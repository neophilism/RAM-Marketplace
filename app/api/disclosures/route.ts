import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { createDisclosureRequest } from "@/lib/server/disclosures";
import { disclosureRequestSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const session = requireRequestSession(request);
    const form = await request.formData();
    const parsed = disclosureRequestSchema.safeParse({
      animalCaseId: form.get("animalCaseId"),
      researchNeedId: form.get("researchNeedId"),
      requestedFields: form.getAll("requestedFields").map(String),
      scientificReason: form.get("scientificReason")
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid disclosure request", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const disclosure = await createDisclosureRequest(session, parsed.data);
    return NextResponse.redirect(
      new URL("/disclosures/" + disclosure.id, request.url),
      303
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create disclosure request";
    const status = /Authentication/.test(message)
      ? 401
      : /Forbidden/.test(message)
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
