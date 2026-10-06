import { NextRequest, NextResponse } from "next/server";
import { savePrototypeResearchNeed } from "@/lib/server/prototype-store";
import { researchNeedSchema } from "@/lib/validation";

function blankToUndefined(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const parsed = researchNeedSchema.safeParse({
    title: form.get("title"),
    condition: form.get("condition"),
    species: blankToUndefined(form.get("species")),
    minAgeMonths: blankToUndefined(form.get("minAgeMonths")),
    maxAgeMonths: blankToUndefined(form.get("maxAgeMonths")),
    sex: form.get("sex"),
    diseaseStage: blankToUndefined(form.get("diseaseStage")),
    requiredPhenotype: form.get("requiredPhenotype"),
    exclusionCriteria: blankToUndefined(form.get("exclusionCriteria")),
    acceptableComorbidities: blankToUndefined(form.get("acceptableComorbidities")),
    requiredDiagnostics: blankToUndefined(form.get("requiredDiagnostics")),
    procedures: blankToUndefined(form.get("procedures")),
    quantity: form.get("quantity"),
    timeline: form.get("timeline"),
    budgetUsd: blankToUndefined(form.get("budgetUsd")),
    protocolStatus: form.get("protocolStatus"),
    scientificRationale: form.get("scientificRationale")
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid research need", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const record = savePrototypeResearchNeed(parsed.data);
  const response = NextResponse.redirect(new URL("/research?submitted=1", request.url), 303);
  response.headers.set("X-RAM-Prototype-Record", record.id);
  return response;
}
