-- CreateEnum
CREATE TYPE "Market" AS ENUM ('CO', 'USA');

-- CreateEnum
CREATE TYPE "Company" AS ENUM ('VITRALUX', 'VLX');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('COP', 'USD');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('PRINCIPAL', 'ADICIONAL');

-- CreateEnum
CREATE TYPE "ProjectStage" AS ENUM ('COTIZACION', 'CONTRATO', 'PRODUCCION', 'INSTALACION', 'GARANTIAS');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVO', 'EN_PAUSA', 'CERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('BORRADOR', 'EN_REVISION', 'APROBADA', 'ENVIADA', 'ACEPTADA', 'RECHAZADA', 'CAMBIOS_SOLICITADOS', 'SIN_RESPUESTA');

-- CreateEnum
CREATE TYPE "ContactChannel" AS ENUM ('LLAMADA', 'CORREO', 'WHATSAPP', 'VISITA', 'OTRO');

-- CreateEnum
CREATE TYPE "QuoteRejectionReason" AS ENUM ('MUY_COSTOSOS', 'NO_INFORMARON', 'UBICACION_NO_APLICA', 'COMPETENCIA', 'OTROS');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('RECIBIDO', 'EN_REVISION', 'RECHAZADO_CON_OBSERVACIONES', 'FIRMADO');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('REQUERIDA', 'SOLICITADA', 'EXPEDIDA', 'PAGADA', 'ENVIADA_AL_CLIENTE');

-- CreateEnum
CREATE TYPE "AdvanceStatus" AS ENUM ('CUENTA_COBRO_GENERADA', 'ENVIADO_AL_CLIENTE', 'CONSIGNADO', 'VERIFICADO');

-- CreateEnum
CREATE TYPE "PurchaseCategory" AS ENUM ('ALUMINIO', 'VIDRIO', 'ACCESORIOS', 'OTRO');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('COTIZANDO', 'ORDENADA', 'ENTREGADA_PARCIAL', 'ENTREGADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "DTStatus" AS ENUM ('PENDIENTE', 'EN_COLA', 'EN_PRODUCCION', 'TERMINADO', 'DESPACHADO');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "RemisionStatus" AS ENUM ('DESPACHADO', 'RECIBIDO_CONFORME', 'RECIBIDO_CON_OBSERVACIONES');

-- CreateEnum
CREATE TYPE "ReworkType" AS ENUM ('DANO_TRANSPORTE', 'ERROR_MEDIDAS', 'SENTIDO_APERTURA', 'DIGITACION', 'CANTIDADES', 'OTRO');

-- CreateEnum
CREATE TYPE "WarrantyStatus" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'PAZ_Y_SALVOS_FIRMADOS', 'DOCUMENTACION_ENVIADA', 'COBRADA');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('CORREO', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "AssignmentRole" AS ENUM ('SUPERVISOR', 'COTIZADOR', 'PLANEADOR', 'JEFE_TALLER');

-- CreateEnum
CREATE TYPE "AppModule" AS ENUM ('PROYECTOS', 'COTIZACIONES', 'CRM', 'CONTRATOS', 'POLIZAS', 'ANTICIPOS', 'COMPRAS', 'PRODUCCION', 'INSTALACION', 'ACTAS', 'GARANTIAS', 'ERRORES', 'NOTIFICACIONES', 'USUARIOS', 'EQUIPOS', 'DASHBOARD_GERENCIAL', 'AUDITORIA', 'PLANTILLAS');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDIENTE', 'EN_PROGRESO', 'BLOQUEADA', 'COMPLETADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamPermission" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "module" "AppModule" NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TeamPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" "AppModule" NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallerGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallerGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "InstallerGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "market" "Market" NOT NULL,
    "company" "Company" NOT NULL,
    "currency" "Currency" NOT NULL,
    "costCenter" TEXT,
    "contractAmount" DECIMAL(14,2),
    "advancePercent" DECIMAL(5,2),
    "warrantyRetentionPercent" DECIMAL(5,2),
    "currentStage" "ProjectStage" NOT NULL DEFAULT 'COTIZACION',
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVO',
    "type" "ProjectType" NOT NULL DEFAULT 'PRINCIPAL',
    "startDate" TIMESTAMP(3),
    "estimatedEndDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "notes" TEXT,
    "parentProjectId" TEXT,
    "earlyStartWithoutAdvance" BOOLEAN NOT NULL DEFAULT false,
    "earlyStartAuthorizedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAssignment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AssignmentRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectInstallerGroup" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProjectInstallerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStageHistory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromStage" "ProjectStage",
    "toStage" "ProjectStage" NOT NULL,
    "changedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "quoterId" TEXT NOT NULL,
    "assignedById" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "marginPercent" DECIMAL(5,2) NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'BORRADOR',
    "requiresManagementApproval" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "clientRespondedAt" TIMESTAMP(3),
    "budgetApprovedById" TEXT,
    "budgetApprovedAt" TIMESTAMP(3),
    "managementApprovedById" TEXT,
    "managementApprovedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteContactLog" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "ContactChannel" NOT NULL,
    "notes" TEXT NOT NULL,
    "contactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteContactLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteRejection" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "reason" "QuoteRejectionReason" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteRejection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'RECIBIDO',
    "observations" TEXT,
    "deliveryTermDays" INTEGER,
    "receivedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractId" TEXT,
    "type" TEXT NOT NULL,
    "insurer" TEXT,
    "status" "PolicyStatus" NOT NULL DEFAULT 'REQUERIDA',
    "value" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advance" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "status" "AdvanceStatus" NOT NULL DEFAULT 'CUENTA_COBRO_GENERADA',
    "receiptUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "depositedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "category" "PurchaseCategory" NOT NULL,
    "obraPercent" DECIMAL(5,2) NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'COTIZANDO',
    "orderedAt" TIMESTAMP(3),
    "expectedDeliveryAt" TIMESTAMP(3),
    "actualDeliveryAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActaVanos" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "surveyedAt" TIMESTAMP(3) NOT NULL,
    "requiredDeliveryNotes" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActaVanos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DT" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "projectId" TEXT NOT NULL,
    "actaVanosId" TEXT,
    "despiece" JSONB NOT NULL,
    "requiredDeliveryDate" TIMESTAMP(3) NOT NULL,
    "status" "DTStatus" NOT NULL DEFAULT 'PENDIENTE',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIA',
    "queuedAt" TIMESTAMP(3),
    "productionStartedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "remisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Remision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "dispatchedAt" TIMESTAMP(3) NOT NULL,
    "status" "RemisionStatus" NOT NULL DEFAULT 'DESPACHADO',
    "observations" TEXT,
    "signedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Remision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReworkError" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "ReworkType" NOT NULL,
    "responsibleId" TEXT,
    "stage" "ProjectStage" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "costImpact" DECIMAL(14,2),
    "delayImpactDays" INTEGER,
    "description" TEXT NOT NULL,
    "remisionId" TEXT,
    "reportedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReworkError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActaCorte" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "invoicedValue" DECIMAL(14,2) NOT NULL,
    "cutDate" TIMESTAMP(3) NOT NULL,
    "advanceOffset" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "retentionApplied" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActaCorte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActaEntrega" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "clientSignedName" TEXT,
    "clientSignedAt" TIMESTAMP(3),
    "supervisorId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActaEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActaCierre" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActaCierre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warranty" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "retentionValue" DECIMAL(14,2) NOT NULL,
    "workEndDate" TIMESTAMP(3),
    "estimatedProcessDate" TIMESTAMP(3),
    "status" "WarrantyStatus" NOT NULL DEFAULT 'PENDIENTE',
    "responsibleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warranty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "event" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "projectId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT,
    "stage" "ProjectStage",
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDIENTE',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIA',
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDependency" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,

    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TeamPermission_teamId_module_key" ON "TeamPermission"("teamId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_userId_module_key" ON "UserPermission"("userId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "InstallerGroup_name_key" ON "InstallerGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "InstallerGroupMember_groupId_userId_key" ON "InstallerGroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "Project_currentStage_status_idx" ON "Project"("currentStage", "status");

-- CreateIndex
CREATE INDEX "Project_parentProjectId_idx" ON "Project"("parentProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAssignment_projectId_userId_role_key" ON "ProjectAssignment"("projectId", "userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectInstallerGroup_projectId_groupId_key" ON "ProjectInstallerGroup"("projectId", "groupId");

-- CreateIndex
CREATE INDEX "ProjectStageHistory_projectId_idx" ON "ProjectStageHistory"("projectId");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

-- CreateIndex
CREATE INDEX "Quote_quoterId_idx" ON "Quote"("quoterId");

-- CreateIndex
CREATE INDEX "QuoteContactLog_quoteId_idx" ON "QuoteContactLog"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRejection_quoteId_key" ON "QuoteRejection"("quoteId");

-- CreateIndex
CREATE INDEX "Contract_projectId_idx" ON "Contract"("projectId");

-- CreateIndex
CREATE INDEX "Policy_projectId_idx" ON "Policy"("projectId");

-- CreateIndex
CREATE INDEX "Advance_projectId_idx" ON "Advance"("projectId");

-- CreateIndex
CREATE INDEX "Purchase_projectId_idx" ON "Purchase"("projectId");

-- CreateIndex
CREATE INDEX "ActaVanos_projectId_idx" ON "ActaVanos"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "DT_code_key" ON "DT"("code");

-- CreateIndex
CREATE INDEX "DT_status_requiredDeliveryDate_idx" ON "DT"("status", "requiredDeliveryDate");

-- CreateIndex
CREATE INDEX "DT_projectId_idx" ON "DT"("projectId");

-- CreateIndex
CREATE INDEX "Remision_projectId_idx" ON "Remision"("projectId");

-- CreateIndex
CREATE INDEX "ReworkError_projectId_idx" ON "ReworkError"("projectId");

-- CreateIndex
CREATE INDEX "ReworkError_responsibleId_idx" ON "ReworkError"("responsibleId");

-- CreateIndex
CREATE INDEX "ActaCorte_projectId_idx" ON "ActaCorte"("projectId");

-- CreateIndex
CREATE INDEX "ActaEntrega_projectId_idx" ON "ActaEntrega"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ActaCierre_projectId_key" ON "ActaCierre"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Warranty_projectId_key" ON "Warranty"("projectId");

-- CreateIndex
CREATE INDEX "Warranty_status_estimatedProcessDate_idx" ON "Warranty"("status", "estimatedProcessDate");

-- CreateIndex
CREATE INDEX "Notification_recipientId_read_idx" ON "Notification"("recipientId", "read");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE INDEX "Task_assigneeId_status_idx" ON "Task"("assigneeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDependency_taskId_dependsOnId_key" ON "TaskDependency"("taskId", "dependsOnId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTemplate_name_key" ON "ProjectTemplate"("name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPermission" ADD CONSTRAINT "TeamPermission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallerGroupMember" ADD CONSTRAINT "InstallerGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InstallerGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallerGroupMember" ADD CONSTRAINT "InstallerGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_parentProjectId_fkey" FOREIGN KEY ("parentProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_earlyStartAuthorizedById_fkey" FOREIGN KEY ("earlyStartAuthorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInstallerGroup" ADD CONSTRAINT "ProjectInstallerGroup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInstallerGroup" ADD CONSTRAINT "ProjectInstallerGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InstallerGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStageHistory" ADD CONSTRAINT "ProjectStageHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStageHistory" ADD CONSTRAINT "ProjectStageHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_quoterId_fkey" FOREIGN KEY ("quoterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_budgetApprovedById_fkey" FOREIGN KEY ("budgetApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_managementApprovedById_fkey" FOREIGN KEY ("managementApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteContactLog" ADD CONSTRAINT "QuoteContactLog_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteContactLog" ADD CONSTRAINT "QuoteContactLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRejection" ADD CONSTRAINT "QuoteRejection_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActaVanos" ADD CONSTRAINT "ActaVanos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActaVanos" ADD CONSTRAINT "ActaVanos_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DT" ADD CONSTRAINT "DT_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DT" ADD CONSTRAINT "DT_actaVanosId_fkey" FOREIGN KEY ("actaVanosId") REFERENCES "ActaVanos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DT" ADD CONSTRAINT "DT_remisionId_fkey" FOREIGN KEY ("remisionId") REFERENCES "Remision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remision" ADD CONSTRAINT "Remision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remision" ADD CONSTRAINT "Remision_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReworkError" ADD CONSTRAINT "ReworkError_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReworkError" ADD CONSTRAINT "ReworkError_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReworkError" ADD CONSTRAINT "ReworkError_remisionId_fkey" FOREIGN KEY ("remisionId") REFERENCES "Remision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReworkError" ADD CONSTRAINT "ReworkError_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActaCorte" ADD CONSTRAINT "ActaCorte_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActaEntrega" ADD CONSTRAINT "ActaEntrega_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActaEntrega" ADD CONSTRAINT "ActaEntrega_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActaCierre" ADD CONSTRAINT "ActaCierre_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
