import assert from "node:assert/strict";
import test from "node:test";
import {
  createEnrollmentToken,
  verifyEnrollmentToken
} from "../lib/auth/enrollment-token";

const secret = "this-is-a-test-secret-with-enough-length";
const identity = {
  userId: "user-1",
  email: "person@example.test",
  name: "Person",
  provider: "test-oidc",
  subject: "subject-1"
};

test("verified enrollment tokens round-trip", () => {
  const token = createEnrollmentToken(identity, secret, 600, 1_000_000);
  const verified = verifyEnrollmentToken(token, secret, 1_100_000);
  assert.equal(verified?.userId, identity.userId);
  assert.equal(verified?.provider, identity.provider);
});

test("tampered and expired enrollment tokens fail closed", () => {
  const token = createEnrollmentToken(identity, secret, 10, 1_000_000);
  const [payload, signature] = token.split(".");
  const tampered =
    payload.slice(0, -1) +
    (payload.endsWith("A") ? "B" : "A") +
    "." +
    signature;

  assert.equal(verifyEnrollmentToken(tampered, secret, 1_000_000), null);
  assert.equal(verifyEnrollmentToken(token, secret, 1_011_000), null);
});
