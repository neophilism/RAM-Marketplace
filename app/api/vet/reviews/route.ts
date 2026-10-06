import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { submitVeterinaryReview } from "@/lib/server/clinical";
import { veterinaryReviewSchema } from "@/lib/validation";

function blankToUndefined(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const session = requireRequestSession(request);
    const form = await request.formData();
    const parsed = veterinaryReviewSchema.safeParse({
      animalCaseId: form.get("animalCaseId"),
      outcome: form.get("outcome"),
      diagnosis: blankToUndefined(form.get("diagnosis")),
      diseaseStage: blankToUndefined(form.get("diseaseStage")),
      etiology: blankToUndefined(form.get("etiology")),
      diagnosticConfidence: blankToUndefined(form.get("diagnosticConfidence")),
      phenotype: blankToUndefined(form.get("phenotype")),
      comorbidities: blankToUndefined(form.get("comorbidities")),
      diagnosticEvidence: blankToUndefined(form.get("diagnosticEvidence")),
      publicSummary: blankToUndefined(form.get("publicSummary")),
      welfareNotes: blankToUndefined(form.get("welfareNotes")),
      diagnosticPlan: blankToUndefined(form.get("diagnosticPlan")),
      transportReady: form.get("transportReady") === "on",
      reviewerAttestation: form.get("reviewerAttestation") === "on"
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid veterinary review", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await submitVeterinaryReview(session, parsed.data);
    return NextResponse.redirect(new URL("/vet", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit veterinary review";
    const status = /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
