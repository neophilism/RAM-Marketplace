import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  return clearSession(response);
}
