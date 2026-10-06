import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { reviewDisclosureByRam } from "@/lib/server/disclosures";
import { disclosureRamReviewSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRequestSession(request);
    const { id } = await params;
    const form = await request.formData();
    const denialReason = form.get("denialReason");
    const parsed = disclosureRamReviewSchema.safeParse({
      requestId: id,
      decision: form.get("decision"),
      denialReason:
        typeof denialReason === "string" && denialReason.trim()
          ? denialReason
          : undefined
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid RAM disclosure review", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await reviewDisclosureByRam(session, parsed.data);
    return NextResponse.redirect(new URL("/compliance/disclosures", request.url), 303);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to review disclosure request";
    const status = /Authentication/.test(message)
      ? 401
      : /Forbidden/.test(message)
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
