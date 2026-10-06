import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.env.RAM_FAKE_MONITORING_ALERT_PORT ?? 4120);
const secret = process.env.RAM_MONITORING_ALERT_WEBHOOK_SECRET;

if (!secret || secret.length < 32) {
  throw new Error("RAM_MONITORING_ALERT_WEBHOOK_SECRET is required");
}

function sign(raw, timestamp) {
  return createHmac("sha256", secret)
    .update(timestamp)
    .update(".")
    .update(raw)
    .digest("hex");
}

function verify(raw, timestamp, signature) {
  if (!timestamp || !signature) return false;
  const expected = Buffer.from(sign(raw, timestamp), "hex");
  const supplied = Buffer.from(signature, "hex");
  return (
    expected.length === supplied.length &&
    timingSafeEqual(expected, supplied)
  );
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.method !== "POST" || request.url !== "/alerts") {
    response.writeHead(404);
    response.end("not found");
    return;
  }

  let raw = "";
  for await (const chunk of request) raw += chunk;

  const timestamp = request.headers["x-ram-monitoring-timestamp"];
  const signature = request.headers["x-ram-monitoring-signature"];

  if (
    typeof timestamp !== "string" ||
    typeof signature !== "string" ||
    !verify(raw, timestamp, signature)
  ) {
    response.writeHead(401);
    response.end("invalid signature");
    return;
  }

  const payload = JSON.parse(raw);
  if (
    payload.version !== 1 ||
    typeof payload.event !== "string" ||
    !payload.event.startsWith("RAM_OPERATIONAL_INCIDENT_") ||
    typeof payload.incident?.id !== "string" ||
    typeof payload.incident?.code !== "string"
  ) {
    response.writeHead(400);
    response.end("invalid payload");
    return;
  }

  response.writeHead(202, { "content-type": "application/json" });
  response.end(JSON.stringify({ accepted: true }));
});

server.listen(port, "127.0.0.1", () => {
  console.log(
    "Fake RAM monitoring alert receiver listening on 127.0.0.1:" + port
  );
});
