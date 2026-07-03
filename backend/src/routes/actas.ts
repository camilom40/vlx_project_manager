import { Router } from "express";
import { logAudit } from "../lib/audit";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { AppModule, WarrantyStatus } from "../generated/prisma/enums";

// Etapa 4: actas de corte / entrega / cierre + % de facturación
export const actasRouter = Router();

actasRouter.use(authenticate);

actasRouter.get(
  "/projects/:id/actas",
  authorize(AppModule.ACTAS, "ver"),
  async (req, res) => {
    const projectId = String(req.params.id);
    const [cortes, entregas, cierre, project] = await Promise.all([
      prisma.actaCorte.findMany({
        where: { projectId },
        orderBy: { cutDate: "asc" },
      }),
      prisma.actaEntrega.findMany({
        where: { projectId },
        include: { supervisor: { select: { id: true, name: true } } },
        orderBy: { deliveredAt: "asc" },
      }),
      prisma.actaCierre.findUnique({ where: { projectId } }),
      prisma.project.findUnique({
        where: { id: projectId },
        select: { contractAmount: true, currency: true },
      }),
    ]);
    const facturado = cortes.reduce(
      (sum, c) => sum + Number(c.invoicedValue),
      0,
    );
    const monto = project?.contractAmount
      ? Number(project.contractAmount)
      : null;
    res.json({
      cortes,
      entregas,
      cierre,
      facturacion: {
        facturado,
        montoContrato: monto,
        porcentaje: monto ? (facturado / monto) * 100 : null,
        anticipoCruzado: cortes.reduce(
          (s, c) => s + Number(c.advanceOffset),
          0,
        ),
        retencionAcumulada: cortes.reduce(
          (s, c) => s + Number(c.retentionApplied),
          0,
        ),
      },
    });
  },
);

actasRouter.post(
  "/projects/:id/actas-corte",
  authorize(AppModule.ACTAS, "editar"),
  async (req, res) => {
    const { section, invoicedValue, cutDate, advanceOffset, retentionApplied } =
      req.body ?? {};
    if (!section || invoicedValue === undefined) {
      res.status(400).json({
        error: "La torre/sección y el valor facturado son obligatorios.",
      });
      return;
    }
    const acta = await prisma.actaCorte.create({
      data: {
        projectId: String(req.params.id),
        section: String(section).trim(),
        invoicedValue,
        cutDate: cutDate ? new Date(cutDate) : new Date(),
        advanceOffset: advanceOffset ?? 0,
        retentionApplied: retentionApplied ?? 0,
      },
    });
    await logAudit(req.user!.id, "registrar_acta_corte", "ActaCorte", acta.id);
    res.status(201).json({ acta });
  },
);

actasRouter.post(
  "/projects/:id/actas-entrega",
  authorize(AppModule.ACTAS, "editar"),
  async (req, res) => {
    const { section, clientSignedName, deliveredAt } = req.body ?? {};
    if (!section) {
      res.status(400).json({ error: "La torre/sección es obligatoria." });
      return;
    }
    const acta = await prisma.actaEntrega.create({
      data: {
        projectId: String(req.params.id),
        section: String(section).trim(),
        clientSignedName: clientSignedName ? String(clientSignedName) : null,
        clientSignedAt: clientSignedName ? new Date() : null,
        supervisorId: req.user!.id,
        deliveredAt: deliveredAt ? new Date(deliveredAt) : new Date(),
      },
    });
    await logAudit(
      req.user!.id,
      "registrar_acta_entrega",
      "ActaEntrega",
      acta.id,
    );
    res.status(201).json({ acta });
  },
);

// Acta de cierre: única por proyecto; crea la garantía si hay retención
actasRouter.post(
  "/projects/:id/acta-cierre",
  authorize(AppModule.ACTAS, "editar"),
  async (req, res) => {
    const projectId = String(req.params.id);
    const existing = await prisma.actaCierre.findUnique({
      where: { projectId },
    });
    if (existing) {
      res.status(409).json({ error: "El proyecto ya tiene acta de cierre." });
      return;
    }
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { actasCorte: true, warranty: true },
    });
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado." });
      return;
    }
    const cierre = await prisma.actaCierre.create({
      data: { projectId, closedAt: new Date() },
    });
    // Garantía automática: retención acumulada, trámite estimado a 4 meses
    let warranty = project.warranty;
    if (!warranty) {
      const retencion = project.actasCorte.reduce(
        (s, c) => s + Number(c.retentionApplied),
        0,
      );
      const estimada = new Date();
      estimada.setMonth(estimada.getMonth() + 4);
      warranty = await prisma.warranty.create({
        data: {
          projectId,
          retentionValue: retencion,
          workEndDate: new Date(),
          estimatedProcessDate: estimada,
          status: WarrantyStatus.PENDIENTE,
        },
      });
    }
    await prisma.project.update({
      where: { id: projectId },
      data: { actualEndDate: new Date() },
    });
    await logAudit(
      req.user!.id,
      "registrar_acta_cierre",
      "ActaCierre",
      cierre.id,
    );
    res.status(201).json({ cierre, warranty });
  },
);
