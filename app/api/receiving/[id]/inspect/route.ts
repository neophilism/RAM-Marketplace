import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { recordReceivingInspection } from "@/lib/server/receiving";
import { receivingInspectionSchema } from "@/lib/validation";

function checked(form: FormData, key: string) {
  return form.get(key) === "on";
}

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
    const parsed = receivingInspectionSchema.safeParse({
      orderId: id,
      decision: form.get("decision"),
      animalIdentityConfirmed: checked(form, "animalIdentityConfirmed"),
      movementDocumentsReceived: checked(form, "movementDocumentsReceived"),
      physicalConditionConsistent: checked(form, "physicalConditionConsistent"),
      welfareIntakeAcceptable: checked(form, "welfareIntakeAcceptable"),
      discrepancyNotes: optional(form.get("discrepancyNotes")),
      notes: optional(form.get("notes")),
      inspectorAttestation: checked(form, "inspectorAttestation")
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid receiving inspection", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await recordReceivingInspection(session, parsed.data);
    return NextResponse.redirect(new URL("/receiving/" + id, request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record receiving inspection";
    const status = /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
