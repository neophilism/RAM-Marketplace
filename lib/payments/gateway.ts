import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type PaymentExecutionType =
  | "BUYER_COLLECTION"
  | "SUPPLIER_PAYOUT"
  | "BUYER_REFUND";

export type PaymentExecutionStatus =
  | "CREATED"
  | "SUBMITTED"
  | "SUBMISSION_UNKNOWN"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELED";

export interface PaymentGatewayInstruction {
  executionId: string;
  settlementId: string;
  counterpartyOrganizationId: string;
  accountReference: string;
  idempotencyKey: string;
  type: PaymentExecutionType;
  amountCents: number;
  currency: string;
}

export interface PaymentGatewayAcknowledgment {
  gateway: string;
  provider: string;
  providerReference: string;
  status: "SUBMITTED" | "PROCESSING";
}

export interface PaymentGatewayWebhook {
  eventId: string;
  gateway: string;
  provider: string;
  providerReference: string;
  executionId: string;
  status: "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELED";
  occurredAt: string;
  failureCode?: string;
  failureMessage?: string;
}

export interface PaymentGatewayConfig {
  name: string;
  url: string;
  secret: string;
}

function assertSecret(secret: string) {
  if (secret.length < 32) {
    throw new Error("RAM_PAYMENT_GATEWAY_SECRET must be at least 32 characters");
  }
}

export function paymentGatewayConfig(
  env: Record<string, string | undefined> = process.env
): PaymentGatewayConfig | null {
  const name = env.RAM_PAYMENT_GATEWAY_NAME?.trim();
  const url = env.RAM_PAYMENT_GATEWAY_URL?.trim();
  const secret = env.RAM_PAYMENT_GATEWAY_SECRET?.trim();

  if (!name && !url && !secret) return null;
  if (!name || !url || !secret) {
    throw new Error(
      "RAM payment gateway requires RAM_PAYMENT_GATEWAY_NAME, RAM_PAYMENT_GATEWAY_URL and RAM_PAYMENT_GATEWAY_SECRET"
    );
  }
  assertSecret(secret);
  if (
    secret === env.AUTH_SECRET ||
    secret === env.RAM_IDENTITY_ASSERTION_SECRET
  ) {
    throw new Error(
      "RAM_PAYMENT_GATEWAY_SECRET must be distinct from session and identity secrets"
    );
  }

  const parsed = new URL(url);
  const insecureLocalAllowed =
    env.RAM_PAYMENT_GATEWAY_ALLOW_INSECURE_LOCAL === "true" &&
    (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");

  if (
    env.NODE_ENV === "production" &&
    parsed.protocol !== "https:" &&
    !insecureLocalAllowed
  ) {
    throw new Error("Production payment gateway URL must use HTTPS");
  }
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("Payment gateway URL must use HTTP(S)");
  }

  return { name, url: parsed.toString().replace(/\/$/, ""), secret };
}

export function bodyHash(rawBody: string) {
  return createHash("sha256").update(rawBody).digest("hex");
}

export function signGatewayMessage(
  rawBody: string,
  timestamp: string,
  secret: string
) {
  assertSecret(secret);
  return createHmac("sha256", secret)
    .update(timestamp)
    .update(".")
    .update(rawBody)
    .digest("hex");
}

export function verifyGatewaySignature(
  rawBody: string,
  timestamp: string | null,
  suppliedSignature: string | null,
  secret: string,
  options: { nowMs?: number; maxSkewSeconds?: number } = {}
) {
  assertSecret(secret);
  if (!timestamp || !suppliedSignature) {
    throw new Error("Missing payment gateway signature headers");
  }

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs)) {
    throw new Error("Invalid payment gateway timestamp");
  }

  const nowMs = options.nowMs ?? Date.now();
  const maxSkewMs = (options.maxSkewSeconds ?? 300) * 1000;
  if (Math.abs(nowMs - timestampMs) > maxSkewMs) {
    throw new Error("Payment gateway signature timestamp is outside allowed skew");
  }

  const expected = signGatewayMessage(rawBody, timestamp, secret);
  const expectedBuffer = Buffer.from(expected, "hex");
  const suppliedBuffer = Buffer.from(suppliedSignature, "hex");

  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    throw new Error("Invalid payment gateway signature");
  }
}

export function executionTypeToLedgerType(type: PaymentExecutionType) {
  switch (type) {
    case "BUYER_COLLECTION":
      return "BUYER_PAYMENT" as const;
    case "SUPPLIER_PAYOUT":
      return "SUPPLIER_PAYOUT" as const;
    case "BUYER_REFUND":
      return "BUYER_REFUND" as const;
  }
}

export function assertExecutionStatusTransition(
  current: PaymentExecutionStatus,
  next: PaymentExecutionStatus
) {
  const allowed: Record<PaymentExecutionStatus, readonly PaymentExecutionStatus[]> = {
    CREATED: ["SUBMITTED", "SUBMISSION_UNKNOWN", "PROCESSING", "SUCCEEDED", "FAILED", "CANCELED"],
    SUBMITTED: ["PROCESSING", "SUCCEEDED", "FAILED", "CANCELED"],
    SUBMISSION_UNKNOWN: ["SUBMITTED", "PROCESSING", "SUCCEEDED", "FAILED", "CANCELED"],
    PROCESSING: ["SUCCEEDED", "FAILED", "CANCELED"],
    SUCCEEDED: [],
    FAILED: [],
    CANCELED: []
  };

  if (!allowed[current].includes(next)) {
    throw new Error(
      "Invalid payment execution transition " + current + " -> " + next
    );
  }
}
