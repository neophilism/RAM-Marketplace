import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { updateFarmDisclosurePolicy } from "@/lib/server/disclosures";
import { farmDisclosurePolicySchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const session = await requireRequestSession(request);
    const form = await request.formData();
    const parsed = farmDisclosurePolicySchema.safeParse({
      shareGeneralHusbandry: form.get("shareGeneralHusbandry") === "on",
      shareCountyAfterNda: form.get("shareCountyAfterNda") === "on",
      shareIdentityPrePurchase: form.get("shareIdentityPrePurchase") === "on",
      shareIdentityPostPurchase: form.get("shareIdentityPostPurchase") === "on"
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid farm disclosure policy", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await updateFarmDisclosurePolicy(session, parsed.data);
    return NextResponse.redirect(new URL("/farm?policy=updated", request.url), 303);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update disclosure policy";
    const status = /Authentication/.test(message)
      ? 401
      : /Forbidden/.test(message)
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
