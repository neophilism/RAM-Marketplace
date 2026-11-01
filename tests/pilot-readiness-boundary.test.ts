import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePilotReadiness, PILOT_MANUAL_GATES } from "../lib/pilot-readiness";
import { requireAlertWebhookConfig, requireMonitoringRunnerConfig } from "../lib/monitoring/config";

// Distinct constructed fixtures only; this suite performs no network or database access.
const env = {
  NODE_ENV: "production", RAM_DATA_BACKEND: "postgres", DATABASE_URL: "postgresql://fixture:fixture@db.example.test/ram?sslmode=require",
  AUTH_SECRET: "synthetic-auth-" + "a".repeat(32), RAM_IDENTITY_ASSERTION_SECRET: "synthetic-identity-" + "i".repeat(32),
  RAM_PAYMENT_GATEWAY_SECRET: "synthetic-payment-" + "p".repeat(32), RAM_MONITORING_RUN_TOKEN: "synthetic-run-" + "r".repeat(32),
  RAM_MONITORING_ALERT_WEBHOOK_SECRET: "synthetic-alert-" + "s".repeat(32), RAM_MONITORING_ENABLED: "true",
  RAM_IDENTITY_ALLOWED_PROVIDERS: "fixture-oidc", RAM_IDENTITY_LOGIN_URL: "https://identity.example.test/login?flow=pilot",
  RAM_PAYMENT_GATEWAY_NAME: "fixture", RAM_PAYMENT_GATEWAY_URL: "https://payments.example.test/v1",
  RAM_MONITORING_ALERT_WEBHOOK_URL: "https://alerts.example.test/ram", RAM_IDENTITY_REQUIRE_MFA: "true"
};
const endpoints = [ ["RAM_IDENTITY_LOGIN_URL", "identity_login_url"], ["RAM_PAYMENT_GATEWAY_URL", "payment_gateway_url"],
  ["RAM_MONITORING_ALERT_WEBHOOK_URL", "monitoring_alert_url"] ] as const;
function state(values: Record<string, string | undefined>, id: string) {
  const checks = evaluatePilotReadiness(values);
  assert.equal(new Set(checks.map((item) => item.id)).size, checks.length);
  return checks.find((item) => item.id === id)?.status;
}
for (const [key, id] of endpoints) {
  for (const value of ["https://", "https:///", "https://:443/", "https://service.example.test:99999/", "https://user:private-marker@service.example.test/",
    "https://service.example.test/in\nternal", "https://service.example.test\\internal", "https://service.example.test/a b"]) {
    test(key + " does not accept a mere HTTPS prefix: " + JSON.stringify(value), () => {
      const values = { ...env, [key]: value };
      assert.equal(state(values, id), "BLOCK");
      assert.equal(JSON.stringify(evaluatePilotReadiness(values)).includes("private-marker"), false);
    });
  }
  test(key + " still accepts a complete HTTPS endpoint with a query", () => {
    assert.equal(state({ ...env, [key]: "https://service.example.test/v1?route=pilot" }, id), "PASS");
  });
}
for (const value of ["postgresql://", "postgres://", "postgresql://user:fixture@", "postgresql://host.test:99999/db", "postgresql://host.test/d\nb",
  "postgresql://host.test/db#ignored", "postgresql://host.test\\db"]) {
  test("database readiness rejects an incomplete or ambiguous connection URL: " + JSON.stringify(value), () => {
    assert.equal(state({ ...env, DATABASE_URL: value }, "postgres_backend"), "BLOCK");
  });
}
test("database validation retains encoded credentials, database paths and SSL/schema queries", () => {
  assert.equal(state({ ...env, DATABASE_URL: "postgres://fixture:p%40ss@db.example.test:5432/ram?sslmode=require&schema=public" }, "postgres_backend"), "PASS");
});
for (const [key, id] of [["AUTH_SECRET", "auth_secret"], ["RAM_IDENTITY_ASSERTION_SECRET", "identity_secret"], ["RAM_PAYMENT_GATEWAY_SECRET", "payment_secret"]] as const)
  test(key + " cannot pass the secret length check using whitespace padding", () => {
    for (const value of [" ".repeat(50), "short" + " ".repeat(50)]) assert.equal(state({ ...env, [key]: value }, id), "BLOCK");
  });
for (const other of [env.AUTH_SECRET, env.RAM_IDENTITY_ASSERTION_SECRET, env.RAM_PAYMENT_GATEWAY_SECRET]) {
  test("scheduler preflight agrees with runtime after whitespace normalization: " + other.slice(0, 20), () => {
    const values = { ...env, RAM_MONITORING_RUN_TOKEN: " " + other + " " };
    assert.throws(() => requireMonitoringRunnerConfig(values), /distinct/);
    assert.equal(state(values, "monitoring_run_token"), "BLOCK");
  });
  test("alert preflight agrees with runtime after whitespace normalization: " + other.slice(0, 20), () => {
    const values = { ...env, RAM_MONITORING_ALERT_WEBHOOK_SECRET: " " + other + " " };
    assert.throws(() => requireAlertWebhookConfig(values), /distinct/);
    assert.equal(state(values, "monitoring_alert_secret"), "BLOCK");
  });
}
test("differently padded monitoring keys do not appear independent after runtime normalization", () => {
  const values = { ...env, RAM_MONITORING_RUN_TOKEN: " " + env.RAM_MONITORING_RUN_TOKEN,
    RAM_MONITORING_ALERT_WEBHOOK_SECRET: env.RAM_MONITORING_RUN_TOKEN + " " };
  assert.throws(() => requireAlertWebhookConfig(values), /distinct/);
  assert.equal(state(values, "monitoring_alert_secret"), "BLOCK");
});
test("API endpoint fragments are rejected while browser login fragments remain usable", () => {
  for (const [key, id] of endpoints.slice(1)) assert.equal(state({ ...env, [key]: "https://service.example.test/endpoint#fragment" }, id), "BLOCK");
  assert.equal(state({ ...env, RAM_IDENTITY_LOGIN_URL: "https://identity.example.test/#/login" }, "identity_login_url"), "PASS");
});
test("all institutional and operational gates stay manual and source values are not mutated", () => {
  const original = JSON.stringify(env), checks = evaluatePilotReadiness(Object.freeze({ ...env }));
  assert.deepEqual(checks.filter((item) => item.status === "MANUAL").map((item) => item.id), PILOT_MANUAL_GATES.map((item) => item.key));
  assert.equal(checks.filter((item) => item.status === "BLOCK").length, 0);
  assert.equal(JSON.stringify(env), original);
  for (const value of [env.AUTH_SECRET, env.RAM_IDENTITY_ASSERTION_SECRET, env.RAM_PAYMENT_GATEWAY_SECRET,
    env.RAM_MONITORING_RUN_TOKEN, env.RAM_MONITORING_ALERT_WEBHOOK_SECRET, env.DATABASE_URL]) assert.equal(JSON.stringify(checks).includes(value), false);
});
