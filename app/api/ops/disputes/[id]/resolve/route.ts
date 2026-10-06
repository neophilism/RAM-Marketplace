import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { resolveOrderDispute } from "@/lib/server/disputes";
import { disputeResolutionSchema } from "@/lib/validation";

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
    const parsed = disputeResolutionSchema.safeParse({
      disputeId: id,
      resolutionType: form.get("resolutionType"),
      resolutionNotes: optional(form.get("resolutionNotes")),
      operatorAttestation: form.get("operatorAttestation") === "on"
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid dispute resolution", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await resolveOrderDispute(session, parsed.data);
    return NextResponse.redirect(new URL("/ops/disputes/" + id, request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve dispute";
    const status = /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
