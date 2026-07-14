-- Fecha límite de entrega de la cotización (licitaciones) + dedup del recordatorio
ALTER TABLE "Quote" ADD COLUMN "dueDate" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "dueSoonNotifiedAt" TIMESTAMP(3);
