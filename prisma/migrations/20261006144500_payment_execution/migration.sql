-- CreateEnum
CREATE TYPE "PaymentExecutionType" AS ENUM ('BUYER_COLLECTION', 'SUPPLIER_PAYOUT', 'BUYER_REFUND');

-- CreateEnum
CREATE TYPE "PaymentProfileStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PaymentExecutionStatus" AS ENUM ('CREATED', 'SUBMITTED', 'SUBMISSION_UNKNOWN', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateTable
CREATE TABLE "OrganizationPaymentProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "externalAccountReference" TEXT NOT NULL,
    "status" "PaymentProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "buyerCollectionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "supplierPayoutEnabled" BOOLEAN NOT NULL DEFAULT false,
    "verifiedByUserId" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationPaymentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentExecution" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "counterpartyOrganizationId" TEXT NOT NULL,
    "accountReference" TEXT NOT NULL,
    "type" "PaymentExecutionType" NOT NULL,
    "status" "PaymentExecutionStatus" NOT NULL DEFAULT 'CREATED',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "gateway" TEXT,
    "provider" TEXT,
    "providerReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookReceipt" (
    "id" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "executionId" TEXT,
    "payloadHash" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "result" TEXT,

    CONSTRAINT "PaymentWebhookReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationPaymentProfile_organizationId_key" ON "OrganizationPaymentProfile"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationPaymentProfile_gateway_status_idx" ON "OrganizationPaymentProfile"("gateway", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentExecution_idempotencyKey_key" ON "PaymentExecution"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentExecution_settlementId_createdAt_idx" ON "PaymentExecution"("settlementId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentExecution_counterpartyOrganizationId_createdAt_idx" ON "PaymentExecution"("counterpartyOrganizationId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentExecution_status_createdAt_idx" ON "PaymentExecution"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentExecution_provider_providerReference_key" ON "PaymentExecution"("provider", "providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookReceipt_gateway_eventId_key" ON "PaymentWebhookReceipt"("gateway", "eventId");

-- CreateIndex
CREATE INDEX "PaymentWebhookReceipt_executionId_receivedAt_idx" ON "PaymentWebhookReceipt"("executionId", "receivedAt");

-- AddForeignKey
ALTER TABLE "PaymentExecution" ADD CONSTRAINT "PaymentExecution_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "FinancialSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentExecution" ADD CONSTRAINT "PaymentExecution_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationPaymentProfile" ADD CONSTRAINT "OrganizationPaymentProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationPaymentProfile" ADD CONSTRAINT "OrganizationPaymentProfile_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentExecution" ADD CONSTRAINT "PaymentExecution_counterpartyOrganizationId_fkey" FOREIGN KEY ("counterpartyOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
