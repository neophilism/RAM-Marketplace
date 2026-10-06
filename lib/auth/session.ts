import "server-only";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  verifySessionToken,
  type SessionPrincipal
} from "@/lib/auth/token";

export const SESSION_COOKIE = "ram_session";

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
  return session;
}

export function requireRequestSession(request: NextRequest) {
  const session = readSessionFromRequest(request);
  if (!session) throw new Error("Authentication required");
  return session;
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
