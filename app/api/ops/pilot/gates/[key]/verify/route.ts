import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { verifyPilotGateSchema } from "@/lib/pilot-gates";
import { verifyPilotGate } from "@/lib/server/pilot-gates";

function optional(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const session = await requireRequestSession(request);
    const { key } = await params;
    const form = await request.formData();

    const parsed = verifyPilotGateSchema.safeParse({
      gateKey: key,
      ownerUserId: form.get("ownerUserId"),
      evidenceSummary: form.get("evidenceSummary"),
      reviewDueAt: optional(form.get("reviewDueAt")),
      notes: optional(form.get("notes"))
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid pilot gate verification", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await verifyPilotGate(session, parsed.data);
    return NextResponse.redirect(
      new URL("/ops/pilot?updated=verified", request.url),
      303
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to verify pilot gate";
    const status = /Authentication/.test(message)
      ? 401
      : /Forbidden/.test(message)
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
