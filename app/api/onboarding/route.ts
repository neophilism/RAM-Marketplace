import { NextRequest, NextResponse } from "next/server";
import {
  attachSession,
  clearEnrollmentIdentity,
  publicOnboardingEnabled,
  readEnrollmentIdentityFromRequest
} from "@/lib/auth/session";
import { onboardingSchema } from "@/lib/onboarding";
import { createOnboardingAccount } from "@/lib/server/onboarding";
import {
  enforceRequestRateLimit,
  RateLimitExceededError
} from "@/lib/server/rate-limit";

function blankToUndefined(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export async function POST(request: NextRequest) {
  const verifiedIdentity = readEnrollmentIdentityFromRequest(request);

  if (!verifiedIdentity && !publicOnboardingEnabled()) {
    return NextResponse.json(
      { error: "Verified identity is required before organization onboarding" },
      { status: 403 }
    );
  }

  try {
    await enforceRequestRateLimit(request, {
      action: "public_onboarding",
      limit: 5,
      windowSeconds: 3600
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) }
        }
      );
    }
    throw error;
  }

  const form = await request.formData();
  const parsed = onboardingSchema.safeParse({
    name: verifiedIdentity?.name ?? form.get("name"),
    email: verifiedIdentity?.email ?? form.get("email"),
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

  const principal = await createOnboardingAccount(
    parsed.data,
    verifiedIdentity ?? undefined
  );
  const response = NextResponse.redirect(
    new URL("/account?onboarded=1", request.url),
    303
  );
  clearEnrollmentIdentity(response);
  return attachSession(response, principal);
}
