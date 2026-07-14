import { Router } from "express";
import {
  hashPassword,
  signToken,
  verifyPassword,
} from "../lib/auth";
import { logAudit } from "../lib/audit";
import { getEffectivePermissions } from "../lib/permissions";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";

export const authRouter = Router();

function publicUser(user: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  teamId: string | null;
  isTeamLead: boolean;
  mustChangePassword: boolean;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    teamId: user.teamId,
    isTeamLead: user.isTeamLead,
    mustChangePassword: user.mustChangePassword,
  };
}

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "Ingresa tu correo y tu contraseña." });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { email: String(email).toLowerCase().trim() },
    include: { team: true },
  });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Correo o contraseña incorrectos." });
    return;
  }
  if (!user.isActive) {
    res.status(403).json({
      error: "Tu cuenta está desactivada. Contacta a Gerencia.",
    });
    return;
  }
  const token = signToken({ userId: user.id });
  const permissions = await getEffectivePermissions(user.id);
  await logAudit(user.id, "iniciar_sesion", "User", user.id);
  res.json({
    token,
    user: { ...publicUser(user), teamName: user.team?.name ?? null },
    permissions,
  });
});

authRouter.post("/logout", authenticate, async (req, res) => {
  await logAudit(req.user!.id, "cerrar_sesion", "User", req.user!.id);
  res.json({ ok: true });
});

authRouter.get("/me", authenticate, async (req, res) => {
  res.json({
    user: {
      id: req.user!.id,
      name: req.user!.name,
      email: req.user!.email,
      teamId: req.user!.teamId,
      teamName: req.user!.teamName,
      isTeamLead: req.user!.isTeamLead,
      mustChangePassword: req.user!.mustChangePassword,
    },
    permissions: req.user!.permissions,
  });
});

authRouter.post("/cambiar-password", authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!newPassword || String(newPassword).length < 8) {
    res.status(400).json({
      error: "La nueva contraseña debe tener al menos 8 caracteres.",
    });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }
  // Con cambio forzado (contraseña temporal) no se exige la contraseña actual
  if (!user.mustChangePassword) {
    if (
      !currentPassword ||
      !(await verifyPassword(currentPassword, user.passwordHash))
    ) {
      res.status(401).json({ error: "La contraseña actual es incorrecta." });
      return;
    }
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(String(newPassword)),
      mustChangePassword: false,
    },
  });
  await logAudit(user.id, "cambiar_password", "User", user.id);
  res.json({ ok: true });
});
