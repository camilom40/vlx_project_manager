-- Las notificaciones de cotización enlazan a la cotización (como ya hacen con proyecto)
ALTER TABLE "Notification" ADD COLUMN "quoteId" TEXT;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
