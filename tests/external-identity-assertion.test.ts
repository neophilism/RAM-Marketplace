import assert from "node:assert/strict";
import test from "node:test";
import {
  createExternalIdentityAssertion,
  verifyExternalIdentityAssertion
} from "../lib/auth/external-assertion";

const secret = "external-identity-test-secret-value-2026";
const payload = {
  v: 1 as const,
  aud: "ram-marketplace" as const,
  provider: "test-oidc",
  subject: "subject-123",
  email: "Researcher@Example.Test",
  name: "Researcher",
  emailVerified: true,
  mfa: true,
  amr: ["pwd", "mfa"],
  jti: "assertion-jti-123456",
  iat: 1000,
  exp: 1120
};

test("verified external identity assertions round-trip and normalize email", () => {
  const token = createExternalIdentityAssertion(payload, secret);
  const verified = verifyExternalIdentityAssertion(token, secret, {
    allowedProviders: ["test-oidc"],
    requireMfa: true,
    nowMs: 1_050_000
  });

  assert.equal(verified.subject, payload.subject);
  assert.equal(verified.email, "researcher@example.test");
  assert.equal(verified.mfa, true);
});

test("external identity assertion signature tampering fails", () => {
  const token = createExternalIdentityAssertion(payload, secret);
  const [encoded, signature] = token.split(".");
  const tampered =
    encoded.slice(0, -1) +
    (encoded.endsWith("A") ? "B" : "A") +
    "." +
    signature;

  assert.throws(
    () =>
      verifyExternalIdentityAssertion(tampered, secret, {
        allowedProviders: ["test-oidc"],
        requireMfa: true,
        nowMs: 1_050_000
      }),
    /signature/
  );
});

test("provider allowlist and MFA policy fail closed", () => {
  const token = createExternalIdentityAssertion(payload, secret);

  assert.throws(
    () =>
      verifyExternalIdentityAssertion(token, secret, {
        allowedProviders: ["other-provider"],
        requireMfa: true,
        nowMs: 1_050_000
      }),
    /not allowed/
  );

  const noMfa = createExternalIdentityAssertion(
    { ...payload, mfa: false, jti: "assertion-jti-no-mfa" },
    secret
  );
  assert.throws(
    () =>
      verifyExternalIdentityAssertion(noMfa, secret, {
        allowedProviders: ["test-oidc"],
        requireMfa: true,
        nowMs: 1_050_000
      }),
    /MFA/
  );
});

test("expired and overlong assertions fail closed", () => {
  const expired = createExternalIdentityAssertion(
    { ...payload, exp: 1010, jti: "assertion-jti-expired" },
    secret
  );
  assert.throws(
    () =>
      verifyExternalIdentityAssertion(expired, secret, {
        allowedProviders: ["test-oidc"],
        requireMfa: true,
        nowMs: 1_020_000
      }),
    /expired/
  );

  const overlong = createExternalIdentityAssertion(
    { ...payload, exp: 1600, jti: "assertion-jti-overlong" },
    secret
  );
  assert.throws(
    () =>
      verifyExternalIdentityAssertion(overlong, secret, {
        allowedProviders: ["test-oidc"],
        requireMfa: true,
        nowMs: 1_050_000
      }),
    /lifetime/
  );
});
