import assert from "node:assert/strict";
import test from "node:test";
import { normalizePilotBaseUrl, runPilotSmoke } from "../scripts/pilot-smoke";

const env = { RAM_PILOT_BASE_URL: "https://pilot.example.test", RAM_MONITORING_RUN_TOKEN: "synthetic-token-" + "x".repeat(32) };
const success = [ { status: "ok" }, { status: "ready" }, { ok: true, status: "SUCCESS", runId: "synthetic-run-1" } ];
function fixture(override?: (index: number) => Response | undefined) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    const index = calls.length;
    calls.push({ url: String(url), init });
    if (index > 2) throw new Error("Unexpected retry or extra request");
    return override?.(index) ?? Response.json(success[index]);
  };
  return { calls, fetcher };
}
const rejected = (error: unknown) => error instanceof Error && !(error instanceof TypeError);

for (const url of ["https://pilot.example.test/a\nb", "https://pilot.example.test\\nested", "https://pilot.example.test/?key=synthetic",
  "https://pilot.example.test/#fragment", "https://pilot.example.test/#", "https://", "https:pilot.example.test"])
  test("ambiguous pilot URL is rejected: " + JSON.stringify(url), () => {
    assert.throws(() => normalizePilotBaseUrl(url), rejected);
  });
test("bad URL errors never retain the configured URL or its userinfo", () => {
  const raw = "https://user:synthetic-private-value@";
  assert.throws(() => normalizePilotBaseUrl(raw), (error: unknown) => error instanceof Error &&
    !JSON.stringify(error).includes("synthetic-private-value") && !error.message.includes("synthetic-private-value"));
});
test("all smoke requests forbid redirects, caching and implicit cookies; only monitoring carries a token", async () => {
  const f = fixture();
  await runPilotSmoke(env, f.fetcher);
  assert.equal(f.calls.length, 3);
  for (const call of f.calls) {
    assert.equal(call.init?.redirect, "error");
    assert.equal(call.init?.cache, "no-store");
    assert.equal(call.init?.credentials, "omit");
    assert.ok(call.init?.signal instanceof AbortSignal);
    assert.equal(new Headers(call.init?.headers).get("accept"), "application/json");
  }
  assert.equal(new Headers(f.calls[0].init?.headers).has("authorization"), false);
  assert.equal(new Headers(f.calls[1].init?.headers).has("authorization"), false);
  assert.equal(new Headers(f.calls[2].init?.headers).get("authorization"), "Bearer " + env.RAM_MONITORING_RUN_TOKEN);
});
for (const index of [0, 1, 2]) {
  test("redirected response at step " + index + " cannot produce a pass", async () => {
    const f = fixture((i) => {
      if (i !== index) return;
      const response = Response.json(success[i]);
      Object.defineProperty(response, "redirected", { value: true });
      return response;
    });
    await assert.rejects(runPilotSmoke(env, f.fetcher), /redirect/);
    assert.equal(f.calls.length, index + 1);
  });
  test("server error at step " + index + " is redacted and never retried", async () => {
    const f = fixture((i) => i === index ? Response.json({ error: "synthetic-private-database-detail" }, { status: 500 }) : undefined);
    await assert.rejects(runPilotSmoke(env, f.fetcher), (error: unknown) => error instanceof Error &&
      /HTTP 500/.test(error.message) && !error.message.includes("synthetic-private-database-detail"));
    assert.equal(f.calls.length, index + 1);
  });
  test("transport error at step " + index + " cannot leak the request or credentials", async () => {
    const f = fixture((i) => { if (i === index) throw new Error("https://user:synthetic-private-value@host.test"); return undefined; });
    await assert.rejects(runPilotSmoke(env, f.fetcher), (error: unknown) => error instanceof Error &&
      /unavailable/.test(error.message) && !error.message.includes("synthetic-private-value"));
    assert.equal(f.calls.length, index + 1);
  });
}
for (const value of [null, [], true, 42, "ok"])
  test("JSON primitive or array is rejected as a response object: " + JSON.stringify(value), async () => {
    const f = fixture(() => Response.json(value));
    await assert.rejects(runPilotSmoke(env, f.fetcher), /JSON object/);
    assert.equal(f.calls.length, 1);
  });
test("valid-looking JSON without its JSON media type is not accepted", async () => {
  const f = fixture(() => new Response(JSON.stringify(success[0]), { headers: { "Content-Type": "text/html" } }));
  await assert.rejects(runPilotSmoke(env, f.fetcher), /JSON/);
  assert.equal(f.calls.length, 1);
});
test("response bodies are bounded even without Content-Length", async () => {
  let canceled = false;
  let closeTimer: ReturnType<typeof setTimeout>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"status":"ok","padding":"' + "x".repeat(70_000)));
      closeTimer = setTimeout(() => controller.close(), 50);
    },
    cancel() { canceled = true; clearTimeout(closeTimer); }
  });
  const f = fixture(() => new Response(stream, { headers: { "Content-Type": "application/json" } }));
  await assert.rejects(runPilotSmoke(env, f.fetcher), /limit/);
  assert.equal(canceled, true);
  assert.equal(f.calls.length, 1);
});
test("an oversized declared length fails before consuming its body", async () => {
  let canceled = false;
  let closeTimer: ReturnType<typeof setTimeout>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { closeTimer = setTimeout(() => controller.close(), 50); },
    cancel() { canceled = true; clearTimeout(closeTimer); }
  });
  const f = fixture(() => new Response(stream, { headers: { "Content-Type": "application/json", "Content-Length": "65537" } }));
  await assert.rejects(runPilotSmoke(env, f.fetcher), /limit/);
  assert.equal(canceled, true);
});
for (const runId of [undefined, null, 12, "", " ", "unsafe\nlog", "x".repeat(201)])
  test("monitoring response requires a bounded safe run receipt: " + JSON.stringify(runId), async () => {
    const f = fixture((i) => i === 2 ? Response.json({ ok: true, status: "SUCCESS", runId }) : undefined);
    await assert.rejects(runPilotSmoke(env, f.fetcher), /receipt/);
  });
test("missing token stops before any network request", async () => {
  const f = fixture();
  await assert.rejects(runPilotSmoke({ RAM_PILOT_BASE_URL: env.RAM_PILOT_BASE_URL }, f.fetcher), /required/);
  assert.equal(f.calls.length, 0);
});
test("normal HTTPS subpaths and explicit local rehearsal remain usable", async () => {
  assert.equal(normalizePilotBaseUrl(" https://pilot.example.test/rehearsal/// "), "https://pilot.example.test/rehearsal");
  assert.equal(normalizePilotBaseUrl("http://127.0.0.1:3117/", true), "http://127.0.0.1:3117");
  const f = fixture();
  const result = await runPilotSmoke(env, f.fetcher);
  assert.equal(result.monitoringRunId, "synthetic-run-1");
  assert.equal(result.monitoring, "PASS");
});

for (const status of [undefined, null, "RUNNING", "FAILED", true])
  test("monitoring cycle must have completed successfully: " + JSON.stringify(status), async () => {
    const f = fixture((i) => i === 2 ? Response.json({ ok: true, runId: "synthetic-run-1", status }) : undefined);
    await assert.rejects(runPilotSmoke(env, f.fetcher), /result/);
    assert.equal(f.calls.length, 3);
  });
