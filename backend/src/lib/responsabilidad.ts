import { AuthUser } from "../middleware/auth";
import {
  ACCOUNTING_TEAM,
  BUDGET_TEAM,
  MANAGEMENT_TEAM,
} from "./permissions";
import { QuoteStatus } from "../generated/prisma/enums";

// ============================================================
// ÚNICA fuente de verdad de "el balón está en tu cancha" para
// cotizaciones. La consumen: el contador de pendientes de la barra,
// el punto de acción del tablero (vía GET /api/quotes) y cualquier
// disparador que necesite saber quién es el responsable de un estado.
// Si cambia una responsabilidad del flujo, se cambia SOLO aquí.
// ============================================================

export interface QuoteResponsabilidad {
  status: QuoteStatus;
  quoterId: string | null;
  projectId: string | null;
  budgetApprovedAt: Date | string | null;
  requiresManagementApproval: boolean;
  managementApprovedAt: Date | string | null;
}

/** ¿Puede asignar cotizaciones? Gerencia o líder del equipo Presupuesto. */
export function puedeAsignarCotizaciones(user: AuthUser): boolean {
  return (
    user.teamName === MANAGEMENT_TEAM ||
    (user.isTeamLead && user.teamName === BUDGET_TEAM)
  );
}

/** ¿Esta cotización requiere una acción de ESTE usuario ahora mismo? */
export function cotizacionRequiereAccion(
  user: AuthUser,
  q: QuoteResponsabilidad,
): boolean {
  const esMia = q.quoterId === user.id;
  const esGerencia = user.teamName === MANAGEMENT_TEAM;
  switch (q.status) {
    case QuoteStatus.INGRESADA:
      // Asignarla: líderes de Presupuesto o Gerencia
      return puedeAsignarCotizaciones(user);
    case QuoteStatus.EN_REVISION:
      // Aprobarla: presupuesto (líderes/Gerencia) y gerencia si la exige
      return (
        (puedeAsignarCotizaciones(user) && !q.budgetApprovedAt) ||
        (esGerencia && q.requiresManagementApproval && !q.managementApprovedAt)
      );
    case QuoteStatus.BORRADOR:
    case QuoteStatus.CAMBIOS_SOLICITADOS:
      // Elaborarla / ajustarla: el cotizador responsable
      return esMia;
    case QuoteStatus.APROBADA:
      // Enviarla al cliente: el cotizador responsable
      return esMia;
    case QuoteStatus.ACEPTADA:
      // Crear el centro de costo y generar el proyecto: Contabilidad
      return user.teamName === ACCOUNTING_TEAM && !q.projectId;
    default:
      // ENVIADA / SIN_RESPUESTA (se espera al cliente) y RECHAZADA (cerrada)
      return false;
  }
}
