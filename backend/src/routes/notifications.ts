import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

// Notificaciones del usuario autenticado (bandeja en la app)
notificationsRouter.get("/", async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { recipientId: req.user!.id },
    include: { project: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = await prisma.notification.count({
    where: { recipientId: req.user!.id, read: false },
  });
  res.json({ notifications, unread });
});

notificationsRouter.put("/leer-todas", async (req, res) => {
  await prisma.notification.updateMany({
    where: { recipientId: req.user!.id, read: false },
    data: { read: true },
  });
  res.json({ ok: true });
});

// Eliminar de mi bandeja todo lo ya leído
notificationsRouter.delete("/leidas", async (req, res) => {
  const r = await prisma.notification.deleteMany({
    where: { recipientId: req.user!.id, read: true },
  });
  res.json({ eliminadas: r.count });
});

notificationsRouter.put("/:id/leer", async (req, res) => {
  const n = await prisma.notification.findUnique({
    where: { id: String(req.params.id) },
  });
  if (!n || n.recipientId !== req.user!.id) {
    res.status(404).json({ error: "Notificación no encontrada." });
    return;
  }
  await prisma.notification.update({
    where: { id: n.id },
    data: { read: true },
  });
  res.json({ ok: true });
});
