import "server-only";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  verifySessionToken,
  type SessionPrincipal
} from "@/lib/auth/token";
import {
  createEnrollmentToken,
  verifyEnrollmentToken,
  type EnrollmentIdentity
} from "@/lib/auth/enrollment-token";
import {
  getAccountAccessContext,
  requireOperationalPrincipal
} from "@/lib/server/identity";

export const SESSION_COOKIE = "ram_session";
export const ENROLLMENT_COOKIE = "ram_identity_enrollment";

export function getSessionSecret() {
  const configured = process.env.AUTH_SECRET;
  if (configured) return configured;

  if (process.env.NODE_ENV !== "production") {
    return "ram-local-development-only-secret";
  }

  throw new Error("AUTH_SECRET is required in production");
}

export function demoAuthEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.RAM_DEMO_AUTH_ENABLED === "true"
  );
}

export function publicOnboardingEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.RAM_PUBLIC_ONBOARDING_ENABLED === "true"
  );
}

export async function readSession(): Promise<SessionPrincipal | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value, getSessionSecret());
}

export function readSessionFromRequest(request: NextRequest) {
  return verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
    getSessionSecret()
  );
}

export async function requireSession() {
  const session = await readSession();
  if (!session) throw new Error("Authentication required");
  return requireOperationalPrincipal(session);
}

export async function requireAccountSession() {
  const session = await readSession();
  if (!session) throw new Error("Authentication required");
  const access = await getAccountAccessContext(session);
  return {
    session: {
      ...access.principal,
      exp: session.exp
    },
    access
  };
}

export async function requireRequestSession(request: NextRequest) {
  const session = readSessionFromRequest(request);
  if (!session) throw new Error("Authentication required");
  return requireOperationalPrincipal(session);
}

export async function readEnrollmentIdentity() {
  const jar = await cookies();
  return verifyEnrollmentToken(
    jar.get(ENROLLMENT_COOKIE)?.value,
    getSessionSecret()
  );
}

export function readEnrollmentIdentityFromRequest(request: NextRequest) {
  return verifyEnrollmentToken(
    request.cookies.get(ENROLLMENT_COOKIE)?.value,
    getSessionSecret()
  );
}

export function attachSession(
  response: NextResponse,
  principal: Omit<SessionPrincipal, "exp">
) {
  response.cookies.set(
    SESSION_COOKIE,
    createSessionToken(principal, getSessionSecret()),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 12
    }
  );
  return response;
}

export function attachEnrollmentIdentity(
  response: NextResponse,
  identity: Omit<EnrollmentIdentity, "exp">
) {
  response.cookies.set(
    ENROLLMENT_COOKIE,
    createEnrollmentToken(identity, getSessionSecret()),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 20 * 60
    }
  );
  return response;
}

export function clearEnrollmentIdentity(response: NextResponse) {
  response.cookies.set(ENROLLMENT_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0
  });
  return response;
}

export function clearSession(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0
  });
  return response;
}
