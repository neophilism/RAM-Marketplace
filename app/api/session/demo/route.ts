import { NextRequest, NextResponse } from "next/server";
import { attachSession, demoAuthEnabled } from "@/lib/auth/session";
import { demoActors } from "@/lib/access";
import { landingPageForRole } from "@/lib/onboarding";

export async function POST(request: NextRequest) {
  if (!demoAuthEnabled()) {
    return NextResponse.json({ error: "Demo authentication is disabled" }, { status: 403 });
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

  const response = NextResponse.redirect(
    new URL(landingPageForRole(principal.role), request.url),
    303
  );
  return attachSession(response, principal);
}
