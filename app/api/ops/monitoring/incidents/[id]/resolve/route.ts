import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { resolveIncident } from "@/lib/server/monitoring";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRequestSession(request);
    const { id } = await params;
    const form = await request.formData();
    await resolveIncident(
      session,
      id,
      String(form.get("resolutionNotes") ?? "")
    );
    return NextResponse.redirect(
      new URL("/ops/monitoring?updated=resolved", request.url),
      303
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to resolve incident";
    const status = /Authentication/.test(message)
      ? 401
      : /Forbidden/.test(message)
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
