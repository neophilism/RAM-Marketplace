import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { requireCapability } from "@/lib/access";
import { readBatchJson } from "@/lib/supplier-batch-preview";
import { getSupplierBatchImport, quarantineSupplierBatch } from "@/lib/server/supplier-batch-import";

export async function POST(request: NextRequest) {
  try {
    const session = await requireRequestSession(request);
    requireCapability(session.role, "animal:create");
    const payload = await readBatchJson(request);
    const result = await quarantineSupplierBatch(session, payload);
    return NextResponse.json({ ...result, candidatesCreated: 0, movementAuthorized: false }, { status: result.replay ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to quarantine supplier batch";
    return NextResponse.json({ error: message }, { status: /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireRequestSession(request);
    requireCapability(session.role, "animal:create");
    const batchKey = new URL(request.url).searchParams.get("batchKey") ?? "";
    if (!/^[A-Za-z0-9_-]{8,120}$/.test(batchKey)) throw new Error("Invalid batch key");
    const batch = await getSupplierBatchImport(session, batchKey);
    return NextResponse.json({ batch });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read supplier batch";
    return NextResponse.json({ error: message }, { status: /Authentication/.test(message) ? 401 : /Forbidden/.test(message) ? 403 : 400 });
  }
}
