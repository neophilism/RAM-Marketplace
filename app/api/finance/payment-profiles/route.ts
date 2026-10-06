import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { paymentProfileUpsertSchema } from "@/lib/payments/profile-validation";
import { upsertPaymentProfile } from "@/lib/server/payment-profiles";

function optional(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRequestSession(request);
    const form = await request.formData();

    const parsed = paymentProfileUpsertSchema.safeParse({
      organizationId: form.get("organizationId"),
      externalAccountReference: form.get("externalAccountReference"),
      buyerCollectionEnabled: form.get("buyerCollectionEnabled") === "on",
      supplierPayoutEnabled: form.get("supplierPayoutEnabled") === "on",
      notes: optional(form.get("notes")),
      verificationAttestation: form.get("verificationAttestation") === "on"
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payment profile", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await upsertPaymentProfile(session, parsed.data);
    return NextResponse.redirect(
      new URL("/finance/payment-profiles?saved=1", request.url),
      303
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save payment profile";
    const status = /Authentication/.test(message)
      ? 401
      : /Forbidden/.test(message)
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
