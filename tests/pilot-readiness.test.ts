import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluatePilotReadiness,
  readinessSummary
} from "../lib/pilot-readiness";

const readyEnv = {
  NODE_ENV: "production",
  RAM_DATA_BACKEND: "postgres",
  DATABASE_URL: "postgresql://ram:secret@db.internal:5432/ram",
  AUTH_SECRET: "this-is-a-production-strength-secret-value-2026",
  RAM_IDENTITY_ASSERTION_SECRET: "separate-identity-assertion-secret-value-2026",
  RAM_IDENTITY_ALLOWED_PROVIDERS: "enterprise-oidc",
  RAM_IDENTITY_LOGIN_URL: "https://identity.example.test/login",
  RAM_IDENTITY_REQUIRE_MFA: "true",
  RAM_PAYMENT_GATEWAY_NAME: "production-gateway",
  RAM_PAYMENT_GATEWAY_URL: "https://payments.example.test",
  RAM_PAYMENT_GATEWAY_SECRET: "separate-payment-gateway-secret-value-2026",
  RAM_PAYMENT_GATEWAY_ALLOW_INSECURE_LOCAL: "false",
  RAM_MONITORING_ENABLED: "true",
  RAM_MONITORING_RUN_TOKEN: "separate-monitoring-run-token-value-2026",
  RAM_MONITORING_ALERT_WEBHOOK_URL: "https://alerts.example.test/ram",
  RAM_MONITORING_ALERT_WEBHOOK_SECRET: "separate-monitoring-alert-secret-value-2026",
  RAM_MONITORING_ALLOW_INSECURE_LOCAL: "false",
  RAM_MONITORING_PAYMENT_UNKNOWN_MINUTES: "10",
  RAM_MONITORING_PAYMENT_PROCESSING_MINUTES: "60",
  RAM_MONITORING_DISPUTE_HOURS: "24",
  RAM_MONITORING_PICKUP_HOURS: "24",
  RAM_MONITORING_ORG_VERIFICATION_HOURS: "48",
  RAM_MONITORING_MAX_RUN_AGE_MINUTES: "15",
  RAM_DEMO_AUTH_ENABLED: "false",
  RAM_PUBLIC_ONBOARDING_ENABLED: "false",
  RAM_MAX_MUTATION_BYTES: "1048576"
};

test("pilot readiness passes automatically verifiable production configuration", () => {
  const checks = evaluatePilotReadiness(readyEnv);
  const summary = readinessSummary(checks);
  assert.equal(summary.automaticReady, true);
  assert.equal(summary.blockers, 0);
  assert.ok(summary.manualGates > 0);
});

test("pilot readiness blocks prototype persistence and demo auth", () => {
  const checks = evaluatePilotReadiness({
    ...readyEnv,
    RAM_DATA_BACKEND: "prototype",
    RAM_DEMO_AUTH_ENABLED: "true"
  });
  const summary = readinessSummary(checks);
  assert.equal(summary.automaticReady, false);
  assert.ok(summary.blockers >= 2);
});

test("pilot readiness rejects placeholder or short auth secrets", () => {
  for (const secret of ["short", "replace-with-a-long-random-secret"]) {
    const checks = evaluatePilotReadiness({
      ...readyEnv,
      AUTH_SECRET: secret
    });
    assert.equal(
      checks.find((check) => check.id === "auth_secret")?.status,
      "BLOCK"
    );
  }
});


test("pilot readiness blocks missing or weakened identity boundary", () => {
  const checks = evaluatePilotReadiness({
    ...readyEnv,
    RAM_IDENTITY_ASSERTION_SECRET: readyEnv.AUTH_SECRET,
    RAM_IDENTITY_ALLOWED_PROVIDERS: "",
    RAM_IDENTITY_LOGIN_URL: "http://identity.example.test/login",
    RAM_IDENTITY_REQUIRE_MFA: "false"
  });

  for (const id of [
    "identity_secret",
    "identity_providers",
    "identity_login_url",
    "identity_mfa"
  ]) {
    assert.equal(checks.find((check) => check.id === id)?.status, "BLOCK");
  }
});


test("pilot readiness blocks insecure or shared payment gateway configuration", () => {
  const checks = evaluatePilotReadiness({
    ...readyEnv,
    RAM_PAYMENT_GATEWAY_SECRET: readyEnv.AUTH_SECRET,
    RAM_PAYMENT_GATEWAY_NAME: "",
    RAM_PAYMENT_GATEWAY_URL: "http://127.0.0.1:4119",
    RAM_PAYMENT_GATEWAY_ALLOW_INSECURE_LOCAL: "true"
  });

  for (const id of [
    "payment_secret",
    "payment_gateway_name",
    "payment_gateway_url"
  ]) {
    assert.equal(checks.find((check) => check.id === id)?.status, "BLOCK");
  }
});


test("pilot readiness blocks missing, shared or insecure monitoring configuration", () => {
  const checks = evaluatePilotReadiness({
    ...readyEnv,
    RAM_MONITORING_ENABLED: "false",
    RAM_MONITORING_RUN_TOKEN: readyEnv.AUTH_SECRET,
    RAM_MONITORING_ALERT_WEBHOOK_URL: "http://127.0.0.1:4120",
    RAM_MONITORING_ALERT_WEBHOOK_SECRET: readyEnv.RAM_PAYMENT_GATEWAY_SECRET,
    RAM_MONITORING_ALLOW_INSECURE_LOCAL: "true",
    RAM_MONITORING_PAYMENT_UNKNOWN_MINUTES: "0"
  });

  for (const id of [
    "monitoring_enabled",
    "monitoring_run_token",
    "monitoring_alert_secret",
    "monitoring_alert_url",
    "monitoring_thresholds"
  ]) {
    assert.equal(checks.find((check) => check.id === id)?.status, "BLOCK");
  }
});
