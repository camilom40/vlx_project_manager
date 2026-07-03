// Traducción de enums internos (en inglés/código) a etiquetas visibles en español

export const MODULOS: Record<string, string> = {
  PROYECTOS: "Proyectos",
  COTIZACIONES: "Cotizaciones",
  CRM: "Seguimiento CRM",
  CONTRATOS: "Contratos",
  POLIZAS: "Pólizas",
  ANTICIPOS: "Anticipos",
  COMPRAS: "Compras",
  PRODUCCION: "Producción",
  INSTALACION: "Instalación",
  ACTAS: "Actas",
  GARANTIAS: "Garantías",
  ERRORES: "Errores y retrabajos",
  NOTIFICACIONES: "Notificaciones",
  USUARIOS: "Usuarios",
  EQUIPOS: "Equipos",
  DASHBOARD_GERENCIAL: "Dashboard gerencial",
  AUDITORIA: "Auditoría",
  PLANTILLAS: "Plantillas",
};

export const ROLES_ASIGNACION: Record<string, string> = {
  SUPERVISOR: "Supervisor de obra",
  COTIZADOR: "Cotizador",
  PLANEADOR: "Planeador",
  JEFE_TALLER: "Jefe de taller",
};

export function etiquetaModulo(modulo: string): string {
  return MODULOS[modulo] ?? modulo;
}
