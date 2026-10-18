import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { requireCapability } from "@/lib/access";
import { previewSupplierBatch, readBatchJson } from "@/lib/supplier-batch-preview";

export async function POST(request: NextRequest) {
  try {
    const session = await requireRequestSession(request);
    requireCapability(session.role, "animal:create");
    const payload = await readBatchJson(request);
    return NextResponse.json(previewSupplierBatch(session.organizationId, payload));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to preview batch";
    const status = /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 :
      error instanceof SyntaxError || /invalid|batch|submission|organization|JSON|utf-8/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
