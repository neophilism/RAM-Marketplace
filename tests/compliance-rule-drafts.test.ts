import assert from "node:assert/strict";
import test from "node:test";
import { createRuleDraft, reviseRuleDraft } from "../lib/compliance-rule-drafts";

const input = {
  ruleId: "corridor-us-aa-bb-swine-family-1",
  originState: "AA",
  destinationState: "BB",
  species: "Swine",
  conditionFamily: "Synthetic family",
  prohibited: true,
  rationale: "Synthetic fixture only; no real movement approval",
  sourceReferences: ["source-b", "source-a"],
  effectiveFrom: "2026-01-01",
  effectiveUntil: "2026-12-31",
  authorId: "test-author"
};

test("draft revisions are deterministic, immutable candidates and never active", () => {
  const first = createRuleDraft(input);
  assert.equal(first.status, "DRAFT");
  assert.equal(first.revision, 1);
  assert.deepEqual(first.sourceReferences, ["source-a", "source-b"]);
  assert.equal(first.digest, createRuleDraft({ ...input, sourceReferences: ["source-a", "source-b"] }).digest);

  const second = reviseRuleDraft(first, first.digest, { ...input, prohibited: false });
  assert.equal(second.revision, 2);
  assert.equal(second.status, "DRAFT");
  assert.notEqual(second.digest, first.digest);
  assert.equal(first.prohibited, true);
});

test("stale, tampered and reidentified revisions are rejected", () => {
  const first = createRuleDraft(input);
  assert.throws(() => reviseRuleDraft(first, "wrong", input), /stale/);
  assert.throws(() => reviseRuleDraft({ ...first, rationale: "tampered" }, first.digest, input), /altered/);
  assert.throws(() => reviseRuleDraft(first, first.digest, { ...input, ruleId: "other" }), /identity/);
});

test("invalid dates, missing provenance and malformed corridors fail closed", () => {
  assert.throws(() => createRuleDraft({ ...input, effectiveFrom: "2026-02-30" }), /valid ISO/);
  assert.throws(() => createRuleDraft({ ...input, effectiveFrom: "2027-01-01" }), /reversed/);
  assert.throws(() => createRuleDraft({ ...input, sourceReferences: [] }), /source reference/);
  assert.throws(() => createRuleDraft({ ...input, destinationState: "Atlantis" }), /state codes/);
});

test("source references reject malformed and unbounded inputs", () => {
  assert.throws(() => createRuleDraft({ ...input, sourceReferences: null as unknown as string[] }), /bounded list/);
  assert.throws(() => createRuleDraft({ ...input, sourceReferences: [5] as unknown as string[] }), /bounded list/);
  assert.throws(() => createRuleDraft({ ...input, sourceReferences: Array(101).fill("source") }), /bounded list/);
  assert.throws(() => createRuleDraft({ ...input, sourceReferences: ["x".repeat(2049)] }), /bounded list/);
});
