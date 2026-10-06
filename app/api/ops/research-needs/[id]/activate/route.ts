import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { activateResearchNeed } from "@/lib/server/clinical";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = requireRequestSession(request);
    const { id } = await params;
    await activateResearchNeed(session, id);
    return NextResponse.redirect(new URL("/ops", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to activate research need";
    const status = /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
