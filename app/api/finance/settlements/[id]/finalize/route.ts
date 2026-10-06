import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { finalizeFinancialSettlement } from "@/lib/server/settlements";
import { settlementFinalizeSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRequestSession(request);
    const { id } = await params;
    const parsed = settlementFinalizeSchema.safeParse({ settlementId: id });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid settlement" }, { status: 400 });
    }

    await finalizeFinancialSettlement(session, id);
    return NextResponse.redirect(new URL("/finance/settlements/" + id, request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to finalize settlement";
    const status = /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
