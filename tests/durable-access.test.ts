import assert from "node:assert/strict";
import test from "node:test";
import { evaluateDurableAccess } from "../lib/auth/access-state";

test("only verified active membership in active organization is operational", () => {
  const decision = evaluateDurableAccess({
    emailVerified: true,
    membershipStatus: "ACTIVE",
    organizationStatus: "ACTIVE"
  });
  assert.equal(decision.accountAllowed, true);
  assert.equal(decision.operationalAllowed, true);
  assert.equal(decision.reason, "OK");
});

test("pending and suspended states retain account view but block operations", () => {
  for (const state of [
    {
      emailVerified: true,
      membershipStatus: "ACTIVE" as const,
      organizationStatus: "PENDING_VERIFICATION" as const,
      reason: "ORGANIZATION_PENDING"
    },
    {
      emailVerified: true,
      membershipStatus: "SUSPENDED" as const,
      organizationStatus: "ACTIVE" as const,
      reason: "MEMBERSHIP_SUSPENDED"
    },
    {
      emailVerified: false,
      membershipStatus: "ACTIVE" as const,
      organizationStatus: "ACTIVE" as const,
      reason: "EMAIL_UNVERIFIED"
    }
  ]) {
    const decision = evaluateDurableAccess(state);
    assert.equal(decision.accountAllowed, true);
    assert.equal(decision.operationalAllowed, false);
    assert.equal(decision.reason, state.reason);
  }
});

test("revoked membership and closed organization fail account access", () => {
  const revoked = evaluateDurableAccess({
    emailVerified: true,
    membershipStatus: "REVOKED",
    organizationStatus: "ACTIVE"
  });
  assert.equal(revoked.accountAllowed, false);
  assert.equal(revoked.operationalAllowed, false);

  const closed = evaluateDurableAccess({
    emailVerified: true,
    membershipStatus: "ACTIVE",
    organizationStatus: "CLOSED"
  });
  assert.equal(closed.accountAllowed, false);
  assert.equal(closed.operationalAllowed, false);
});
