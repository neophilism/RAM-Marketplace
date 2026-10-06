import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { membershipAccessActionSchema } from "@/lib/account-lifecycle";
import { updateMembershipAccess } from "@/lib/server/access-admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRequestSession(request);
    const { id } = await params;
    const form = await request.formData();

    const parsed = membershipAccessActionSchema.safeParse({
      membershipId: id,
      status: form.get("status"),
      reason: form.get("reason")
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid membership access action",
          issues: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    await updateMembershipAccess(session, parsed.data);
    return NextResponse.redirect(
      new URL("/ops/access?updated=membership", request.url),
      303
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to update membership access";
    const status = /Authentication/.test(message)
      ? 401
      : /Forbidden/.test(message)
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
