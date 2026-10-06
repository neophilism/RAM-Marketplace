import assert from "node:assert/strict";
import test from "node:test";
import { nextOrderStatusForReceiptDecision } from "../lib/receiving-policy";

test("acceptance advances only a delivered order", () => {
  assert.equal(
    nextOrderStatusForReceiptDecision("DELIVERED", "ACCEPT"),
    "ACCEPTED"
  );
  assert.throws(
    () => nextOrderStatusForReceiptDecision("IN_TRANSIT", "ACCEPT"),
    /only after carrier delivery/
  );
});

test("rejection records a receipt exception without starting the study", () => {
  assert.equal(
    nextOrderStatusForReceiptDecision("DELIVERED", "REJECT"),
    "REJECTED_AT_RECEIPT"
  );
});
