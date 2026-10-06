export type ReadinessStatus = "PASS" | "BLOCK" | "MANUAL";

export interface ReadinessCheck {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
}

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

  const manual = [
    ["identity", "Identity proofing / MFA", "Connect and validate the selected production identity provider and MFA/SSO policy."],
    ["migrations", "Reviewed database migrations", "Apply reviewed Prisma migrations; do not launch production from db:push."],
    ["edge", "TLS / WAF / hard body limits", "Confirm TLS termination, trusted forwarding, WAF throttling and edge body-size enforcement."],
    ["backups", "Backup / restore exercise", "Confirm encrypted backups and complete a tested restore exercise."],
    ["monitoring", "Monitoring / incident response", "Confirm centralized logs, alerting, escalation ownership and incident runbooks."],
    ["payments", "Payment execution controls", "Confirm the approved process or provider for executing buyer payments, refunds and payouts around the RAM ledger."]
  ] as const;

  for (const [id, label, detail] of manual) {
    checks.push({
      id: "manual_" + id,
      label,
      status: "MANUAL",
      detail
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
