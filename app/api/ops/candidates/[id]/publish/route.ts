import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { publishCandidate } from "@/lib/server/clinical";
import { candidatePublishSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRequestSession(request);
    const { id } = await params;
    const form = await request.formData();
    const parsed = candidatePublishSchema.safeParse({
      animalCaseId: id,
      listPriceUsd: form.get("listPriceUsd"),
      availabilityText: form.get("availabilityText"),
      sourceDisclosure: form.get("sourceDisclosure"),
      publishAttestation: form.get("publishAttestation") === "on"
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid publication request", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await publishCandidate(session, parsed.data);
    return NextResponse.redirect(new URL("/ops", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to publish candidate";
    const status = /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
