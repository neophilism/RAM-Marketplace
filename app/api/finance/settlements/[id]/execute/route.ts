import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { paymentExecutionRequestSchema } from "@/lib/payments/validation";
import { initiatePaymentExecution } from "@/lib/server/payment-executions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRequestSession(request);
    const { id } = await params;
    const form = await request.formData();

    const parsed = paymentExecutionRequestSchema.safeParse({
      settlementId: id,
      type: form.get("type"),
      amountUsd: form.get("amountUsd")
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payment execution", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await initiatePaymentExecution(session, parsed.data);
    return NextResponse.redirect(
      new URL("/finance/settlements/" + id, request.url),
      303
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to initiate payment";
    const status = /Authentication/.test(message)
      ? 401
      : /Forbidden/.test(message)
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
