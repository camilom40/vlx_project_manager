import { Router } from "express";
import { logAudit } from "../lib/audit";
import { notify, projectRoleUserIds, teamMemberIds } from "../lib/notifications";
import { parseFecha } from "../lib/fechas";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { can, MANAGEMENT_TEAM } from "../lib/permissions";
import {
  anticipoVerificado,
  comprasLiberadas,
  contratoRequiereAccion,
  polizasResueltas,
  puedeRevisarContrato,
} from "../lib/responsabilidad";
import {
  AdvanceStatus,
  AppModule,
  ContractStatus,
  PolicyStatus,
  PurchaseCategory,
  PurchaseStatus,
} from "../generated/prisma/enums";

// Contrato, pólizas, anticipos y compras (Etapa 2 del flujo)
export const etapa2Router = Router();

etapa2Router.use(authenticate);

// Candado de compras: si el contrato está firmado y ya se resolvieron pólizas
// y anticipo (o van marcados como no requeridos), avisa a Compras una sola vez.
// Se llama tras firmar, tras mover una póliza/anticipo y tras la excepción de
// inicio sin anticipo. Fuente de la regla: lib/responsabilidad (comprasLiberadas).
export async function revisarCandadoCompras(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      contracts: true,
      policies: { select: { status: true } },
      advances: { select: { status: true } },
    },
  });
  if (!project || project.purchasingUnlockedNotifiedAt) return;
  const firmado = project.contracts
    .filter((c) => c.status === ContractStatus.FIRMADO)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  if (!firmado) return;
  const liberadas = comprasLiberadas({
    requiresPolicy: firmado.requiresPolicy,
    requiresAdvance: firmado.requiresAdvance,
    polizasResueltas: polizasResueltas(project.policies),
    anticipoVerificado: anticipoVerificado(project.advances),
    earlyStartWithoutAdvance: project.earlyStartWithoutAdvance,
  });
  if (!liberadas) return;
  await prisma.project.update({
    where: { id: project.id },
    data: { purchasingUnlockedNotifiedAt: new Date() },
  });
  const compras = await teamMemberIds("Compras");
  // Se espera (no fire-and-forget): este aviso es el objetivo del handoff a
  // Compras y solo ocurre una vez por proyecto. notify es resiliente sin SMTP.
  await notify(
    compras,
    "compras.habilitadas",
    `Compras habilitadas: ${project.name}`,
    `El proyecto "${project.name}" ya cumple sus requisitos de pólizas y anticipo. Compras puede proceder con la compra de material.`,
    project.id,
  );
}

// ---------- Contratos ----------

etapa2Router.get("/projects/:id/contrato", async (req, res) => {
  const projectId = String(req.params.id);
  const [contracts, policies, advances] = await Promise.all([
    prisma.contract.findMany({
      where: { projectId },
      include: {
        reviewedBy: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
        policies: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.policy.findMany({ where: { projectId }, select: { status: true } }),
    prisma.advance.findMany({ where: { projectId }, select: { status: true } }),
  ]);
  // El módulo Contratos, o ser el revisor asignado de algún contrato del proyecto
  const esRevisorDelProyecto = contracts.some(
    (c) => c.reviewerId === req.user!.id,
  );
  if (
    !can(req.user!.permissions, AppModule.CONTRATOS, "ver") &&
    !esRevisorDelProyecto
  ) {
    res.status(403).json({ error: "No tienes permiso para ver el contrato." });
    return;
  }
  const pr = polizasResueltas(policies);
  const av = anticipoVerificado(advances);
  const withFlag = contracts.map((c) => ({
    ...c,
    requiereAccion: contratoRequiereAccion(req.user!, {
      status: c.status,
      reviewerId: c.reviewerId,
      requiresPolicy: c.requiresPolicy,
      requiresAdvance: c.requiresAdvance,
      polizasResueltas: pr,
      anticipoResuelto: av,
    }),
  }));
  res.json({ contracts: withFlag });
});

etapa2Router.post(
  "/projects/:id/contrato",
  authorize(AppModule.CONTRATOS, "editar"),
  async (req, res) => {
    const { deliveryTermDays, receivedAt } = req.body ?? {};
    const project = await prisma.project.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado." });
      return;
    }
    const contract = await prisma.contract.create({
      data: {
        projectId: project.id,
        deliveryTermDays: deliveryTermDays ? Number(deliveryTermDays) : null,
        receivedAt: receivedAt ? parseFecha(receivedAt) : new Date(),
      },
    });
    await logAudit(req.user!.id, "registrar_contrato", "Contract", contract.id);
    res.status(201).json({ contract });
  },
);

// Asignar revisor: el receptor (Contratos editar) elige a cualquier usuario;
// el contrato pasa a EN_REVISION y se le notifica.
etapa2Router.post(
  "/projects/:id/contrato/:cid/asignar-revisor",
  authorize(AppModule.CONTRATOS, "editar"),
  async (req, res) => {
    const { reviewerId } = req.body ?? {};
    if (!reviewerId) {
      res.status(400).json({ error: "Debes elegir un revisor." });
      return;
    }
    const contract = await prisma.contract.findUnique({
      where: { id: String(req.params.cid) },
      include: { project: { select: { id: true, name: true } } },
    });
    if (!contract || contract.projectId !== String(req.params.id)) {
      res.status(404).json({ error: "Contrato no encontrado." });
      return;
    }
    if (contract.status === ContractStatus.FIRMADO) {
      res.status(400).json({ error: "El contrato ya está firmado." });
      return;
    }
    const reviewer = await prisma.user.findFirst({
      where: { id: String(reviewerId), isActive: true },
      select: { id: true, name: true },
    });
    if (!reviewer) {
      res.status(400).json({ error: "El revisor seleccionado no existe." });
      return;
    }
    const updated = await prisma.contract.update({
      where: { id: contract.id },
      data: { reviewerId: reviewer.id, status: ContractStatus.EN_REVISION },
      include: {
        reviewedBy: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
        policies: true,
      },
    });
    await logAudit(req.user!.id, "asignar_revisor_contrato", "Contract", contract.id, {
      reviewerId: reviewer.id,
    });
    void notify(
      [reviewer.id],
      "contrato.revisor_asignado",
      `Revisión de contrato: ${contract.project.name}`,
      `Te asignaron la revisión del contrato de "${contract.project.name}". Registra el valor del anticipo y las pólizas requeridas, y envíalo a firma.`,
      contract.projectId,
    );
    res.json({ contract: updated });
  },
);

// Guardar la revisión: el revisor asignado registra el valor del anticipo y las
// pólizas requeridas (nombre obligatorio, valor opcional), o marca "sin póliza"
// / "sin anticipo". No cambia de estado por sí solo.
etapa2Router.put("/contratos/:id/revision", async (req, res) => {
  const {
    advanceValue,
    requiresAdvance,
    requiresPolicy,
    polizas,
    deliveryTermDays,
  } = req.body ?? {};
  const contract = await prisma.contract.findUnique({
    where: { id: String(req.params.id) },
    include: { project: { select: { id: true } }, policies: true },
  });
  if (!contract) {
    res.status(404).json({ error: "Contrato no encontrado." });
    return;
  }
  if (!puedeRevisarContrato(req.user!, contract)) {
    res
      .status(403)
      .json({ error: "Solo el revisor asignado puede editar la revisión." });
    return;
  }
  if (contract.status === ContractStatus.FIRMADO) {
    res.status(400).json({ error: "El contrato ya está firmado." });
    return;
  }
  const pideAnticipo = requiresAdvance !== false;
  const pidePoliza = requiresPolicy !== false;

  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      requiresAdvance: pideAnticipo,
      requiresPolicy: pidePoliza,
      deliveryTermDays:
        deliveryTermDays !== undefined
          ? deliveryTermDays
            ? Number(deliveryTermDays)
            : null
          : undefined,
    },
  });

  // Pólizas requeridas: crear las nuevas (nombre obligatorio, valor opcional)
  if (pidePoliza && Array.isArray(polizas)) {
    for (const p of polizas as { type?: string; value?: unknown }[]) {
      if (!p?.type || !String(p.type).trim()) continue;
      await prisma.policy.create({
        data: {
          projectId: contract.projectId,
          contractId: contract.id,
          type: String(p.type).trim(),
          value:
            p.value !== undefined && p.value !== null && p.value !== ""
              ? (p.value as string)
              : null,
        },
      });
    }
  }

  // Valor del anticipo: crea la cuenta de cobro si aún no existe
  if (pideAnticipo && advanceValue !== undefined && advanceValue !== null && advanceValue !== "") {
    const yaHay = await prisma.advance.count({
      where: { projectId: contract.projectId },
    });
    if (yaHay === 0) {
      await prisma.advance.create({
        data: { projectId: contract.projectId, value: String(advanceValue) },
      });
    }
  }

  await logAudit(req.user!.id, "guardar_revision_contrato", "Contract", contract.id);
  const actualizado = await prisma.contract.findUnique({
    where: { id: contract.id },
    include: {
      reviewedBy: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
      policies: true,
    },
  });
  res.json({ contract: actualizado });
});

// Transiciones de estado del contrato con responsabilidad por rol:
// - PENDIENTE_FIRMA: solo el revisor asignado (envía a firma → avisa a Gerencia)
// - FIRMADO / RECHAZADO_CON_OBSERVACIONES: solo Gerencia
// - RECIBIDO (versión corregida): el revisor o quien tenga Contratos editar
etapa2Router.put("/contratos/:id", async (req, res) => {
  const { status, observations, deliveryTermDays } = req.body ?? {};
  if (status && !Object.values(ContractStatus).includes(status)) {
    res.status(400).json({ error: "Estado de contrato inválido." });
    return;
  }
  const contract = await prisma.contract.findUnique({
    where: { id: String(req.params.id) },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!contract) {
    res.status(404).json({ error: "Contrato no encontrado." });
    return;
  }

  const esGerencia = req.user!.teamName === MANAGEMENT_TEAM;
  const esRevisor = contract.reviewerId === req.user!.id;

  // Autorización por transición
  if (status === ContractStatus.PENDIENTE_FIRMA) {
    if (!esRevisor && !esGerencia) {
      res
        .status(403)
        .json({ error: "Solo el revisor asignado puede enviar a firma." });
      return;
    }
    if (contract.status !== ContractStatus.EN_REVISION) {
      res.status(400).json({ error: "El contrato no está en revisión." });
      return;
    }
  } else if (
    status === ContractStatus.FIRMADO ||
    status === ContractStatus.RECHAZADO_CON_OBSERVACIONES
  ) {
    if (!esGerencia) {
      res
        .status(403)
        .json({ error: "Solo Gerencia puede firmar o rechazar el contrato." });
      return;
    }
    if (contract.status !== ContractStatus.PENDIENTE_FIRMA) {
      res
        .status(400)
        .json({ error: "El contrato debe estar pendiente de firma." });
      return;
    }
  } else {
    // Edición de campos / versión corregida
    if (!puedeRevisarContrato(req.user!, contract)) {
      res.status(403).json({ error: "No tienes permiso para editar el contrato." });
      return;
    }
  }

  if (status === ContractStatus.RECHAZADO_CON_OBSERVACIONES && !observations) {
    res.status(400).json({
      error: "Para rechazar el contrato debes indicar las observaciones.",
    });
    return;
  }

  const updated = await prisma.contract.update({
    where: { id: contract.id },
    data: {
      status: status ?? undefined,
      observations:
        observations !== undefined ? String(observations) : undefined,
      deliveryTermDays:
        deliveryTermDays !== undefined ? Number(deliveryTermDays) : undefined,
      reviewedById:
        status === ContractStatus.FIRMADO ? req.user!.id : undefined,
      reviewSubmittedAt:
        status === ContractStatus.PENDIENTE_FIRMA ? new Date() : undefined,
      signedAt: status === ContractStatus.FIRMADO ? new Date() : undefined,
    },
    include: {
      reviewedBy: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
      policies: true,
    },
  });
  await logAudit(req.user!.id, "actualizar_contrato", "Contract", contract.id, {
    status,
  });

  const project = contract.project;
  if (status === ContractStatus.PENDIENTE_FIRMA) {
    // El revisor terminó → Gerencia firma o rechaza
    const gerencia = await teamMemberIds(MANAGEMENT_TEAM);
    void notify(
      gerencia,
      "contrato.pendiente_firma",
      `Contrato pendiente de firma: ${project.name}`,
      `El revisor terminó la revisión del contrato de "${project.name}". Gerencia debe firmarlo o rechazarlo con observaciones.`,
      contract.projectId,
    );
  } else if (status === ContractStatus.RECHAZADO_CON_OBSERVACIONES) {
    // Gerencia rechazó → vuelve al revisor
    if (contract.reviewerId) {
      void notify(
        [contract.reviewerId],
        "contrato.rechazado",
        `Contrato rechazado: ${project.name}`,
        `Gerencia rechazó el contrato de "${project.name}" con observaciones: ${observations}`,
        contract.projectId,
      );
    }
  } else if (status === ContractStatus.FIRMADO) {
    // Gerencia firmó → Tesorería solicita pólizas, Contabilidad genera la
    // cuenta de cobro del anticipo, Planeación arranca el despiece.
    const planeacion = await teamMemberIds("Planeación");
    const contabilidad = await teamMemberIds("Contabilidad");
    const tesoreria = await teamMemberIds("Tesorería");
    const planeador = await projectRoleUserIds(contract.projectId, ["PLANEADOR"]);
    void notify(
      [...planeacion, ...planeador],
      "contrato.firmado",
      `Contrato firmado: ${project.name}`,
      `Gerencia firmó el contrato de "${project.name}". Pueden iniciar el despiece.`,
      contract.projectId,
    );
    void notify(
      [...tesoreria, ...contabilidad],
      "contrato.firmado",
      `Pólizas y anticipo: ${project.name}`,
      `Se firmó el contrato de "${project.name}". Tesorería solicita las pólizas y Contabilidad gestiona la cuenta de cobro del anticipo.`,
      contract.projectId,
    );
    // Puede quedar liberado de inmediato (contrato sin póliza y sin anticipo)
    await revisarCandadoCompras(contract.projectId);
  }
  res.json({ contract: updated });
});

// ---------- Pólizas ----------

etapa2Router.get(
  "/projects/:id/polizas",
  authorize(AppModule.POLIZAS, "ver"),
  async (req, res) => {
    const policies = await prisma.policy.findMany({
      where: { projectId: String(req.params.id) },
      orderBy: { createdAt: "asc" },
    });
    res.json({ policies });
  },
);

etapa2Router.post(
  "/projects/:id/polizas",
  authorize(AppModule.POLIZAS, "editar"),
  async (req, res) => {
    const { type, insurer, value, contractId } = req.body ?? {};
    if (!type) {
      res.status(400).json({ error: "El tipo de póliza es obligatorio." });
      return;
    }
    const policy = await prisma.policy.create({
      data: {
        projectId: String(req.params.id),
        contractId: contractId ? String(contractId) : null,
        type: String(type),
        insurer: insurer ? String(insurer) : null,
        value: value ?? null,
      },
    });
    await logAudit(req.user!.id, "crear_poliza", "Policy", policy.id);
    res.status(201).json({ policy });
  },
);

etapa2Router.put(
  "/polizas/:id",
  authorize(AppModule.POLIZAS, "editar"),
  async (req, res) => {
    const { status, insurer, value } = req.body ?? {};
    if (status && !Object.values(PolicyStatus).includes(status)) {
      res.status(400).json({ error: "Estado de póliza inválido." });
      return;
    }
    const policy = await prisma.policy.update({
      where: { id: String(req.params.id) },
      data: {
        status: status ?? undefined,
        insurer: insurer !== undefined ? String(insurer) : undefined,
        value: value !== undefined ? value : undefined,
      },
    });
    await logAudit(req.user!.id, "actualizar_poliza", "Policy", policy.id, {
      status,
    });
    // Puede liberar el candado de compras (pólizas resueltas)
    await revisarCandadoCompras(policy.projectId);
    res.json({ policy });
  },
);

// ---------- Anticipos ----------

etapa2Router.get(
  "/projects/:id/anticipos",
  authorize(AppModule.ANTICIPOS, "ver"),
  async (req, res) => {
    const advances = await prisma.advance.findMany({
      where: { projectId: String(req.params.id) },
      include: { verifiedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json({ advances });
  },
);

etapa2Router.post(
  "/projects/:id/anticipos",
  authorize(AppModule.ANTICIPOS, "editar"),
  async (req, res) => {
    const { value } = req.body ?? {};
    if (value === undefined) {
      res.status(400).json({ error: "El valor del anticipo es obligatorio." });
      return;
    }
    const advance = await prisma.advance.create({
      data: { projectId: String(req.params.id), value },
    });
    await logAudit(
      req.user!.id,
      "generar_cuenta_cobro_anticipo",
      "Advance",
      advance.id,
    );
    res.status(201).json({ advance });
  },
);

etapa2Router.put(
  "/anticipos/:id",
  authorize(AppModule.ANTICIPOS, "editar"),
  async (req, res) => {
    const { status, receiptUrl } = req.body ?? {};
    if (status && !Object.values(AdvanceStatus).includes(status)) {
      res.status(400).json({ error: "Estado de anticipo inválido." });
      return;
    }
    const advance = await prisma.advance.update({
      where: { id: String(req.params.id) },
      data: {
        status: status ?? undefined,
        receiptUrl: receiptUrl !== undefined ? String(receiptUrl) : undefined,
        sentAt:
          status === AdvanceStatus.ENVIADO_AL_CLIENTE ? new Date() : undefined,
        depositedAt:
          status === AdvanceStatus.CONSIGNADO ? new Date() : undefined,
        ...(status === AdvanceStatus.VERIFICADO
          ? { verifiedAt: new Date(), verifiedById: req.user!.id }
          : {}),
      },
    });
    await logAudit(req.user!.id, "actualizar_anticipo", "Advance", advance.id, {
      status,
    });
    if (status === AdvanceStatus.VERIFICADO) {
      // Anticipo verificado en banco → Presupuesto informa a Planeación
      const project = await prisma.project.findUnique({
        where: { id: advance.projectId },
      });
      const presupuesto = await teamMemberIds("Presupuesto");
      const planeacion = await teamMemberIds("Planeación");
      void notify(
        [...presupuesto, ...planeacion],
        "anticipo.verificado",
        `Anticipo verificado: ${project?.name}`,
        `El anticipo del proyecto "${project?.name}" fue verificado en el banco. La operación puede arrancar.`,
        advance.projectId,
      );
      // Puede liberar el candado de compras (anticipo verificado)
      await revisarCandadoCompras(advance.projectId);
    }
    res.json({ advance });
  },
);

// ---------- Compras ----------

etapa2Router.get(
  "/projects/:id/compras",
  authorize(AppModule.COMPRAS, "ver"),
  async (req, res) => {
    const purchases = await prisma.purchase.findMany({
      where: { projectId: String(req.params.id) },
      orderBy: { createdAt: "asc" },
    });
    res.json({ purchases });
  },
);

etapa2Router.post(
  "/projects/:id/compras",
  authorize(AppModule.COMPRAS, "editar"),
  async (req, res) => {
    const { supplier, category, obraPercent, expectedDeliveryAt, notes } =
      req.body ?? {};
    if (!supplier || !Object.values(PurchaseCategory).includes(category)) {
      res.status(400).json({
        error: "El proveedor y la categoría son obligatorios.",
      });
      return;
    }
    // Verificar la excepción de inicio sin anticipo
    const project = await prisma.project.findUnique({
      where: { id: String(req.params.id) },
      include: { advances: true, contracts: true },
    });
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado." });
      return;
    }
    const anticipoOk = project.advances.some(
      (a) => a.status === AdvanceStatus.VERIFICADO,
    );
    // El contrato firmado puede ir marcado "sin anticipo" (requiresAdvance=false)
    const sinAnticipo = project.contracts.some(
      (c) => c.status === ContractStatus.FIRMADO && !c.requiresAdvance,
    );
    if (!anticipoOk && !sinAnticipo && !project.earlyStartWithoutAdvance) {
      res.status(400).json({
        error:
          "El anticipo aún no está verificado. Gerencia puede autorizar el inicio sin anticipo (cliente de confianza) desde la ficha del proyecto.",
      });
      return;
    }
    const purchase = await prisma.purchase.create({
      data: {
        projectId: project.id,
        supplier: String(supplier).trim(),
        category,
        obraPercent: obraPercent ?? 0,
        expectedDeliveryAt: expectedDeliveryAt
          ? new Date(expectedDeliveryAt)
          : null,
        notes: notes ? String(notes) : null,
      },
    });
    await logAudit(req.user!.id, "crear_compra", "Purchase", purchase.id);
    res.status(201).json({ purchase });
  },
);

etapa2Router.put(
  "/compras/:id",
  authorize(AppModule.COMPRAS, "editar"),
  async (req, res) => {
    const { status, obraPercent, expectedDeliveryAt, actualDeliveryAt, notes } =
      req.body ?? {};
    if (status && !Object.values(PurchaseStatus).includes(status)) {
      res.status(400).json({ error: "Estado de compra inválido." });
      return;
    }
    const purchase = await prisma.purchase.update({
      where: { id: String(req.params.id) },
      data: {
        status: status ?? undefined,
        obraPercent: obraPercent !== undefined ? obraPercent : undefined,
        orderedAt: status === PurchaseStatus.ORDENADA ? new Date() : undefined,
        expectedDeliveryAt:
          expectedDeliveryAt !== undefined
            ? expectedDeliveryAt
              ? new Date(expectedDeliveryAt)
              : null
            : undefined,
        actualDeliveryAt:
          actualDeliveryAt !== undefined
            ? actualDeliveryAt
              ? new Date(actualDeliveryAt)
              : null
            : undefined,
        notes: notes !== undefined ? (notes ? String(notes) : null) : undefined,
      },
    });
    await logAudit(req.user!.id, "actualizar_compra", "Purchase", purchase.id, {
      status,
    });
    res.json({ purchase });
  },
);
