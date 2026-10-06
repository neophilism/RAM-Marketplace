import assert from "node:assert/strict";
import test from "node:test";
import {
  paymentProfileStatusSchema,
  paymentProfileUpsertSchema
} from "../lib/payments/profile-validation";

test("payment profile requires at least one enabled capability", () => {
  assert.equal(
    paymentProfileUpsertSchema.safeParse({
      organizationId: "org-1",
      externalAccountReference: "acct-token-123",
      buyerCollectionEnabled: false,
      supplierPayoutEnabled: false,
      verificationAttestation: true
    }).success,
    false
  );
});

test("payment profile accepts buyer or supplier routing with verification attestation", () => {
  assert.equal(
    paymentProfileUpsertSchema.safeParse({
      organizationId: "org-1",
      externalAccountReference: "acct-token-123",
      buyerCollectionEnabled: true,
      supplierPayoutEnabled: false,
      verificationAttestation: true
    }).success,
    true
  );

  assert.equal(
    paymentProfileUpsertSchema.safeParse({
      organizationId: "org-2",
      externalAccountReference: "acct-token-456",
      buyerCollectionEnabled: false,
      supplierPayoutEnabled: true,
      verificationAttestation: true
    }).success,
    true
  );
});

test("payment profile status changes require a reason", () => {
  assert.equal(
    paymentProfileStatusSchema.safeParse({
      profileId: "profile-1",
      status: "SUSPENDED",
      reason: "Bank account verification expired"
    }).success,
    true
  );

  assert.equal(
    paymentProfileStatusSchema.safeParse({
      profileId: "profile-1",
      status: "ACTIVE",
      reason: ""
    }).success,
    false
  );
});
