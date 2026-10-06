import {
  monitoringConfig,
  strongMonitoringSecret
} from "./monitoring/config";

export type ReadinessStatus = "PASS" | "BLOCK" | "MANUAL";

export interface ReadinessCheck {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
}

export const PILOT_MANUAL_GATES = [
  {
    key: "manual_identity",
    label: "Identity provider validation",
    detail:
      "Validate the upstream provider/gateway claim mapping, MFA signal, signing-secret handling and incident revocation procedure."
  },
  {
    key: "manual_migrations",
    label: "Reviewed database migrations",
    detail:
      "Apply reviewed Prisma migrations; do not launch production from db:push."
  },
  {
    key: "manual_edge",
    label: "TLS / WAF / hard body limits",
    detail:
      "Confirm TLS termination, trusted forwarding, WAF throttling and edge body-size enforcement."
  },
  {
    key: "manual_backups",
    label: "Backup / restore exercise",
    detail:
      "Confirm encrypted backups and complete a tested restore exercise."
  },
  {
    key: "manual_monitoring",
    label: "Monitoring / incident response",
    detail:
      "Validate scheduler cadence, signed alert delivery, escalation ownership and incident runbooks."
  },
  {
    key: "manual_payments",
    label: "Payment provider operational validation",
    detail:
      "Validate live provider credentials, webhook registration, payout-account ownership, failure escalation, reversal semantics and accounting reconciliation against the RAM ledger."
  }
] as const;

export type PilotManualGateKey =
  (typeof PILOT_MANUAL_GATES)[number]["key"];

function truthy(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function strongSecret(value: string | undefined) {
  if (!value || value.length < 32) return false;
  return !/replace|changeme|example|development-only/i.test(value);
}

function postgresUrl(value: string | undefined) {
  return Boolean(value && /^postgres(ql)?:\/\//i.test(value));
}

export function evaluatePilotReadiness(
  env: Record<string, string | undefined>
): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [
    {
      id: "node_env",
      label: "Production runtime",
      status: env.NODE_ENV === "production" ? "PASS" : "BLOCK",
      detail:
        env.NODE_ENV === "production"
          ? "NODE_ENV is production."
          : "Pilot deployment must run with NODE_ENV=production."
    },
    {
      id: "postgres_backend",
      label: "PostgreSQL persistence",
      status:
        env.RAM_DATA_BACKEND === "postgres" && postgresUrl(env.DATABASE_URL)
          ? "PASS"
          : "BLOCK",
      detail:
        env.RAM_DATA_BACKEND === "postgres" && postgresUrl(env.DATABASE_URL)
          ? "RAM is configured for PostgreSQL persistence."
          : "Set RAM_DATA_BACKEND=postgres and a PostgreSQL DATABASE_URL."
    },
    {
      id: "auth_secret",
      label: "Production session secret",
      status: strongSecret(env.AUTH_SECRET) ? "PASS" : "BLOCK",
      detail: strongSecret(env.AUTH_SECRET)
        ? "AUTH_SECRET passes the pilot strength check."
        : "AUTH_SECRET must be at least 32 characters and not a placeholder."
    },
    {
      id: "demo_auth",
      label: "Demo authentication disabled",
      status: truthy(env.RAM_DEMO_AUTH_ENABLED) ? "BLOCK" : "PASS",
      detail: truthy(env.RAM_DEMO_AUTH_ENABLED)
        ? "Disable demo authentication before admitting real transactions."
        : "Demo authentication is disabled."
    },
    {
      id: "public_onboarding",
      label: "Unverified public onboarding disabled",
      status: truthy(env.RAM_PUBLIC_ONBOARDING_ENABLED) ? "BLOCK" : "PASS",
      detail: truthy(env.RAM_PUBLIC_ONBOARDING_ENABLED)
        ? "Public onboarding must remain disabled until identity/email verification is connected."
        : "Public onboarding is disabled."
    }
  ];

  const identitySecret = env.RAM_IDENTITY_ASSERTION_SECRET;
  checks.push({
    id: "identity_secret",
    label: "External identity assertion secret",
    status:
      strongSecret(identitySecret) && identitySecret !== env.AUTH_SECRET
        ? "PASS"
        : "BLOCK",
    detail:
      strongSecret(identitySecret) && identitySecret !== env.AUTH_SECRET
        ? "Identity assertions use a strong secret distinct from AUTH_SECRET."
        : "Configure RAM_IDENTITY_ASSERTION_SECRET with at least 32 non-placeholder characters and keep it distinct from AUTH_SECRET."
  });

  const providers = (env.RAM_IDENTITY_ALLOWED_PROVIDERS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  checks.push({
    id: "identity_providers",
    label: "Identity provider allowlist",
    status: providers.length > 0 ? "PASS" : "BLOCK",
    detail:
      providers.length > 0
        ? "At least one external identity provider is explicitly allowed."
        : "Configure RAM_IDENTITY_ALLOWED_PROVIDERS."
  });

  checks.push({
    id: "identity_login_url",
    label: "Identity login URL",
    status: /^https:\/\//i.test(env.RAM_IDENTITY_LOGIN_URL ?? "")
      ? "PASS"
      : "BLOCK",
    detail: /^https:\/\//i.test(env.RAM_IDENTITY_LOGIN_URL ?? "")
      ? "Identity login URL uses HTTPS."
      : "Configure RAM_IDENTITY_LOGIN_URL with an HTTPS URL."
  });

  checks.push({
    id: "identity_mfa",
    label: "Identity MFA policy",
    status: env.RAM_IDENTITY_REQUIRE_MFA === "false" ? "BLOCK" : "PASS",
    detail:
      env.RAM_IDENTITY_REQUIRE_MFA === "false"
        ? "Pilot identity assertions must require MFA."
        : "External identity assertions require MFA."
  });

  const paymentSecret = env.RAM_PAYMENT_GATEWAY_SECRET;
  const paymentUrl = env.RAM_PAYMENT_GATEWAY_URL ?? "";
  const paymentName = env.RAM_PAYMENT_GATEWAY_NAME?.trim() ?? "";
  const paymentSecretDistinct =
    strongSecret(paymentSecret) &&
    paymentSecret !== env.AUTH_SECRET &&
    paymentSecret !== env.RAM_IDENTITY_ASSERTION_SECRET;

  checks.push({
    id: "payment_secret",
    label: "Payment gateway signing secret",
    status: paymentSecretDistinct ? "PASS" : "BLOCK",
    detail: paymentSecretDistinct
      ? "Payment gateway uses a strong secret distinct from session and identity secrets."
      : "Configure RAM_PAYMENT_GATEWAY_SECRET with at least 32 non-placeholder characters and keep it distinct from AUTH_SECRET and RAM_IDENTITY_ASSERTION_SECRET."
  });

  checks.push({
    id: "payment_gateway_name",
    label: "Payment gateway identifier",
    status: paymentName ? "PASS" : "BLOCK",
    detail: paymentName
      ? "Payment gateway identifier is configured."
      : "Configure RAM_PAYMENT_GATEWAY_NAME."
  });

  checks.push({
    id: "payment_gateway_url",
    label: "Payment gateway HTTPS endpoint",
    status:
      /^https:\/\//i.test(paymentUrl) &&
      env.RAM_PAYMENT_GATEWAY_ALLOW_INSECURE_LOCAL !== "true"
        ? "PASS"
        : "BLOCK",
    detail:
      /^https:\/\//i.test(paymentUrl) &&
      env.RAM_PAYMENT_GATEWAY_ALLOW_INSECURE_LOCAL !== "true"
        ? "Payment gateway endpoint uses HTTPS and the local insecure override is disabled."
        : "Configure an HTTPS RAM_PAYMENT_GATEWAY_URL and disable RAM_PAYMENT_GATEWAY_ALLOW_INSECURE_LOCAL."
  });

  const monitoringEnabled = env.RAM_MONITORING_ENABLED === "true";
  checks.push({
    id: "monitoring_enabled",
    label: "Operational monitoring enabled",
    status: monitoringEnabled ? "PASS" : "BLOCK",
    detail: monitoringEnabled
      ? "Operational monitoring is enabled."
      : "Set RAM_MONITORING_ENABLED=true before pilot launch."
  });

  const monitoringRunToken = env.RAM_MONITORING_RUN_TOKEN;
  const monitoringRunTokenDistinct =
    strongMonitoringSecret(monitoringRunToken) &&
    monitoringRunToken !== env.AUTH_SECRET &&
    monitoringRunToken !== env.RAM_IDENTITY_ASSERTION_SECRET &&
    monitoringRunToken !== env.RAM_PAYMENT_GATEWAY_SECRET;

  checks.push({
    id: "monitoring_run_token",
    label: "Monitoring scheduler token",
    status: monitoringRunTokenDistinct ? "PASS" : "BLOCK",
    detail: monitoringRunTokenDistinct
      ? "Monitoring scheduler uses a strong independent bearer token."
      : "Configure a strong RAM_MONITORING_RUN_TOKEN distinct from session, identity and payment secrets."
  });

  const monitoringAlertSecret = env.RAM_MONITORING_ALERT_WEBHOOK_SECRET;
  const monitoringAlertSecretDistinct =
    strongMonitoringSecret(monitoringAlertSecret) &&
    monitoringAlertSecret !== env.AUTH_SECRET &&
    monitoringAlertSecret !== env.RAM_IDENTITY_ASSERTION_SECRET &&
    monitoringAlertSecret !== env.RAM_PAYMENT_GATEWAY_SECRET &&
    monitoringAlertSecret !== monitoringRunToken;

  checks.push({
    id: "monitoring_alert_secret",
    label: "Monitoring alert signing secret",
    status: monitoringAlertSecretDistinct ? "PASS" : "BLOCK",
    detail: monitoringAlertSecretDistinct
      ? "Monitoring alerts use a strong independent signing secret."
      : "Configure a strong RAM_MONITORING_ALERT_WEBHOOK_SECRET distinct from all other RAM secrets."
  });

  const monitoringAlertUrl = env.RAM_MONITORING_ALERT_WEBHOOK_URL ?? "";
  const monitoringAlertHttps =
    /^https:\/\//i.test(monitoringAlertUrl) &&
    env.RAM_MONITORING_ALLOW_INSECURE_LOCAL !== "true";

  checks.push({
    id: "monitoring_alert_url",
    label: "Monitoring alert HTTPS endpoint",
    status: monitoringAlertHttps ? "PASS" : "BLOCK",
    detail: monitoringAlertHttps
      ? "Monitoring alert receiver uses HTTPS and the CI loopback override is disabled."
      : "Configure an HTTPS RAM_MONITORING_ALERT_WEBHOOK_URL and disable RAM_MONITORING_ALLOW_INSECURE_LOCAL."
  });

  let monitoringThresholdsValid = true;
  try {
    monitoringConfig(env);
  } catch {
    monitoringThresholdsValid = false;
  }

  checks.push({
    id: "monitoring_thresholds",
    label: "Monitoring thresholds",
    status: monitoringThresholdsValid ? "PASS" : "BLOCK",
    detail: monitoringThresholdsValid
      ? "Monitoring thresholds are within reviewed positive bounds."
      : "One or more RAM_MONITORING_* threshold values are invalid."
  });

  const mutationBytes = Number(env.RAM_MAX_MUTATION_BYTES ?? "1048576");
  checks.push({
    id: "mutation_limit",
    label: "Mutation body limit",
    status:
      Number.isInteger(mutationBytes) &&
      mutationBytes >= 16_384 &&
      mutationBytes <= 10_485_760
        ? "PASS"
        : "BLOCK",
    detail:
      Number.isInteger(mutationBytes) &&
      mutationBytes >= 16_384 &&
      mutationBytes <= 10_485_760
        ? "Application mutation limit is within the reviewed range."
        : "RAM_MAX_MUTATION_BYTES must be between 16384 and 10485760."
  });

  for (const gate of PILOT_MANUAL_GATES) {
    checks.push({
      id: gate.key,
      label: gate.label,
      status: "MANUAL",
      detail: gate.detail
    });
  }

  return checks;
}

export function readinessSummary(checks: readonly ReadinessCheck[]) {
  const blockers = checks.filter((check) => check.status === "BLOCK");
  const manual = checks.filter((check) => check.status === "MANUAL");
  return {
    automaticReady: blockers.length === 0,
    blockers: blockers.length,
    manualGates: manual.length
  };
}
