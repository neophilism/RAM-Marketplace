import { createHmac, timingSafeEqual } from "node:crypto";

export interface ExternalIdentityAssertionPayload {
  v: 1;
  aud: "ram-marketplace";
  provider: string;
  subject: string;
  email: string;
  name: string;
  emailVerified: boolean;
  mfa: boolean;
  acr?: string;
  amr?: string[];
  jti: string;
  iat: number;
  exp: number;
}

export interface ExternalAssertionPolicy {
  allowedProviders: readonly string[];
  requireMfa: boolean;
  nowMs?: number;
  maxLifetimeSeconds?: number;
}

function encode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function sign(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret)
    .update("ram-external-identity.")
    .update(encodedPayload)
    .digest("base64url");
}

function assertSecret(secret: string) {
  if (secret.length < 32) {
    throw new Error("RAM_IDENTITY_ASSERTION_SECRET must be at least 32 characters");
  }
}

export function createExternalIdentityAssertion(
  payload: ExternalIdentityAssertionPayload,
  secret: string
) {
  assertSecret(secret);
  const encoded = encode(JSON.stringify(payload));
  return encoded + "." + sign(encoded, secret);
}

export function verifyExternalIdentityAssertion(
  token: string,
  secret: string,
  policy: ExternalAssertionPolicy
): ExternalIdentityAssertionPayload {
  assertSecret(secret);

  const [encoded, suppliedSignature, extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra) {
    throw new Error("Invalid external identity assertion format");
  }

  const expected = sign(encoded, secret);
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(suppliedSignature);
  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    throw new Error("Invalid external identity assertion signature");
  }

  let payload: Partial<ExternalIdentityAssertionPayload>;
  try {
    payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as Partial<ExternalIdentityAssertionPayload>;
  } catch {
    throw new Error("Invalid external identity assertion payload");
  }

  if (
    payload.v !== 1 ||
    payload.aud !== "ram-marketplace" ||
    typeof payload.provider !== "string" ||
    !payload.provider.trim() ||
    typeof payload.subject !== "string" ||
    !payload.subject.trim() ||
    typeof payload.email !== "string" ||
    !payload.email.includes("@") ||
    typeof payload.name !== "string" ||
    !payload.name.trim() ||
    payload.emailVerified !== true ||
    typeof payload.mfa !== "boolean" ||
    typeof payload.jti !== "string" ||
    payload.jti.length < 12 ||
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number"
  ) {
    throw new Error("External identity assertion is missing required verified claims");
  }

  if (!policy.allowedProviders.includes(payload.provider)) {
    throw new Error("External identity provider is not allowed");
  }

  if (policy.requireMfa && payload.mfa !== true) {
    throw new Error("External identity assertion does not satisfy MFA policy");
  }

  const nowSeconds = Math.floor((policy.nowMs ?? Date.now()) / 1000);
  const maxLifetime = policy.maxLifetimeSeconds ?? 300;

  if (payload.iat > nowSeconds + 60) {
    throw new Error("External identity assertion was issued in the future");
  }
  if (payload.exp <= nowSeconds) {
    throw new Error("External identity assertion has expired");
  }
  if (payload.exp <= payload.iat || payload.exp - payload.iat > maxLifetime) {
    throw new Error("External identity assertion lifetime exceeds policy");
  }

  return {
    v: 1,
    aud: "ram-marketplace",
    provider: payload.provider.trim(),
    subject: payload.subject.trim(),
    email: payload.email.trim().toLowerCase(),
    name: payload.name.trim(),
    emailVerified: true,
    mfa: payload.mfa,
    acr: typeof payload.acr === "string" ? payload.acr : undefined,
    amr: Array.isArray(payload.amr)
      ? payload.amr.filter((item): item is string => typeof item === "string")
      : undefined,
    jti: payload.jti,
    iat: payload.iat,
    exp: payload.exp
  };
}

export function allowedIdentityProviders(raw: string | undefined) {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
