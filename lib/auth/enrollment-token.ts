import { createHmac, timingSafeEqual } from "node:crypto";

export interface EnrollmentIdentity {
  userId: string;
  email: string;
  name: string;
  provider: string;
  subject: string;
  exp: number;
}

interface EnrollmentPayload extends EnrollmentIdentity {
  v: 1;
  purpose: "ram-organization-enrollment";
}

function encode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function signature(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret)
    .update("ram-enrollment.")
    .update(encodedPayload)
    .digest("base64url");
}

export function createEnrollmentToken(
  identity: Omit<EnrollmentIdentity, "exp">,
  secret: string,
  ttlSeconds = 20 * 60,
  nowMs = Date.now()
) {
  if (secret.length < 24) throw new Error("AUTH_SECRET must be at least 24 characters");
  const payload: EnrollmentPayload = {
    v: 1,
    purpose: "ram-organization-enrollment",
    ...identity,
    exp: Math.floor(nowMs / 1000) + ttlSeconds
  };
  const encoded = encode(JSON.stringify(payload));
  return encoded + "." + signature(encoded, secret);
}

export function verifyEnrollmentToken(
  token: string | undefined,
  secret: string,
  nowMs = Date.now()
): EnrollmentIdentity | null {
  if (!token || secret.length < 24) return null;

  const [encoded, suppliedSignature, extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra) return null;

  const expected = signature(encoded, secret);
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(suppliedSignature);
  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as Partial<EnrollmentPayload>;

    if (
      payload.v !== 1 ||
      payload.purpose !== "ram-organization-enrollment" ||
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.provider !== "string" ||
      typeof payload.subject !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp <= Math.floor(nowMs / 1000)
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      provider: payload.provider,
      subject: payload.subject,
      exp: payload.exp
    };
  } catch {
    return null;
  }
}
