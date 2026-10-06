import assert from "node:assert/strict";
import test from "node:test";
import {
  membershipAccessActionSchema,
  organizationAccessActionSchema
} from "../lib/account-lifecycle";

test("organization approval requires method and evidence", () => {
  const incomplete = organizationAccessActionSchema.safeParse({
    organizationId: "org-1",
    action: "APPROVE"
  });
  assert.equal(incomplete.success, false);

  const complete = organizationAccessActionSchema.safeParse({
    organizationId: "org-1",
    action: "APPROVE",
    method: "Registry verification",
    evidenceSummary: "Verified legal entity and authorized institutional contact."
  });
  assert.equal(complete.success, true);
});

test("organization suspension/rejection require reasons", () => {
  for (const action of ["SUSPEND", "REJECT"] as const) {
    assert.equal(
      organizationAccessActionSchema.safeParse({
        organizationId: "org-1",
        action
      }).success,
      false
    );
  }
});

test("membership lifecycle only permits active, suspended or revoked", () => {
  assert.equal(
    membershipAccessActionSchema.safeParse({
      membershipId: "member-1",
      status: "SUSPENDED",
      reason: "Compliance review"
    }).success,
    true
  );

  assert.equal(
    membershipAccessActionSchema.safeParse({
      membershipId: "member-1",
      status: "INVITED",
      reason: "Invalid target state"
    }).success,
    false
  );
});
