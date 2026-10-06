import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.env.RAM_FAKE_PAYMENT_GATEWAY_PORT ?? 4119);
const secret = process.env.RAM_PAYMENT_GATEWAY_SECRET;
const gateway = process.env.RAM_PAYMENT_GATEWAY_NAME ?? "ci-gateway";

if (!secret || secret.length < 32) {
  throw new Error("RAM_PAYMENT_GATEWAY_SECRET is required");
}

function sign(raw, timestamp) {
  return createHmac("sha256", secret)
    .update(timestamp)
    .update(".")
    .update(raw)
    .digest("hex");
}

function verify(raw, timestamp, supplied) {
  if (!timestamp || !supplied) return false;
  const expected = Buffer.from(sign(raw, timestamp), "hex");
  const actual = Buffer.from(supplied, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const seen = new Map();

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.method !== "POST" || request.url !== "/v1/executions") {
    response.writeHead(404);
    response.end("not found");
    return;
  }

  let raw = "";
  for await (const chunk of request) raw += chunk;

  const timestamp = request.headers["x-ram-gateway-timestamp"];
  const signature = request.headers["x-ram-gateway-signature"];
  const idempotencyKey = request.headers["idempotency-key"];

  if (
    typeof timestamp !== "string" ||
    typeof signature !== "string" ||
    typeof idempotencyKey !== "string" ||
    !verify(raw, timestamp, signature)
  ) {
    response.writeHead(401);
    response.end("invalid signature");
    return;
  }

  const instruction = JSON.parse(raw);
  const prior = seen.get(idempotencyKey);

  const acknowledgment =
    prior ??
    {
      gateway,
      provider: "ci-provider",
      providerReference: "ci-provider-" + instruction.executionId,
      status: "SUBMITTED"
    };

  seen.set(idempotencyKey, acknowledgment);

  const responseBody = JSON.stringify(acknowledgment);
  const responseTimestamp = String(Math.floor(Date.now() / 1000));

  response.writeHead(200, {
    "content-type": "application/json",
    "x-ram-gateway-timestamp": responseTimestamp,
    "x-ram-gateway-signature": sign(responseBody, responseTimestamp)
  });
  response.end(responseBody);
});

server.listen(port, "127.0.0.1", () => {
  console.log("Fake RAM payment gateway listening on 127.0.0.1:" + port);
});
