import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { resetPilotGateSchema } from "@/lib/pilot-gates";
import { resetPilotGate } from "@/lib/server/pilot-gates";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const session = await requireRequestSession(request);
    const { key } = await params;
    const form = await request.formData();

    const parsed = resetPilotGateSchema.safeParse({
      gateKey: key,
      reason: form.get("reason")
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid pilot gate reset", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await resetPilotGate(session, parsed.data);
    return NextResponse.redirect(
      new URL("/ops/pilot?updated=reset", request.url),
      303
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reset pilot gate";
    const status = /Authentication/.test(message)
      ? 401
      : /Forbidden/.test(message)
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
