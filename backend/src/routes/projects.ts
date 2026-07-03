import { Router } from "express";
import { logAudit } from "../lib/audit";
import { notify } from "../lib/notifications";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import {
  AppModule,
  AssignmentRole,
  Company,
  Currency,
  Market,
  ProjectStage,
  ProjectStatus,
  ProjectType,
} from "../generated/prisma/enums";

export const projectsRouter = Router();

projectsRouter.use(authenticate);

// Orden canónico de las 5 etapas (para detectar retrocesos)
const STAGE_ORDER: ProjectStage[] = [
  ProjectStage.COTIZACION,
  ProjectStage.CONTRATO,
  ProjectStage.PRODUCCION,
  ProjectStage.INSTALACION,
  ProjectStage.GARANTIAS,
];

const listInclude = {
  parentProject: { select: { id: true, name: true } },
  assignments: {
    include: { user: { select: { id: true, name: true } } },
  },
  installerGroups: {
    where: { isActive: true },
    include: { group: { select: { id: true, name: true } } },
  },
  _count: { select: { children: true, quotes: true } },
} as const;

projectsRouter.get(
  "/",
  authorize(AppModule.PROYECTOS, "ver"),
  async (req, res) => {
    const { etapa, estado, tipo, buscar } = req.query;
    const projects = await prisma.project.findMany({
      where: {
        currentStage: etapa ? (String(etapa) as ProjectStage) : undefined,
        status: estado ? (String(estado) as ProjectStatus) : undefined,
        type: tipo ? (String(tipo) as ProjectType) : undefined,
        ...(buscar
          ? {
              OR: [
                { name: { contains: String(buscar), mode: "insensitive" as const } },
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
      include: listInclude,
      orderBy: { createdAt: "desc" },
    });
    res.json({ projects });
  },
);

projectsRouter.post(
  "/",
  authorize(AppModule.PROYECTOS, "editar"),
  async (req, res) => {
    const {
      name,
      clientName,
      market,
      company,
      currency,
      type,
      parentProjectId,
      costCenter,
      contractAmount,
      advancePercent,
      warrantyRetentionPercent,
      startDate,
      estimatedEndDate,
      notes,
    } = req.body ?? {};
    if (!name || !clientName) {
      res
        .status(400)
        .json({ error: "El nombre y el cliente son obligatorios." });
      return;
    }
    if (!Object.values(Market).includes(market)) {
      res.status(400).json({ error: "El mercado debe ser CO o USA." });
      return;
    }
    if (!Object.values(Company).includes(company)) {
      res
        .status(400)
        .json({ error: "La empresa debe ser Vitralux o VLX." });
      return;
    }
    if (!Object.values(Currency).includes(currency)) {
      res.status(400).json({ error: "La moneda debe ser COP o USD." });
      return;
    }
    const isAdicional = type === ProjectType.ADICIONAL;
    if (isAdicional) {
      if (!parentProjectId) {
        res.status(400).json({
          error: "Un adicional debe estar vinculado a un proyecto principal.",
        });
        return;
      }
      const parent = await prisma.project.findUnique({
        where: { id: String(parentProjectId) },
      });
      if (!parent) {
        res.status(404).json({ error: "El proyecto principal no existe." });
        return;
      }
      if (parent.type === ProjectType.ADICIONAL) {
        res.status(400).json({
          error: "No se puede crear un adicional de otro adicional.",
        });
        return;
      }
    }
    const project = await prisma.project.create({
      data: {
        name: String(name).trim(),
        clientName: String(clientName).trim(),
        market,
        company,
        currency,
        type: isAdicional ? ProjectType.ADICIONAL : ProjectType.PRINCIPAL,
        parentProjectId: isAdicional ? String(parentProjectId) : null,
        costCenter: costCenter ? String(costCenter).trim() : null,
        contractAmount: contractAmount ?? null,
        advancePercent: advancePercent ?? null,
        warrantyRetentionPercent: warrantyRetentionPercent ?? null,
        startDate: startDate ? new Date(startDate) : null,
        estimatedEndDate: estimatedEndDate ? new Date(estimatedEndDate) : null,
        notes: notes ? String(notes) : null,
        stageHistory: {
          create: {
            toStage: ProjectStage.COTIZACION,
            changedById: req.user!.id,
            reason: "Creación del proyecto",
          },
        },
      },
      include: listInclude,
    });
    await logAudit(req.user!.id, "crear_proyecto", "Project", project.id, {
      name: project.name,
      type: project.type,
    });
    res.status(201).json({ project });
  },
);

projectsRouter.get(
  "/:id",
  authorize(AppModule.PROYECTOS, "ver"),
  async (req, res) => {
    const project = await prisma.project.findUnique({
      where: { id: String(req.params.id) },
      include: {
        parentProject: { select: { id: true, name: true, type: true } },
        children: {
          select: {
            id: true,
            name: true,
            currentStage: true,
            status: true,
            costCenter: true,
            contractAmount: true,
            currency: true,
          },
          orderBy: { createdAt: "desc" },
        },
        assignments: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        installerGroups: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
                members: {
                  where: { isActive: true },
                  select: { user: { select: { id: true, name: true } } },
                },
              },
            },
          },
          orderBy: { assignedAt: "desc" },
        },
        stageHistory: {
          include: { changedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        earlyStartAuthorizedBy: { select: { id: true, name: true } },
      },
    });
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado." });
      return;
    }
    res.json({ project });
  },
);

projectsRouter.put(
  "/:id",
  authorize(AppModule.PROYECTOS, "editar"),
  async (req, res) => {
    const existing = await prisma.project.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!existing) {
      res.status(404).json({ error: "Proyecto no encontrado." });
      return;
    }
    const {
      name,
      clientName,
      market,
      company,
      currency,
      status,
      costCenter,
      contractAmount,
      advancePercent,
      warrantyRetentionPercent,
      startDate,
      estimatedEndDate,
      actualEndDate,
      notes,
      earlyStartWithoutAdvance,
    } = req.body ?? {};
    const project = await prisma.project.update({
      where: { id: existing.id },
      data: {
        name: name !== undefined ? String(name).trim() : undefined,
        clientName:
          clientName !== undefined ? String(clientName).trim() : undefined,
        market: market !== undefined ? market : undefined,
        company: company !== undefined ? company : undefined,
        currency: currency !== undefined ? currency : undefined,
        status: status !== undefined ? status : undefined,
        costCenter:
          costCenter !== undefined
            ? costCenter
              ? String(costCenter).trim()
              : null
            : undefined,
        contractAmount: contractAmount !== undefined ? contractAmount : undefined,
        advancePercent: advancePercent !== undefined ? advancePercent : undefined,
        warrantyRetentionPercent:
          warrantyRetentionPercent !== undefined
            ? warrantyRetentionPercent
            : undefined,
        startDate:
          startDate !== undefined
            ? startDate
              ? new Date(startDate)
              : null
            : undefined,
        estimatedEndDate:
          estimatedEndDate !== undefined
            ? estimatedEndDate
              ? new Date(estimatedEndDate)
              : null
            : undefined,
        actualEndDate:
          actualEndDate !== undefined
            ? actualEndDate
              ? new Date(actualEndDate)
              : null
            : undefined,
        notes: notes !== undefined ? (notes ? String(notes) : null) : undefined,
        // Excepción de cliente de confianza: registrar quién la autorizó
        ...(earlyStartWithoutAdvance !== undefined
          ? {
              earlyStartWithoutAdvance: Boolean(earlyStartWithoutAdvance),
              earlyStartAuthorizedById: earlyStartWithoutAdvance
                ? req.user!.id
                : null,
            }
          : {}),
      },
    });
    await logAudit(req.user!.id, "editar_proyecto", "Project", project.id);
    res.json({ project });
  },
);

// Cambiar de etapa (adelante o atrás). Retroceso exige motivo.
projectsRouter.post(
  "/:id/etapa",
  authorize(AppModule.PROYECTOS, "editar"),
  async (req, res) => {
    const { toStage, reason } = req.body ?? {};
    if (!Object.values(ProjectStage).includes(toStage)) {
      res.status(400).json({ error: "Etapa de destino inválida." });
      return;
    }
    const project = await prisma.project.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado." });
      return;
    }
    if (project.currentStage === toStage) {
      res.status(400).json({ error: "El proyecto ya está en esa etapa." });
      return;
    }
    const isBackwards =
      STAGE_ORDER.indexOf(toStage) < STAGE_ORDER.indexOf(project.currentStage);
    if (isBackwards && (!reason || !String(reason).trim())) {
      res.status(400).json({
        error: "Para devolver el proyecto de etapa debes indicar el motivo.",
      });
      return;
    }
    const [updated] = await prisma.$transaction([
      prisma.project.update({
        where: { id: project.id },
        data: { currentStage: toStage },
      }),
      prisma.projectStageHistory.create({
        data: {
          projectId: project.id,
          fromStage: project.currentStage,
          toStage,
          changedById: req.user!.id,
          reason: reason ? String(reason).trim() : null,
        },
      }),
    ]);
    await logAudit(
      req.user!.id,
      isBackwards ? "devolver_etapa" : "avanzar_etapa",
      "Project",
      project.id,
      { from: project.currentStage, to: toStage },
    );
    // El balón pasa a la cancha del equipo asignado al proyecto
    const asignados = await prisma.projectAssignment.findMany({
      where: { projectId: project.id },
      select: { userId: true },
    });
    void notify(
      asignados.map((a) => a.userId).filter((id) => id !== req.user!.id),
      isBackwards ? "proyecto.retroceso" : "proyecto.avance",
      isBackwards
        ? `Retroceso: ${project.name}`
        : `El proyecto ${project.name} avanzó de etapa`,
      isBackwards
        ? `${req.user!.name} devolvió el proyecto "${project.name}" a la etapa de ${toStage.toLowerCase()}. Motivo: ${reason ?? "sin especificar"}.`
        : `${req.user!.name} movió el proyecto "${project.name}" a la etapa de ${toStage.toLowerCase()}. Revisa tus tareas pendientes.`,
      project.id,
    );
    res.json({ project: updated });
  },
);

// Asignación del equipo nominal + grupos de instaladores
projectsRouter.put(
  "/:id/equipo",
  authorize(AppModule.PROYECTOS, "editar"),
  async (req, res) => {
    const { assignments, installerGroupIds } = req.body ?? {};
    const project = await prisma.project.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado." });
      return;
    }
    const validRoles = new Set(Object.values(AssignmentRole));
    const ops = [];
    if (Array.isArray(assignments)) {
      ops.push(
        prisma.projectAssignment.deleteMany({
          where: { projectId: project.id },
        }),
        prisma.projectAssignment.createMany({
          data: assignments
            .filter(
              (a: { userId?: string; role?: string }) =>
                a.userId && validRoles.has(a.role as AssignmentRole),
            )
            .map((a: { userId: string; role: AssignmentRole }) => ({
              projectId: project.id,
              userId: a.userId,
              role: a.role,
            })),
          skipDuplicates: true,
        }),
      );
    }
    if (Array.isArray(installerGroupIds)) {
      const ids = installerGroupIds.map(String);
      ops.push(
        // Desactivar los que salen (conservando historial)
        prisma.projectInstallerGroup.updateMany({
          where: { projectId: project.id, groupId: { notIn: ids } },
          data: { isActive: false, unassignedAt: new Date() },
        }),
        // Reactivar los que vuelven
        prisma.projectInstallerGroup.updateMany({
          where: { projectId: project.id, groupId: { in: ids } },
          data: { isActive: true, unassignedAt: null },
        }),
      );
    }
    await prisma.$transaction(ops);
    if (Array.isArray(installerGroupIds)) {
      // Crear los vínculos nuevos que no existían
      for (const groupId of installerGroupIds.map(String)) {
        await prisma.projectInstallerGroup.upsert({
          where: {
            projectId_groupId: { projectId: project.id, groupId },
          },
          update: { isActive: true, unassignedAt: null },
          create: { projectId: project.id, groupId },
        });
      }
    }
    await logAudit(req.user!.id, "asignar_equipo", "Project", project.id);
    const updated = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        assignments: {
          include: { user: { select: { id: true, name: true } } },
        },
        installerGroups: {
          where: { isActive: true },
          include: { group: { select: { id: true, name: true } } },
        },
      },
    });
    res.json({ project: updated });
  },
);
