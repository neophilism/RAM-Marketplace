import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { reviewOrderClearance } from "@/lib/server/transactions";
import { clearanceReviewSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRequestSession(request);
    const { id } = await params;
    const form = await request.formData();
    const parsed = clearanceReviewSchema.safeParse({
      orderId: id,
      decision: form.get("decision"),
      protocolConfirmed: form.get("protocolConfirmed") === "on",
      receivingFacilityConfirmed: form.get("receivingFacilityConfirmed") === "on",
      welfareConfirmed: form.get("welfareConfirmed") === "on",
      biosecurityConfirmed: form.get("biosecurityConfirmed") === "on",
      movementRequirementsConfirmed: form.get("movementRequirementsConfirmed") === "on",
      transportPlanConfirmed: form.get("transportPlanConfirmed") === "on",
      sourceProvenanceConfirmed: form.get("sourceProvenanceConfirmed") === "on",
      blockingFindings: typeof form.get("blockingFindings") === "string"
        ? form.get("blockingFindings")
        : undefined,
      notes: typeof form.get("notes") === "string" ? form.get("notes") : undefined
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid clearance review", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await reviewOrderClearance(session, parsed.data);
    return NextResponse.redirect(new URL("/compliance", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to review clearance";
    const status = /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
