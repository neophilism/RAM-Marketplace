import { NextRequest, NextResponse } from "next/server";
import { processPaymentWebhook } from "@/lib/server/payment-executions";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const result = await processPaymentWebhook(
      rawBody,
      request.headers.get("x-ram-gateway-timestamp"),
      request.headers.get("x-ram-gateway-signature")
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to process payment webhook";
    const status = /signature|timestamp|gateway mismatch/i.test(message)
      ? 401
      : /Invalid payment webhook/.test(message)
        ? 400
        : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
