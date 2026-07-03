import { Router } from "express";
import { logAudit } from "../lib/audit";
import { notify } from "../lib/notifications";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import {
  AppModule,
  Priority,
  ProjectStage,
  TaskStatus,
} from "../generated/prisma/enums";

// Tareas con dependencias, fechas plan/real (Gantt) y carga de trabajo
export const tasksRouter = Router();

tasksRouter.use(authenticate);

const taskInclude = {
  assignee: { select: { id: true, name: true } },
  dependencies: {
    include: {
      dependsOn: { select: { id: true, name: true, status: true } },
    },
  },
} as const;

tasksRouter.get(
  "/projects/:id/tareas",
  authorize(AppModule.PROYECTOS, "ver"),
  async (req, res) => {
    const tasks = await prisma.task.findMany({
      where: { projectId: String(req.params.id) },
      include: taskInclude,
      orderBy: [{ plannedStart: "asc" }, { createdAt: "asc" }],
    });
    res.json({ tasks });
  },
);

tasksRouter.post(
  "/projects/:id/tareas",
  authorize(AppModule.PROYECTOS, "editar"),
  async (req, res) => {
    const {
      name,
      description,
      assigneeId,
      stage,
      priority,
      plannedStart,
      plannedEnd,
      dependsOnIds,
    } = req.body ?? {};
    if (!name) {
      res.status(400).json({ error: "El nombre de la tarea es obligatorio." });
      return;
    }
    const task = await prisma.task.create({
      data: {
        projectId: String(req.params.id),
        name: String(name).trim(),
        description: description ? String(description) : null,
        assigneeId: assigneeId ? String(assigneeId) : null,
        stage: Object.values(ProjectStage).includes(stage) ? stage : null,
        priority: Object.values(Priority).includes(priority)
          ? priority
          : Priority.MEDIA,
        plannedStart: plannedStart ? new Date(plannedStart) : null,
        plannedEnd: plannedEnd ? new Date(plannedEnd) : null,
        ...(Array.isArray(dependsOnIds) && dependsOnIds.length > 0
          ? {
              dependencies: {
                create: dependsOnIds.map((id: string) => ({
                  dependsOnId: String(id),
                })),
              },
            }
          : {}),
      },
      include: taskInclude,
    });
    await logAudit(req.user!.id, "crear_tarea", "Task", task.id);
    if (task.assigneeId && task.assigneeId !== req.user!.id) {
      const proyecto = await prisma.project.findUnique({
        where: { id: task.projectId },
        select: { name: true },
      });
      void notify(
        [task.assigneeId],
        "tarea.asignada",
        `Nueva tarea: ${task.name}`,
        `${req.user!.name} te asignó la tarea "${task.name}" en el proyecto "${proyecto?.name}".`,
        task.projectId,
      );
    }
    res.status(201).json({ task });
  },
);

tasksRouter.put(
  "/tareas/:id",
  authorize(AppModule.PROYECTOS, "editar"),
  async (req, res) => {
    const { status, assigneeId, plannedStart, plannedEnd, priority } =
      req.body ?? {};
    const task = await prisma.task.findUnique({
      where: { id: String(req.params.id) },
      include: taskInclude,
    });
    if (!task) {
      res.status(404).json({ error: "Tarea no encontrada." });
      return;
    }
    // Dependencias: no se puede iniciar si lo que la bloquea no está completo
    if (status === TaskStatus.EN_PROGRESO) {
      const bloqueantes = task.dependencies.filter(
        (d) => d.dependsOn.status !== TaskStatus.COMPLETADA,
      );
      if (bloqueantes.length > 0) {
        res.status(400).json({
          error: `Esta tarea está bloqueada por: ${bloqueantes
            .map((b) => b.dependsOn.name)
            .join(", ")}. Complétalas primero.`,
        });
        return;
      }
    }
    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: Object.values(TaskStatus).includes(status) ? status : undefined,
        assigneeId:
          assigneeId !== undefined
            ? assigneeId
              ? String(assigneeId)
              : null
            : undefined,
        plannedStart:
          plannedStart !== undefined
            ? plannedStart
              ? new Date(plannedStart)
              : null
            : undefined,
        plannedEnd:
          plannedEnd !== undefined
            ? plannedEnd
              ? new Date(plannedEnd)
              : null
            : undefined,
        priority: priority ?? undefined,
        actualStart:
          status === TaskStatus.EN_PROGRESO && !task.actualStart
            ? new Date()
            : undefined,
        actualEnd: status === TaskStatus.COMPLETADA ? new Date() : undefined,
      },
      include: taskInclude,
    });
    await logAudit(req.user!.id, "actualizar_tarea", "Task", task.id, {
      status,
    });
    // Al completar, desbloquear: avisar a los responsables de las tareas dependientes
    if (status === TaskStatus.COMPLETADA) {
      const dependientes = await prisma.taskDependency.findMany({
        where: { dependsOnId: task.id },
        include: {
          task: {
            include: { assignee: { select: { id: true } } },
          },
        },
      });
      const destinatarios = dependientes
        .map((d) => d.task.assignee?.id)
        .filter((x): x is string => Boolean(x));
      void notify(
        destinatarios,
        "tarea.desbloqueada",
        `Tarea desbloqueada`,
        `"${task.name}" quedó completada. Las tareas que dependían de ella ya pueden arrancar.`,
        task.projectId,
      );
    }
    res.json({ task: updated });
  },
);

// Carga de trabajo: quién está saturado
tasksRouter.get(
  "/carga",
  authorize(AppModule.PROYECTOS, "ver"),
  async (_req, res) => {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        team: { select: { name: true } },
        tasksAssigned: {
          where: {
            status: { in: [TaskStatus.PENDIENTE, TaskStatus.EN_PROGRESO, TaskStatus.BLOQUEADA] },
          },
          select: { id: true },
        },
        projectAssignments: {
          where: { project: { status: "ACTIVO" } },
          select: { role: true, project: { select: { id: true, name: true } } },
        },
        quotesAsQuoter: {
          where: {
            status: { in: ["BORRADOR", "EN_REVISION"] },
          },
          select: { id: true },
        },
      },
      orderBy: { name: "asc" },
    });
    res.json({
      carga: users.map((u) => ({
        id: u.id,
        nombre: u.name,
        equipo: u.team?.name ?? null,
        tareasAbiertas: u.tasksAssigned.length,
        cotizacionesAbiertas: u.quotesAsQuoter.length,
        proyectosActivos: u.projectAssignments.map((a) => ({
          rol: a.role,
          proyecto: a.project,
        })),
      })),
    });
  },
);
