import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { BUDGET_TEAM, can, MANAGEMENT_TEAM } from "../lib/permissions";
import {
  AppModule,
  AssignmentRole,
  DTStatus,
  QuoteStatus,
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
    const puedeAsignar =
      user.teamName === MANAGEMENT_TEAM ||
      (user.isTeamLead && user.teamName === BUDGET_TEAM);
    const [sinAsignar, mias] = await Promise.all([
      puedeAsignar
        ? prisma.quote.count({ where: { status: QuoteStatus.INGRESADA } })
        : Promise.resolve(0),
      prisma.quote.count({
        where: {
          quoterId: user.id,
          status: {
            in: [QuoteStatus.BORRADOR, QuoteStatus.CAMBIOS_SOLICITADOS],
          },
        },
      }),
    ]);
    pendientes[AppModule.COTIZACIONES] = sinAsignar + mias;
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
