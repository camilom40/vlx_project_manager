import { notify, teamLeadIds, teamMemberIds } from "./notifications";
import { BUDGET_TEAM, MANAGEMENT_TEAM } from "./permissions";
import { prisma } from "./prisma";
import { QuoteStatus } from "../generated/prisma/enums";

// Recordatorio de licitaciones: cotizaciones con fecha límite que aún no se
// han enviado al cliente. Se avisa una sola vez cuando faltan 3 días o menos
// (dueSoonNotifiedAt se resetea si la fecha límite cambia). Si la fecha pasa
// sin que se envíe, se escala una vez a Gerencia (overdueNotifiedAt).

const DIAS_ANTICIPACION = 3;
const INTERVALO_MS = 60 * 60 * 1000; // cada hora

// Estados en los que la cotización todavía no se ha enviado
const ESTADOS_PRE_ENVIO: QuoteStatus[] = [
  QuoteStatus.INGRESADA,
  QuoteStatus.BORRADOR,
  QuoteStatus.EN_REVISION,
  QuoteStatus.APROBADA,
  QuoteStatus.CAMBIOS_SOLICITADOS,
];

export async function checkQuoteDeadlines(): Promise<void> {
  const ahora = new Date();
  const limite = new Date(ahora.getTime() + DIAS_ANTICIPACION * 86400000);
  const quotes = await prisma.quote.findMany({
    where: {
      dueDate: { not: null, lte: limite },
      dueSoonNotifiedAt: null,
      status: { in: ESTADOS_PRE_ENVIO },
    },
    select: {
      id: true,
      title: true,
      clientName: true,
      dueDate: true,
      quoterId: true,
    },
  });
  if (quotes.length === 0) return;

  const lideres = await teamLeadIds(BUDGET_TEAM);
  for (const q of quotes) {
    const dias = Math.ceil(
      (q.dueDate!.getTime() - ahora.getTime()) / 86400000,
    );
    const fechaLimite = q.dueDate!.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const plazo =
      dias > 1
        ? `vence en ${dias} días`
        : dias === 1
          ? "vence mañana"
          : dias === 0
            ? "vence hoy"
            : `venció hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "día" : "días"}`;
    const titulo =
      dias >= 0
        ? `Cotización por vencer: ${q.title}`
        : `Cotización vencida sin enviar: ${q.title}`;
    void notify(
      [...(q.quoterId ? [q.quoterId] : []), ...lideres],
      "cotizacion.vence_pronto",
      titulo,
      `La cotización "${q.title}" del cliente ${q.clientName} ${plazo} (fecha límite: ${fechaLimite}) y aún no se ha enviado al cliente.`,
      null,
    );
    await prisma.quote.update({
      where: { id: q.id },
      data: { dueSoonNotifiedAt: ahora },
    });
  }
}

// Escalamiento: la fecha límite ya pasó y la cotización sigue sin enviarse →
// avisar una sola vez a Gerencia (además del responsable y los líderes).
export async function checkOverdueQuotes(): Promise<void> {
  const ahora = new Date();
  const vencidas = await prisma.quote.findMany({
    where: {
      dueDate: { not: null, lt: ahora },
      overdueNotifiedAt: null,
      status: { in: ESTADOS_PRE_ENVIO },
    },
    select: {
      id: true,
      title: true,
      clientName: true,
      dueDate: true,
      quoterId: true,
    },
  });
  if (vencidas.length === 0) return;

  const [gerencia, lideres] = await Promise.all([
    teamMemberIds(MANAGEMENT_TEAM),
    teamLeadIds(BUDGET_TEAM),
  ]);
  for (const q of vencidas) {
    const dias = Math.floor(
      (ahora.getTime() - q.dueDate!.getTime()) / 86400000,
    );
    const fechaLimite = q.dueDate!.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    void notify(
      [...gerencia, ...lideres, ...(q.quoterId ? [q.quoterId] : [])],
      "cotizacion.vencida",
      `Cotización vencida sin enviar: ${q.title}`,
      `La cotización "${q.title}" del cliente ${q.clientName} venció el ${fechaLimite}${dias > 0 ? ` (hace ${dias} ${dias === 1 ? "día" : "días"})` : ""} y no se envió al cliente. Requiere atención de Gerencia.`,
      null,
    );
    await prisma.quote.update({
      where: { id: q.id },
      data: { overdueNotifiedAt: ahora },
    });
  }
}

export function startDeadlineWatcher(): void {
  const correr = () => {
    checkQuoteDeadlines().catch((err) =>
      console.error("Error revisando fechas límite de cotizaciones:", err),
    );
    checkOverdueQuotes().catch((err) =>
      console.error("Error escalando cotizaciones vencidas:", err),
    );
  };
  correr();
  setInterval(correr, INTERVALO_MS);
}
