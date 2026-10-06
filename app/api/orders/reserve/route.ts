import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { reserveMatchedCandidate } from "@/lib/server/transactions";
import { reserveOrderSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const session = requireRequestSession(request);
    const form = await request.formData();
    const parsed = reserveOrderSchema.safeParse({
      animalCaseId: form.get("animalCaseId"),
      researchNeedId: form.get("researchNeedId")
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid reservation request", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const order = await reserveMatchedCandidate(session, parsed.data);
    return NextResponse.redirect(new URL("/orders/" + order.id, request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reserve candidate";
    const status = /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
