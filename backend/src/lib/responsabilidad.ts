import { AuthUser } from "../middleware/auth";
import {
  ACCOUNTING_TEAM,
  BUDGET_TEAM,
  MANAGEMENT_TEAM,
  TREASURY_TEAM,
  can,
} from "./permissions";
import {
  AdvanceStatus,
  AppModule,
  ContractStatus,
  PolicyStatus,
  QuoteStatus,
} from "../generated/prisma/enums";

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

// ============================================================
// Contrato → pólizas / anticipos → compras.
// Misma idea: quién es el dueño de cada estado. La consumen el
// contador de pendientes del módulo Contratos, el punto de acción
// del TabContrato (vía el flag que devuelve el GET de contratos) y
// los disparadores de notificación. Fuente única: SOLO aquí.
// ============================================================

// Estados de póliza que cuentan como "resuelta" para liberar Compras
const POLIZAS_RESUELTAS = new Set<PolicyStatus>([
  PolicyStatus.EXPEDIDA,
  PolicyStatus.PAGADA,
  PolicyStatus.ENVIADA_AL_CLIENTE,
]);

export interface ContratoResponsabilidad {
  status: ContractStatus;
  reviewerId: string | null;
  requiresPolicy: boolean;
  requiresAdvance: boolean;
  // Estado agregado de pólizas y anticipos del proyecto (para el candado)
  polizasResueltas: boolean;
  anticipoResuelto: boolean;
}

/**
 * ¿Puede este usuario revisar/editar este contrato? El revisor asignado
 * (cualquier usuario), quien tenga el módulo Contratos, o Gerencia.
 */
export function puedeRevisarContrato(
  user: AuthUser,
  contract: { reviewerId: string | null },
): boolean {
  return (
    contract.reviewerId === user.id ||
    user.teamName === MANAGEMENT_TEAM ||
    can(user.permissions, AppModule.CONTRATOS, "editar")
  );
}

/** ¿El candado de compras está liberado? (para notificar a Compras). */
export function comprasLiberadas(project: {
  requiresPolicy: boolean;
  requiresAdvance: boolean;
  polizasResueltas: boolean;
  anticipoVerificado: boolean;
  earlyStartWithoutAdvance: boolean;
}): boolean {
  const polizasOk = !project.requiresPolicy || project.polizasResueltas;
  const anticipoOk =
    !project.requiresAdvance ||
    project.anticipoVerificado ||
    project.earlyStartWithoutAdvance;
  return polizasOk && anticipoOk;
}

/** Helper: ¿todas las pólizas registradas están resueltas y hay al menos una? */
export function polizasResueltas(
  policies: { status: PolicyStatus }[],
): boolean {
  return policies.length > 0 && policies.every((p) => POLIZAS_RESUELTAS.has(p.status));
}

/** Helper: ¿hay algún anticipo verificado en banco? */
export function anticipoVerificado(
  advances: { status: AdvanceStatus }[],
): boolean {
  return advances.some((a) => a.status === AdvanceStatus.VERIFICADO);
}

/** ¿Este contrato requiere una acción de ESTE usuario ahora mismo? */
export function contratoRequiereAccion(
  user: AuthUser,
  c: ContratoResponsabilidad,
): boolean {
  const esRevisor = c.reviewerId === user.id;
  const esGerencia = user.teamName === MANAGEMENT_TEAM;
  const gestionaPolizas =
    can(user.permissions, AppModule.POLIZAS, "editar") &&
    (user.teamName === ACCOUNTING_TEAM || user.teamName === TREASURY_TEAM);
  const gestionaAnticipos =
    can(user.permissions, AppModule.ANTICIPOS, "editar") &&
    (user.teamName === ACCOUNTING_TEAM || user.teamName === TREASURY_TEAM);

  switch (c.status) {
    case ContractStatus.RECIBIDO:
      // Asignar revisor: quien tenga Contratos editar (o Gerencia)
      return can(user.permissions, AppModule.CONTRATOS, "editar");
    case ContractStatus.EN_REVISION:
      // Revisar (anticipo + pólizas requeridas) y enviar a firma: el revisor
      return esRevisor;
    case ContractStatus.PENDIENTE_FIRMA:
      // Firmar o rechazar: Gerencia
      return esGerencia;
    case ContractStatus.RECHAZADO_CON_OBSERVACIONES:
      // Corregir y reenviar: el revisor
      return esRevisor;
    case ContractStatus.FIRMADO:
      // Falta cerrar el candado de compras
      if (c.requiresPolicy && !c.polizasResueltas && gestionaPolizas) return true;
      if (c.requiresAdvance && !c.anticipoResuelto && gestionaAnticipos) return true;
      return false;
    default:
      return false;
  }
}
