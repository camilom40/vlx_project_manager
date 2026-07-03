import { Router } from "express";
import { logAudit } from "../lib/audit";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { AppModule, WarrantyStatus } from "../generated/prisma/enums";

// Etapa 5: gestión de garantías (Tesorería)
export const warrantiesRouter = Router();

warrantiesRouter.use(authenticate);

// Dashboard de garantías con alertas por fecha estimada
warrantiesRouter.get(
  "/",
  authorize(AppModule.GARANTIAS, "ver"),
  async (_req, res) => {
    const warranties = await prisma.warranty.findMany({
      include: {
        project: {
          select: {
            id: true,
            name: true,
            clientName: true,
            currency: true,
            actaCierre: { select: { closedAt: true } },
          },
        },
        responsible: { select: { id: true, name: true } },
      },
      orderBy: { estimatedProcessDate: "asc" },
    });
    const hoy = new Date();
    const enriquecidas = warranties.map((w) => {
      const vencida =
        w.status !== WarrantyStatus.COBRADA &&
        w.estimatedProcessDate !== null &&
        w.estimatedProcessDate <= hoy;
      const proxima =
        !vencida &&
        w.status !== WarrantyStatus.COBRADA &&
        w.estimatedProcessDate !== null &&
        w.estimatedProcessDate.getTime() - hoy.getTime() <
          30 * 24 * 60 * 60 * 1000;
      return { ...w, alerta: vencida ? "vencida" : proxima ? "proxima" : null };
    });
    res.json({ warranties: enriquecidas });
  },
);

warrantiesRouter.put(
  "/:id",
  authorize(AppModule.GARANTIAS, "editar"),
  async (req, res) => {
    const { status, responsibleId, estimatedProcessDate, retentionValue } =
      req.body ?? {};
    if (status && !Object.values(WarrantyStatus).includes(status)) {
      res.status(400).json({ error: "Estado de garantía inválido." });
      return;
    }
    const warranty = await prisma.warranty.update({
      where: { id: String(req.params.id) },
      data: {
        status: status ?? undefined,
        responsibleId:
          responsibleId !== undefined
            ? responsibleId
              ? String(responsibleId)
              : null
            : undefined,
        estimatedProcessDate:
          estimatedProcessDate !== undefined
            ? estimatedProcessDate
              ? new Date(estimatedProcessDate)
              : null
            : undefined,
        retentionValue: retentionValue !== undefined ? retentionValue : undefined,
      },
    });
    await logAudit(
      req.user!.id,
      "actualizar_garantia",
      "Warranty",
      warranty.id,
      { status },
    );
    res.json({ warranty });
  },
);
