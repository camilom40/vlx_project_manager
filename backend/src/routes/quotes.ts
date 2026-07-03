import { Router } from "express";
import { logAudit } from "../lib/audit";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import {
  AppModule,
  ContactChannel,
  QuoteRejectionReason,
  QuoteStatus,
} from "../generated/prisma/enums";

export const quotesRouter = Router();

quotesRouter.use(authenticate);

const quoteInclude = {
  project: {
    select: { id: true, name: true, clientName: true, currency: true },
  },
  quoter: { select: { id: true, name: true } },
  budgetApprovedBy: { select: { id: true, name: true } },
  managementApprovedBy: { select: { id: true, name: true } },
  rejection: true,
  contactLogs: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { contactedAt: "desc" as const },
  },
} as const;

// Listado global (vista admin CRM): pendientes ordenadas por días esperando
quotesRouter.get(
  "/",
  authorize(AppModule.COTIZACIONES, "ver"),
  async (req, res) => {
    const { estado, cotizador, projectId } = req.query;
    const quotes = await prisma.quote.findMany({
      where: {
        status: estado ? (String(estado) as QuoteStatus) : undefined,
        quoterId: cotizador ? String(cotizador) : undefined,
        projectId: projectId ? String(projectId) : undefined,
      },
      include: quoteInclude,
      orderBy: [{ sentAt: "asc" }, { createdAt: "desc" }],
    });
    res.json({ quotes });
  },
);

// Analítica del mini-CRM
quotesRouter.get(
  "/analitica",
  authorize(AppModule.CRM, "ver"),
  async (_req, res) => {
    const quotes = await prisma.quote.findMany({
      include: {
        quoter: { select: { id: true, name: true } },
        rejection: true,
      },
    });
    const porCotizador: Record<
      string,
      {
        nombre: string;
        total: number;
        enviadas: number;
        aceptadas: number;
        rechazadas: number;
        tiemposEntregaDias: number[];
        margenes: number[];
      }
    > = {};
    const rechazosPorRazon: Record<string, number> = {};
    const tiemposRespuestaCliente: number[] = [];
    let margenTotal = 0;
    let margenCount = 0;

    for (const q of quotes) {
      const key = q.quoterId;
      porCotizador[key] ??= {
        nombre: q.quoter.name,
        total: 0,
        enviadas: 0,
        aceptadas: 0,
        rechazadas: 0,
        tiemposEntregaDias: [],
        margenes: [],
      };
      const c = porCotizador[key];
      c.total++;
      if (q.sentAt) c.enviadas++;
      if (q.status === QuoteStatus.ACEPTADA) c.aceptadas++;
      if (q.status === QuoteStatus.RECHAZADA) c.rechazadas++;
      if (q.assignedAt && q.completedAt) {
        c.tiemposEntregaDias.push(
          (q.completedAt.getTime() - q.assignedAt.getTime()) / 86400000,
        );
      }
      c.margenes.push(Number(q.marginPercent));
      margenTotal += Number(q.marginPercent);
      margenCount++;
      if (q.rejection) {
        rechazosPorRazon[q.rejection.reason] =
          (rechazosPorRazon[q.rejection.reason] ?? 0) + 1;
      }
      if (q.sentAt && q.clientRespondedAt) {
        tiemposRespuestaCliente.push(
          (q.clientRespondedAt.getTime() - q.sentAt.getTime()) / 86400000,
        );
      }
    }

    const prom = (xs: number[]) =>
      xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

    res.json({
      cotizadores: Object.entries(porCotizador).map(([id, c]) => ({
        id,
        nombre: c.nombre,
        total: c.total,
        enviadas: c.enviadas,
        aceptadas: c.aceptadas,
        rechazadas: c.rechazadas,
        tasaConversion: c.enviadas ? c.aceptadas / c.enviadas : null,
        tiempoPromedioEntregaDias: prom(c.tiemposEntregaDias),
        margenPromedio: prom(c.margenes),
      })),
      rechazosPorRazon,
      tiempoPromedioRespuestaClienteDias: prom(tiemposRespuestaCliente),
      margenPromedioGlobal: margenCount ? margenTotal / margenCount : null,
      totalCotizaciones: quotes.length,
    });
  },
);

quotesRouter.post(
  "/",
  authorize(AppModule.COTIZACIONES, "editar"),
  async (req, res) => {
    const {
      projectId,
      quoterId,
      amount,
      marginPercent,
      requiresManagementApproval,
    } = req.body ?? {};
    if (!projectId || amount === undefined || marginPercent === undefined) {
      res.status(400).json({
        error: "El proyecto, el monto y el margen son obligatorios.",
      });
      return;
    }
    const project = await prisma.project.findUnique({
      where: { id: String(projectId) },
    });
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado." });
      return;
    }
    const quote = await prisma.quote.create({
      data: {
        projectId: project.id,
        quoterId: quoterId ? String(quoterId) : req.user!.id,
        assignedById: req.user!.id,
        assignedAt: new Date(),
        amount,
        marginPercent,
        requiresManagementApproval: Boolean(requiresManagementApproval),
      },
      include: quoteInclude,
    });
    await logAudit(req.user!.id, "crear_cotizacion", "Quote", quote.id, {
      projectId: project.id,
    });
    res.status(201).json({ quote });
  },
);

quotesRouter.put(
  "/:id",
  authorize(AppModule.COTIZACIONES, "editar"),
  async (req, res) => {
    const { amount, marginPercent, requiresManagementApproval, completed } =
      req.body ?? {};
    const existing = await prisma.quote.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!existing) {
      res.status(404).json({ error: "Cotización no encontrada." });
      return;
    }
    const quote = await prisma.quote.update({
      where: { id: existing.id },
      data: {
        amount: amount !== undefined ? amount : undefined,
        marginPercent: marginPercent !== undefined ? marginPercent : undefined,
        requiresManagementApproval:
          requiresManagementApproval !== undefined
            ? Boolean(requiresManagementApproval)
            : undefined,
        // El cotizador marca que terminó de elaborarla → pasa a revisión
        ...(completed
          ? { completedAt: new Date(), status: QuoteStatus.EN_REVISION }
          : {}),
      },
      include: quoteInclude,
    });
    await logAudit(req.user!.id, "editar_cotizacion", "Quote", quote.id);
    res.json({ quote });
  },
);

// Aprobación: presupuesto siempre; gerencia cuando la cotización lo exige
quotesRouter.post(
  "/:id/aprobar",
  authorize(AppModule.COTIZACIONES, "editar"),
  async (req, res) => {
    const { tipo } = req.body ?? {}; // "presupuesto" | "gerencia"
    const quote = await prisma.quote.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!quote) {
      res.status(404).json({ error: "Cotización no encontrada." });
      return;
    }
    if (tipo === "gerencia" && req.user!.teamName !== "Gerencia") {
      res.status(403).json({
        error: "Solo Gerencia puede dar la aprobación de gerencia.",
      });
      return;
    }
    const data =
      tipo === "gerencia"
        ? {
            managementApprovedById: req.user!.id,
            managementApprovedAt: new Date(),
          }
        : {
            budgetApprovedById: req.user!.id,
            budgetApprovedAt: new Date(),
          };
    let updated = await prisma.quote.update({
      where: { id: quote.id },
      data,
      include: quoteInclude,
    });
    // Queda APROBADA cuando tiene todas las aprobaciones requeridas
    const aprobada =
      updated.budgetApprovedAt &&
      (!updated.requiresManagementApproval || updated.managementApprovedAt);
    if (aprobada && updated.status !== QuoteStatus.APROBADA) {
      updated = await prisma.quote.update({
        where: { id: quote.id },
        data: { status: QuoteStatus.APROBADA },
        include: quoteInclude,
      });
    }
    await logAudit(
      req.user!.id,
      tipo === "gerencia" ? "aprobar_cotizacion_gerencia" : "aprobar_cotizacion_presupuesto",
      "Quote",
      quote.id,
    );
    res.json({ quote: updated });
  },
);

quotesRouter.post(
  "/:id/enviar",
  authorize(AppModule.COTIZACIONES, "editar"),
  async (req, res) => {
    const quote = await prisma.quote.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!quote) {
      res.status(404).json({ error: "Cotización no encontrada." });
      return;
    }
    if (quote.status !== QuoteStatus.APROBADA) {
      res.status(400).json({
        error: "La cotización debe estar aprobada antes de enviarse.",
      });
      return;
    }
    const updated = await prisma.quote.update({
      where: { id: quote.id },
      data: { status: QuoteStatus.ENVIADA, sentAt: new Date() },
      include: quoteInclude,
    });
    await logAudit(req.user!.id, "enviar_cotizacion", "Quote", quote.id);
    res.json({ quote: updated });
  },
);

// Respuesta del cliente: aceptada | rechazada (con razón) | cambios | sin respuesta
quotesRouter.post(
  "/:id/responder",
  authorize(AppModule.COTIZACIONES, "editar"),
  async (req, res) => {
    const { estado, razon, nota } = req.body ?? {};
    const validas = [
      QuoteStatus.ACEPTADA,
      QuoteStatus.RECHAZADA,
      QuoteStatus.CAMBIOS_SOLICITADOS,
      QuoteStatus.SIN_RESPUESTA,
    ] as string[];
    if (!validas.includes(estado)) {
      res.status(400).json({ error: "Estado de respuesta inválido." });
      return;
    }
    const quote = await prisma.quote.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!quote) {
      res.status(404).json({ error: "Cotización no encontrada." });
      return;
    }
    if (
      estado === QuoteStatus.RECHAZADA &&
      !Object.values(QuoteRejectionReason).includes(razon)
    ) {
      res.status(400).json({
        error: "Para rechazar debes indicar la razón del rechazo.",
      });
      return;
    }
    const respondida =
      estado === QuoteStatus.ACEPTADA || estado === QuoteStatus.RECHAZADA;
    const updated = await prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: estado,
        clientRespondedAt: respondida ? new Date() : undefined,
        ...(estado === QuoteStatus.RECHAZADA
          ? {
              rejection: {
                upsert: {
                  create: { reason: razon, note: nota ? String(nota) : null },
                  update: { reason: razon, note: nota ? String(nota) : null },
                },
              },
            }
          : {}),
      },
      include: quoteInclude,
    });
    await logAudit(req.user!.id, "respuesta_cotizacion", "Quote", quote.id, {
      estado,
      razon,
    });
    res.json({ quote: updated });
  },
);

// Bitácora de contactos (mini-CRM)
quotesRouter.post(
  "/:id/contactos",
  authorize(AppModule.CRM, "editar"),
  async (req, res) => {
    const { channel, notes } = req.body ?? {};
    if (!Object.values(ContactChannel).includes(channel) || !notes) {
      res.status(400).json({
        error: "Indica el canal y las notas del contacto.",
      });
      return;
    }
    const quote = await prisma.quote.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!quote) {
      res.status(404).json({ error: "Cotización no encontrada." });
      return;
    }
    const log = await prisma.quoteContactLog.create({
      data: {
        quoteId: quote.id,
        userId: req.user!.id,
        channel,
        notes: String(notes),
      },
      include: { user: { select: { id: true, name: true } } },
    });
    await logAudit(req.user!.id, "registrar_contacto", "Quote", quote.id);
    res.status(201).json({ log });
  },
);
