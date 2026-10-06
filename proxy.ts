import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth/token";

const COOKIE = "ram_session";

function secret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV !== "production") return "ram-local-development-only-secret";
  return "";
}

export function proxy(request: NextRequest) {
  const session = verifySessionToken(request.cookies.get(COOKIE)?.value, secret());
  if (session) return NextResponse.next();

  const signIn = new URL("/signin", request.url);
  signIn.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: [
    "/account/:path*",
    "/farm/:path*",
    "/research/:path*",
    "/orders/:path*",
    "/disclosures/:path*",
    "/vet/:path*",
    "/ops/:path*",
    "/finance/:path*",
    "/compliance/:path*"
  ]
};
