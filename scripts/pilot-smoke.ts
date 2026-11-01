import { pathToFileURL } from "node:url";

export type PilotSmokeResult = {
  baseUrl: string;
  liveness: "PASS";
  readiness: "PASS";
  monitoring: "PASS";
  monitoringRunId: string;
};

type FetchLike = typeof fetch;

type PilotSmokeEnvironment = {
  RAM_PILOT_BASE_URL?: string;
  RAM_PILOT_ALLOW_INSECURE_LOCAL?: string;
  RAM_MONITORING_RUN_TOKEN?: string;
};

function isLoopback(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

export function normalizePilotBaseUrl(
  raw: string | undefined,
  allowInsecureLocal = false
) {
  if (!raw?.trim()) {
    throw new Error("RAM_PILOT_BASE_URL is required");
  }

  const value = raw.trim();
  let url: URL;
  try {
    // Reject ambiguity instead of silently removing query/fragment or control bytes.
    if (!/^https?:\/\//i.test(value) || /[\x00-\x20\x7f\\]/.test(value) || /[?#]/.test(value)) throw new Error();
    url = new URL(value);
    if (!url.hostname) throw new Error();
  } catch {
    throw new Error("Invalid RAM_PILOT_BASE_URL");
  }
  if (url.username || url.password) {
    throw new Error("RAM_PILOT_BASE_URL must not contain embedded credentials");
  }

  if (url.protocol !== "https:") {
    if (!(allowInsecureLocal && url.protocol === "http:" && isLoopback(url.hostname))) {
      throw new Error(
        "RAM_PILOT_BASE_URL must use HTTPS (HTTP is allowed only for explicit loopback rehearsal)"
      );
    }
  }

  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

const MAX_SMOKE_RESPONSE_BYTES = 65_536;

async function discardResponse(response: Response) {
  try { await response.body?.cancel(); } catch { /* Disposal must not replace the safe failure. */ }
}

async function readJson(response: Response, label: string): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) {
    await discardResponse(response);
    throw new Error(label + " returned non-JSON response");
  }
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^[0-9]+$/.test(declared) || Number(declared) > MAX_SMOKE_RESPONSE_BYTES)) {
    await discardResponse(response);
    throw new Error(label + " response exceeds the size limit");
  }
  if (!response.body) throw new Error(label + " returned no JSON object");
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      let item: ReadableStreamReadResult<Uint8Array>;
      try { item = await reader.read(); }
      catch { throw new Error(label + " response unavailable"); }
      if (item.done) break;
      length += item.value.byteLength;
      if (length > MAX_SMOKE_RESPONSE_BYTES) {
        try { await reader.cancel(); } catch { /* Preserve bounded-response error. */ }
        throw new Error(label + " response exceeds the size limit");
      }
      chunks.push(item.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body: unknown;
  try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new Error(label + " returned non-JSON response"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error(label + " returned no JSON object");
  return body as Record<string, unknown>;
}

async function checkedFetch(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit | undefined,
  label: string
) {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      ...init,
      headers: { accept: "application/json", ...init?.headers },
      redirect: "error", cache: "no-store", credentials: "omit",
      signal: AbortSignal.timeout(15_000)
    });
  } catch {
    // A failed monitoring POST can have an unknown remote effect; never retry it here.
    throw new Error(label + " request unavailable; inspect remote evidence before retrying");
  }
  if (response.redirected) {
    await discardResponse(response);
    throw new Error(label + " returned an unexpected redirect");
  }
  if (!response.ok) {
    await discardResponse(response);
    throw new Error(label + " failed with HTTP " + response.status);
  }
  return readJson(response, label);
}

export async function runPilotSmoke(
  env: PilotSmokeEnvironment = {
    RAM_PILOT_BASE_URL: process.env.RAM_PILOT_BASE_URL,
    RAM_PILOT_ALLOW_INSECURE_LOCAL:
      process.env.RAM_PILOT_ALLOW_INSECURE_LOCAL,
    RAM_MONITORING_RUN_TOKEN: process.env.RAM_MONITORING_RUN_TOKEN
  },
  fetchImpl: FetchLike = fetch
): Promise<PilotSmokeResult> {
  const allowInsecureLocal =
    env.RAM_PILOT_ALLOW_INSECURE_LOCAL === "true";
  const baseUrl = normalizePilotBaseUrl(
    env.RAM_PILOT_BASE_URL,
    allowInsecureLocal
  );
  const token = env.RAM_MONITORING_RUN_TOKEN?.trim();
  if (!token) {
    throw new Error("RAM_MONITORING_RUN_TOKEN is required for deployed smoke testing");
  }

  const live = await checkedFetch(
    fetchImpl,
    baseUrl + "/api/health/live",
    undefined,
    "Liveness probe"
  );
  if (live.status !== "ok") {
    throw new Error("Liveness probe returned unexpected status");
  }

  const ready = await checkedFetch(
    fetchImpl,
    baseUrl + "/api/health/ready",
    undefined,
    "Readiness probe"
  );
  if (ready.status !== "ready") {
    throw new Error("Readiness probe returned unexpected status");
  }

  const monitoring = await checkedFetch(
    fetchImpl,
    baseUrl + "/api/monitoring/run",
    {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        accept: "application/json"
      }
    },
    "Monitoring cycle"
  );
  if (monitoring.ok !== true || monitoring.status !== "SUCCESS") {
    throw new Error("Monitoring cycle returned unexpected result");
  }

  if (typeof monitoring.runId !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(monitoring.runId)) {
    throw new Error("Monitoring cycle returned no valid run receipt");
  }

  return {
    baseUrl,
    liveness: "PASS",
    readiness: "PASS",
    monitoring: "PASS",
    monitoringRunId: monitoring.runId
  };
}

async function main() {
  const result = await runPilotSmoke();
  console.log("[PASS] deployed liveness");
  console.log("[PASS] deployed PostgreSQL readiness");
  console.log("[PASS] authenticated monitoring cycle");
  if (result.monitoringRunId) {
    console.log("[INFO] monitoring run " + result.monitoringRunId);
  }
  console.log("");
  console.log("Deployed smoke checks passed; pilot authorization and alert delivery remain separate gates.");
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(
      "[FAIL] " + (error instanceof Error ? error.message : String(error))
    );
    process.exitCode = 1;
  });
}
