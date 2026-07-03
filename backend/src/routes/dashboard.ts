import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import {
  AdvanceStatus,
  AppModule,
  DTStatus,
  ProjectStatus,
  QuoteStatus,
  WarrantyStatus,
} from "../generated/prisma/enums";

// Dashboard gerencial: visión global para intervenir a tiempo
export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get(
  "/gerencial",
  authorize(AppModule.DASHBOARD_GERENCIAL, "ver"),
  async (_req, res) => {
    const hoy = new Date();
    const [proyectos, anticipos, garantias, actasSinDts, dtsAtrasados, cotizacionesEsperando, errores] =
      await Promise.all([
        prisma.project.findMany({
          where: { status: ProjectStatus.ACTIVO },
          select: {
            id: true,
            name: true,
            clientName: true,
            currency: true,
            contractAmount: true,
            currentStage: true,
            estimatedEndDate: true,
            type: true,
            actasCorte: { select: { invoicedValue: true } },
          },
        }),
        prisma.advance.findMany({
          select: { status: true, value: true, project: { select: { currency: true } } },
        }),
        prisma.warranty.findMany({
          where: { status: { not: WarrantyStatus.COBRADA } },
          select: {
            id: true,
            retentionValue: true,
            estimatedProcessDate: true,
            status: true,
            project: { select: { id: true, name: true, currency: true } },
          },
        }),
        prisma.actaVanos.count({ where: { dts: { none: {} } } }),
        prisma.dT.count({
          where: {
            status: { not: DTStatus.DESPACHADO },
            requiredDeliveryDate: { lt: hoy },
          },
        }),
        prisma.quote.count({
          where: {
            status: { in: [QuoteStatus.ENVIADA, QuoteStatus.SIN_RESPUESTA] },
            sentAt: { lt: new Date(hoy.getTime() - 15 * 86400000) },
          },
        }),
        prisma.reworkError.groupBy({
          by: ["responsibleId"],
          _count: { id: true },
        }),
      ]);

    const facturacionPorProyecto = proyectos.map((p) => {
      const facturado = p.actasCorte.reduce(
        (s, c) => s + Number(c.invoicedValue),
        0,
      );
      const monto = p.contractAmount ? Number(p.contractAmount) : null;
      return {
        id: p.id,
        nombre: p.name,
        cliente: p.clientName,
        moneda: p.currency,
        etapa: p.currentStage,
        tipo: p.type,
        monto,
        facturado,
        porcentaje: monto ? (facturado / monto) * 100 : null,
        atrasado:
          p.estimatedEndDate !== null && p.estimatedEndDate < hoy,
        entregaEstimada: p.estimatedEndDate,
      };
    });

    const anticiposPorEstado: Record<string, { cantidad: number; total: number }> = {};
    for (const a of anticipos) {
      anticiposPorEstado[a.status] ??= { cantidad: 0, total: 0 };
      anticiposPorEstado[a.status].cantidad++;
      anticiposPorEstado[a.status].total += Number(a.value);
    }

    const usuariosConErrores = await prisma.user.findMany({
      where: {
        id: {
          in: errores
            .map((e) => e.responsibleId)
            .filter((x): x is string => Boolean(x)),
        },
      },
      select: { id: true, name: true },
    });
    const nombrePorId = new Map(usuariosConErrores.map((u) => [u.id, u.name]));

    res.json({
      proyectosActivos: proyectos.length,
      facturacionPorProyecto,
      anticipos: {
        porEstado: anticiposPorEstado,
        pendientesVerificar: anticipos.filter(
          (a) => a.status !== AdvanceStatus.VERIFICADO,
        ).length,
      },
      garantias: {
        pendientes: garantias.length,
        vencidas: garantias.filter(
          (g) =>
            g.estimatedProcessDate !== null && g.estimatedProcessDate <= hoy,
        ).length,
        lista: garantias.slice(0, 8),
      },
      cuellosDeBotella: {
        actasSinDts,
        dtsAtrasados,
        cotizacionesEsperandoMas15Dias: cotizacionesEsperando,
      },
      erroresPorPersona: errores
        .map((e) => ({
          nombre: e.responsibleId
            ? (nombrePorId.get(e.responsibleId) ?? "Desconocido")
            : "Sin responsable",
          total: e._count.id,
        }))
        .sort((a, b) => b.total - a.total),
    });
  },
);
