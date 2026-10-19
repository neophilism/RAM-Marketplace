import assert from "node:assert/strict";
import test from "node:test";
import { identityBoundaryConfig } from "../lib/auth/identity-config";

const base = {
  RAM_IDENTITY_ALLOWED_PROVIDERS: "test-oidc",
  RAM_IDENTITY_LOGIN_URL: "https://identity.example.test/login",
  RAM_IDENTITY_ASSERTION_SECRET: "x".repeat(32)
};

test("identity boundary stays disabled unless the actual assertion secret meets verification policy", () => {
  assert.equal(identityBoundaryConfig(base).enabled, true);
  assert.equal(identityBoundaryConfig({ ...base, RAM_IDENTITY_ASSERTION_SECRET: "too-short" }).enabled, false);
  assert.equal(identityBoundaryConfig({ ...base, RAM_IDENTITY_ASSERTION_SECRET: "  " }).enabled, false);
  assert.equal(identityBoundaryConfig({ ...base, RAM_IDENTITY_ASSERTION_SECRET: undefined }).enabled, false);
});
