import { NextRequest, NextResponse } from "next/server";
import {
  attachEnrollmentIdentity,
  attachSession,
  clearEnrollmentIdentity
} from "@/lib/auth/session";
import {
  getIdentityAssertionSecret,
  identityBoundaryConfig
} from "@/lib/auth/identity-config";
import { verifyExternalIdentityAssertion } from "@/lib/auth/external-assertion";
import { landingPageForRole } from "@/lib/onboarding";
import { consumeExternalIdentity } from "@/lib/server/identity";
import {
  enforceRequestRateLimit,
  RateLimitExceededError
} from "@/lib/server/rate-limit";

export async function POST(request: NextRequest) {
  const config = identityBoundaryConfig();
  if (!config.enabled) {
    return NextResponse.json(
      { error: "External identity boundary is not configured" },
      { status: 503 }
    );
  }

  try {
    await enforceRequestRateLimit(request, {
      action: "external_identity",
      limit: 60,
      windowSeconds: 600
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

  try {
    const form = await request.formData();
    const assertionToken = String(form.get("assertion") ?? "");
    const organizationId = String(form.get("organizationId") ?? "").trim() || undefined;

    const assertion = verifyExternalIdentityAssertion(
      assertionToken,
      getIdentityAssertionSecret(),
      {
        allowedProviders: config.allowedProviders,
        requireMfa: config.requireMfa
      }
    );

    const resolution = await consumeExternalIdentity(
      assertion,
      organizationId
    );

    if (resolution.kind === "SELECT_ORGANIZATION") {
      return NextResponse.json(
        {
          error: "Organization selection required",
          choices: resolution.choices
        },
        { status: 409 }
      );
    }

    if (resolution.kind === "ENROLLMENT") {
      const response = NextResponse.redirect(
        new URL("/onboarding?identity=verified", request.url),
        303
      );
      return attachEnrollmentIdentity(response, {
        userId: resolution.userId,
        email: resolution.email,
        name: resolution.name,
        provider: resolution.provider,
        subject: resolution.subject
      });
    }

    const destination = resolution.operational
      ? landingPageForRole(resolution.principal.role)
      : "/account";

    const response = NextResponse.redirect(
      new URL(destination, request.url),
      303
    );
    clearEnrollmentIdentity(response);
    return attachSession(response, resolution.principal);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "External identity sign-in failed";
    const status = /not configured/.test(message)
      ? 503
      : /Forbidden/.test(message)
        ? 403
        : /assertion|identity|MFA|provider|expired|already been used|email conflicts/i.test(
              message
            )
          ? 401
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
