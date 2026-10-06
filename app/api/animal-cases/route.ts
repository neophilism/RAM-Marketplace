import { NextRequest, NextResponse } from "next/server";
import { savePrototypeAnimal } from "@/lib/server/prototype-store";
import { animalSubmissionSchema } from "@/lib/validation";

function blankToUndefined(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export async function POST(request: NextRequest) {
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

  const record = savePrototypeAnimal(parsed.data);
  const response = NextResponse.redirect(new URL("/farm?submitted=1", request.url), 303);
  response.headers.set("X-RAM-Prototype-Record", record.id);
  return response;
}
