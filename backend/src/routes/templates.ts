import { Router } from "express";
import { logAudit } from "../lib/audit";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { AppModule, Priority, ProjectStage } from "../generated/prisma/enums";

// Plantillas de proyecto: tareas preconfiguradas que se materializan al aplicar
export const templatesRouter = Router();

templatesRouter.use(authenticate);

interface TemplateTask {
  nombre: string;
  etapa?: string;
  prioridad?: string;
  duracionDias?: number;
  dependeDe?: number[]; // índices dentro de la misma plantilla
}

templatesRouter.get(
  "/",
  authorize(AppModule.PLANTILLAS, "ver"),
  async (_req, res) => {
    const templates = await prisma.projectTemplate.findMany({
      orderBy: { name: "asc" },
    });
    res.json({ templates });
  },
);

templatesRouter.post(
  "/",
  authorize(AppModule.PLANTILLAS, "editar"),
  async (req, res) => {
    const { name, description, tareas } = req.body ?? {};
    if (!name || !Array.isArray(tareas)) {
      res.status(400).json({
        error: "El nombre y la lista de tareas son obligatorios.",
      });
      return;
    }
    const existing = await prisma.projectTemplate.findUnique({
      where: { name: String(name).trim() },
    });
    if (existing) {
      res.status(409).json({ error: "Ya existe una plantilla con ese nombre." });
      return;
    }
    const template = await prisma.projectTemplate.create({
      data: {
        name: String(name).trim(),
        description: description ? String(description) : null,
        config: { tareas },
      },
    });
    await logAudit(
      req.user!.id,
      "crear_plantilla",
      "ProjectTemplate",
      template.id,
    );
    res.status(201).json({ template });
  },
);

templatesRouter.delete(
  "/:id",
  authorize(AppModule.PLANTILLAS, "editar"),
  async (req, res) => {
    await prisma.projectTemplate.delete({
      where: { id: String(req.params.id) },
    });
    await logAudit(
      req.user!.id,
      "eliminar_plantilla",
      "ProjectTemplate",
      String(req.params.id),
    );
    res.json({ ok: true });
  },
);

// Aplica la plantilla a un proyecto: crea sus tareas con dependencias
templatesRouter.post(
  "/:id/aplicar",
  authorize(AppModule.PROYECTOS, "editar"),
  async (req, res) => {
    const { projectId } = req.body ?? {};
    const template = await prisma.projectTemplate.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!template) {
      res.status(404).json({ error: "Plantilla no encontrada." });
      return;
    }
    const project = await prisma.project.findUnique({
      where: { id: String(projectId) },
    });
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado." });
      return;
    }
    const config = template.config as unknown as { tareas: TemplateTask[] };
    const tareas = config?.tareas ?? [];
    const startBase = project.startDate ?? new Date();
    const createdIds: string[] = [];
    let cursor = new Date(startBase);
    for (const t of tareas) {
      const inicio = new Date(cursor);
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + (t.duracionDias ?? 3));
      const task = await prisma.task.create({
        data: {
          projectId: project.id,
          name: t.nombre,
          stage: Object.values(ProjectStage).includes(t.etapa as ProjectStage)
            ? (t.etapa as ProjectStage)
            : null,
          priority: Object.values(Priority).includes(t.prioridad as Priority)
            ? (t.prioridad as Priority)
            : Priority.MEDIA,
          plannedStart: inicio,
          plannedEnd: fin,
        },
      });
      createdIds.push(task.id);
      cursor = fin;
    }
    // Dependencias por índice dentro de la plantilla
    for (let i = 0; i < tareas.length; i++) {
      for (const dep of tareas[i].dependeDe ?? []) {
        if (dep >= 0 && dep < createdIds.length && dep !== i) {
          await prisma.taskDependency.create({
            data: { taskId: createdIds[i], dependsOnId: createdIds[dep] },
          });
        }
      }
    }
    await logAudit(
      req.user!.id,
      "aplicar_plantilla",
      "ProjectTemplate",
      template.id,
      { projectId: project.id, tareas: createdIds.length },
    );
    res.json({ ok: true, tareasCreadas: createdIds.length });
  },
);
