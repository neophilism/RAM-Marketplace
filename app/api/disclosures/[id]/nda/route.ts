import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { acceptDisclosureNda } from "@/lib/server/disclosures";
import { disclosureNdaAcceptSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRequestSession(request);
    const { id } = await params;
    const form = await request.formData();
    const parsed = disclosureNdaAcceptSchema.safeParse({
      requestId: id,
      accepted: form.get("accepted") === "on"
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "NDA acceptance is required", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await acceptDisclosureNda(session, parsed.data);
    return NextResponse.redirect(new URL("/disclosures/" + id, request.url), 303);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to accept disclosure NDA";
    const status = /Authentication/.test(message)
      ? 401
      : /Forbidden/.test(message)
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
