-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('FARM', 'RESEARCH_INSTITUTION', 'BIOTECH', 'PHARMA', 'CRO', 'VETERINARY', 'LOGISTICS', 'RAM');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('SUPPLIER_OWNER_ADMIN', 'SUPPLIER_STAFF', 'RESEARCH_PI', 'RESEARCH_PROCUREMENT', 'RESEARCH_COMPLIANCE', 'VETERINARIAN', 'TRANSPORT_PROVIDER', 'RAM_MARKETPLACE_OPS', 'RAM_COMPLIANCE', 'RAM_FINANCE_ADMIN', 'RAM_SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PRE_SCREENED', 'VET_PENDING', 'VERIFIED', 'MATCHABLE', 'RESERVED', 'SOLD_TO_RAM', 'TRANSFERRED', 'WITHDRAWN', 'CULLED', 'EXPIRED', 'INELIGIBLE', 'QUARANTINED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CANDIDATE_HELD', 'CHECKOUT_PENDING', 'BUYER_COMMITTED', 'ACQUISITION_COMMITTED', 'CLEARANCE_PENDING', 'READY_FOR_PICKUP', 'IN_TRANSIT', 'DELIVERED', 'ACCEPTED', 'SETTLED', 'CLOSED', 'EXPIRED', 'CLEARANCE_FAILED', 'SUPPLIER_WITHDRAWN', 'BUYER_CANCELLED', 'TRANSPORT_EXCEPTION', 'REJECTED_AT_RECEIPT', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ResearchNeedStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED', 'ACTIVE', 'MATCH_REVIEW', 'SELECTED', 'INSTITUTIONAL_CLEARANCE', 'ORDERED', 'IN_STUDY', 'COMPLETED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProtocolStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'SUBMITTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "DisclosureTier" AS ENUM ('PUBLIC_ANONYMIZED', 'REQUESTABLE', 'POST_RESERVATION', 'POST_PURCHASE', 'RAM_INTERNAL_ONLY');

-- CreateEnum
CREATE TYPE "DisclosureRequestStatus" AS ENUM ('PENDING_RAM_REVIEW', 'PENDING_SUPPLIER_APPROVAL', 'APPROVED', 'DENIED', 'RELEASED', 'CLOSED');

-- CreateEnum
CREATE TYPE "VeterinaryReviewOutcome" AS ENUM ('PENDING', 'NEEDS_DIAGNOSTICS', 'ELIGIBLE', 'INELIGIBLE', 'WELFARE_HOLD');

-- CreateEnum
CREATE TYPE "ResearchMatchStatus" AS ENUM ('CANDIDATE', 'SHORTLISTED', 'SELECTED', 'REJECTED', 'STALE');

-- CreateEnum
CREATE TYPE "ClearanceDecision" AS ENUM ('PENDING', 'CLEARED', 'FAILED');

-- CreateEnum
CREATE TYPE "TransportEventType" AS ENUM ('ASSIGNED', 'PICKUP_CONFIRMED', 'EXCEPTION_REPORTED', 'RESUME_TRANSIT', 'DELIVERY_CONFIRMED');

-- CreateEnum
CREATE TYPE "ReceiptDecision" AS ENUM ('ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FinancialSettlementStatus" AS ENUM ('OPEN', 'SETTLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "FinancialLedgerEntryType" AS ENUM ('BUYER_RECEIVABLE', 'SUPPLIER_PAYABLE', 'DIRECT_COST', 'BUYER_PAYMENT', 'SUPPLIER_PAYOUT', 'BUYER_CREDIT', 'BUYER_REFUND');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DisputeResolutionType" AS ENUM ('ACCEPT_AS_IS', 'ACCEPT_WITH_CREDIT', 'REPLACEMENT', 'REFUND');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "facilityType" TEXT NOT NULL,
    "regionLabel" TEXT NOT NULL,
    "exactAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmSite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "internalLabel" TEXT NOT NULL,
    "regionLabel" TEXT NOT NULL,
    "exactAddress" TEXT NOT NULL,
    "countyLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmDisclosurePolicy" (
    "id" TEXT NOT NULL,
    "farmSiteId" TEXT NOT NULL,
    "shareGeneralHusbandry" BOOLEAN NOT NULL DEFAULT true,
    "shareCountyAfterNda" BOOLEAN NOT NULL DEFAULT false,
    "shareIdentityPrePurchase" BOOLEAN NOT NULL DEFAULT false,
    "shareIdentityPostPurchase" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmDisclosurePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalCase" (
    "publicId" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "breed" TEXT,
    "sex" TEXT,
    "ageMonths" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "condition" TEXT NOT NULL,
    "diseaseStage" TEXT,
    "etiology" TEXT,
    "diagnosticConfidence" TEXT,
    "comorbidities" JSONB,
    "diagnosticEvidence" JSONB,
    "regionLabel" TEXT NOT NULL,
    "publicSummary" TEXT NOT NULL,
    "phenotype" JSONB,
    "availabilityText" TEXT,
    "sourceDisclosure" "DisclosureTier" NOT NULL DEFAULT 'PUBLIC_ANONYMIZED',
    "status" "CandidateStatus" NOT NULL DEFAULT 'DRAFT',
    "listPriceCents" INTEGER,
    "transportReady" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalCase_pkey" PRIMARY KEY ("publicId")
);

-- CreateTable
CREATE TABLE "AnimalSourceRecord" (
    "id" TEXT NOT NULL,
    "animalCaseId" TEXT NOT NULL,
    "farmSiteId" TEXT NOT NULL,
    "exactAddress" TEXT NOT NULL,
    "legalOwnerName" TEXT NOT NULL,
    "ownerContactName" TEXT NOT NULL,
    "ownerContactEmail" TEXT NOT NULL,
    "localVetName" TEXT,
    "localVetContact" TEXT,
    "privateHistory" JSONB,
    "generalHusbandry" TEXT,
    "privateNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalSourceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CullEvent" (
    "id" TEXT NOT NULL,
    "animalCaseId" TEXT NOT NULL,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plannedCullAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "independentlyIdentified" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CullEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VeterinaryReview" (
    "id" TEXT NOT NULL,
    "animalCaseId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "outcome" "VeterinaryReviewOutcome" NOT NULL DEFAULT 'PENDING',
    "diagnosis" TEXT,
    "welfareNotes" TEXT,
    "diagnosticPlan" TEXT,
    "diseaseStage" TEXT,
    "etiology" TEXT,
    "diagnosticConfidence" TEXT,
    "phenotype" JSONB,
    "comorbidities" JSONB,
    "diagnosticEvidence" JSONB,
    "publicSummary" TEXT,
    "transportReady" BOOLEAN,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VeterinaryReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchNeed" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "species" TEXT,
    "minAgeMonths" INTEGER,
    "maxAgeMonths" INTEGER,
    "sex" TEXT,
    "diseaseStage" TEXT,
    "etiologyRequirement" TEXT,
    "requiredPhenotype" TEXT NOT NULL,
    "exclusionCriteria" TEXT,
    "acceptableComorbidities" TEXT,
    "requiredDiagnostics" TEXT,
    "procedures" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "timeline" TEXT NOT NULL,
    "budgetCents" INTEGER,
    "protocolStatus" "ProtocolStatus" NOT NULL,
    "scientificRationale" TEXT NOT NULL,
    "status" "ResearchNeedStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchNeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchMatch" (
    "id" TEXT NOT NULL,
    "researchNeedId" TEXT NOT NULL,
    "animalCaseId" TEXT NOT NULL,
    "status" "ResearchMatchStatus" NOT NULL DEFAULT 'CANDIDATE',
    "totalScore" INTEGER NOT NULL,
    "phenotypeFit" INTEGER NOT NULL,
    "diagnosticConfidence" INTEGER NOT NULL,
    "etiologyFit" INTEGER NOT NULL,
    "comorbidityFit" INTEGER NOT NULL,
    "timingAvailability" INTEGER NOT NULL,
    "logisticsFit" INTEGER NOT NULL,
    "priceFit" INTEGER NOT NULL,
    "hardGates" JSONB NOT NULL,
    "reviewFlags" JSONB NOT NULL,
    "reasons" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisclosureRequest" (
    "id" TEXT NOT NULL,
    "animalCaseId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "requesterOrganizationId" TEXT NOT NULL,
    "researchNeedId" TEXT NOT NULL,
    "orderId" TEXT,
    "requestedFields" JSONB NOT NULL,
    "scientificReason" TEXT NOT NULL,
    "status" "DisclosureRequestStatus" NOT NULL DEFAULT 'PENDING_RAM_REVIEW',
    "supplierApproved" BOOLEAN,
    "reviewedByRam" BOOLEAN NOT NULL DEFAULT false,
    "ramReviewerUserId" TEXT,
    "supplierReviewerUserId" TEXT,
    "ramReviewedAt" TIMESTAMP(3),
    "supplierReviewedAt" TIMESTAMP(3),
    "ndaRequired" BOOLEAN NOT NULL DEFAULT false,
    "ndaAcceptedAt" TIMESTAMP(3),
    "releasedFields" JSONB,
    "releasedData" JSONB,
    "denialReason" TEXT,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisclosureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "animalCaseId" TEXT NOT NULL,
    "buyerOrganizationId" TEXT NOT NULL,
    "researchNeedId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "buyerPriceCents" INTEGER,
    "buyerPriceComponents" JSONB,
    "supplierPricingPolicyId" TEXT,
    "supplierScheduleCents" INTEGER,
    "supplierMarketCeilingCents" INTEGER,
    "supplierAcquisitionCents" INTEGER,
    "directCostsCents" INTEGER NOT NULL DEFAULT 0,
    "holdExpiresAt" TIMESTAMP(3),
    "quoteIssuedAt" TIMESTAMP(3),
    "quoteExpiresAt" TIMESTAMP(3),
    "buyerCommittedAt" TIMESTAMP(3),
    "acquisitionCommittedAt" TIMESTAMP(3),
    "clearanceStartedAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "receivingFacilityName" TEXT,
    "receivingFacilityAddress" TEXT,
    "protocolReference" TEXT,
    "institutionalApprovalAttested" BOOLEAN NOT NULL DEFAULT false,
    "purchasingAuthorityAttested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPricingPolicy" (
    "id" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "standardizedCullScheduleCents" INTEGER NOT NULL,
    "marketCeilingCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierPricingPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderClearance" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reviewerUserId" TEXT,
    "decision" "ClearanceDecision" NOT NULL DEFAULT 'PENDING',
    "protocolConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "receivingFacilityConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "welfareConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "biosecurityConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "movementRequirementsConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "transportPlanConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "sourceProvenanceConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "blockingFindings" JSONB,
    "notes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderClearance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportAssignment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "transportOrganizationId" TEXT NOT NULL,
    "assignedTransportUserId" TEXT,
    "assignedByUserId" TEXT NOT NULL,
    "pickupWindowStart" TIMESTAMP(3),
    "pickupWindowEnd" TIMESTAMP(3),
    "deliveryWindowStart" TIMESTAMP(3),
    "deliveryWindowEnd" TIMESTAMP(3),
    "movementDocumentRefs" JSONB,
    "sanitationRequirements" TEXT,
    "specialInstructions" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportEvent" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "type" "TransportEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "sanitationConfirmed" BOOLEAN,
    "custodyAttested" BOOLEAN NOT NULL DEFAULT false,
    "previousOrderStatus" "OrderStatus",
    "nextOrderStatus" "OrderStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransportEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptInspection" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "inspectorUserId" TEXT NOT NULL,
    "decision" "ReceiptDecision" NOT NULL,
    "animalIdentityConfirmed" BOOLEAN NOT NULL,
    "movementDocumentsReceived" BOOLEAN NOT NULL,
    "physicalConditionConsistent" BOOLEAN NOT NULL,
    "welfareIntakeAcceptable" BOOLEAN NOT NULL,
    "discrepancyNotes" TEXT,
    "notes" TEXT,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderDispute" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "openedByUserId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolutionType" "DisputeResolutionType",
    "resolutionNotes" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialSettlement" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "FinancialSettlementStatus" NOT NULL DEFAULT 'OPEN',
    "buyerReceivableCents" INTEGER NOT NULL,
    "supplierPayableCents" INTEGER NOT NULL,
    "supplierScheduleCents" INTEGER NOT NULL,
    "supplierMarketCeilingCents" INTEGER NOT NULL,
    "directCostsCents" INTEGER NOT NULL,
    "grossSpreadCents" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "reconciliationReference" TEXT,
    "reconciliationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialLedgerEntry" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "type" "FinancialLedgerEntryType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "externalReference" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityRateLimitBucket" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityRateLimitBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "organizationId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousState" JSONB,
    "nextState" JSONB,
    "reason" TEXT,
    "correlationId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_organizationId_status_idx" ON "Membership"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_role_key" ON "Membership"("userId", "organizationId", "role");

-- CreateIndex
CREATE INDEX "Facility_organizationId_idx" ON "Facility"("organizationId");

-- CreateIndex
CREATE INDEX "FarmSite_organizationId_idx" ON "FarmSite"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "FarmDisclosurePolicy_farmSiteId_key" ON "FarmDisclosurePolicy"("farmSiteId");

-- CreateIndex
CREATE INDEX "AnimalCase_species_condition_status_idx" ON "AnimalCase"("species", "condition", "status");

-- CreateIndex
CREATE INDEX "AnimalCase_status_regionLabel_idx" ON "AnimalCase"("status", "regionLabel");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalSourceRecord_animalCaseId_key" ON "AnimalSourceRecord"("animalCaseId");

-- CreateIndex
CREATE INDEX "AnimalSourceRecord_farmSiteId_idx" ON "AnimalSourceRecord"("farmSiteId");

-- CreateIndex
CREATE UNIQUE INDEX "CullEvent_animalCaseId_key" ON "CullEvent"("animalCaseId");

-- CreateIndex
CREATE INDEX "VeterinaryReview_animalCaseId_outcome_idx" ON "VeterinaryReview"("animalCaseId", "outcome");

-- CreateIndex
CREATE INDEX "ResearchNeed_organizationId_status_idx" ON "ResearchNeed"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ResearchNeed_condition_species_status_idx" ON "ResearchNeed"("condition", "species", "status");

-- CreateIndex
CREATE INDEX "ResearchMatch_researchNeedId_totalScore_idx" ON "ResearchMatch"("researchNeedId", "totalScore");

-- CreateIndex
CREATE INDEX "ResearchMatch_animalCaseId_status_idx" ON "ResearchMatch"("animalCaseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchMatch_researchNeedId_animalCaseId_key" ON "ResearchMatch"("researchNeedId", "animalCaseId");

-- CreateIndex
CREATE INDEX "DisclosureRequest_animalCaseId_status_idx" ON "DisclosureRequest"("animalCaseId", "status");

-- CreateIndex
CREATE INDEX "DisclosureRequest_requesterOrganizationId_status_idx" ON "DisclosureRequest"("requesterOrganizationId", "status");

-- CreateIndex
CREATE INDEX "DisclosureRequest_researchNeedId_status_idx" ON "DisclosureRequest"("researchNeedId", "status");

-- CreateIndex
CREATE INDEX "Order_animalCaseId_status_idx" ON "Order"("animalCaseId", "status");

-- CreateIndex
CREATE INDEX "Order_buyerOrganizationId_status_idx" ON "Order"("buyerOrganizationId", "status");

-- CreateIndex
CREATE INDEX "Order_researchNeedId_status_idx" ON "Order"("researchNeedId", "status");

-- CreateIndex
CREATE INDEX "SupplierPricingPolicy_species_active_effectiveFrom_idx" ON "SupplierPricingPolicy"("species", "active", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "OrderClearance_orderId_key" ON "OrderClearance"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "TransportAssignment_orderId_key" ON "TransportAssignment"("orderId");

-- CreateIndex
CREATE INDEX "TransportAssignment_transportOrganizationId_assignedAt_idx" ON "TransportAssignment"("transportOrganizationId", "assignedAt");

-- CreateIndex
CREATE INDEX "TransportAssignment_assignedTransportUserId_assignedAt_idx" ON "TransportAssignment"("assignedTransportUserId", "assignedAt");

-- CreateIndex
CREATE INDEX "TransportEvent_assignmentId_occurredAt_idx" ON "TransportEvent"("assignmentId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptInspection_orderId_key" ON "ReceiptInspection"("orderId");

-- CreateIndex
CREATE INDEX "ReceiptInspection_decision_inspectedAt_idx" ON "ReceiptInspection"("decision", "inspectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderDispute_orderId_key" ON "OrderDispute"("orderId");

-- CreateIndex
CREATE INDEX "OrderDispute_status_openedAt_idx" ON "OrderDispute"("status", "openedAt");

-- CreateIndex
CREATE INDEX "OrderDispute_resolutionType_resolvedAt_idx" ON "OrderDispute"("resolutionType", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialSettlement_orderId_key" ON "FinancialSettlement"("orderId");

-- CreateIndex
CREATE INDEX "FinancialSettlement_status_openedAt_idx" ON "FinancialSettlement"("status", "openedAt");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_settlementId_occurredAt_idx" ON "FinancialLedgerEntry"("settlementId", "occurredAt");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_type_externalReference_idx" ON "FinancialLedgerEntry"("type", "externalReference");

-- CreateIndex
CREATE INDEX "SecurityRateLimitBucket_expiresAt_idx" ON "SecurityRateLimitBucket"("expiresAt");

-- CreateIndex
CREATE INDEX "SecurityRateLimitBucket_action_windowStart_idx" ON "SecurityRateLimitBucket"("action", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityRateLimitBucket_keyHash_action_windowStart_key" ON "SecurityRateLimitBucket"("keyHash", "action", "windowStart");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_createdAt_idx" ON "AuditEvent"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmSite" ADD CONSTRAINT "FarmSite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmDisclosurePolicy" ADD CONSTRAINT "FarmDisclosurePolicy_farmSiteId_fkey" FOREIGN KEY ("farmSiteId") REFERENCES "FarmSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalSourceRecord" ADD CONSTRAINT "AnimalSourceRecord_animalCaseId_fkey" FOREIGN KEY ("animalCaseId") REFERENCES "AnimalCase"("publicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalSourceRecord" ADD CONSTRAINT "AnimalSourceRecord_farmSiteId_fkey" FOREIGN KEY ("farmSiteId") REFERENCES "FarmSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CullEvent" ADD CONSTRAINT "CullEvent_animalCaseId_fkey" FOREIGN KEY ("animalCaseId") REFERENCES "AnimalCase"("publicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VeterinaryReview" ADD CONSTRAINT "VeterinaryReview_animalCaseId_fkey" FOREIGN KEY ("animalCaseId") REFERENCES "AnimalCase"("publicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VeterinaryReview" ADD CONSTRAINT "VeterinaryReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchNeed" ADD CONSTRAINT "ResearchNeed_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchNeed" ADD CONSTRAINT "ResearchNeed_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchMatch" ADD CONSTRAINT "ResearchMatch_researchNeedId_fkey" FOREIGN KEY ("researchNeedId") REFERENCES "ResearchNeed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchMatch" ADD CONSTRAINT "ResearchMatch_animalCaseId_fkey" FOREIGN KEY ("animalCaseId") REFERENCES "AnimalCase"("publicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureRequest" ADD CONSTRAINT "DisclosureRequest_animalCaseId_fkey" FOREIGN KEY ("animalCaseId") REFERENCES "AnimalCase"("publicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureRequest" ADD CONSTRAINT "DisclosureRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureRequest" ADD CONSTRAINT "DisclosureRequest_requesterOrganizationId_fkey" FOREIGN KEY ("requesterOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureRequest" ADD CONSTRAINT "DisclosureRequest_researchNeedId_fkey" FOREIGN KEY ("researchNeedId") REFERENCES "ResearchNeed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureRequest" ADD CONSTRAINT "DisclosureRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureRequest" ADD CONSTRAINT "DisclosureRequest_ramReviewerUserId_fkey" FOREIGN KEY ("ramReviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureRequest" ADD CONSTRAINT "DisclosureRequest_supplierReviewerUserId_fkey" FOREIGN KEY ("supplierReviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_animalCaseId_fkey" FOREIGN KEY ("animalCaseId") REFERENCES "AnimalCase"("publicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerOrganizationId_fkey" FOREIGN KEY ("buyerOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_researchNeedId_fkey" FOREIGN KEY ("researchNeedId") REFERENCES "ResearchNeed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_supplierPricingPolicyId_fkey" FOREIGN KEY ("supplierPricingPolicyId") REFERENCES "SupplierPricingPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPricingPolicy" ADD CONSTRAINT "SupplierPricingPolicy_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderClearance" ADD CONSTRAINT "OrderClearance_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderClearance" ADD CONSTRAINT "OrderClearance_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportAssignment" ADD CONSTRAINT "TransportAssignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportAssignment" ADD CONSTRAINT "TransportAssignment_transportOrganizationId_fkey" FOREIGN KEY ("transportOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportAssignment" ADD CONSTRAINT "TransportAssignment_assignedTransportUserId_fkey" FOREIGN KEY ("assignedTransportUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportAssignment" ADD CONSTRAINT "TransportAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportEvent" ADD CONSTRAINT "TransportEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TransportAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportEvent" ADD CONSTRAINT "TransportEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptInspection" ADD CONSTRAINT "ReceiptInspection_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptInspection" ADD CONSTRAINT "ReceiptInspection_inspectorUserId_fkey" FOREIGN KEY ("inspectorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDispute" ADD CONSTRAINT "OrderDispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDispute" ADD CONSTRAINT "OrderDispute_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDispute" ADD CONSTRAINT "OrderDispute_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialSettlement" ADD CONSTRAINT "FinancialSettlement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "FinancialSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
