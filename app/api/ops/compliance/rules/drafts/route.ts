import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { listComplianceRuleDrafts, saveComplianceRuleDraft } from "@/lib/server/compliance-rule-drafts";
import type { RuleDraftInput } from "@/lib/compliance-rule-drafts";

export async function GET(request: NextRequest) {
  try {
    const principal = await requireRequestSession(request);
    const ruleId = new URL(request.url).searchParams.get("ruleId") ?? "";
    return NextResponse.json({ revisions: await listComplianceRuleDrafts(principal, ruleId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to list rule drafts";
    return NextResponse.json({ error: message }, { status: /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const principal = await requireRequestSession(request);
    const payload = await request.json() as { input?: RuleDraftInput; expectedDigest?: string };
    if (!payload || typeof payload !== "object" || !payload.input ||
        (payload.expectedDigest !== undefined && typeof payload.expectedDigest !== "string")) {
      return NextResponse.json({ error: "Invalid draft request" }, { status: 400 });
    }
    const draft = await saveComplianceRuleDraft(principal, payload.input, payload.expectedDigest);
    return NextResponse.json({ draft, movementAuthorized: false }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save rule draft";
    return NextResponse.json({ error: message }, { status: /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 400 });
  }
}
