import assert from "node:assert/strict";
import test from "node:test";
import { requireAlertWebhookConfig, signMonitoringPayload, strongMonitoringSecret,
  verifyMonitoringRunToken, verifyMonitoringSignature } from "../lib/monitoring/config";

// Constructed fixtures only; no external receiver, provider or real key.
const secret = "synthetic-monitoring-key-" + "q".repeat(32);
const body = '{"incidentId":"synthetic-incident"}';
const timestamp = "1791300000", nowMs = Number(timestamp) * 1000;
const signature = signMonitoringPayload(body, timestamp, secret);

for (const suffix of ["a", "junk", " ", "\n", "-discarded", "zz"])
  test("a valid signature with suffix " + JSON.stringify(suffix) + " is rejected", () => {
    assert.throws(() => verifyMonitoringSignature(body, timestamp, signature + suffix, secret, { nowMs }), /signature/);
  });
for (const invalid of ["01791300000", "1791300000.0", "1.7913e9", " 1791300000", "+1791300000", "0x6ac51280", "-0"])
  test("timestamp is canonical decimal seconds: " + JSON.stringify(invalid), () => {
    const signed = signMonitoringPayload(body, invalid, secret);
    assert.throws(() => verifyMonitoringSignature(body, invalid, signed, secret, { nowMs: Number(invalid) * 1000 }), /timestamp/);
  });
for (const clock of [NaN, Infinity, -Infinity, -1, Number.MAX_SAFE_INTEGER + 1])
  test("invalid verifier clock " + String(clock) + " fails closed", () => {
    assert.throws(() => verifyMonitoringSignature(body, timestamp, signature, secret, { nowMs: clock }), /clock|policy/);
  });
for (const skew of [NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER])
  test("invalid verifier skew " + String(skew) + " fails closed", () => {
    assert.throws(() => verifyMonitoringSignature(body, timestamp, signature, secret, { nowMs, maxSkewSeconds: skew }), /policy|skew/);
  });
test("valid uppercase hex, exact skew boundary and zero-skew policy remain supported", () => {
  assert.doesNotThrow(() => verifyMonitoringSignature(body, timestamp, signature.toUpperCase(), secret, { nowMs }));
  for (const offset of [-300_000, 300_000])
    assert.doesNotThrow(() => verifyMonitoringSignature(body, timestamp, signature, secret, { nowMs: nowMs + offset }));
  for (const offset of [-300_001, 300_001])
    assert.throws(() => verifyMonitoringSignature(body, timestamp, signature, secret, { nowMs: nowMs + offset }), /skew/);
  assert.doesNotThrow(() => verifyMonitoringSignature(body, timestamp, signature, secret, { nowMs, maxSkewSeconds: 0 }));
  assert.throws(() => verifyMonitoringSignature(body, timestamp, signature, secret, { nowMs: nowMs + 1, maxSkewSeconds: 0 }), /skew/);
});
test("whitespace cannot satisfy minimum signing-secret strength", () => {
  for (const value of [" ".repeat(40), "\t".repeat(40), "x".repeat(8) + " ".repeat(40)]) {
    assert.equal(strongMonitoringSecret(value), false);
    assert.throws(() => signMonitoringPayload(body, timestamp, value), /weak/);
  }
  assert.equal(strongMonitoringSecret(secret), true);
});
test("the exported bearer verifier never accepts an unconfigured expected token", () => {
  for (const value of ["", "short", " ".repeat(40)])
    assert.throws(() => verifyMonitoringRunToken("Bearer " + value, value), /token|configuration/);
  assert.doesNotThrow(() => verifyMonitoringRunToken("Bearer " + secret, secret));
});
const env = { NODE_ENV: "production", RAM_MONITORING_ALERT_WEBHOOK_SECRET: secret };
for (const url of ["https://user:pass@alerts.example.test/notify", "https://alerts.example.test/notify#fragment",
  "https://alerts.example.test/not\nify", "https://alerts.example.test\\notify", "https://"]) {
  test("alert configuration rejects ambiguous endpoint " + JSON.stringify(url), () => {
    assert.throws(() => requireAlertWebhookConfig({ ...env, RAM_MONITORING_ALERT_WEBHOOK_URL: url }), /URL|endpoint/);
  });
}
test("explicit CI loopback exception is preserved and never permits a remote HTTP receiver", () => {
  assert.equal(requireAlertWebhookConfig({ ...env, RAM_MONITORING_ALERT_WEBHOOK_URL: "http://127.0.0.1:4120/alerts",
    RAM_MONITORING_ALLOW_INSECURE_LOCAL: "true" }).alertUrl, "http://127.0.0.1:4120/alerts");
  assert.throws(() => requireAlertWebhookConfig({ ...env, RAM_MONITORING_ALERT_WEBHOOK_URL: "http://remote.example.test",
    RAM_MONITORING_ALLOW_INSECURE_LOCAL: "true" }), /HTTPS/);
});
