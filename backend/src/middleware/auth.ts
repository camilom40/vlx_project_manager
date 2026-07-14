import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/auth";
import {
  can,
  EffectivePermissions,
  getEffectivePermissions,
  PermissionAction,
} from "../lib/permissions";
import { prisma } from "../lib/prisma";
import { AppModule } from "../generated/prisma/enums";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  teamId: string | null;
  teamName: string | null;
  isTeamLead: boolean;
  mustChangePassword: boolean;
  permissions: EffectivePermissions;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Debes iniciar sesión para continuar." });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res
      .status(401)
      .json({ error: "Tu sesión expiró. Inicia sesión nuevamente." });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { team: true },
  });
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Usuario inactivo o inexistente." });
    return;
  }
  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    teamId: user.teamId,
    teamName: user.team?.name ?? null,
    isTeamLead: user.isTeamLead,
    mustChangePassword: user.mustChangePassword,
    permissions: await getEffectivePermissions(user.id),
  };
  next();
}

export function authorize(module: AppModule, action: PermissionAction) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Debes iniciar sesión para continuar." });
      return;
    }
    if (!can(req.user.permissions, module, action)) {
      res.status(403).json({
        error: "No tienes permiso para acceder a este módulo.",
      });
      return;
    }
    next();
  };
}
