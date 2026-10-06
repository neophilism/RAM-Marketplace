import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { createAnimalCandidate } from "@/lib/server/repositories";
import { animalSubmissionSchema } from "@/lib/validation";

function blankToUndefined(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const session = requireRequestSession(request);
    const form = await request.formData();
    const parsed = animalSubmissionSchema.safeParse({
      species: form.get("species"),
      breed: blankToUndefined(form.get("breed")),
      sex: form.get("sex"),
      ageMonths: blankToUndefined(form.get("ageMonths")),
      weightKg: blankToUndefined(form.get("weightKg")),
      condition: form.get("condition"),
      diseaseStage: blankToUndefined(form.get("diseaseStage")),
      observedSigns: form.get("observedSigns"),
      firstObservedDate: blankToUndefined(form.get("firstObservedDate")),
      existingDiagnosis: blankToUndefined(form.get("existingDiagnosis")),
      currentTreatment: blankToUndefined(form.get("currentTreatment")),
      cullDecisionDate: form.get("cullDecisionDate"),
      plannedCullAt: form.get("plannedCullAt"),
      cullReason: form.get("cullReason"),
      welfareUrgency: form.get("welfareUrgency"),
      independentCullAttestation: form.get("independentCullAttestation") === "on",
      ownerAttestation: form.get("ownerAttestation") === "on"
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid animal submission", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const record = await createAnimalCandidate(session, parsed.data);
    const response = NextResponse.redirect(new URL("/farm?submitted=1", request.url), 303);
    response.headers.set("X-RAM-Record", record.id);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit candidate";
    const status = /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
