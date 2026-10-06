import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/session";
import { requireCapability } from "@/lib/access";
import { runMonitoringCycle } from "@/lib/server/monitoring";

export async function POST(request: NextRequest) {
  try {
    const session = await requireRequestSession(request);
    requireCapability(session.role, "admin:manage");

    await runMonitoringCycle("RAM_ADMIN_MANUAL");
    return NextResponse.redirect(
      new URL("/ops/monitoring?ran=1", request.url),
      303
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Monitoring cycle failed";
    const status = /Authentication/.test(message)
      ? 401
      : /Forbidden/.test(message)
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
