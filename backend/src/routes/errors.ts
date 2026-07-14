import { Router } from "express";
import { logAudit } from "../lib/audit";
import { parseFecha } from "../lib/fechas";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import {
  AppModule,
  ProjectStage,
  ReworkType,
} from "../generated/prisma/enums";

// Módulo de errores y retrabajos, con estadística por persona
export const errorsRouter = Router();

errorsRouter.use(authenticate);

errorsRouter.get(
  "/",
  authorize(AppModule.ERRORES, "ver"),
  async (req, res) => {
    const { projectId, responsableId, tipo } = req.query;
    const errors = await prisma.reworkError.findMany({
      where: {
        projectId: projectId ? String(projectId) : undefined,
        responsibleId: responsableId ? String(responsableId) : undefined,
        type: tipo ? (String(tipo) as ReworkType) : undefined,
      },
      include: {
        project: { select: { id: true, name: true } },
        responsible: { select: { id: true, name: true } },
        reportedBy: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: "desc" },
    });
    res.json({ errors });
  },
);

// Estadísticas: dónde se cometen más errores y quién necesita capacitación
errorsRouter.get(
  "/estadisticas",
  authorize(AppModule.ERRORES, "ver"),
  async (_req, res) => {
    const errors = await prisma.reworkError.findMany({
      include: { responsible: { select: { id: true, name: true } } },
    });
    const porPersona: Record<
      string,
      { nombre: string; total: number; porTipo: Record<string, number>; costoTotal: number; diasAtrasoTotal: number }
    > = {};
    const porTipo: Record<string, number> = {};
    for (const e of errors) {
      porTipo[e.type] = (porTipo[e.type] ?? 0) + 1;
      const key = e.responsibleId ?? "sin_responsable";
      porPersona[key] ??= {
        nombre: e.responsible?.name ?? "Sin responsable identificado",
        total: 0,
        porTipo: {},
        costoTotal: 0,
        diasAtrasoTotal: 0,
      };
      const p = porPersona[key];
      p.total++;
      p.porTipo[e.type] = (p.porTipo[e.type] ?? 0) + 1;
      p.costoTotal += e.costImpact ? Number(e.costImpact) : 0;
      p.diasAtrasoTotal += e.delayImpactDays ?? 0;
    }
    res.json({
      total: errors.length,
      porTipo,
      porPersona: Object.entries(porPersona)
        .map(([id, p]) => ({ id, ...p }))
        .sort((a, b) => b.total - a.total),
    });
  },
);

errorsRouter.post(
  "/",
  authorize(AppModule.ERRORES, "editar"),
  async (req, res) => {
    const {
      projectId,
      type,
      stage,
      description,
      responsibleId,
      costImpact,
      delayImpactDays,
      occurredAt,
    } = req.body ?? {};
    if (
      !projectId ||
      !Object.values(ReworkType).includes(type) ||
      !description
    ) {
      res.status(400).json({
        error: "El proyecto, el tipo de error y la descripción son obligatorios.",
      });
      return;
    }
    const error = await prisma.reworkError.create({
      data: {
        projectId: String(projectId),
        type,
        stage: Object.values(ProjectStage).includes(stage)
          ? stage
          : ProjectStage.PRODUCCION,
        description: String(description),
        responsibleId: responsibleId ? String(responsibleId) : null,
        costImpact: costImpact ?? null,
        delayImpactDays: delayImpactDays ? Number(delayImpactDays) : null,
        occurredAt: occurredAt ? parseFecha(occurredAt) : new Date(),
        reportedById: req.user!.id,
      },
      include: {
        project: { select: { id: true, name: true } },
        responsible: { select: { id: true, name: true } },
      },
    });
    await logAudit(req.user!.id, "registrar_error", "ReworkError", error.id);
    res.status(201).json({ error });
  },
);
