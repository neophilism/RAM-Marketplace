import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { createResearchNeed } from "@/lib/server/repositories";
import { researchNeedSchema } from "@/lib/validation";

function blankToUndefined(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRequestSession(request);
    const form = await request.formData();
    const parsed = researchNeedSchema.safeParse({
      title: form.get("title"),
      condition: form.get("condition"),
      species: blankToUndefined(form.get("species")),
      minAgeMonths: blankToUndefined(form.get("minAgeMonths")),
      maxAgeMonths: blankToUndefined(form.get("maxAgeMonths")),
      sex: form.get("sex"),
      diseaseStage: blankToUndefined(form.get("diseaseStage")),
      etiologyRequirement: blankToUndefined(form.get("etiologyRequirement")),
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

    const record = await createResearchNeed(session, parsed.data);
    const response = NextResponse.redirect(new URL("/research?submitted=1", request.url), 303);
    response.headers.set("X-RAM-Record", record.id);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit research need";
    const status = /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
