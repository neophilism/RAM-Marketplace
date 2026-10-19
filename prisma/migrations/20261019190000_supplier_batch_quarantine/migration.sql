-- Quarantine-only supplier feed intake; no candidate publication, pricing or movement.
CREATE TABLE "SupplierBatchImport" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "batchKey" TEXT NOT NULL,
  "manifestDigest" TEXT NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'QUARANTINED',
  "rows" JSONB NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierBatchImport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SupplierBatchImport_organizationId_batchKey_key"
ON "SupplierBatchImport"("organizationId", "batchKey");
CREATE INDEX "SupplierBatchImport_organizationId_createdAt_idx"
ON "SupplierBatchImport"("organizationId", "createdAt");
ALTER TABLE "SupplierBatchImport" ADD CONSTRAINT "SupplierBatchImport_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierBatchImport" ADD CONSTRAINT "SupplierBatchImport_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
