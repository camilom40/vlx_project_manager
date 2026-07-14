import { notify, teamLeadIds } from "./notifications";
import { BUDGET_TEAM } from "./permissions";
import { prisma } from "./prisma";
import { QuoteStatus } from "../generated/prisma/enums";

// Recordatorio de licitaciones: cotizaciones con fecha límite que aún no se
// han enviado al cliente. Se avisa una sola vez cuando faltan 3 días o menos
// (dueSoonNotifiedAt se resetea si la fecha límite cambia).

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

export function startDeadlineWatcher(): void {
  const correr = () =>
    checkQuoteDeadlines().catch((err) =>
      console.error("Error revisando fechas límite de cotizaciones:", err),
    );
  correr();
  setInterval(correr, INTERVALO_MS);
}
