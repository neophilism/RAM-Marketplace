import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { assignTransport } from "@/lib/server/logistics";
import { transportAssignmentSchema } from "@/lib/validation";

function optional(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const session = requireRequestSession(request);
    const form = await request.formData();
    const parsed = transportAssignmentSchema.safeParse({
      orderId: form.get("orderId"),
      transportOrganizationId: form.get("transportOrganizationId"),
      assignedTransportUserId: optional(form.get("assignedTransportUserId")),
      pickupWindowStart: optional(form.get("pickupWindowStart")),
      pickupWindowEnd: optional(form.get("pickupWindowEnd")),
      deliveryWindowStart: optional(form.get("deliveryWindowStart")),
      deliveryWindowEnd: optional(form.get("deliveryWindowEnd")),
      movementDocumentRefs: optional(form.get("movementDocumentRefs")),
      sanitationRequirements: optional(form.get("sanitationRequirements")),
      specialInstructions: optional(form.get("specialInstructions"))
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid transport assignment", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await assignTransport(session, parsed.data);
    return NextResponse.redirect(new URL("/ops/logistics", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to assign transport";
    const status = /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
