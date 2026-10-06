import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePilotBaseUrl,
  runPilotSmoke
} from "../scripts/pilot-smoke";

test("normalizePilotBaseUrl requires HTTPS by default", () => {
  assert.equal(
    normalizePilotBaseUrl("https://pilot.ram.example/"),
    "https://pilot.ram.example"
  );
  assert.throws(
    () => normalizePilotBaseUrl("http://pilot.ram.example"),
    /must use HTTPS/
  );
});

test("normalizePilotBaseUrl permits explicit loopback rehearsal only", () => {
  assert.equal(
    normalizePilotBaseUrl("http://127.0.0.1:3000/", true),
    "http://127.0.0.1:3000"
  );
  assert.throws(
    () => normalizePilotBaseUrl("http://10.0.0.2:3000", true),
    /must use HTTPS/
  );
});

test("runPilotSmoke exercises live, ready and authenticated monitoring", async () => {
  const seen: Array<{ url: string; init?: RequestInit }> = [];
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    seen.push({ url, init });

    if (url.endsWith("/api/health/live")) {
      return Response.json({ status: "ok" });
    }
    if (url.endsWith("/api/health/ready")) {
      return Response.json({ status: "ready" });
    }
    if (url.endsWith("/api/monitoring/run")) {
      return Response.json({ ok: true, runId: "run-123" });
    }
    return Response.json({ error: "unexpected" }, { status: 404 });
  }) as typeof fetch;

  const result = await runPilotSmoke(
    {
      RAM_PILOT_BASE_URL: "https://pilot.ram.example",
      RAM_MONITORING_RUN_TOKEN: "a-strong-monitoring-token"
    },
    fakeFetch
  );

  assert.equal(result.monitoringRunId, "run-123");
  assert.equal(seen.length, 3);
  assert.equal(seen[2].init?.method, "POST");
  assert.equal(
    (seen[2].init?.headers as Record<string, string>).authorization,
    "Bearer a-strong-monitoring-token"
  );
});

test("runPilotSmoke fails closed on readiness failure", async () => {
  const fakeFetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/api/health/live")) {
      return Response.json({ status: "ok" });
    }
    if (url.endsWith("/api/health/ready")) {
      return Response.json({ status: "not_ready" }, { status: 503 });
    }
    throw new Error("monitoring should not run");
  }) as typeof fetch;

  await assert.rejects(
    runPilotSmoke(
      {
        RAM_PILOT_BASE_URL: "https://pilot.ram.example",
        RAM_MONITORING_RUN_TOKEN: "a-strong-monitoring-token"
      },
      fakeFetch
    ),
    /Readiness probe failed with HTTP 503/
  );
});
