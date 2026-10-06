import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTransportAssignmentEligible,
  nextOrderStatusForTransportEvent
} from "../lib/logistics-policy";

test("transport assignment is blocked before compliance clearance", () => {
  assert.throws(
    () => assertTransportAssignmentEligible("CLEARANCE_PENDING"),
    /only after RAM clearance/
  );
  assert.doesNotThrow(() => assertTransportAssignmentEligible("READY_FOR_PICKUP"));
});

test("pickup starts transit only from ready-for-pickup", () => {
  assert.equal(
    nextOrderStatusForTransportEvent("READY_FOR_PICKUP", "PICKUP_CONFIRMED"),
    "IN_TRANSIT"
  );
  assert.throws(
    () => nextOrderStatusForTransportEvent("CLEARANCE_PENDING", "PICKUP_CONFIRMED"),
    /Invalid transport event/
  );
});

test("transport exception can pause and resume transit", () => {
  assert.equal(
    nextOrderStatusForTransportEvent("IN_TRANSIT", "EXCEPTION_REPORTED"),
    "TRANSPORT_EXCEPTION"
  );
  assert.equal(
    nextOrderStatusForTransportEvent("TRANSPORT_EXCEPTION", "RESUME_TRANSIT"),
    "IN_TRANSIT"
  );
});

test("delivery can close transport from transit or an exception", () => {
  assert.equal(
    nextOrderStatusForTransportEvent("IN_TRANSIT", "DELIVERY_CONFIRMED"),
    "DELIVERED"
  );
  assert.equal(
    nextOrderStatusForTransportEvent("TRANSPORT_EXCEPTION", "DELIVERY_CONFIRMED"),
    "DELIVERED"
  );
});
