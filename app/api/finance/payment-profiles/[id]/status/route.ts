import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { paymentProfileStatusSchema } from "@/lib/payments/profile-validation";
import { updatePaymentProfileStatus } from "@/lib/server/payment-profiles";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRequestSession(request);
    const { id } = await params;
    const form = await request.formData();

    const parsed = paymentProfileStatusSchema.safeParse({
      profileId: id,
      status: form.get("status"),
      reason: form.get("reason")
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payment profile status action", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await updatePaymentProfileStatus(session, parsed.data);
    return NextResponse.redirect(
      new URL("/finance/payment-profiles?updated=1", request.url),
      303
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update payment profile";
    const status = /Authentication/.test(message)
      ? 401
      : /Forbidden/.test(message)
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
