import assert from "node:assert/strict";
import test from "node:test";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { runPilotSmoke } from "../scripts/pilot-smoke";

// Real loopback HTTP with a constructed token. No app/database/provider credentials.
const token = "synthetic-smoke-rehearsal-" + "k".repeat(32);
function json(response: ServerResponse, value: unknown, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}
async function usingServer(handler: (request: IncomingMessage, response: ServerResponse) => void,
  check: (base: string) => Promise<void>) {
  const server = createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    await check("http://127.0.0.1:" + address.port);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}
function env(base: string) { return { RAM_PILOT_BASE_URL: base, RAM_PILOT_ALLOW_INSECURE_LOCAL: "true", RAM_MONITORING_RUN_TOKEN: token }; }
function health(request: IncomingMessage, response: ServerResponse) {
  if (request.url === "/api/health/live") { json(response, { status: "ok" }); return true; }
  if (request.url === "/api/health/ready") { json(response, { status: "ready" }); return true; }
  return false;
}

test("real loopback transport completes three probes and sends a credential only to monitoring", async () => {
  const seen: { path: string | undefined; authorization: string | undefined; method: string | undefined }[] = [];
  await usingServer((request, response) => {
    seen.push({ path: request.url, authorization: request.headers.authorization, method: request.method });
    if (!health(request, response)) json(response, { ok: true, status: "SUCCESS", runId: "local-synthetic-run" });
  }, async (base) => {
    assert.equal((await runPilotSmoke(env(base))).monitoringRunId, "local-synthetic-run");
  });
  assert.equal(seen.length, 3);
  assert.deepEqual(seen.map((item) => item.method), ["GET", "GET", "POST"]);
  assert.deepEqual(seen.map((item) => item.authorization), [undefined, undefined, "Bearer " + token]);
});
test("real redirect from a public probe is not followed and never reaches monitoring", async () => {
  const paths: string[] = [];
  await usingServer((request, response) => {
    paths.push(request.url ?? "");
    response.writeHead(302, { Location: "/redirect-target" }); response.end();
  }, async (base) => {
    await assert.rejects(runPilotSmoke(env(base)), /Liveness probe request unavailable/);
  });
  assert.deepEqual(paths, ["/api/health/live"]);
});
test("a redirect after the monitoring POST is not replayed or followed", async () => {
  const paths: string[] = [];
  await usingServer((request, response) => {
    paths.push(request.url ?? "");
    if (health(request, response)) return;
    response.writeHead(307, { Location: "/must-not-receive-token" }); response.end();
  }, async (base) => {
    await assert.rejects(runPilotSmoke(env(base)), /Monitoring cycle request unavailable/);
  });
  assert.deepEqual(paths, ["/api/health/live", "/api/health/ready", "/api/monitoring/run"]);
});
test("real readiness failure preserves the HTTP code but withholds the remote error body", async () => {
  const paths: string[] = [];
  await usingServer((request, response) => {
    paths.push(request.url ?? "");
    if (request.url === "/api/health/live") json(response, { status: "ok" });
    else json(response, { error: "synthetic-private-database-diagnostic" }, 503);
  }, async (base) => {
    await assert.rejects(runPilotSmoke(env(base)), (error: unknown) => error instanceof Error &&
      error.message === "Readiness probe failed with HTTP 503");
  });
  assert.deepEqual(paths, ["/api/health/live", "/api/health/ready"]);
});
test("real chunked oversized JSON fails before subsequent probes", async () => {
  const paths: string[] = [];
  await usingServer((request, response) => {
    paths.push(request.url ?? "");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.write('{"status":"ok","padding":"'); response.end("x".repeat(70_000) + '"}');
  }, async (base) => {
    await assert.rejects(runPilotSmoke(env(base)), /size limit/);
  });
  assert.deepEqual(paths, ["/api/health/live"]);
});
