import assert from "node:assert/strict";
import test from "node:test";
import { createSessionToken, verifySessionToken } from "../lib/auth/token";

const secret = "this-is-a-test-secret-with-enough-length";
const principal = {
  userId: "user-1",
  organizationId: "org-1",
  role: "RESEARCH_PI" as const,
  email: "researcher@example.test",
  name: "Researcher"
};

test("signed RAM sessions round-trip", () => {
  const token = createSessionToken(principal, secret, 3600, 1_000_000);
  const verified = verifySessionToken(token, secret, 1_000_000);
  assert.equal(verified?.userId, principal.userId);
  assert.equal(verified?.organizationId, principal.organizationId);
  assert.equal(verified?.role, principal.role);
});

test("tampered RAM sessions fail closed", () => {
  const token = createSessionToken(principal, secret);
  const [payload, signature] = token.split(".");
  const tampered = payload.slice(0, -1) + (payload.endsWith("A") ? "B" : "A") + "." + signature;
  assert.equal(verifySessionToken(tampered, secret), null);
});

test("expired RAM sessions fail closed", () => {
  const token = createSessionToken(principal, secret, 10, 1_000_000);
  assert.equal(verifySessionToken(token, secret, 1_011_000), null);
});

test("short signing secrets are rejected", () => {
  assert.throws(() => createSessionToken(principal, "too-short"), /at least 24/);
});
