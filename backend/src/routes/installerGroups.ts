import { Router } from "express";
import { logAudit } from "../lib/audit";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { AppModule } from "../generated/prisma/enums";

export const installerGroupsRouter = Router();

installerGroupsRouter.use(authenticate);

const groupInclude = {
  members: {
    where: { isActive: true },
    include: {
      user: { select: { id: true, name: true, phone: true } },
    },
  },
  _count: { select: { projects: { where: { isActive: true } } } },
} as const;

installerGroupsRouter.get(
  "/",
  authorize(AppModule.EQUIPOS, "ver"),
  async (_req, res) => {
    const groups = await prisma.installerGroup.findMany({
      include: groupInclude,
      orderBy: { name: "asc" },
    });
    res.json({ groups });
  },
);

installerGroupsRouter.post(
  "/",
  authorize(AppModule.EQUIPOS, "editar"),
  async (req, res) => {
    const { name } = req.body ?? {};
    if (!name || !String(name).trim()) {
      res.status(400).json({ error: "El nombre del grupo es obligatorio." });
      return;
    }
    const trimmed = String(name).trim();
    const existing = await prisma.installerGroup.findUnique({
      where: { name: trimmed },
    });
    if (existing) {
      res.status(409).json({ error: "Ya existe un grupo con ese nombre." });
      return;
    }
    const group = await prisma.installerGroup.create({
      data: { name: trimmed },
      include: groupInclude,
    });
    await logAudit(
      req.user!.id,
      "crear_grupo_instaladores",
      "InstallerGroup",
      group.id,
    );
    res.status(201).json({ group });
  },
);

installerGroupsRouter.put(
  "/:id",
  authorize(AppModule.EQUIPOS, "editar"),
  async (req, res) => {
    const { name } = req.body ?? {};
    const group = await prisma.installerGroup.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!group) {
      res.status(404).json({ error: "Grupo no encontrado." });
      return;
    }
    const updated = await prisma.installerGroup.update({
      where: { id: group.id },
      data: { name: name ? String(name).trim() : undefined },
      include: groupInclude,
    });
    await logAudit(
      req.user!.id,
      "editar_grupo_instaladores",
      "InstallerGroup",
      group.id,
    );
    res.json({ group: updated });
  },
);

// Reemplaza los integrantes activos del grupo
installerGroupsRouter.put(
  "/:id/miembros",
  authorize(AppModule.EQUIPOS, "editar"),
  async (req, res) => {
    const { userIds } = req.body ?? {};
    if (!Array.isArray(userIds)) {
      res.status(400).json({ error: "Formato de integrantes inválido." });
      return;
    }
    const group = await prisma.installerGroup.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!group) {
      res.status(404).json({ error: "Grupo no encontrado." });
      return;
    }
    const ids = userIds.map(String);
    await prisma.$transaction([
      prisma.installerGroupMember.updateMany({
        where: { groupId: group.id, userId: { notIn: ids } },
        data: { isActive: false },
      }),
      ...ids.map((userId) =>
        prisma.installerGroupMember.upsert({
          where: { groupId_userId: { groupId: group.id, userId } },
          update: { isActive: true },
          create: { groupId: group.id, userId },
        }),
      ),
    ]);
    await logAudit(
      req.user!.id,
      "editar_integrantes_grupo",
      "InstallerGroup",
      group.id,
    );
    const updated = await prisma.installerGroup.findUnique({
      where: { id: group.id },
      include: groupInclude,
    });
    res.json({ group: updated });
  },
);
