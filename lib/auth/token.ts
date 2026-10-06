import { createHmac, timingSafeEqual } from "node:crypto";
import { ROLES, type Role } from "@/lib/rbac";

export interface SessionPrincipal {
  userId: string;
  organizationId: string;
  role: Role;
  email: string;
  name: string;
  exp: number;
}

interface SessionPayload extends SessionPrincipal {
  v: 1;
}

function encode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(
  principal: Omit<SessionPrincipal, "exp">,
  secret: string,
  ttlSeconds = 60 * 60 * 12,
  nowMs = Date.now()
) {
  if (secret.length < 24) throw new Error("AUTH_SECRET must be at least 24 characters");

  const payload: SessionPayload = {
    v: 1,
    ...principal,
    exp: Math.floor(nowMs / 1000) + ttlSeconds
  };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  nowMs = Date.now()
): SessionPrincipal | null {
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
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (
      payload.v !== 1 ||
      typeof payload.userId !== "string" ||
      typeof payload.organizationId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.role !== "string" ||
      !ROLES.includes(payload.role as Role) ||
      typeof payload.exp !== "number" ||
      payload.exp <= Math.floor(nowMs / 1000)
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      organizationId: payload.organizationId,
      role: payload.role as Role,
      email: payload.email,
      name: payload.name,
      exp: payload.exp
    };
  } catch {
    return null;
  }
}
