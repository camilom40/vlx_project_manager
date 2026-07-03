// Traducción de enums internos (en inglés/código) a etiquetas visibles en español

export const MODULOS: Record<string, string> = {
  PROYECTOS: "Proyectos",
  CLIENTES: "Clientes",
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

export const ETAPAS: Record<string, string> = {
  COTIZACION: "Cotización",
  CONTRATO: "Contrato",
  PRODUCCION: "Producción",
  INSTALACION: "Instalación",
  GARANTIAS: "Garantías",
};

export const ORDEN_ETAPAS = [
  "COTIZACION",
  "CONTRATO",
  "PRODUCCION",
  "INSTALACION",
  "GARANTIAS",
];

export const ESTADOS_PROYECTO: Record<string, string> = {
  ACTIVO: "Activo",
  EN_PAUSA: "En pausa",
  CERRADO: "Cerrado",
  CANCELADO: "Cancelado",
};

export const TIPOS_PROYECTO: Record<string, string> = {
  PRINCIPAL: "Principal",
  ADICIONAL: "Adicional",
};

export const EMPRESAS: Record<string, string> = {
  VITRALUX: "Vitralux (Colombia)",
  VLX: "VLX Windows (USA)",
};

export const ESTADOS_COTIZACION: Record<string, string> = {
  BORRADOR: "Borrador",
  EN_REVISION: "En revisión",
  APROBADA: "Aprobada",
  ENVIADA: "Enviada",
  ACEPTADA: "Aceptada",
  RECHAZADA: "Rechazada",
  CAMBIOS_SOLICITADOS: "Cambios solicitados",
  SIN_RESPUESTA: "Sin respuesta",
};

export const RAZONES_RECHAZO: Record<string, string> = {
  MUY_COSTOSOS: "Muy costosos",
  NO_INFORMARON: "No informaron",
  UBICACION_NO_APLICA: "Ubicación no aplica",
  COMPETENCIA: "Competencia",
  OTROS: "Otros",
};

export const CANALES_CONTACTO: Record<string, string> = {
  LLAMADA: "Llamada",
  CORREO: "Correo",
  WHATSAPP: "WhatsApp",
  VISITA: "Visita",
  OTRO: "Otro",
};

export const ESTADOS_CONTRATO: Record<string, string> = {
  RECIBIDO: "Recibido",
  EN_REVISION: "En revisión",
  RECHAZADO_CON_OBSERVACIONES: "Rechazado con observaciones",
  FIRMADO: "Firmado",
};

export const ESTADOS_POLIZA: Record<string, string> = {
  REQUERIDA: "Requerida",
  SOLICITADA: "Solicitada",
  EXPEDIDA: "Expedida",
  PAGADA: "Pagada",
  ENVIADA_AL_CLIENTE: "Enviada al cliente",
};

export const ESTADOS_ANTICIPO: Record<string, string> = {
  CUENTA_COBRO_GENERADA: "Cuenta de cobro generada",
  ENVIADO_AL_CLIENTE: "Enviado al cliente",
  CONSIGNADO: "Consignado",
  VERIFICADO: "Verificado",
};

export const CATEGORIAS_COMPRA: Record<string, string> = {
  ALUMINIO: "Aluminio",
  VIDRIO: "Vidrio",
  ACCESORIOS: "Accesorios",
  OTRO: "Otro",
};

export const ESTADOS_COMPRA: Record<string, string> = {
  COTIZANDO: "Cotizando",
  ORDENADA: "Ordenada",
  ENTREGADA_PARCIAL: "Entrega parcial",
  ENTREGADA: "Entregada",
  CANCELADA: "Cancelada",
};

export const ESTADOS_DT: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_COLA: "En cola",
  EN_PRODUCCION: "En producción",
  TERMINADO: "Terminado",
  DESPACHADO: "Despachado",
};

export const PRIORIDADES: Record<string, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

export const ESTADOS_REMISION: Record<string, string> = {
  DESPACHADO: "Despachado",
  RECIBIDO_CONFORME: "Recibido conforme",
  RECIBIDO_CON_OBSERVACIONES: "Recibido con observaciones",
};

export const TIPOS_ERROR: Record<string, string> = {
  DANO_TRANSPORTE: "Daño de transporte",
  ERROR_MEDIDAS: "Error de medidas",
  SENTIDO_APERTURA: "Sentido de apertura",
  DIGITACION: "Digitación",
  CANTIDADES: "Cantidades",
  OTRO: "Otro",
};

export const ESTADOS_GARANTIA: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "En proceso",
  PAZ_Y_SALVOS_FIRMADOS: "Paz y salvos firmados",
  DOCUMENTACION_ENVIADA: "Documentación enviada",
  COBRADA: "Cobrada",
};

export const ESTADOS_TAREA: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_PROGRESO: "En progreso",
  BLOQUEADA: "Bloqueada",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
};
