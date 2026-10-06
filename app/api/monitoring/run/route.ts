import { NextRequest, NextResponse } from "next/server";
import {
  requireMonitoringRunnerConfig,
  verifyMonitoringRunToken
} from "@/lib/monitoring/config";
import { runMonitoringCycle } from "@/lib/server/monitoring";

export async function POST(request: NextRequest) {
  try {
    const config = requireMonitoringRunnerConfig();
    verifyMonitoringRunToken(
      request.headers.get("authorization"),
      config.runToken
    );

    const result = await runMonitoringCycle("SCHEDULED_HTTP");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Monitoring cycle failed";
    const status = /bearer token|Invalid monitoring bearer token/i.test(message)
      ? 401
      : /not enabled|must be a strong secret|must be distinct/i.test(message)
        ? 503
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
