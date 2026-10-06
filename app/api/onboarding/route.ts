import { NextRequest, NextResponse } from "next/server";
import { attachSession, publicOnboardingEnabled } from "@/lib/auth/session";
import {
  landingPageForRole,
  onboardingSchema
} from "@/lib/onboarding";
import { createOnboardingAccount } from "@/lib/server/onboarding";

function blankToUndefined(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export async function POST(request: NextRequest) {
  if (!publicOnboardingEnabled()) {
    return NextResponse.json(
      { error: "Public onboarding is disabled on this deployment" },
      { status: 403 }
    );
  }

  const form = await request.formData();
  const parsed = onboardingSchema.safeParse({
    name: form.get("name"),
    email: form.get("email"),
    organizationName: form.get("organizationName"),
    organizationType: form.get("organizationType"),
    regionLabel: blankToUndefined(form.get("regionLabel")),
    countyLabel: blankToUndefined(form.get("countyLabel")),
    farmSiteLabel: blankToUndefined(form.get("farmSiteLabel")),
    exactAddress: blankToUndefined(form.get("exactAddress"))
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid onboarding request", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const principal = await createOnboardingAccount(parsed.data);
  const response = NextResponse.redirect(
    new URL(landingPageForRole(principal.role), request.url),
    303
  );
  return attachSession(response, principal);
}
