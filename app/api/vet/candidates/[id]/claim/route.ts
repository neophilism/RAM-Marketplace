import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { claimVeterinaryCandidate } from "@/lib/server/clinical";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = requireRequestSession(request);
    const { id } = await params;
    await claimVeterinaryCandidate(session, id);
    return NextResponse.redirect(new URL("/vet/" + id, request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to claim veterinary review";
    const status = /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
