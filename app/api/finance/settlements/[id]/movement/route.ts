import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { recordFinancialMovement } from "@/lib/server/settlements";
import { financialMovementSchema } from "@/lib/validation";

function optional(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = requireRequestSession(request);
    const { id } = await params;
    const form = await request.formData();
    const parsed = financialMovementSchema.safeParse({
      settlementId: id,
      movementType: form.get("movementType"),
      amountUsd: form.get("amountUsd"),
      externalReference: form.get("externalReference"),
      notes: optional(form.get("notes"))
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid financial movement", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await recordFinancialMovement(session, parsed.data);
    return NextResponse.redirect(new URL("/finance/settlements/" + id, request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record financial movement";
    const status = /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
