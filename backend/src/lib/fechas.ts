// Fechas "solo día" (YYYY-MM-DD, de un <input type="date">) se interpretan
// como mediodía UTC: así el día mostrado no se corre en ninguna zona horaria
// razonable (Colombia es UTC-5; medianoche UTC se mostraba un día antes).
const SOLO_DIA = /^\d{4}-\d{2}-\d{2}$/;

export function parseFecha(valor: unknown): Date {
  const s = String(valor);
  if (SOLO_DIA.test(s)) return new Date(`${s}T12:00:00Z`);
  return new Date(s);
}
