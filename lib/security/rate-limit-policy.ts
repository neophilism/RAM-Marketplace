import { createHmac } from "node:crypto";

export function fixedWindowStartMs(
  nowMs: number,
  windowSeconds: number
) {
  const windowMs = windowSeconds * 1000;
  return Math.floor(nowMs / windowMs) * windowMs;
}

export function rateLimitFingerprint(
  input: {
    address: string;
    userAgent: string;
  },
  secret: string
) {
  if (secret.length < 24) {
    throw new Error("Rate-limit secret must be at least 24 characters");
  }

  return createHmac("sha256", secret)
    .update(input.address)
    .update("\0")
    .update(input.userAgent)
    .digest("hex");
}

export function assertRateLimitCount(
  count: number,
  limit: number
) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Rate-limit configuration must be a positive integer");
  }
  if (count > limit) {
    throw new Error("Rate limit exceeded");
  }
}
