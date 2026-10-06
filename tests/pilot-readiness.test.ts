import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluatePilotReadiness,
  readinessSummary
} from "../lib/pilot-readiness";

const readyEnv = {
  NODE_ENV: "production",
  RAM_DATA_BACKEND: "postgres",
  DATABASE_URL: "postgresql://ram:secret@db.internal:5432/ram",
  AUTH_SECRET: "this-is-a-production-strength-secret-value-2026",
  RAM_DEMO_AUTH_ENABLED: "false",
  RAM_PUBLIC_ONBOARDING_ENABLED: "false",
  RAM_MAX_MUTATION_BYTES: "1048576"
};

test("pilot readiness passes automatically verifiable production configuration", () => {
  const checks = evaluatePilotReadiness(readyEnv);
  const summary = readinessSummary(checks);
  assert.equal(summary.automaticReady, true);
  assert.equal(summary.blockers, 0);
  assert.ok(summary.manualGates > 0);
});

test("pilot readiness blocks prototype persistence and demo auth", () => {
  const checks = evaluatePilotReadiness({
    ...readyEnv,
    RAM_DATA_BACKEND: "prototype",
    RAM_DEMO_AUTH_ENABLED: "true"
  });
  const summary = readinessSummary(checks);
  assert.equal(summary.automaticReady, false);
  assert.ok(summary.blockers >= 2);
});

test("pilot readiness rejects placeholder or short auth secrets", () => {
  for (const secret of ["short", "replace-with-a-long-random-secret"]) {
    const checks = evaluatePilotReadiness({
      ...readyEnv,
      AUTH_SECRET: secret
    });
    assert.equal(
      checks.find((check) => check.id === "auth_secret")?.status,
      "BLOCK"
    );
  }
});
