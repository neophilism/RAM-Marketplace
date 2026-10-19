import { allowedIdentityProviders } from "@/lib/auth/external-assertion";

export interface IdentityBoundaryConfig {
  enabled: boolean;
  allowedProviders: string[];
  requireMfa: boolean;
  loginUrl?: string;
}

function trustedLoginUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw.trim());
    const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    if ((url.protocol !== "https:" && !(loopback && url.protocol === "http:")) ||
        url.username || url.password || url.hash) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function identityBoundaryConfig(
  env: Record<string, string | undefined> = process.env
): IdentityBoundaryConfig {
  const allowedProviders = allowedIdentityProviders(
    env.RAM_IDENTITY_ALLOWED_PROVIDERS
  );
  const loginUrl = trustedLoginUrl(env.RAM_IDENTITY_LOGIN_URL);

  return {
    enabled:
      allowedProviders.length > 0 &&
      (env.RAM_IDENTITY_ASSERTION_SECRET?.trim().length ?? 0) >= 32 &&
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
