import assert from "node:assert/strict";
import test from "node:test";
import { assertTransportPacketProjection } from "../lib/logistics-privacy";

test("transport packet permits operational pickup and delivery fields", () => {
  assert.doesNotThrow(() =>
    assertTransportPacketProjection({
      animalCaseId: "RAM-SW-1",
      pickupAddress: "123 Pickup Road",
      pickupContactName: "Pickup Contact",
      pickupContactEmail: "pickup@example.invalid",
      deliveryAddress: "456 Research Lane",
      sanitationRequirements: "Disinfect before loading"
    })
  );
});

test("transport packet fails closed on commercial or source-identity leakage", () => {
  for (const key of [
    "buyerPriceCents",
    "supplierAcquisitionCents",
    "legalOwnerName",
    "researchNeedTitle",
    "matchScore"
  ]) {
    assert.throws(
      () => assertTransportPacketProjection({ [key]: "forbidden" }),
      /privacy boundary violated/
    );
  }
});
