import { Router } from "express";
import { logAudit } from "../lib/audit";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { AppModule } from "../generated/prisma/enums";

export const teamsRouter = Router();

teamsRouter.use(authenticate);

teamsRouter.get("/", authorize(AppModule.EQUIPOS, "ver"), async (_req, res) => {
  const teams = await prisma.team.findMany({
    include: {
      permissions: true,
      _count: { select: { members: true } },
    },
    orderBy: { name: "asc" },
  });
  res.json({ teams });
});

teamsRouter.post("/", authorize(AppModule.EQUIPOS, "editar"), async (req, res) => {
  const { name } = req.body ?? {};
  if (!name || !String(name).trim()) {
    res.status(400).json({ error: "El nombre del equipo es obligatorio." });
    return;
  }
  const trimmed = String(name).trim();
  const existing = await prisma.team.findUnique({ where: { name: trimmed } });
  if (existing) {
    res.status(409).json({ error: "Ya existe un equipo con ese nombre." });
    return;
  }
  const team = await prisma.team.create({ data: { name: trimmed } });
  await logAudit(req.user!.id, "crear_equipo", "Team", team.id, {
    name: trimmed,
  });
  res.status(201).json({ team });
});

teamsRouter.put("/:id", authorize(AppModule.EQUIPOS, "editar"), async (req, res) => {
  const { name } = req.body ?? {};
  if (!name || !String(name).trim()) {
    res.status(400).json({ error: "El nombre del equipo es obligatorio." });
    return;
  }
  const team = await prisma.team.findUnique({ where: { id: String(req.params.id) } });
  if (!team) {
    res.status(404).json({ error: "Equipo no encontrado." });
    return;
  }
  const updated = await prisma.team.update({
    where: { id: team.id },
    data: { name: String(name).trim() },
  });
  await logAudit(req.user!.id, "editar_equipo", "Team", team.id);
  res.json({ team: updated });
});

teamsRouter.put(
  "/:id/permisos",
  authorize(AppModule.EQUIPOS, "editar"),
  async (req, res) => {
    const { permissions } = req.body ?? {};
    if (!Array.isArray(permissions)) {
      res.status(400).json({ error: "Formato de permisos inválido." });
      return;
    }
    const team = await prisma.team.findUnique({ where: { id: String(req.params.id) } });
    if (!team) {
      res.status(404).json({ error: "Equipo no encontrado." });
      return;
    }
    const validModules = new Set(Object.values(AppModule));
    await prisma.$transaction([
      prisma.teamPermission.deleteMany({ where: { teamId: team.id } }),
      prisma.teamPermission.createMany({
        data: permissions
          .filter((p: { module: string }) => validModules.has(p.module as AppModule))
          .map((p: { module: AppModule; canView?: boolean; canEdit?: boolean }) => ({
            teamId: team.id,
            module: p.module,
            canView: Boolean(p.canView),
            canEdit: Boolean(p.canEdit),
          })),
      }),
    ]);
    await logAudit(req.user!.id, "editar_permisos_equipo", "Team", team.id);
    const saved = await prisma.teamPermission.findMany({
      where: { teamId: team.id },
    });
    res.json({ permissions: saved });
  },
);
