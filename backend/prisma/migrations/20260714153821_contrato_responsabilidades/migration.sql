-- Etapa Contrato: revisor asignado, requisitos de póliza/anticipo y candado de compras

-- AlterEnum
ALTER TYPE "ContractStatus" ADD VALUE 'PENDIENTE_FIRMA' BEFORE 'RECHAZADO_CON_OBSERVACIONES';

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "reviewerId" TEXT,
ADD COLUMN     "requiresPolicy" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "requiresAdvance" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reviewSubmittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "purchasingUnlockedNotifiedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
