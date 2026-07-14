import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import {
  ACCOUNTING_TEAM,
  BUDGET_TEAM,
  can,
  MANAGEMENT_TEAM,
} from "../lib/permissions";
import {
  AppModule,
  AssignmentRole,
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
    const esGerencia = user.teamName === MANAGEMENT_TEAM;
    const puedeAsignar =
      esGerencia || (user.isTeamLead && user.teamName === BUDGET_TEAM);
    const esContabilidad = user.teamName === ACCOUNTING_TEAM;
    const [sinAsignar, porAprobar, porGenerarProyecto, mias] = await Promise.all([
      // El balón está en la cancha del líder: asignar las ingresadas
      puedeAsignar
        ? prisma.quote.count({ where: { status: QuoteStatus.INGRESADA } })
        : Promise.resolve(0),
      // ...y aprobar las que están en revisión (Gerencia también las suyas)
      puedeAsignar
        ? prisma.quote.count({
            where: {
              status: QuoteStatus.EN_REVISION,
              OR: [
                { budgetApprovedAt: null },
                ...(esGerencia
                  ? [
                      {
                        requiresManagementApproval: true,
                        managementApprovedAt: null,
                      },
                    ]
                  : []),
              ],
            },
          })
        : Promise.resolve(0),
      // Aceptadas sin proyecto: Contabilidad crea el CC y genera el proyecto
      esContabilidad
        ? prisma.quote.count({
            where: { status: QuoteStatus.ACEPTADA, projectId: null },
          })
        : Promise.resolve(0),
      // El balón está en la cancha del cotizador: elaborar o enviar la aprobada
      prisma.quote.count({
        where: {
          quoterId: user.id,
          OR: [
            {
              status: {
                in: [QuoteStatus.BORRADOR, QuoteStatus.CAMBIOS_SOLICITADOS],
              },
            },
            { status: QuoteStatus.APROBADA },
          ],
        },
      }),
    ]);
    pendientes[AppModule.COTIZACIONES] =
      sinAsignar + porAprobar + porGenerarProyecto + mias;
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
