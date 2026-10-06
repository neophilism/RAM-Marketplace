import assert from "node:assert/strict";
import test from "node:test";
import {
  pilotGateKeys,
  resetPilotGateSchema,
  verifyPilotGateSchema
} from "../lib/pilot-gates";

test("canonical pilot gate keys include every launch gate", () => {
  for (const key of [
    "manual_identity",
    "manual_migrations",
    "manual_edge",
    "manual_backups",
    "manual_monitoring",
    "manual_payments"
  ]) {
    assert.equal(pilotGateKeys.has(key as never), true);
  }
});

test("pilot gate verification requires owner and meaningful evidence", () => {
  assert.equal(
    verifyPilotGateSchema.safeParse({
      gateKey: "manual_monitoring",
      ownerUserId: "demo-ram-user",
      evidenceSummary:
        "Scheduler cadence and signed incident alert delivery were verified."
    }).success,
    true
  );

  assert.equal(
    verifyPilotGateSchema.safeParse({
      gateKey: "manual_monitoring",
      ownerUserId: "",
      evidenceSummary: "short"
    }).success,
    false
  );
});

test("pilot gate reset requires a reason", () => {
  assert.equal(
    resetPilotGateSchema.safeParse({
      gateKey: "manual_monitoring",
      reason: "Alert receiver configuration changed."
    }).success,
    true
  );
  assert.equal(
    resetPilotGateSchema.safeParse({
      gateKey: "manual_monitoring",
      reason: ""
    }).success,
    false
  );
});
