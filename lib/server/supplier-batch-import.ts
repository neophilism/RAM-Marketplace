import "server-only";
import { createHash } from "node:crypto";
import type { SessionPrincipal } from "@/lib/auth/token";
import { requirePrisma } from "@/lib/server/db";
import { assertSupplierPreviewRole, previewSupplierBatch } from "@/lib/supplier-batch-preview";

/** This stores quarantined uploads only, with no marketplace side effects. */
export async function quarantineSupplierBatch(principal: SessionPrincipal, payload: unknown) {
  assertSupplierPreviewRole(principal.role);
  const preview = previewSupplierBatch(principal.organizationId, payload);
  if (!preview.acceptedForReview) throw new Error("Invalid batch; no rows were imported");
  const digest = createHash("sha256").update(JSON.stringify(
    preview.rows.map((row) => [row.externalAnimalId, row.digest])
  )).digest("hex");
  const db = requirePrisma();
  return db.$transaction(async (tx) => {
    const existing = await tx.supplierBatchImport.findUnique({
      where: { organizationId_batchKey: { organizationId: principal.organizationId, batchKey: preview.batchKey } }
    });
    if (existing) {
      if (existing.manifestDigest !== digest) throw new Error("Batch key was reused for different content");
      return { id: existing.id, batchKey: existing.batchKey, state: existing.state,
        rowCount: existing.rowCount, replay: true };
    }
    const created = await tx.supplierBatchImport.create({
      data: {
        organizationId: principal.organizationId,
        batchKey: preview.batchKey,
        manifestDigest: digest,
        rowCount: preview.rowCount,
        createdById: principal.userId,
        rows: JSON.parse(JSON.stringify(payload))
      }
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId, organizationId: principal.organizationId,
        action: "SUPPLIER_BATCH_QUARANTINED", entityType: "SupplierBatchImport",
        entityId: created.id, nextState: { batchKey: preview.batchKey, rowCount: preview.rowCount, state: "QUARANTINED", digest }
      }
    });
    return { id: created.id, batchKey: created.batchKey, state: created.state,
      rowCount: created.rowCount, replay: false };
  });
}

export async function getSupplierBatchImport(principal: SessionPrincipal, batchKey: string) {
  assertSupplierPreviewRole(principal.role);
  const db = requirePrisma();
  const row = await db.supplierBatchImport.findUnique({
    where: { organizationId_batchKey: { organizationId: principal.organizationId, batchKey } },
    select: { id: true, batchKey: true, state: true, rowCount: true, createdAt: true }
  });
  return row ?? null;
}
