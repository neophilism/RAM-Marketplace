-- Draft-only immutable review artifacts. This table grants no movement permission.
CREATE TABLE "ComplianceRuleDraftRevision" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "digest" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceRuleDraftRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ComplianceRuleDraftRevision_ruleId_revision_key"
ON "ComplianceRuleDraftRevision"("ruleId", "revision");
CREATE UNIQUE INDEX "ComplianceRuleDraftRevision_digest_key"
ON "ComplianceRuleDraftRevision"("digest");
CREATE INDEX "ComplianceRuleDraftRevision_ruleId_createdAt_idx"
ON "ComplianceRuleDraftRevision"("ruleId", "createdAt");
