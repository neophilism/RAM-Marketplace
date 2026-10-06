import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { commitBuyerOrder } from "@/lib/server/transactions";
import { buyerCommitmentSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRequestSession(request);
    const { id } = await params;
    const form = await request.formData();
    const parsed = buyerCommitmentSchema.safeParse({
      orderId: id,
      receivingFacilityName: form.get("receivingFacilityName"),
      receivingFacilityAddress: form.get("receivingFacilityAddress"),
      protocolReference: form.get("protocolReference"),
      institutionalApprovalAttested: form.get("institutionalApprovalAttested") === "on",
      purchasingAuthorityAttested: form.get("purchasingAuthorityAttested") === "on"
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid buyer commitment", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await commitBuyerOrder(session, parsed.data);
    return NextResponse.redirect(new URL("/orders/" + id, request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to commit order";
    const status = /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
