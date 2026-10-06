import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRateLimitCount,
  fixedWindowStartMs,
  rateLimitFingerprint
} from "../lib/security/rate-limit-policy";

test("fixed windows are deterministic", () => {
  assert.equal(fixedWindowStartMs(125_000, 60), 120_000);
  assert.equal(fixedWindowStartMs(179_999, 60), 120_000);
  assert.equal(fixedWindowStartMs(180_000, 60), 180_000);
});

test("rate-limit fingerprint is stable but does not reveal raw address", () => {
  const secret = "this-is-a-long-enough-test-secret";
  const first = rateLimitFingerprint(
    { address: "203.0.113.10", userAgent: "test-agent" },
    secret
  );
  const second = rateLimitFingerprint(
    { address: "203.0.113.10", userAgent: "test-agent" },
    secret
  );
  assert.equal(first, second);
  assert.equal(first.includes("203.0.113.10"), false);
});

test("rate limit fails only after the configured count", () => {
  assert.doesNotThrow(() => assertRateLimitCount(5, 5));
  assert.throws(() => assertRateLimitCount(6, 5), /Rate limit exceeded/);
});
