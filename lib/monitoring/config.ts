import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export interface MonitoringConfig {
  enabled: boolean;
  runToken?: string;
  alertUrl?: string;
  alertSecret?: string;
  allowInsecureLocal: boolean;
  paymentUnknownMinutes: number;
  paymentProcessingMinutes: number;
  disputeHours: number;
  pickupHours: number;
  organizationVerificationHours: number;
  maxRunAgeMinutes: number;
}

function positiveInt(
  value: string | undefined,
  fallback: number,
  name: string,
  max: number
) {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) {
    throw new Error(name + " must be a positive integer no greater than " + max);
  }
  return parsed;
}

export function strongMonitoringSecret(
  value: string | undefined
): value is string {
  return Boolean(
    value &&
      value.length >= 32 &&
      !/replace|changeme|example|development-only/i.test(value)
  );
}

export function monitoringConfig(
  env: Record<string, string | undefined> = process.env
): MonitoringConfig {
  return {
    enabled: env.RAM_MONITORING_ENABLED === "true",
    runToken: env.RAM_MONITORING_RUN_TOKEN?.trim() || undefined,
    alertUrl: env.RAM_MONITORING_ALERT_WEBHOOK_URL?.trim() || undefined,
    alertSecret:
      env.RAM_MONITORING_ALERT_WEBHOOK_SECRET?.trim() || undefined,
    allowInsecureLocal:
      env.RAM_MONITORING_ALLOW_INSECURE_LOCAL === "true",
    paymentUnknownMinutes: positiveInt(
      env.RAM_MONITORING_PAYMENT_UNKNOWN_MINUTES,
      10,
      "RAM_MONITORING_PAYMENT_UNKNOWN_MINUTES",
      1440
    ),
    paymentProcessingMinutes: positiveInt(
      env.RAM_MONITORING_PAYMENT_PROCESSING_MINUTES,
      60,
      "RAM_MONITORING_PAYMENT_PROCESSING_MINUTES",
      10080
    ),
    disputeHours: positiveInt(
      env.RAM_MONITORING_DISPUTE_HOURS,
      24,
      "RAM_MONITORING_DISPUTE_HOURS",
      720
    ),
    pickupHours: positiveInt(
      env.RAM_MONITORING_PICKUP_HOURS,
      24,
      "RAM_MONITORING_PICKUP_HOURS",
      720
    ),
    organizationVerificationHours: positiveInt(
      env.RAM_MONITORING_ORG_VERIFICATION_HOURS,
      48,
      "RAM_MONITORING_ORG_VERIFICATION_HOURS",
      720
    ),
    maxRunAgeMinutes: positiveInt(
      env.RAM_MONITORING_MAX_RUN_AGE_MINUTES,
      15,
      "RAM_MONITORING_MAX_RUN_AGE_MINUTES",
      1440
    )
  };
}

export function requireMonitoringRunnerConfig(
  env: Record<string, string | undefined> = process.env
) {
  const config = monitoringConfig(env);
  if (!config.enabled) {
    throw new Error("RAM monitoring is not enabled");
  }
  if (!strongMonitoringSecret(config.runToken)) {
    throw new Error(
      "RAM_MONITORING_RUN_TOKEN must be a strong secret of at least 32 characters"
    );
  }
  if (
    config.runToken === env.AUTH_SECRET ||
    config.runToken === env.RAM_IDENTITY_ASSERTION_SECRET ||
    config.runToken === env.RAM_PAYMENT_GATEWAY_SECRET
  ) {
    throw new Error(
      "RAM_MONITORING_RUN_TOKEN must be distinct from session, identity and payment secrets"
    );
  }
  return { ...config, runToken: config.runToken };
}

export function requireAlertWebhookConfig(
  env: Record<string, string | undefined> = process.env
) {
  const config = monitoringConfig(env);
  if (!config.alertUrl || !strongMonitoringSecret(config.alertSecret)) {
    throw new Error(
      "Monitoring alert webhook URL and strong signing secret are required"
    );
  }

  if (
    config.alertSecret === env.AUTH_SECRET ||
    config.alertSecret === env.RAM_IDENTITY_ASSERTION_SECRET ||
    config.alertSecret === env.RAM_PAYMENT_GATEWAY_SECRET ||
    config.alertSecret === config.runToken
  ) {
    throw new Error(
      "RAM_MONITORING_ALERT_WEBHOOK_SECRET must be distinct from other RAM secrets"
    );
  }

  const parsed = new URL(config.alertUrl);
  const loopback =
    parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";

  if (
    env.NODE_ENV === "production" &&
    parsed.protocol !== "https:" &&
    !(config.allowInsecureLocal && loopback && parsed.protocol === "http:")
  ) {
    throw new Error("Production monitoring alert webhook must use HTTPS");
  }

  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("Monitoring alert webhook must use HTTP(S)");
  }

  return {
    ...config,
    alertUrl: parsed.toString(),
    alertSecret: config.alertSecret
  };
}

export function signMonitoringPayload(
  rawBody: string,
  timestamp: string,
  secret: string
) {
  if (!strongMonitoringSecret(secret)) {
    throw new Error("Monitoring signing secret is too weak");
  }
  return createHmac("sha256", secret)
    .update(timestamp)
    .update(".")
    .update(rawBody)
    .digest("hex");
}

export function verifyMonitoringSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  secret: string,
  options: { nowMs?: number; maxSkewSeconds?: number } = {}
) {
  if (!timestamp || !signature) {
    throw new Error("Monitoring signature headers are required");
  }

  const seconds = Number(timestamp);
  if (!Number.isInteger(seconds)) {
    throw new Error("Invalid monitoring signature timestamp");
  }

  const nowMs = options.nowMs ?? Date.now();
  const maxSkewMs = (options.maxSkewSeconds ?? 300) * 1000;
  if (Math.abs(nowMs - seconds * 1000) > maxSkewMs) {
    throw new Error("Monitoring signature timestamp is outside allowed skew");
  }

  const expected = Buffer.from(
    signMonitoringPayload(rawBody, timestamp, secret),
    "hex"
  );
  const supplied = Buffer.from(signature, "hex");

  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    throw new Error("Invalid monitoring signature");
  }
}

export function verifyMonitoringRunToken(
  supplied: string | null,
  expected: string
) {
  if (!supplied?.startsWith("Bearer ")) {
    throw new Error("Monitoring bearer token is required");
  }
  const token = supplied.slice("Bearer ".length);
  const expectedHash = createHash("sha256").update(expected).digest();
  const actualHash = createHash("sha256").update(token).digest();

  if (!timingSafeEqual(expectedHash, actualHash)) {
    throw new Error("Invalid monitoring bearer token");
  }
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
