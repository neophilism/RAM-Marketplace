-- CreateEnum
CREATE TYPE "OrganizationVerificationDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ExternalIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "emailAtLink" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAuthenticatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAuthContext" JSONB,

    CONSTRAINT "ExternalIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityAssertionUse" (
    "jti" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityAssertionUse_pkey" PRIMARY KEY ("jti")
);

-- CreateTable
CREATE TABLE "OrganizationVerification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "decision" "OrganizationVerificationDecision" NOT NULL DEFAULT 'PENDING',
    "method" TEXT,
    "evidenceSummary" TEXT,
    "notes" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Membership_userId_status_idx" ON "Membership"("userId", "status");

-- CreateIndex
CREATE INDEX "ExternalIdentity_userId_idx" ON "ExternalIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalIdentity_provider_subject_key" ON "ExternalIdentity"("provider", "subject");

-- CreateIndex
CREATE INDEX "IdentityAssertionUse_expiresAt_idx" ON "IdentityAssertionUse"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationVerification_organizationId_key" ON "OrganizationVerification"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationVerification_decision_updatedAt_idx" ON "OrganizationVerification"("decision", "updatedAt");

-- AddForeignKey
ALTER TABLE "ExternalIdentity" ADD CONSTRAINT "ExternalIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationVerification" ADD CONSTRAINT "OrganizationVerification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationVerification" ADD CONSTRAINT "OrganizationVerification_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill verification records for organizations that predate this migration.
-- ACTIVE and SUSPENDED organizations are grandfathered as approved because
-- they already had operational access before formal verification records.
INSERT INTO "OrganizationVerification" (
    "id",
    "organizationId",
    "decision",
    "method",
    "evidenceSummary",
    "reviewedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'migration-verification-' || "id",
    "id",
    CASE
      WHEN "status" IN ('ACTIVE', 'SUSPENDED') THEN 'APPROVED'::"OrganizationVerificationDecision"
      WHEN "status" = 'CLOSED' THEN 'REJECTED'::"OrganizationVerificationDecision"
      ELSE 'PENDING'::"OrganizationVerificationDecision"
    END,
    CASE
      WHEN "status" IN ('ACTIVE', 'SUSPENDED') THEN 'MIGRATION_GRANDFATHERED'
      WHEN "status" = 'CLOSED' THEN 'MIGRATION_EXISTING_CLOSED'
      ELSE 'MIGRATION_PENDING'
    END,
    CASE
      WHEN "status" IN ('ACTIVE', 'SUSPENDED')
        THEN 'Organization had operational status before formal verification records were introduced.'
      WHEN "status" = 'CLOSED'
        THEN 'Organization was already closed before formal verification records were introduced.'
      ELSE 'Organization remained pending when formal verification records were introduced.'
    END,
    CASE
      WHEN "status" = 'PENDING_VERIFICATION' THEN NULL
      ELSE CURRENT_TIMESTAMP
    END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Organization";
