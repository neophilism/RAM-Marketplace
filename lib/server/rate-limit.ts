import "server-only";
import type { NextRequest } from "next/server";
import {
  assertRateLimitCount,
  fixedWindowStartMs,
  rateLimitFingerprint
} from "@/lib/security/rate-limit-policy";
import { dataBackend, requirePrisma } from "@/lib/server/db";

export class RateLimitExceededError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Rate limit exceeded");
    this.name = "RateLimitExceededError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __ramPrototypeRateLimits:
    | Map<string, number>
    | undefined;
}

function prototypeCounts() {
  if (!globalThis.__ramPrototypeRateLimits) {
    globalThis.__ramPrototypeRateLimits = new Map();
  }
  return globalThis.__ramPrototypeRateLimits;
}

function secret() {
  const configured = process.env.AUTH_SECRET;
  if (configured && configured.length >= 24) return configured;
  if (process.env.NODE_ENV !== "production") {
    return "ram-local-development-only-secret";
  }
  throw new Error("AUTH_SECRET is required for production rate limiting");
}

function address(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function enforceRequestRateLimit(
  request: NextRequest,
  options: {
    action: string;
    limit: number;
    windowSeconds: number;
  }
) {
  const nowMs = Date.now();
  const windowStartMs = fixedWindowStartMs(
    nowMs,
    options.windowSeconds
  );
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil(
      (windowStartMs + options.windowSeconds * 1000 - nowMs) / 1000
    )
  );
  const keyHash = rateLimitFingerprint(
    {
      address: address(request),
      userAgent: request.headers.get("user-agent") ?? "unknown"
    },
    secret()
  );

  if (dataBackend() === "prototype") {
    const key = [
      options.action,
      keyHash,
      String(windowStartMs)
    ].join(":");
    const count = (prototypeCounts().get(key) ?? 0) + 1;
    prototypeCounts().set(key, count);
    try {
      assertRateLimitCount(count, options.limit);
    } catch {
      throw new RateLimitExceededError(retryAfterSeconds);
    }
    return {
      count,
      remaining: Math.max(options.limit - count, 0),
      retryAfterSeconds
    };
  }

  const prisma = requirePrisma();
  const windowStart = new Date(windowStartMs);
  const expiresAt = new Date(
    windowStartMs + options.windowSeconds * 1000
  );

  const bucket = await prisma.securityRateLimitBucket.upsert({
    where: {
      keyHash_action_windowStart: {
        keyHash,
        action: options.action,
        windowStart
      }
    },
    create: {
      keyHash,
      action: options.action,
      windowStart,
      expiresAt,
      count: 1
    },
    update: {
      count: { increment: 1 },
      expiresAt
    },
    select: { count: true }
  });

  try {
    assertRateLimitCount(bucket.count, options.limit);
  } catch {
    throw new RateLimitExceededError(retryAfterSeconds);
  }

  if (bucket.count === 1) {
    await prisma.securityRateLimitBucket.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(nowMs - 24 * 60 * 60 * 1000)
        }
      }
    });
  }

  return {
    count: bucket.count,
    remaining: Math.max(options.limit - bucket.count, 0),
    retryAfterSeconds
  };
}
