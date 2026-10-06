import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { closeFinancialSettlement } from "@/lib/server/settlements";
import { settlementCloseSchema } from "@/lib/validation";

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
    const parsed = settlementCloseSchema.safeParse({
      settlementId: id,
      reconciliationReference: form.get("reconciliationReference"),
      reconciliationNotes: optional(form.get("reconciliationNotes")),
      reconciliationAttestation: form.get("reconciliationAttestation") === "on"
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid reconciliation", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await closeFinancialSettlement(session, parsed.data);
    return NextResponse.redirect(new URL("/finance/settlements/" + id, request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to close settlement";
    const status = /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
