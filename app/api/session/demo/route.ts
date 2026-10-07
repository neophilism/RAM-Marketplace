import { NextRequest, NextResponse } from "next/server";
import { attachSession, demoAuthEnabled } from "@/lib/auth/session";
import { demoActors } from "@/lib/access";
import { landingPageForRole } from "@/lib/onboarding";
import {
  enforceRequestRateLimit,
  RateLimitExceededError
} from "@/lib/server/rate-limit";

export async function POST(request: NextRequest) {
  if (!demoAuthEnabled()) {
    return NextResponse.json({ error: "Demo authentication is disabled" }, { status: 403 });
  }

  try {
    await enforceRequestRateLimit(request, {
      action: "demo_session",
      limit: 120,
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

  const form = await request.formData();
  const actorKey = String(form.get("actor") ?? "") as keyof typeof demoActors;
  const actor = demoActors[actorKey];
  if (!actor) {
    return NextResponse.json({ error: "Unknown demo actor" }, { status: 400 });
  }

  const principal = {
    userId: `demo-${actorKey}-user`,
    organizationId: actor.organizationId,
    role: actor.role,
    email: `${actorKey}@demo.ram.invalid`,
    name: actor.name
  };

  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: landingPageForRole(principal.role)
    }
  });
  return attachSession(response, principal);
}
