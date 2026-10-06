import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { retryPaymentExecution } from "@/lib/server/payment-executions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRequestSession(request);
    const { id } = await params;
    const execution = await retryPaymentExecution(session, id);
    return NextResponse.redirect(
      new URL("/finance/settlements/" + execution.settlementId, request.url),
      303
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to retry payment execution";
    const status = /Authentication/.test(message)
      ? 401
      : /Forbidden/.test(message)
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
