import assert from "node:assert/strict";
import test from "node:test";
import {
  monitoringConfig,
  requireAlertWebhookConfig,
  requireMonitoringRunnerConfig,
  signMonitoringPayload,
  verifyMonitoringRunToken,
  verifyMonitoringSignature
} from "../lib/monitoring/config";

const runToken = "monitoring-run-token-long-enough-for-tests-2026";
const alertSecret = "monitoring-alert-secret-long-enough-for-tests-2026";

test("monitoring thresholds have bounded defaults", () => {
  const config = monitoringConfig({});
  assert.equal(config.paymentUnknownMinutes, 10);
  assert.equal(config.paymentProcessingMinutes, 60);
  assert.equal(config.disputeHours, 24);
  assert.equal(config.pickupHours, 24);
  assert.equal(config.organizationVerificationHours, 48);
  assert.equal(config.maxRunAgeMinutes, 15);
});

test("monitoring runner requires a distinct strong token", () => {
  assert.equal(
    requireMonitoringRunnerConfig({
      RAM_MONITORING_ENABLED: "true",
      RAM_MONITORING_RUN_TOKEN: runToken
    }).enabled,
    true
  );

  assert.throws(
    () =>
      requireMonitoringRunnerConfig({
        RAM_MONITORING_ENABLED: "true",
        RAM_MONITORING_RUN_TOKEN: runToken,
        AUTH_SECRET: runToken
      }),
    /must be distinct/
  );
});

test("monitoring alert webhook requires HTTPS in production", () => {
  assert.throws(
    () =>
      requireAlertWebhookConfig({
        NODE_ENV: "production",
        RAM_MONITORING_ALERT_WEBHOOK_URL: "http://alerts.example.test",
        RAM_MONITORING_ALERT_WEBHOOK_SECRET: alertSecret
      }),
    /must use HTTPS/
  );

  assert.equal(
    requireAlertWebhookConfig({
      NODE_ENV: "production",
      RAM_MONITORING_ALERT_WEBHOOK_URL: "https://alerts.example.test",
      RAM_MONITORING_ALERT_WEBHOOK_SECRET: alertSecret
    }).alertUrl,
    "https://alerts.example.test/"
  );
});

test("monitoring signatures reject tampering and stale delivery", () => {
  const body = JSON.stringify({ incidentId: "incident-1" });
  const timestamp = "1791300000";
  const signature = signMonitoringPayload(body, timestamp, alertSecret);

  assert.doesNotThrow(() =>
    verifyMonitoringSignature(body, timestamp, signature, alertSecret, {
      nowMs: 1791300000 * 1000
    })
  );

  assert.throws(
    () =>
      verifyMonitoringSignature(body + "x", timestamp, signature, alertSecret, {
        nowMs: 1791300000 * 1000
      }),
    /Invalid monitoring signature/
  );

  assert.throws(
    () =>
      verifyMonitoringSignature(body, timestamp, signature, alertSecret, {
        nowMs: 1791301000 * 1000
      }),
    /outside allowed skew/
  );
});

test("monitoring runner bearer token comparison fails closed", () => {
  assert.doesNotThrow(() =>
    verifyMonitoringRunToken("Bearer " + runToken, runToken)
  );
  assert.throws(
    () => verifyMonitoringRunToken("Bearer wrong", runToken),
    /Invalid monitoring bearer token/
  );
});
