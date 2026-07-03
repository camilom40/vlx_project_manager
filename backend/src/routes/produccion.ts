import { Router } from "express";
import { logAudit } from "../lib/audit";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import {
  AppModule,
  DTStatus,
  Priority,
  ProjectStage,
  RemisionStatus,
  ReworkType,
} from "../generated/prisma/enums";

// Etapa 3: Acta de Vanos → DTs → producción → remisión (+ retrocesos)
export const produccionRouter = Router();

produccionRouter.use(authenticate);

// Cola global de producción: actas dormidas y DTs por fecha requerida
produccionRouter.get(
  "/produccion/cola",
  authorize(AppModule.PRODUCCION, "ver"),
  async (_req, res) => {
    const [actasSinDts, dts] = await Promise.all([
      prisma.actaVanos.findMany({
        where: { dts: { none: {} } },
        include: {
          project: { select: { id: true, name: true, clientName: true } },
          supervisor: { select: { id: true, name: true } },
        },
        orderBy: { surveyedAt: "asc" },
      }),
      prisma.dT.findMany({
        where: { status: { not: DTStatus.DESPACHADO } },
        include: {
          project: { select: { id: true, name: true } },
        },
        orderBy: [{ requiredDeliveryDate: "asc" }],
      }),
    ]);
    res.json({ actasSinDts, dts });
  },
);

// ---------- Actas de Vanos ----------

produccionRouter.get(
  "/projects/:id/actas-vanos",
  authorize(AppModule.PRODUCCION, "ver"),
  async (req, res) => {
    const actas = await prisma.actaVanos.findMany({
      where: { projectId: String(req.params.id) },
      include: {
        supervisor: { select: { id: true, name: true } },
        dts: { select: { id: true, code: true, status: true } },
      },
      orderBy: { surveyedAt: "desc" },
    });
    res.json({ actas });
  },
);

produccionRouter.post(
  "/projects/:id/actas-vanos",
  authorize(AppModule.PRODUCCION, "editar"),
  async (req, res) => {
    const { details, surveyedAt, requiredDeliveryNotes, priority } =
      req.body ?? {};
    if (!details) {
      res.status(400).json({
        error: "El detalle de vanos y medidas es obligatorio.",
      });
      return;
    }
    const project = await prisma.project.findUnique({
      where: { id: String(req.params.id) },
      include: {
        assignments: { where: { role: "SUPERVISOR" }, take: 1 },
      },
    });
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado." });
      return;
    }
    const acta = await prisma.actaVanos.create({
      data: {
        projectId: project.id,
        supervisorId: project.assignments[0]?.userId ?? req.user!.id,
        details,
        surveyedAt: surveyedAt ? new Date(surveyedAt) : new Date(),
        requiredDeliveryNotes: requiredDeliveryNotes
          ? String(requiredDeliveryNotes)
          : null,
        priority: Object.values(Priority).includes(priority)
          ? priority
          : Priority.MEDIA,
      },
    });
    await logAudit(req.user!.id, "levantar_acta_vanos", "ActaVanos", acta.id);
    res.status(201).json({ acta });
  },
);

// ---------- DTs ----------

produccionRouter.get(
  "/projects/:id/dts",
  authorize(AppModule.PRODUCCION, "ver"),
  async (req, res) => {
    const dts = await prisma.dT.findMany({
      where: { projectId: String(req.params.id) },
      include: {
        actaVanos: { select: { id: true, surveyedAt: true } },
        remision: { select: { id: true, dispatchedAt: true, status: true } },
      },
      orderBy: { requiredDeliveryDate: "asc" },
    });
    res.json({ dts });
  },
);

produccionRouter.post(
  "/projects/:id/dts",
  authorize(AppModule.PRODUCCION, "editar"),
  async (req, res) => {
    const { actaVanosId, despiece, requiredDeliveryDate, priority, code } =
      req.body ?? {};
    if (!despiece || !requiredDeliveryDate) {
      res.status(400).json({
        error:
          "El despiece y la fecha de entrega requerida son obligatorios en todo DT.",
      });
      return;
    }
    const count = await prisma.dT.count();
    const dt = await prisma.dT.create({
      data: {
        projectId: String(req.params.id),
        actaVanosId: actaVanosId ? String(actaVanosId) : null,
        code: code ? String(code) : `DT-${String(count + 1).padStart(4, "0")}`,
        despiece,
        requiredDeliveryDate: new Date(requiredDeliveryDate),
        priority: Object.values(Priority).includes(priority)
          ? priority
          : Priority.MEDIA,
      },
    });
    await logAudit(req.user!.id, "generar_dt", "DT", dt.id);
    res.status(201).json({ dt });
  },
);

produccionRouter.put(
  "/dts/:id",
  authorize(AppModule.PRODUCCION, "editar"),
  async (req, res) => {
    const { status, priority, requiredDeliveryDate, despiece } = req.body ?? {};
    if (status && !Object.values(DTStatus).includes(status)) {
      res.status(400).json({ error: "Estado de DT inválido." });
      return;
    }
    const dt = await prisma.dT.update({
      where: { id: String(req.params.id) },
      data: {
        status: status ?? undefined,
        priority: priority ?? undefined,
        requiredDeliveryDate: requiredDeliveryDate
          ? new Date(requiredDeliveryDate)
          : undefined,
        despiece: despiece ?? undefined,
        queuedAt: status === DTStatus.EN_COLA ? new Date() : undefined,
        productionStartedAt:
          status === DTStatus.EN_PRODUCCION ? new Date() : undefined,
        finishedAt: status === DTStatus.TERMINADO ? new Date() : undefined,
      },
    });
    await logAudit(req.user!.id, "actualizar_dt", "DT", dt.id, { status });
    res.json({ dt });
  },
);

// ---------- Remisiones ----------

produccionRouter.get(
  "/projects/:id/remisiones",
  authorize(AppModule.PRODUCCION, "ver"),
  async (req, res) => {
    const remisiones = await prisma.remision.findMany({
      where: { projectId: String(req.params.id) },
      include: {
        dts: { select: { id: true, code: true } },
        signedBy: { select: { id: true, name: true } },
        reworkErrors: true,
      },
      orderBy: { dispatchedAt: "desc" },
    });
    res.json({ remisiones });
  },
);

produccionRouter.post(
  "/projects/:id/remisiones",
  authorize(AppModule.PRODUCCION, "editar"),
  async (req, res) => {
    const { destination, dtIds, dispatchedAt } = req.body ?? {};
    if (!destination || !Array.isArray(dtIds) || dtIds.length === 0) {
      res.status(400).json({
        error: "Indica el destino y al menos un DT terminado para despachar.",
      });
      return;
    }
    const dts = await prisma.dT.findMany({
      where: { id: { in: dtIds.map(String) } },
    });
    const noTerminados = dts.filter((d) => d.status !== DTStatus.TERMINADO);
    if (noTerminados.length > 0) {
      res.status(400).json({
        error: `Solo se despachan DTs terminados. Pendientes: ${noTerminados
          .map((d) => d.code ?? d.id)
          .join(", ")}.`,
      });
      return;
    }
    const remision = await prisma.remision.create({
      data: {
        projectId: String(req.params.id),
        destination: String(destination).trim(),
        dispatchedAt: dispatchedAt ? new Date(dispatchedAt) : new Date(),
        dts: { connect: dtIds.map((id: string) => ({ id: String(id) })) },
      },
      include: { dts: { select: { id: true, code: true } } },
    });
    await prisma.dT.updateMany({
      where: { id: { in: dtIds.map(String) } },
      data: { status: DTStatus.DESPACHADO },
    });
    await logAudit(req.user!.id, "despachar_remision", "Remision", remision.id);
    res.status(201).json({ remision });
  },
);

// Recepción en obra: conforme o con observaciones (genera retroceso)
produccionRouter.post(
  "/remisiones/:id/recibir",
  authorize(AppModule.PRODUCCION, "editar"),
  async (req, res) => {
    const { conforme, observations, retroceso } = req.body ?? {};
    const remision = await prisma.remision.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!remision) {
      res.status(404).json({ error: "Remisión no encontrada." });
      return;
    }
    const updated = await prisma.remision.update({
      where: { id: remision.id },
      data: {
        status: conforme
          ? RemisionStatus.RECIBIDO_CONFORME
          : RemisionStatus.RECIBIDO_CON_OBSERVACIONES,
        observations: observations ? String(observations) : null,
        signedById: req.user!.id,
      },
    });
    // Devolución: daño de transporte (jefe de planta repone) o error técnico (planeación investiga)
    let error = null;
    if (!conforme && retroceso) {
      const tipo = Object.values(ReworkType).includes(retroceso.tipo)
        ? retroceso.tipo
        : ReworkType.OTRO;
      error = await prisma.reworkError.create({
        data: {
          projectId: remision.projectId,
          type: tipo,
          stage: ProjectStage.PRODUCCION,
          occurredAt: new Date(),
          description:
            String(retroceso.descripcion ?? observations ?? "Devolución en obra"),
          remisionId: remision.id,
          responsibleId: retroceso.responsableId
            ? String(retroceso.responsableId)
            : null,
          reportedById: req.user!.id,
          costImpact: retroceso.costoImpacto ?? null,
          delayImpactDays: retroceso.diasAtraso
            ? Number(retroceso.diasAtraso)
            : null,
        },
      });
    }
    await logAudit(req.user!.id, "recibir_remision", "Remision", remision.id, {
      conforme: Boolean(conforme),
    });
    res.json({ remision: updated, reworkError: error });
  },
);
