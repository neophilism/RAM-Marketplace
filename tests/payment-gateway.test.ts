import assert from "node:assert/strict";
import test from "node:test";
import {
  assertExecutionStatusTransition,
  bodyHash,
  executionTypeToLedgerType,
  paymentGatewayConfig,
  signGatewayMessage,
  verifyGatewaySignature
} from "../lib/payments/gateway";

const secret = "payment-gateway-test-secret-value-2026";

test("payment gateway signatures verify and reject tampering", () => {
  const raw = JSON.stringify({ eventId: "evt-12345678", status: "SUCCEEDED" });
  const timestamp = "1791295200";
  const signature = signGatewayMessage(raw, timestamp, secret);

  assert.doesNotThrow(() =>
    verifyGatewaySignature(raw, timestamp, signature, secret, {
      nowMs: 1791295200 * 1000
    })
  );

  assert.throws(
    () =>
      verifyGatewaySignature(
        raw + "x",
        timestamp,
        signature,
        secret,
        { nowMs: 1791295200 * 1000 }
      ),
    /Invalid payment gateway signature/
  );
});

test("payment gateway signature rejects stale timestamps", () => {
  const raw = "{}";
  const timestamp = "1791290000";
  const signature = signGatewayMessage(raw, timestamp, secret);

  assert.throws(
    () =>
      verifyGatewaySignature(raw, timestamp, signature, secret, {
        nowMs: 1791295200 * 1000,
        maxSkewSeconds: 300
      }),
    /outside allowed skew/
  );
});

test("execution types map only to money-moving ledger events", () => {
  assert.equal(executionTypeToLedgerType("BUYER_COLLECTION"), "BUYER_PAYMENT");
  assert.equal(executionTypeToLedgerType("SUPPLIER_PAYOUT"), "SUPPLIER_PAYOUT");
  assert.equal(executionTypeToLedgerType("BUYER_REFUND"), "BUYER_REFUND");
});

test("terminal payment executions cannot transition again", () => {
  assert.doesNotThrow(() =>
    assertExecutionStatusTransition("SUBMITTED", "SUCCEEDED")
  );
  assert.throws(
    () => assertExecutionStatusTransition("SUCCEEDED", "PROCESSING"),
    /Invalid payment execution transition/
  );
});

test("body hash is deterministic", () => {
  assert.equal(bodyHash("abc"), bodyHash("abc"));
  assert.notEqual(bodyHash("abc"), bodyHash("abcd"));
});


test("production gateway requires HTTPS except explicit loopback CI mode", () => {
  assert.throws(
    () =>
      paymentGatewayConfig({
        NODE_ENV: "production",
        RAM_PAYMENT_GATEWAY_NAME: "gateway",
        RAM_PAYMENT_GATEWAY_URL: "http://payments.example.test",
        RAM_PAYMENT_GATEWAY_SECRET: secret
      }),
    /must use HTTPS/
  );

  assert.equal(
    paymentGatewayConfig({
      NODE_ENV: "production",
      RAM_PAYMENT_GATEWAY_NAME: "gateway",
      RAM_PAYMENT_GATEWAY_URL: "http://127.0.0.1:4119",
      RAM_PAYMENT_GATEWAY_SECRET: secret,
      RAM_PAYMENT_GATEWAY_ALLOW_INSECURE_LOCAL: "true"
    })?.name,
    "gateway"
  );
});

test("partial gateway configuration fails closed", () => {
  assert.throws(
    () =>
      paymentGatewayConfig({
        NODE_ENV: "production",
        RAM_PAYMENT_GATEWAY_NAME: "gateway"
      }),
    /requires RAM_PAYMENT_GATEWAY_NAME/
  );
});
