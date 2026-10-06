import assert from "node:assert/strict";
import test from "node:test";
import {
  assertDisputeOpenable,
  disputeResolutionTarget
} from "../lib/dispute-policy";

const resolvedFinances = {
  buyerReceivableCents: 100_000,
  buyerCreditsCents: 100_000,
  buyerOutstandingCents: 0,
  buyerRefundDueCents: 0,
  supplierOutstandingCents: 0
};

test("receipt disputes open only from rejected receipt", () => {
  assert.doesNotThrow(() => assertDisputeOpenable("REJECTED_AT_RECEIPT"));
  assert.throws(
    () => assertDisputeOpenable("DELIVERED"),
    /only from a rejected receipt/
  );
});

test("accept-as-is returns the order to accepted and starts the study", () => {
  assert.deepEqual(
    disputeResolutionTarget(
      "DISPUTED",
      "ORDERED",
      "ACCEPT_AS_IS",
      { ...resolvedFinances, buyerCreditsCents: 0 }
    ),
    {
      orderStatus: "ACCEPTED",
      researchNeedStatus: "IN_STUDY",
      settleFinancials: false
    }
  );
});

test("accept-with-credit requires an accounting credit", () => {
  assert.throws(
    () =>
      disputeResolutionTarget(
        "DISPUTED",
        "ORDERED",
        "ACCEPT_WITH_CREDIT",
        { ...resolvedFinances, buyerCreditsCents: 0 }
      ),
    /recorded buyer credit/
  );
});

test("replacement reopens the research need only after finances are resolved", () => {
  assert.equal(
    disputeResolutionTarget(
      "DISPUTED",
      "ORDERED",
      "REPLACEMENT",
      resolvedFinances
    ).researchNeedStatus,
    "ACTIVE"
  );

  assert.throws(
    () =>
      disputeResolutionTarget(
        "DISPUTED",
        "ORDERED",
        "REPLACEMENT",
        { ...resolvedFinances, supplierOutstandingCents: 10_000 }
      ),
    /all buyer and supplier balances/
  );
});

test("replacement reopens the need while refund closes it", () => {
  assert.equal(
    disputeResolutionTarget(
      "DISPUTED",
      "ORDERED",
      "REPLACEMENT",
      resolvedFinances
    ).researchNeedStatus,
    "ACTIVE"
  );
  assert.equal(
    disputeResolutionTarget(
      "DISPUTED",
      "ORDERED",
      "REFUND",
      resolvedFinances
    ).researchNeedStatus,
    "CLOSED"
  );
});

test("replacement and refund both require full buyer credit", () => {
  for (const resolutionType of ["REPLACEMENT", "REFUND"] as const) {
    assert.throws(
      () =>
        disputeResolutionTarget(
          "DISPUTED",
          "ORDERED",
          resolutionType,
          { ...resolvedFinances, buyerCreditsCents: 50_000 }
        ),
      /full buyer credit/
    );
  }
});
