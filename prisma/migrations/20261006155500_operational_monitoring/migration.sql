-- CreateEnum
CREATE TYPE "OperationalIncidentSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "OperationalIncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "MonitoringRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "AlertDeliveryStatus" AS ENUM ('SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "PilotGateVerificationStatus" AS ENUM ('PENDING', 'VERIFIED');

-- CreateTable
CREATE TABLE "OperationalIncident" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" "OperationalIncidentSeverity" NOT NULL,
    "status" "OperationalIncidentStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "acknowledgedByUserId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringRun" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" "MonitoringRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "signalsEvaluated" INTEGER NOT NULL DEFAULT 0,
    "incidentsOpened" INTEGER NOT NULL DEFAULT 0,
    "incidentsUpdated" INTEGER NOT NULL DEFAULT 0,
    "alertAttempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitoringRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertDelivery" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "status" "AlertDeliveryStatus" NOT NULL,
    "endpointHash" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "responseCode" INTEGER,
    "errorMessage" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotGateVerification" (
    "id" TEXT NOT NULL,
    "gateKey" TEXT NOT NULL,
    "status" "PilotGateVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "ownerUserId" TEXT,
    "evidenceSummary" TEXT,
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "reviewDueAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotGateVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OperationalIncident_fingerprint_key" ON "OperationalIncident"("fingerprint");

-- CreateIndex
CREATE INDEX "OperationalIncident_status_severity_lastDetectedAt_idx" ON "OperationalIncident"("status", "severity", "lastDetectedAt");

-- CreateIndex
CREATE INDEX "OperationalIncident_code_status_idx" ON "OperationalIncident"("code", "status");

-- CreateIndex
CREATE INDEX "OperationalIncident_entityType_entityId_idx" ON "OperationalIncident"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "MonitoringRun_status_startedAt_idx" ON "MonitoringRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "MonitoringRun_completedAt_idx" ON "MonitoringRun"("completedAt");

-- CreateIndex
CREATE INDEX "AlertDelivery_incidentId_attemptedAt_idx" ON "AlertDelivery"("incidentId", "attemptedAt");

-- CreateIndex
CREATE INDEX "AlertDelivery_status_attemptedAt_idx" ON "AlertDelivery"("status", "attemptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PilotGateVerification_gateKey_key" ON "PilotGateVerification"("gateKey");

-- CreateIndex
CREATE INDEX "PilotGateVerification_status_reviewDueAt_idx" ON "PilotGateVerification"("status", "reviewDueAt");

-- CreateIndex
CREATE INDEX "PilotGateVerification_ownerUserId_status_idx" ON "PilotGateVerification"("ownerUserId", "status");

-- AddForeignKey
ALTER TABLE "OperationalIncident" ADD CONSTRAINT "OperationalIncident_acknowledgedByUserId_fkey" FOREIGN KEY ("acknowledgedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalIncident" ADD CONSTRAINT "OperationalIncident_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "OperationalIncident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotGateVerification" ADD CONSTRAINT "PilotGateVerification_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotGateVerification" ADD CONSTRAINT "PilotGateVerification_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
