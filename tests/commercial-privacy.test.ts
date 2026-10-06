import assert from "node:assert/strict";
import test from "node:test";
import {
  assertBlindAcquisitionProjection,
  assertBuyerOrderProjection
} from "../lib/commercial-privacy";

test("buyer order projection rejects supplier acquisition economics", () => {
  assert.doesNotThrow(() =>
    assertBuyerOrderProjection({
      id: "order-1",
      buyerPriceCents: 500_000,
      status: "CHECKOUT_PENDING"
    })
  );

  assert.throws(
    () =>
      assertBuyerOrderProjection({
        id: "order-1",
        supplierAcquisitionCents: 12_000
      }),
    /Buyer order privacy boundary/
  );
});

test("supplier acquisition decision surface rejects buyer value signals", () => {
  assert.doesNotThrow(() =>
    assertBlindAcquisitionProjection({
      id: "order-1",
      animalCaseId: "RAM-SW-1",
      species: "Swine",
      pricingPolicy: { standardizedCullScheduleCents: 12_000 }
    })
  );

  assert.throws(
    () =>
      assertBlindAcquisitionProjection({
        id: "order-1",
        buyerPriceCents: 900_000
      }),
    /Supplier acquisition decision privacy boundary/
  );
});
