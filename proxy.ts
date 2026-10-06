import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth/token";
import {
  assertMutationBodySize,
  assertSameOriginMutation,
  mutationBodyLimitBytes
} from "@/lib/security/request-policy";

const COOKIE = "ram_session";
const MAX_MUTATION_BYTES = mutationBodyLimitBytes(
  process.env.RAM_MAX_MUTATION_BYTES
);

const PROTECTED_PREFIXES = [
  "/account",
  "/farm",
  "/research",
  "/orders",
  "/disclosures",
  "/vet",
  "/ops",
  "/finance",
  "/compliance",
  "/transport",
  "/receiving"
] as const;

function secret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV !== "production") return "ram-local-development-only-secret";
  return "";
}

function protectedPage(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

function requestMetadata(request: NextRequest) {
  return {
    method: request.method,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    host: request.headers.get("host"),
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto:
      request.headers.get("x-forwarded-proto") ||
      request.nextUrl.protocol.replace(":", ""),
    secFetchSite: request.headers.get("sec-fetch-site"),
    contentLength: request.headers.get("content-length")
  };
}

function secured(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-RAM-Request-ID", crypto.randomUUID());
  return response;
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    try {
      const metadata = requestMetadata(request);
      // The external identity callback is authenticated by a short-lived,
      // HMAC-signed, one-time assertion rather than by an existing RAM cookie.
      // It may legitimately be POSTed from an upstream identity gateway.
      if (
        request.nextUrl.pathname !== "/api/session/external" &&
        request.nextUrl.pathname !== "/api/payments/webhook" &&
        request.nextUrl.pathname !== "/api/monitoring/run"
      ) {
        assertSameOriginMutation(metadata, {
          production: process.env.NODE_ENV === "production"
        });
      }
      assertMutationBodySize(metadata, MAX_MUTATION_BYTES);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Request security check failed";
      const status = /body exceeds|Content-Length/.test(message) ? 413 : 403;
      return secured(NextResponse.json({ error: message }, { status }));
    }

    // API handlers perform their own session/RBAC checks close to the data action.
    return secured(NextResponse.next());
  }

  if (!protectedPage(request.nextUrl.pathname)) {
    return secured(NextResponse.next());
  }

  const session = verifySessionToken(
    request.cookies.get(COOKIE)?.value,
    secret()
  );
  if (session) return secured(NextResponse.next());

  const signIn = new URL("/signin", request.url);
  signIn.searchParams.set("next", request.nextUrl.pathname);
  return secured(NextResponse.redirect(signIn));
}

export const config = {
  matcher: [
    "/api/:path*",
    "/account/:path*",
    "/farm/:path*",
    "/research/:path*",
    "/orders/:path*",
    "/disclosures/:path*",
    "/vet/:path*",
    "/ops/:path*",
    "/finance/:path*",
    "/compliance/:path*",
    "/transport/:path*",
    "/receiving/:path*"
  ]
};
