import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateDisclosurePolicy,
  sanitizeRestrictedNarrative
} from "../lib/disclosure-policy";

const defaultPolicy = {
  shareGeneralHusbandry: true,
  shareCountyAfterNda: false,
  shareIdentityPrePurchase: false,
  shareIdentityPostPurchase: true
};

test("general husbandry can use standing farm permission", () => {
  const decision = evaluateDisclosurePolicy({
    requestedFields: ["GENERAL_HUSBANDRY"],
    farmPolicy: defaultPolicy,
    buyerMilestone: "NONE",
    sourceDisclosure: "REQUESTABLE"
  });
  assert.equal(decision.supplierApprovalRequired, false);
  assert.equal(decision.ndaRequired, false);
});

test("county disclosure always requires NDA and may require farm approval", () => {
  const decision = evaluateDisclosurePolicy({
    requestedFields: ["COUNTY"],
    farmPolicy: defaultPolicy,
    buyerMilestone: "NONE",
    sourceDisclosure: "REQUESTABLE"
  });
  assert.equal(decision.ndaRequired, true);
  assert.equal(decision.supplierApprovalRequired, true);
});

test("post-purchase identity policy activates only after buyer commitment", () => {
  assert.throws(
    () =>
      evaluateDisclosurePolicy({
        requestedFields: ["FARM_IDENTITY"],
        farmPolicy: defaultPolicy,
        buyerMilestone: "RESERVED",
        sourceDisclosure: "POST_PURCHASE"
      }),
    /only after buyer commitment/
  );

  const after = evaluateDisclosurePolicy({
    requestedFields: ["FARM_IDENTITY"],
    farmPolicy: defaultPolicy,
    buyerMilestone: "BUYER_COMMITTED",
    sourceDisclosure: "POST_PURCHASE"
  });
  assert.equal(after.supplierApprovalRequired, false);
  assert.equal(after.ndaRequired, true);
});

test("RAM-internal-only source records cannot be externally requested", () => {
  assert.throws(
    () =>
      evaluateDisclosurePolicy({
        requestedFields: ["GENERAL_HUSBANDRY"],
        farmPolicy: defaultPolicy,
        buyerMilestone: "NONE",
        sourceDisclosure: "RAM_INTERNAL_ONLY"
      }),
    /not externally requestable/
  );
});

test("restricted narrative sanitizer removes known source identifiers and contact data", () => {
  const value =
    "Acme Farm at 123 Private Farm Road uses standard group housing. Contact owner@example.com or 202-555-0112.";
  const sanitized = sanitizeRestrictedNarrative(value, [
    "Acme Farm",
    "123 Private Farm Road"
  ]);
  assert.equal(sanitized.includes("Acme Farm"), false);
  assert.equal(sanitized.includes("123 Private Farm Road"), false);
  assert.equal(sanitized.includes("owner@example.com"), false);
  assert.equal(sanitized.includes("202-555-0112"), false);
});


test("post-reservation tier cannot be bypassed before reservation", () => {
  assert.throws(
    () =>
      evaluateDisclosurePolicy({
        requestedFields: ["GENERAL_HUSBANDRY"],
        farmPolicy: defaultPolicy,
        buyerMilestone: "NONE",
        sourceDisclosure: "POST_RESERVATION"
      }),
    /only after reservation/
  );

  assert.doesNotThrow(() =>
    evaluateDisclosurePolicy({
      requestedFields: ["GENERAL_HUSBANDRY"],
      farmPolicy: defaultPolicy,
      buyerMilestone: "RESERVED",
      sourceDisclosure: "POST_RESERVATION"
    })
  );
});

test("post-purchase tier requires buyer commitment", () => {
  assert.throws(
    () =>
      evaluateDisclosurePolicy({
        requestedFields: ["GENERAL_HUSBANDRY"],
        farmPolicy: defaultPolicy,
        buyerMilestone: "RESERVED",
        sourceDisclosure: "POST_PURCHASE"
      }),
    /only after buyer commitment/
  );
});
