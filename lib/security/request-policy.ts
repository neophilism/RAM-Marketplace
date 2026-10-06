export const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface MutationRequestMetadata {
  method: string;
  origin?: string | null;
  referer?: string | null;
  host?: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  secFetchSite?: string | null;
  contentLength?: string | null;
}

function normalizedHost(value?: string | null) {
  return (value ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
}

function requestOrigin(metadata: MutationRequestMetadata) {
  const host = normalizedHost(metadata.forwardedHost || metadata.host);
  if (!host) return null;
  const proto = (metadata.forwardedProto ?? "https").split(",")[0]?.trim() || "https";
  return `${proto}://${host}`;
}

function sourceOrigin(metadata: MutationRequestMetadata) {
  const raw = metadata.origin || metadata.referer;
  if (!raw) return null;
  try {
    return new URL(raw).origin.toLowerCase();
  } catch {
    return null;
  }
}

export function assertSameOriginMutation(
  metadata: MutationRequestMetadata,
  options: { production: boolean }
) {
  if (SAFE_METHODS.has(metadata.method.toUpperCase())) return;

  if ((metadata.secFetchSite ?? "").toLowerCase() === "cross-site") {
    throw new Error("Cross-site mutation request blocked");
  }

  const expected = requestOrigin(metadata)?.toLowerCase();
  const supplied = sourceOrigin(metadata);

  if (supplied && expected && supplied === expected) return;

  if (!options.production && !supplied) {
    // Permit curl/tests during local development. Production fails closed.
    return;
  }

  throw new Error("Mutation request failed same-origin validation");
}

export function assertMutationBodySize(
  metadata: MutationRequestMetadata,
  maxBytes: number
) {
  if (SAFE_METHODS.has(metadata.method.toUpperCase())) return;
  const raw = metadata.contentLength;
  if (!raw) return;

  const bytes = Number(raw);
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new Error("Invalid Content-Length");
  }
  if (bytes > maxBytes) {
    throw new Error("Mutation request body exceeds configured limit");
  }
}


export function mutationBodyLimitBytes(raw: string | undefined) {
  if (!raw) return 1_048_576;
  const value = Number(raw);
  if (
    !Number.isInteger(value) ||
    value < 16_384 ||
    value > 10_485_760
  ) {
    throw new Error(
      "RAM_MAX_MUTATION_BYTES must be an integer between 16384 and 10485760"
    );
  }
  return value;
}
