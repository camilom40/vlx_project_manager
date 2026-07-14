-- Cotizaciones independientes del proyecto:
-- la cotización nace antes del proyecto; una aceptada genera un proyecto (1-a-1).
-- El proyecto pierde la etapa COTIZACION y nace en CONTRATO.

-- 1) Data-fix de ProjectStage antes de recrear el enum sin COTIZACION
DELETE FROM "ProjectStageHistory" WHERE "toStage" = 'COTIZACION' AND "fromStage" IS NOT NULL;
UPDATE "ProjectStageHistory" SET "toStage" = 'CONTRATO' WHERE "toStage" = 'COTIZACION';
UPDATE "ProjectStageHistory" SET "fromStage" = NULL WHERE "fromStage" = 'COTIZACION';
UPDATE "Project" SET "currentStage" = 'CONTRATO' WHERE "currentStage" = 'COTIZACION';
UPDATE "Task" SET "stage" = NULL WHERE "stage" = 'COTIZACION';
UPDATE "ReworkError" SET "stage" = 'CONTRATO' WHERE "stage" = 'COTIZACION';

-- 2) Recrear ProjectStage sin COTIZACION
CREATE TYPE "ProjectStage_new" AS ENUM ('CONTRATO', 'PRODUCCION', 'INSTALACION', 'GARANTIAS');
ALTER TABLE "Project" ALTER COLUMN "currentStage" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "currentStage" TYPE "ProjectStage_new" USING ("currentStage"::text::"ProjectStage_new");
ALTER TABLE "ProjectStageHistory" ALTER COLUMN "fromStage" TYPE "ProjectStage_new" USING ("fromStage"::text::"ProjectStage_new");
ALTER TABLE "ProjectStageHistory" ALTER COLUMN "toStage" TYPE "ProjectStage_new" USING ("toStage"::text::"ProjectStage_new");
ALTER TABLE "ReworkError" ALTER COLUMN "stage" TYPE "ProjectStage_new" USING ("stage"::text::"ProjectStage_new");
ALTER TABLE "Task" ALTER COLUMN "stage" TYPE "ProjectStage_new" USING ("stage"::text::"ProjectStage_new");
ALTER TYPE "ProjectStage" RENAME TO "ProjectStage_old";
ALTER TYPE "ProjectStage_new" RENAME TO "ProjectStage";
DROP TYPE "ProjectStage_old";
ALTER TABLE "Project" ALTER COLUMN "currentStage" SET DEFAULT 'CONTRATO';

-- 3) Recrear QuoteStatus con INGRESADA (recreación completa para poder
--    usar el valor nuevo como default en la misma transacción)
CREATE TYPE "QuoteStatus_new" AS ENUM ('INGRESADA', 'BORRADOR', 'EN_REVISION', 'APROBADA', 'ENVIADA', 'ACEPTADA', 'RECHAZADA', 'CAMBIOS_SOLICITADOS', 'SIN_RESPUESTA');
ALTER TABLE "Quote" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Quote" ALTER COLUMN "status" TYPE "QuoteStatus_new" USING ("status"::text::"QuoteStatus_new");
ALTER TYPE "QuoteStatus" RENAME TO "QuoteStatus_old";
ALTER TYPE "QuoteStatus_new" RENAME TO "QuoteStatus";
DROP TYPE "QuoteStatus_old";
ALTER TABLE "Quote" ALTER COLUMN "status" SET DEFAULT 'INGRESADA';

-- 4) Líder de equipo
ALTER TABLE "User" ADD COLUMN "isTeamLead" BOOLEAN NOT NULL DEFAULT false;

-- 5) Quote independiente: columnas nuevas (nullable primero) y aflojar obligatorias
ALTER TABLE "Quote" DROP CONSTRAINT "Quote_projectId_fkey";
ALTER TABLE "Quote" DROP CONSTRAINT "Quote_quoterId_fkey";
ALTER TABLE "Quote"
  ADD COLUMN "clientId" TEXT,
  ADD COLUMN "clientName" TEXT,
  ADD COLUMN "company" "Company" NOT NULL DEFAULT 'VITRALUX',
  ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'COP',
  ADD COLUMN "description" TEXT,
  ADD COLUMN "market" "Market" NOT NULL DEFAULT 'CO',
  ADD COLUMN "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "title" TEXT,
  ALTER COLUMN "projectId" DROP NOT NULL,
  ALTER COLUMN "quoterId" DROP NOT NULL,
  ALTER COLUMN "amount" DROP NOT NULL,
  ALTER COLUMN "marginPercent" DROP NOT NULL;

-- Backfill desde el proyecto al que pertenecía cada cotización
UPDATE "Quote" q SET
  "title" = p."name",
  "clientId" = p."clientId",
  "clientName" = p."clientName",
  "market" = p."market",
  "company" = p."company",
  "currency" = p."currency",
  "receivedAt" = q."createdAt"
FROM "Project" p WHERE q."projectId" = p."id";

UPDATE "Quote" SET "title" = 'Cotización', "clientName" = 'Sin cliente' WHERE "title" IS NULL;

ALTER TABLE "Quote" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE "Quote" ALTER COLUMN "clientName" SET NOT NULL;

-- 6) El vínculo pasa a ser 1-a-1: conservar una sola cotización por proyecto
--    (prioriza la ACEPTADA, luego la más reciente)
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY "projectId"
    ORDER BY ("status" = 'ACEPTADA') DESC, "createdAt" DESC
  ) AS rn
  FROM "Quote" WHERE "projectId" IS NOT NULL
)
UPDATE "Quote" SET "projectId" = NULL WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1);

-- 7) Índices y llaves foráneas
CREATE UNIQUE INDEX "Quote_projectId_key" ON "Quote"("projectId");
CREATE INDEX "Quote_clientId_idx" ON "Quote"("clientId");
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_quoterId_fkey" FOREIGN KEY ("quoterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
