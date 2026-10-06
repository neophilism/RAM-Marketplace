import assert from "node:assert/strict";
import test from "node:test";
import {
  assertFinancialSnapshot,
  assertMovementWithinOutstanding,
  assertReconciliationCloseReady,
  assertSettlementReady,
  financialBalances
} from "../lib/finance-policy";

const snapshot = {
  buyerReceivableCents: 250_000,
  supplierPayableCents: 15_000,
  supplierScheduleCents: 20_000,
  supplierMarketCeilingCents: 15_000,
  directCostsCents: 25_000
};

test("supplier payable must match the independent acquisition snapshot", () => {
  assert.doesNotThrow(() => assertFinancialSnapshot(snapshot));
  assert.throws(
    () =>
      assertFinancialSnapshot({
        ...snapshot,
        supplierPayableCents: 30_000
      }),
    /independently snapshotted acquisition amount/
  );
});

test("financial balances support partial buyer payments and supplier payouts", () => {
  const balances = financialBalances(snapshot, [
    { type: "BUYER_PAYMENT", amountCents: 100_000 },
    { type: "SUPPLIER_PAYOUT", amountCents: 5_000 }
  ]);

  assert.equal(balances.buyerOutstandingCents, 150_000);
  assert.equal(balances.supplierOutstandingCents, 10_000);
});

test("financial movement cannot exceed the outstanding balance", () => {
  const balances = financialBalances(snapshot, []);
  assert.throws(
    () => assertMovementWithinOutstanding("SUPPLIER_PAYOUT", 15_001, balances),
    /exceeds the available balance/
  );
});

test("settlement requires acceptance and zero outstanding balances", () => {
  const paid = financialBalances(snapshot, [
    { type: "BUYER_PAYMENT", amountCents: 250_000 },
    { type: "SUPPLIER_PAYOUT", amountCents: 15_000 }
  ]);
  assert.doesNotThrow(() => assertSettlementReady("ACCEPTED", paid));
  assert.throws(() => assertSettlementReady("DELIVERED", paid), /only after buyer acceptance/);

  const unpaid = financialBalances(snapshot, []);
  assert.throws(() => assertSettlementReady("ACCEPTED", unpaid), /must be satisfied/);
});

test("reconciliation closes only a settled order", () => {
  assert.doesNotThrow(() =>
    assertReconciliationCloseReady("SETTLED", "SETTLED")
  );
  assert.throws(
    () => assertReconciliationCloseReady("ACCEPTED", "OPEN"),
    /Only a settled order/
  );
});


test("buyer credit reduces receivable without rewriting payment history", () => {
  const balances = financialBalances(snapshot, [
    { type: "BUYER_PAYMENT", amountCents: 100_000 },
    { type: "BUYER_CREDIT", amountCents: 50_000 }
  ]);

  assert.equal(balances.buyerPaidCents, 100_000);
  assert.equal(balances.buyerCreditsCents, 50_000);
  assert.equal(balances.effectiveBuyerReceivableCents, 200_000);
  assert.equal(balances.buyerOutstandingCents, 100_000);
});

test("credit after payment creates an auditable refund due", () => {
  const balances = financialBalances(snapshot, [
    { type: "BUYER_PAYMENT", amountCents: 250_000 },
    { type: "BUYER_CREDIT", amountCents: 250_000 }
  ]);
  assert.equal(balances.buyerRefundDueCents, 250_000);

  assert.doesNotThrow(() =>
    assertMovementWithinOutstanding("BUYER_REFUND", 250_000, balances)
  );
});

test("refund cannot exceed the refund due created by credit", () => {
  const balances = financialBalances(snapshot, [
    { type: "BUYER_PAYMENT", amountCents: 100_000 },
    { type: "BUYER_CREDIT", amountCents: 50_000 }
  ]);
  assert.throws(
    () => assertMovementWithinOutstanding("BUYER_REFUND", 1, balances),
    /exceeds the available balance/
  );
});
