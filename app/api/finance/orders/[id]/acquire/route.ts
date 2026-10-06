import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { commitSupplierAcquisition } from "@/lib/server/transactions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRequestSession(request);
    const { id } = await params;
    await commitSupplierAcquisition(session, id);
    return NextResponse.redirect(new URL("/finance", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to commit supplier acquisition";
    const status = /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
