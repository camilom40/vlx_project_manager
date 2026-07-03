import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { AppModule } from "../generated/prisma/enums";

// Audit trail global: quién hizo qué y cuándo
export const auditRouter = Router();

auditRouter.use(authenticate);

auditRouter.get("/", authorize(AppModule.AUDITORIA, "ver"), async (req, res) => {
  const { entidad, usuario, pagina } = req.query;
  const take = 50;
  const skip = (Math.max(1, Number(pagina) || 1) - 1) * take;
  const where = {
    entity: entidad ? String(entidad) : undefined,
    userId: usuario ? String(usuario) : undefined,
  };
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.auditLog.count({ where }),
  ]);
  res.json({ logs, total, paginas: Math.ceil(total / take) });
});
