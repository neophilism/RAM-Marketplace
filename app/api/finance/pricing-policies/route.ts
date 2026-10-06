import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { createSupplierPricingPolicy } from "@/lib/server/transactions";
import { supplierPricingPolicySchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const session = requireRequestSession(request);
    const form = await request.formData();
    const parsed = supplierPricingPolicySchema.safeParse({
      species: form.get("species"),
      standardizedCullScheduleUsd: form.get("standardizedCullScheduleUsd"),
      marketCeilingUsd: form.get("marketCeilingUsd")
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid supplier pricing policy", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await createSupplierPricingPolicy(session, parsed.data);
    return NextResponse.redirect(new URL("/finance", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create pricing policy";
    const status = /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
