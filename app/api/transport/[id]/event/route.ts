import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { recordTransportEvent } from "@/lib/server/logistics";
import { transportEventSchema } from "@/lib/validation";

function optional(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRequestSession(request);
    const { id } = await params;
    const form = await request.formData();
    const parsed = transportEventSchema.safeParse({
      assignmentId: id,
      eventType: form.get("eventType"),
      notes: optional(form.get("notes")),
      sanitationConfirmed: form.get("sanitationConfirmed") === "on" ? true : undefined,
      custodyAttestation: form.get("custodyAttestation") === "on" ? true : undefined
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid transport event", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await recordTransportEvent(session, parsed.data);
    return NextResponse.redirect(new URL("/transport/" + id, request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record transport event";
    const status = /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
