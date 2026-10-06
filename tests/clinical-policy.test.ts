import assert from "node:assert/strict";
import test from "node:test";
import {
  candidateStatusForVeterinaryOutcome,
  phenotypeLines
} from "../lib/clinical-policy";

test("eligible veterinary review advances to verified but not directly to marketplace", () => {
  assert.equal(candidateStatusForVeterinaryOutcome("ELIGIBLE"), "VERIFIED");
});

test("welfare holds suspend rather than publish a candidate", () => {
  assert.equal(candidateStatusForVeterinaryOutcome("WELFARE_HOLD"), "SUSPENDED");
});

test("diagnostic follow-up remains inside veterinary review", () => {
  assert.equal(candidateStatusForVeterinaryOutcome("NEEDS_DIAGNOSTICS"), "VET_PENDING");
});

test("phenotype evidence is normalized into discrete observations", () => {
  assert.deepEqual(
    phenotypeLines("Bilateral threshold elevation\nStable vestibular function;No otitis externa"),
    ["Bilateral threshold elevation", "Stable vestibular function", "No otitis externa"]
  );
});
