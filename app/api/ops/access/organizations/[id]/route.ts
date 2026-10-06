import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { organizationAccessActionSchema } from "@/lib/account-lifecycle";
import { updateOrganizationAccess } from "@/lib/server/access-admin";

function optional(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRequestSession(request);
    const { id } = await params;
    const form = await request.formData();

    const parsed = organizationAccessActionSchema.safeParse({
      organizationId: id,
      action: form.get("action"),
      method: optional(form.get("method")),
      evidenceSummary: optional(form.get("evidenceSummary")),
      notes: optional(form.get("notes"))
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid organization access action",
          issues: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    await updateOrganizationAccess(session, parsed.data);
    return NextResponse.redirect(
      new URL("/ops/access?updated=organization", request.url),
      303
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to update organization access";
    const status = /Authentication/.test(message)
      ? 401
      : /Forbidden/.test(message)
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
