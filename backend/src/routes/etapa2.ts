import { Router } from "express";
import { logAudit } from "../lib/audit";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
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

// ---------- Contratos ----------

etapa2Router.get(
  "/projects/:id/contrato",
  authorize(AppModule.CONTRATOS, "ver"),
  async (req, res) => {
    const contracts = await prisma.contract.findMany({
      where: { projectId: String(req.params.id) },
      include: {
        reviewedBy: { select: { id: true, name: true } },
        policies: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ contracts });
  },
);

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
        receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      },
    });
    await logAudit(req.user!.id, "registrar_contrato", "Contract", contract.id);
    res.status(201).json({ contract });
  },
);

// Transiciones: en revisión → rechazado con observaciones | firmado
etapa2Router.put(
  "/contratos/:id",
  authorize(AppModule.CONTRATOS, "editar"),
  async (req, res) => {
    const { status, observations, deliveryTermDays } = req.body ?? {};
    if (status && !Object.values(ContractStatus).includes(status)) {
      res.status(400).json({ error: "Estado de contrato inválido." });
      return;
    }
    const contract = await prisma.contract.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!contract) {
      res.status(404).json({ error: "Contrato no encontrado." });
      return;
    }
    if (
      status === ContractStatus.RECHAZADO_CON_OBSERVACIONES &&
      !observations
    ) {
      res.status(400).json({
        error: "Para rechazar el contrato debes indicar las observaciones.",
      });
      return;
    }
    if (status === ContractStatus.FIRMADO && req.user!.teamName !== "Gerencia") {
      res.status(403).json({ error: "Solo Gerencia puede firmar contratos." });
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
          status === ContractStatus.EN_REVISION ? req.user!.id : undefined,
        signedAt: status === ContractStatus.FIRMADO ? new Date() : undefined,
      },
    });
    await logAudit(req.user!.id, "actualizar_contrato", "Contract", contract.id, {
      status,
    });
    res.json({ contract: updated });
  },
);

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
      include: { advances: true },
    });
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado." });
      return;
    }
    const anticipoVerificado = project.advances.some(
      (a) => a.status === AdvanceStatus.VERIFICADO,
    );
    if (!anticipoVerificado && !project.earlyStartWithoutAdvance) {
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
