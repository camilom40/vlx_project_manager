-- Escalamiento a Gerencia cuando la cotización vence sin enviarse (dedup)
ALTER TABLE "Quote" ADD COLUMN "overdueNotifiedAt" TIMESTAMP(3);
