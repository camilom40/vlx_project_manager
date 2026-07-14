import { prisma } from "./prisma";
import { AppModule } from "../generated/prisma/enums";

export type PermissionAction = "ver" | "editar";

export interface ModulePermission {
  canView: boolean;
  canEdit: boolean;
}

export type EffectivePermissions = Record<string, ModulePermission>;

export const ALL_MODULES = Object.values(AppModule);

// Nombre del equipo con acceso total implícito (definido por el spec)
export const MANAGEMENT_TEAM = "Gerencia";

// Equipo cotizador: sus líderes asignan cotizaciones a sus miembros
export const BUDGET_TEAM = "Presupuesto";

/**
 * Permisos efectivos de un usuario:
 * base del equipo, sobreescrita módulo a módulo por sus overrides.
 * Los miembros de Gerencia tienen acceso total.
 */
export async function getEffectivePermissions(
  userId: string,
): Promise<EffectivePermissions> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      team: { include: { permissions: true } },
      permissions: true,
    },
  });

  const result: EffectivePermissions = {};
  for (const m of ALL_MODULES) {
    result[m] = { canView: false, canEdit: false };
  }
  if (!user) return result;

  if (user.team?.name === MANAGEMENT_TEAM) {
    for (const m of ALL_MODULES) {
      result[m] = { canView: true, canEdit: true };
    }
    return result;
  }

  for (const p of user.team?.permissions ?? []) {
    result[p.module] = { canView: p.canView, canEdit: p.canEdit };
  }
  for (const p of user.permissions) {
    result[p.module] = { canView: p.canView, canEdit: p.canEdit };
  }
  return result;
}

export function can(
  perms: EffectivePermissions,
  module: AppModule,
  action: PermissionAction,
): boolean {
  const p = perms[module];
  if (!p) return false;
  return action === "ver" ? p.canView || p.canEdit : p.canEdit;
}
