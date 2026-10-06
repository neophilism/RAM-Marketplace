import { allowedIdentityProviders } from "@/lib/auth/external-assertion";

export interface IdentityBoundaryConfig {
  enabled: boolean;
  allowedProviders: string[];
  requireMfa: boolean;
  loginUrl?: string;
}

export function identityBoundaryConfig(
  env: Record<string, string | undefined> = process.env
): IdentityBoundaryConfig {
  const allowedProviders = allowedIdentityProviders(
    env.RAM_IDENTITY_ALLOWED_PROVIDERS
  );
  const loginUrl = env.RAM_IDENTITY_LOGIN_URL?.trim();

  return {
    enabled:
      allowedProviders.length > 0 &&
      Boolean(env.RAM_IDENTITY_ASSERTION_SECRET?.trim()) &&
      Boolean(loginUrl),
    allowedProviders,
    requireMfa: env.RAM_IDENTITY_REQUIRE_MFA !== "false",
    loginUrl: loginUrl || undefined
  };
}

export function getIdentityAssertionSecret(
  env: Record<string, string | undefined> = process.env
) {
  const secret = env.RAM_IDENTITY_ASSERTION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "RAM_IDENTITY_ASSERTION_SECRET must be configured with at least 32 characters"
    );
  }
  return secret;
}
