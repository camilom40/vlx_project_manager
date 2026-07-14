import { Router } from "express";
import { logAudit } from "../lib/audit";
import { notify, teamLeadIds, teamMemberIds } from "../lib/notifications";
import { BUDGET_TEAM, MANAGEMENT_TEAM } from "../lib/permissions";
import { prisma } from "../lib/prisma";
import { Prisma } from "../generated/prisma/client";
import { authenticate, authorize, AuthUser } from "../middleware/auth";
import {
  AppModule,
  Company,
  ContactChannel,
  Currency,
  Market,
  ProjectStage,
  ProjectType,
  QuoteRejectionReason,
  QuoteStatus,
} from "../generated/prisma/enums";

export const quotesRouter = Router();

quotesRouter.use(authenticate);

const quoteInclude = {
  project: {
    select: { id: true, name: true, currentStage: true },
  },
  client: { select: { id: true, name: true } },
  quoter: { select: { id: true, name: true } },
  assignedBy: { select: { id: true, name: true } },
  budgetApprovedBy: { select: { id: true, name: true } },
  managementApprovedBy: { select: { id: true, name: true } },
  rejection: true,
  contactLogs: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { contactedAt: "desc" as const },
  },
} as const;

// ¿Puede asignar cotizaciones? Gerencia o líder del equipo Presupuesto
function canAssignQuotes(user: AuthUser): boolean {
  return (
    user.teamName === MANAGEMENT_TEAM ||
    (user.isTeamLead && user.teamName === BUDGET_TEAM)
  );
}

// ¿Puede trabajar esta cotización? Quien asigna, o el cotizador responsable
function canManageQuote(user: AuthUser, quote: { quoterId: string | null }): boolean {
  return canAssignQuotes(user) || quote.quoterId === user.id;
}

// Cliente: seleccionado del módulo de clientes, o nombre libre
async function resolveClient(
  clientId: unknown,
  clientName: unknown,
): Promise<{ clientId: string | null; clientName: string | null } | null> {
  if (clientId) {
    const client = await prisma.client.findUnique({
      where: { id: String(clientId) },
    });
    if (!client) return null;
    return { clientId: client.id, clientName: client.name };
  }
  if (clientName && String(clientName).trim()) {
    return { clientId: null, clientName: String(clientName).trim() };
  }
  return { clientId: null, clientName: null };
}

// Listado global del tablero de cotizaciones
quotesRouter.get(
  "/",
  authorize(AppModule.COTIZACIONES, "ver"),
  async (req, res) => {
    const { estado, cotizador, sinAsignar, buscar } = req.query;
    const quotes = await prisma.quote.findMany({
      where: {
        status: estado ? (String(estado) as QuoteStatus) : undefined,
        quoterId: sinAsignar
          ? null
          : cotizador
            ? String(cotizador)
            : undefined,
        ...(buscar
          ? {
              OR: [
                { title: { contains: String(buscar), mode: "insensitive" as const } },
                {
                  clientName: {
                    contains: String(buscar),
                    mode: "insensitive" as const,
                  },
                },
              ],
            }
          : {}),
      },
      include: quoteInclude,
      orderBy: [{ sentAt: "asc" }, { receivedAt: "asc" }],
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
    const tiemposAsignacion: number[] = [];
    const tiemposCiclo: number[] = [];
    let sinAsignar = 0;
    let margenTotal = 0;
    let margenCount = 0;

    for (const q of quotes) {
      if (!q.quoterId) sinAsignar++;
      if (q.assignedAt) {
        tiemposAsignacion.push(
          (q.assignedAt.getTime() - q.receivedAt.getTime()) / 86400000,
        );
      }
      if (q.sentAt) {
        tiemposCiclo.push(
          (q.sentAt.getTime() - q.receivedAt.getTime()) / 86400000,
        );
      }
      if (q.rejection) {
        rechazosPorRazon[q.rejection.reason] =
          (rechazosPorRazon[q.rejection.reason] ?? 0) + 1;
      }
      if (q.sentAt && q.clientRespondedAt) {
        tiemposRespuestaCliente.push(
          (q.clientRespondedAt.getTime() - q.sentAt.getTime()) / 86400000,
        );
      }
      if (q.marginPercent !== null) {
        margenTotal += Number(q.marginPercent);
        margenCount++;
      }
      if (!q.quoterId || !q.quoter) continue;
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
      if (q.marginPercent !== null) c.margenes.push(Number(q.marginPercent));
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
      tiempoPromedioAsignacionDias: prom(tiemposAsignacion),
      tiempoPromedioCicloDias: prom(tiemposCiclo),
      sinAsignar,
      margenPromedioGlobal: margenCount ? margenTotal / margenCount : null,
      totalCotizaciones: quotes.length,
    });
  },
);

// Cotizadores a los que se puede asignar (miembros activos de Presupuesto)
quotesRouter.get(
  "/asignables",
  authorize(AppModule.COTIZACIONES, "ver"),
  async (_req, res) => {
    const users = await prisma.user.findMany({
      where: { isActive: true, team: { name: BUDGET_TEAM } },
      select: { id: true, name: true, isTeamLead: true },
      orderBy: { name: "asc" },
    });
    res.json({ users });
  },
);

quotesRouter.get(
  "/:id",
  authorize(AppModule.COTIZACIONES, "ver"),
  async (req, res) => {
    const quote = await prisma.quote.findUnique({
      where: { id: String(req.params.id) },
      include: quoteInclude,
    });
    if (!quote) {
      res.status(404).json({ error: "Cotización no encontrada." });
      return;
    }
    res.json({ quote });
  },
);

// Registrar el ingreso de una solicitud de cotización (antes de asignarla)
quotesRouter.post(
  "/",
  authorize(AppModule.COTIZACIONES, "editar"),
  async (req, res) => {
    const {
      title,
      description,
      clientId,
      clientName,
      contactName,
      market,
      company,
      currency,
      receivedAt,
      dueDate,
    } = req.body ?? {};
    if (!title || !String(title).trim()) {
      res.status(400).json({ error: "El título de la cotización es obligatorio." });
      return;
    }
    if (!Object.values(Market).includes(market)) {
      res.status(400).json({ error: "El mercado debe ser CO o USA." });
      return;
    }
    if (!Object.values(Company).includes(company)) {
      res.status(400).json({ error: "La empresa debe ser Vitralux o VLX." });
      return;
    }
    if (!Object.values(Currency).includes(currency)) {
      res.status(400).json({ error: "La moneda debe ser COP o USD." });
      return;
    }
    const cliente = await resolveClient(clientId, clientName);
    if (!cliente) {
      res.status(404).json({ error: "El cliente seleccionado no existe." });
      return;
    }
    if (!cliente.clientName) {
      res.status(400).json({
        error: "Selecciona el cliente de la cotización (o créalo primero).",
      });
      return;
    }
    const quote = await prisma.quote.create({
      data: {
        title: String(title).trim(),
        description: description ? String(description) : null,
        clientId: cliente.clientId,
        clientName: cliente.clientName,
        contactName: contactName ? String(contactName).trim() : null,
        market,
        company,
        currency,
        receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: quoteInclude,
    });
    await logAudit(req.user!.id, "crear_cotizacion", "Quote", quote.id, {
      title: quote.title,
    });
    // Avisar a los líderes de Presupuesto que hay una cotización por asignar
    const lideres = await teamLeadIds(BUDGET_TEAM);
    void notify(
      lideres.filter((id) => id !== req.user!.id),
      "cotizacion.ingresada",
      `Nueva cotización por asignar: ${quote.title}`,
      `Ingresó la cotización "${quote.title}" del cliente ${quote.clientName}. Asígnala a un cotizador para empezar a trabajarla.`,
      null,
    );
    res.status(201).json({ quote });
  },
);

// Asignar (o reasignar) la cotización a un cotizador
quotesRouter.post(
  "/:id/asignar",
  authorize(AppModule.COTIZACIONES, "editar"),
  async (req, res) => {
    if (!canAssignQuotes(req.user!)) {
      res.status(403).json({
        error:
          "Solo los líderes de Presupuesto o Gerencia pueden asignar cotizaciones.",
      });
      return;
    }
    const { quoterId } = req.body ?? {};
    if (!quoterId) {
      res.status(400).json({ error: "Indica el cotizador responsable." });
      return;
    }
    const quote = await prisma.quote.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!quote) {
      res.status(404).json({ error: "Cotización no encontrada." });
      return;
    }
    const quoter = await prisma.user.findUnique({
      where: { id: String(quoterId) },
    });
    if (!quoter || !quoter.isActive) {
      res.status(404).json({ error: "El usuario seleccionado no está activo." });
      return;
    }
    const updated = await prisma.quote.update({
      where: { id: quote.id },
      data: {
        quoterId: quoter.id,
        assignedById: req.user!.id,
        assignedAt: new Date(),
        // Al asignarse por primera vez arranca la elaboración
        ...(quote.status === QuoteStatus.INGRESADA
          ? { status: QuoteStatus.BORRADOR }
          : {}),
      },
      include: quoteInclude,
    });
    await logAudit(req.user!.id, "asignar_cotizacion", "Quote", quote.id, {
      quoterId: quoter.id,
    });
    if (quoter.id !== req.user!.id) {
      void notify(
        [quoter.id],
        "cotizacion.asignada",
        `Cotización asignada: ${updated.title}`,
        `${req.user!.name} te asignó la cotización "${updated.title}" del cliente ${updated.clientName}.`,
        null,
      );
    }
    res.json({ quote: updated });
  },
);

quotesRouter.put(
  "/:id",
  authorize(AppModule.COTIZACIONES, "editar"),
  async (req, res) => {
    const {
      title,
      description,
      clientId,
      clientName,
      contactName,
      market,
      company,
      currency,
      receivedAt,
      dueDate,
      amount,
      marginPercent,
      requiresManagementApproval,
      completed,
    } = req.body ?? {};
    const existing = await prisma.quote.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!existing) {
      res.status(404).json({ error: "Cotización no encontrada." });
      return;
    }
    if (!canManageQuote(req.user!, existing)) {
      res.status(403).json({
        error: "Solo el cotizador responsable (o un líder) puede editarla.",
      });
      return;
    }
    let cliente: { clientId: string | null; clientName: string | null } | null =
      null;
    if (clientId !== undefined || clientName !== undefined) {
      cliente = await resolveClient(clientId, clientName);
      if (!cliente) {
        res.status(404).json({ error: "El cliente seleccionado no existe." });
        return;
      }
      if (!cliente.clientName) cliente = null; // sin datos → no tocar
    }
    if (completed) {
      const puedeCompletarse = (
        [QuoteStatus.BORRADOR, QuoteStatus.CAMBIOS_SOLICITADOS] as QuoteStatus[]
      ).includes(existing.status);
      if (!puedeCompletarse) {
        res.status(400).json({
          error: "Solo una cotización en elaboración puede pasar a revisión.",
        });
        return;
      }
      if (!existing.quoterId) {
        res.status(400).json({
          error: "Asigna un cotizador antes de pasarla a revisión.",
        });
        return;
      }
      const finalAmount = amount !== undefined ? amount : existing.amount;
      const finalMargin =
        marginPercent !== undefined ? marginPercent : existing.marginPercent;
      if (
        finalAmount === null ||
        finalAmount === undefined ||
        finalMargin === null ||
        finalMargin === undefined
      ) {
        res.status(400).json({
          error: "Registra el monto y el margen antes de pasarla a revisión.",
        });
        return;
      }
    }
    const data: Prisma.QuoteUncheckedUpdateInput = {};
    if (title !== undefined) data.title = String(title).trim();
    if (description !== undefined)
      data.description = description ? String(description) : null;
    if (cliente && cliente.clientName) {
      data.clientId = cliente.clientId;
      data.clientName = cliente.clientName;
    }
    if (contactName !== undefined)
      data.contactName = contactName ? String(contactName).trim() : null;
    if (market !== undefined) data.market = market;
    if (company !== undefined) data.company = company;
    if (currency !== undefined) data.currency = currency;
    if (receivedAt !== undefined) data.receivedAt = new Date(receivedAt);
    if (dueDate !== undefined) {
      data.dueDate = dueDate ? new Date(dueDate) : null;
      // El plazo cambió → el recordatorio se replanifica
      data.dueSoonNotifiedAt = null;
    }
    if (amount !== undefined) data.amount = amount;
    if (marginPercent !== undefined) data.marginPercent = marginPercent;
    if (requiresManagementApproval !== undefined)
      data.requiresManagementApproval = Boolean(requiresManagementApproval);
    // El cotizador marca que terminó de elaborarla → pasa a revisión
    if (completed) {
      data.completedAt = new Date();
      data.status = QuoteStatus.EN_REVISION;
    }
    const quote = await prisma.quote.update({
      where: { id: existing.id },
      data,
      include: quoteInclude,
    });
    await logAudit(req.user!.id, "editar_cotizacion", "Quote", quote.id);
    // Pasó a revisión → avisar a los líderes de Presupuesto (quienes aprueban)
    if (completed) {
      const lideres = await teamLeadIds(BUDGET_TEAM);
      void notify(
        lideres.filter((id) => id !== req.user!.id),
        "cotizacion.en_revision",
        `Cotización lista para revisar: ${quote.title}`,
        `${req.user!.name} terminó de elaborar la cotización "${quote.title}" del cliente ${quote.clientName} y está lista para tu aprobación.`,
        null,
      );
    }
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
    if (tipo === "gerencia" && req.user!.teamName !== MANAGEMENT_TEAM) {
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
      // Aprobada del todo → notificar al cotizador y a Contabilidad/Tesorería
      const contabilidad = await teamMemberIds("Contabilidad");
      const tesoreria = await teamMemberIds("Tesorería");
      void notify(
        [
          ...(updated.quoterId ? [updated.quoterId] : []),
          ...contabilidad,
          ...tesoreria,
        ],
        "cotizacion.aprobada",
        `Cotización aprobada: ${updated.title}`,
        `La cotización "${updated.title}" del cliente ${updated.clientName} quedó aprobada y lista para enviarse al cliente.`,
        null,
      );
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

// Cotización aceptada → generar el proyecto vinculado (nace en Contrato)
quotesRouter.post(
  "/:id/generar-proyecto",
  authorize(AppModule.PROYECTOS, "editar"),
  async (req, res) => {
    const { name, costCenter, startDate } = req.body ?? {};
    const quote = await prisma.quote.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!quote) {
      res.status(404).json({ error: "Cotización no encontrada." });
      return;
    }
    if (quote.status !== QuoteStatus.ACEPTADA) {
      res.status(400).json({
        error:
          "Solo una cotización aceptada por el cliente puede generar un proyecto.",
      });
      return;
    }
    if (quote.projectId) {
      res.status(400).json({
        error: "Esta cotización ya generó un proyecto.",
      });
      return;
    }
    if (!costCenter || !String(costCenter).trim()) {
      res.status(400).json({
        error: "El centro de costo es obligatorio para generar el proyecto.",
      });
      return;
    }
    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name: name && String(name).trim() ? String(name).trim() : quote.title,
          clientId: quote.clientId,
          clientName: quote.clientName,
          market: quote.market,
          company: quote.company,
          currency: quote.currency,
          contractAmount: quote.amount,
          type: ProjectType.PRINCIPAL,
          costCenter: String(costCenter).trim(),
          startDate: startDate ? new Date(startDate) : null,
          stageHistory: {
            create: {
              toStage: ProjectStage.CONTRATO,
              changedById: req.user!.id,
              reason: "Proyecto generado desde cotización aceptada",
            },
          },
        },
      });
      await tx.quote.update({
        where: { id: quote.id },
        data: { projectId: created.id },
      });
      return created;
    });
    await logAudit(req.user!.id, "generar_proyecto", "Quote", quote.id, {
      projectId: project.id,
    });
    res.status(201).json({ project });
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
