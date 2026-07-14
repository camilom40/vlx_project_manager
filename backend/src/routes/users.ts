import { Router } from "express";
import { generateTempPassword, hashPassword } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { MANAGEMENT_TEAM } from "../lib/permissions";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { AppModule } from "../generated/prisma/enums";

export const usersRouter = Router();

usersRouter.use(authenticate);

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  isActive: true,
  isTeamLead: true,
  mustChangePassword: true,
  teamId: true,
  team: { select: { id: true, name: true } },
  createdAt: true,
} as const;

usersRouter.get("/", authorize(AppModule.USUARIOS, "ver"), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: userSelect,
    orderBy: { name: "asc" },
  });
  res.json({ users });
});

usersRouter.post("/", authorize(AppModule.USUARIOS, "editar"), async (req, res) => {
  const { name, email, phone, teamId, password, isTeamLead } = req.body ?? {};
  if (!name || !email) {
    res.status(400).json({ error: "El nombre y el correo son obligatorios." });
    return;
  }
  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    res.status(409).json({ error: "Ya existe un usuario con ese correo." });
    return;
  }
  const tempPassword = password ? String(password) : generateTempPassword();
  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email: normalizedEmail,
      phone: phone ? String(phone).trim() : null,
      teamId: teamId || null,
      isTeamLead: Boolean(isTeamLead),
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
    },
    select: userSelect,
  });
  await logAudit(req.user!.id, "crear_usuario", "User", user.id, {
    email: normalizedEmail,
  });
  // La contraseña temporal se muestra una sola vez
  res.status(201).json({ user, tempPassword });
});

usersRouter.put("/:id", authorize(AppModule.USUARIOS, "editar"), async (req, res) => {
  const { name, email, phone, teamId, isActive, isTeamLead } = req.body ?? {};
  const existing = await prisma.user.findUnique({
    where: { id: String(req.params.id) },
  });
  if (!existing) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }
  if (email) {
    const normalizedEmail = String(email).toLowerCase().trim();
    const emailTaken = await prisma.user.findFirst({
      where: { email: normalizedEmail, NOT: { id: existing.id } },
    });
    if (emailTaken) {
      res.status(409).json({ error: "Ya existe un usuario con ese correo." });
      return;
    }
  }
  // Nadie puede desactivar su propia cuenta (evita quedarse sin acceso).
  if (isActive === false && existing.id === req.user!.id) {
    res.status(400).json({
      error:
        "No puedes desactivar tu propio usuario. Pídele a otro administrador que lo haga.",
    });
    return;
  }
  // El equipo Gerencia siempre debe tener al menos un usuario activo.
  if (isActive === false && existing.teamId) {
    const equipo = await prisma.team.findUnique({
      where: { id: existing.teamId },
    });
    if (equipo?.name === MANAGEMENT_TEAM) {
      const otrosActivos = await prisma.user.count({
        where: { teamId: existing.teamId, isActive: true, NOT: { id: existing.id } },
      });
      if (otrosActivos === 0) {
        res.status(400).json({
          error:
            "No puedes desactivar el último usuario activo de Gerencia. Activa o crea otro usuario de Gerencia primero.",
        });
        return;
      }
    }
  }
  const user = await prisma.user.update({
    where: { id: existing.id },
    data: {
      name: name !== undefined ? String(name).trim() : undefined,
      email: email !== undefined ? String(email).toLowerCase().trim() : undefined,
      phone: phone !== undefined ? (phone ? String(phone).trim() : null) : undefined,
      teamId: teamId !== undefined ? teamId || null : undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      isTeamLead: isTeamLead !== undefined ? Boolean(isTeamLead) : undefined,
    },
    select: userSelect,
  });
  await logAudit(req.user!.id, "editar_usuario", "User", user.id);
  res.json({ user });
});

// Eliminar solo es posible si el usuario no dejó ningún rastro en el sistema
// (sin historial de auditoría, cotizaciones, actas, tareas, etc.). Si tiene
// historial, Postgres rechaza el borrado por las llaves foráneas y se lo
// indicamos al usuario para que desactive la cuenta en su lugar, conservando
// la trazabilidad.
usersRouter.delete(
  "/:id",
  authorize(AppModule.USUARIOS, "editar"),
  async (req, res) => {
    const id = String(req.params.id);
    if (id === req.user!.id) {
      res.status(400).json({ error: "No puedes eliminar tu propio usuario." });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado." });
      return;
    }
    try {
      await prisma.user.delete({ where: { id } });
    } catch {
      res.status(409).json({
        error:
          "No se puede eliminar: este usuario tiene historial asociado (cotizaciones, aprobaciones, actas, auditoría, etc.). Desactívalo en su lugar para conservar la trazabilidad.",
      });
      return;
    }
    await logAudit(req.user!.id, "eliminar_usuario", "User", id, {
      email: user.email,
    });
    res.json({ ok: true });
  },
);

usersRouter.post(
  "/:id/reset-password",
  authorize(AppModule.USUARIOS, "editar"),
  async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado." });
      return;
    }
    const tempPassword = generateTempPassword();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(tempPassword),
        mustChangePassword: true,
      },
    });
    await logAudit(req.user!.id, "resetear_password", "User", user.id);
    // Se devuelve una sola vez para que Gerencia la comunique
    res.json({ tempPassword });
  },
);

usersRouter.get(
  "/:id/permisos",
  authorize(AppModule.USUARIOS, "ver"),
  async (req, res) => {
    const overrides = await prisma.userPermission.findMany({
      where: { userId: String(req.params.id) },
    });
    res.json({ overrides });
  },
);

usersRouter.put(
  "/:id/permisos",
  authorize(AppModule.USUARIOS, "editar"),
  async (req, res) => {
    const { overrides } = req.body ?? {};
    if (!Array.isArray(overrides)) {
      res.status(400).json({ error: "Formato de permisos inválido." });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado." });
      return;
    }
    const validModules = new Set(Object.values(AppModule));
    await prisma.$transaction([
      prisma.userPermission.deleteMany({ where: { userId: user.id } }),
      prisma.userPermission.createMany({
        data: overrides
          .filter((o: { module: string }) => validModules.has(o.module as AppModule))
          .map((o: { module: AppModule; canView?: boolean; canEdit?: boolean }) => ({
            userId: user.id,
            module: o.module,
            canView: Boolean(o.canView),
            canEdit: Boolean(o.canEdit),
          })),
      }),
    ]);
    await logAudit(req.user!.id, "editar_permisos_usuario", "User", user.id);
    const saved = await prisma.userPermission.findMany({
      where: { userId: user.id },
    });
    res.json({ overrides: saved });
  },
);
