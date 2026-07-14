import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { can } from "../lib/permissions";
import {
  anticipoVerificado,
  contratoRequiereAccion,
  cotizacionRequiereAccion,
  polizasResueltas,
} from "../lib/responsabilidad";
import {
  AppModule,
  AssignmentRole,
  ContractStatus,
  DTStatus,
  QuoteStatus,
  TaskStatus,
  WarrantyStatus,
} from "../generated/prisma/enums";

// Contadores de "pendientes para mí" que se muestran como badge en la barra
// lateral. Cada módulo se calcula solo si el usuario tiene permiso de ver.
export const pendientesRouter = Router();

pendientesRouter.use(authenticate);

pendientesRouter.get("/", async (req, res) => {
  const user = req.user!;
  const pendientes: Record<string, number> = {};

  if (can(user.permissions, AppModule.COTIZACIONES, "ver")) {
    // Misma regla del punto de acción del tablero (lib/responsabilidad):
    // se traen las cotizaciones abiertas y se filtra con la fuente única.
    const abiertas = await prisma.quote.findMany({
      where: {
        status: {
          in: [
            QuoteStatus.INGRESADA,
            QuoteStatus.BORRADOR,
            QuoteStatus.CAMBIOS_SOLICITADOS,
            QuoteStatus.EN_REVISION,
            QuoteStatus.APROBADA,
            QuoteStatus.ACEPTADA,
          ],
        },
      },
      select: {
        status: true,
        quoterId: true,
        projectId: true,
        budgetApprovedAt: true,
        requiresManagementApproval: true,
        managementApprovedAt: true,
      },
    });
    pendientes[AppModule.COTIZACIONES] = abiertas.filter((q) =>
      cotizacionRequiereAccion(user, q),
    ).length;
  }

  // Contratos cuyo balón está en mi cancha (misma regla que el TabContrato)
  if (can(user.permissions, AppModule.CONTRATOS, "ver")) {
    const contratos = await prisma.contract.findMany({
      where: {
        project: { status: "ACTIVO" },
        OR: [
          {
            status: {
              in: [
                ContractStatus.RECIBIDO,
                ContractStatus.EN_REVISION,
                ContractStatus.PENDIENTE_FIRMA,
                ContractStatus.RECHAZADO_CON_OBSERVACIONES,
              ],
            },
          },
          {
            status: ContractStatus.FIRMADO,
            project: { purchasingUnlockedNotifiedAt: null },
          },
        ],
      },
      select: {
        status: true,
        reviewerId: true,
        requiresPolicy: true,
        requiresAdvance: true,
        project: {
          select: {
            policies: { select: { status: true } },
            advances: { select: { status: true } },
          },
        },
      },
    });
    pendientes[AppModule.CONTRATOS] = contratos.filter((c) =>
      contratoRequiereAccion(user, {
        status: c.status,
        reviewerId: c.reviewerId,
        requiresPolicy: c.requiresPolicy,
        requiresAdvance: c.requiresAdvance,
        polizasResueltas: polizasResueltas(c.project.policies),
        anticipoResuelto: anticipoVerificado(c.project.advances),
      }),
    ).length;
  }

  // Tareas de proyecto asignadas a mí que dependen de mí (no bloqueadas)
  if (can(user.permissions, AppModule.PROYECTOS, "ver")) {
    pendientes[AppModule.PROYECTOS] = await prisma.task.count({
      where: {
        assigneeId: user.id,
        status: { in: [TaskStatus.PENDIENTE, TaskStatus.EN_PROGRESO] },
        project: { status: "ACTIVO" },
      },
    });
  }

  if (can(user.permissions, AppModule.PRODUCCION, "ver")) {
    const asignaciones = await prisma.projectAssignment.findMany({
      where: {
        userId: user.id,
        role: { in: [AssignmentRole.JEFE_TALLER, AssignmentRole.PLANEADOR] },
      },
      select: { projectId: true, role: true },
    });
    const proyectosJefeTaller = asignaciones
      .filter((a) => a.role === AssignmentRole.JEFE_TALLER)
      .map((a) => a.projectId);
    const proyectosPlaneador = asignaciones
      .filter((a) => a.role === AssignmentRole.PLANEADOR)
      .map((a) => a.projectId);
    const [dtsPendientes, actasSinDts] = await Promise.all([
      proyectosJefeTaller.length
        ? prisma.dT.count({
            where: {
              projectId: { in: proyectosJefeTaller },
              status: { not: DTStatus.DESPACHADO },
            },
          })
        : Promise.resolve(0),
      proyectosPlaneador.length
        ? prisma.actaVanos.count({
            where: {
              projectId: { in: proyectosPlaneador },
              dts: { none: {} },
            },
          })
        : Promise.resolve(0),
    ]);
    pendientes[AppModule.PRODUCCION] = dtsPendientes + actasSinDts;
  }

  if (can(user.permissions, AppModule.GARANTIAS, "ver")) {
    pendientes[AppModule.GARANTIAS] = await prisma.warranty.count({
      where: { responsibleId: user.id, status: { not: WarrantyStatus.COBRADA } },
    });
  }

  res.json({ pendientes });
});
