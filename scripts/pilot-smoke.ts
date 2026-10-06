import { pathToFileURL } from "node:url";

export type PilotSmokeResult = {
  baseUrl: string;
  liveness: "PASS";
  readiness: "PASS";
  monitoring: "PASS";
  monitoringRunId?: string;
};

type FetchLike = typeof fetch;

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

  const url = new URL(raw.trim());
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
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

async function readJson(response: Response, label: string) {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(label + " returned non-JSON response");
  }
  return body as Record<string, unknown>;
}

async function checkedFetch(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit | undefined,
  label: string
) {
  const response = await fetchImpl(url, {
    ...init,
    signal: AbortSignal.timeout(15_000)
  });
  const body = await readJson(response, label);
  if (!response.ok) {
    throw new Error(
      label +
        " failed with HTTP " +
        response.status +
        (typeof body.error === "string" ? ": " + body.error : "")
    );
  }
  return body;
}

export async function runPilotSmoke(
  env: NodeJS.ProcessEnv = process.env,
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
  if (monitoring.ok !== true) {
    throw new Error("Monitoring cycle returned unexpected result");
  }

  return {
    baseUrl,
    liveness: "PASS",
    readiness: "PASS",
    monitoring: "PASS",
    monitoringRunId:
      typeof monitoring.runId === "string" ? monitoring.runId : undefined
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
  console.log("Deployed smoke rehearsal: READY");
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
