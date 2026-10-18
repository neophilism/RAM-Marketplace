import assert from "node:assert/strict";
import test from "node:test";
import { MAX_BATCH_BYTES, previewSupplierBatch, readBatchJson } from "../lib/supplier-batch-preview";

const submission = {
  species: "Swine",
  sex: "Female",
  condition: "Synthetic hearing loss",
  observedSigns: "Synthetic fixture with observed signs for validation only.",
  cullDecisionDate: "2026-09-15",
  plannedCullAt: "2026-10-20",
  cullReason: "Independent production cull decision recorded before any research demand.",
  welfareUrgency: "ROUTINE",
  independentCullAttestation: true,
  ownerAttestation: true
};

test("supplier batch preview validates bounded rows without creating candidates", () => {
  const payload = { batchKey: "synthetic-001", rows: [
    { externalAnimalId: "farm-1", submission },
    { externalAnimalId: "farm-2", submission }
  ] };
  const result = previewSupplierBatch("supplier-org", payload);
  assert.equal(result.acceptedForReview, true);
  assert.equal(result.rowCount, 2);
  assert.ok(result.rows.every((row) => row.valid && row.digest?.length === 64));
  assert.notEqual(result.rows[0].digest, previewSupplierBatch("other-org", payload).rows[0].digest);
});

test("duplicate IDs, failed provenance and unknown fields quarantine the whole batch", () => {
  const result = previewSupplierBatch("supplier-org", { batchKey: "synthetic-002", rows: [
    { externalAnimalId: "farm-1", submission },
    { externalAnimalId: "FARM-1", submission },
    { externalAnimalId: "farm-3", submission: { ...submission, independentCullAttestation: false } },
    { externalAnimalId: "farm-4", submission: { ...submission, buyerPrice: 10 } }
  ] });
  assert.equal(result.acceptedForReview, false);
  assert.match(result.rows[1].issues.join(" "), /duplicate/);
  assert.match(result.rows[2].issues.join(" "), /independentCullAttestation/);
  assert.match(result.rows[3].issues.join(" "), /unknown submission field/);
  assert.equal(result.rows[3].digest, null);
});

test("invalid envelope and oversized or malformed bodies fail before preview", async () => {
  assert.throws(() => previewSupplierBatch("supplier-org", { batchKey: "too-short", rows: [] }), /rows/);
  assert.throws(() => previewSupplierBatch("supplier-org", { batchKey: "synthetic-003", rows: Array(101).fill({}) }), /rows/);
  await assert.rejects(readBatchJson(new Request("https://example.test", {
    method: "POST", body: "x".repeat(MAX_BATCH_BYTES + 1)
  })), /exceeds limit/);
  await assert.rejects(readBatchJson(new Request("https://example.test", {
    method: "POST", body: "{"
  })), SyntaxError);
});
