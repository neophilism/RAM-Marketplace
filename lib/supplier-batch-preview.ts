import { createHash } from "node:crypto";
import { animalSubmissionSchema } from "./validation";

export const MAX_BATCH_ROWS = 100;
export const MAX_BATCH_BYTES = 262_144;

export function assertSupplierPreviewRole(role: string): void {
  if (role !== "SUPPLIER_OWNER_ADMIN" && role !== "SUPPLIER_STAFF") {
    throw new Error("Forbidden: supplier membership required");
  }
}

interface PreviewRow {
  index: number;
  externalAnimalId: string | null;
  valid: boolean;
  issues: string[];
  digest: string | null;
}

export interface BatchPreview {
  batchKey: string;
  acceptedForReview: boolean;
  rowCount: number;
  rows: PreviewRow[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Preview only: no candidate is created, published, priced or dispatched. */
export function previewSupplierBatch(organizationId: string, payload: unknown): BatchPreview {
  if (!organizationId.trim()) throw new Error("organization is required");
  if (!record(payload) || Object.keys(payload).some((key) => !["batchKey", "rows"].includes(key))) {
    throw new Error("invalid batch envelope");
  }
  const batchKey = payload.batchKey;
  if (typeof batchKey !== "string" || !/^[A-Za-z0-9_-]{8,120}$/.test(batchKey)) {
    throw new Error("invalid batch key");
  }
  if (!Array.isArray(payload.rows) || payload.rows.length < 1 || payload.rows.length > MAX_BATCH_ROWS) {
    throw new Error(`batch must have 1 to ${MAX_BATCH_ROWS} rows`);
  }

  const seenIds = new Set<string>();
  const rows: PreviewRow[] = payload.rows.map((value: unknown, index: number) => {
    const issues: string[] = [];
    if (!record(value) || Object.keys(value).some((key) => !["externalAnimalId", "submission"].includes(key))) {
      return { index, externalAnimalId: null, valid: false, issues: ["invalid row envelope"], digest: null };
    }
    const id = value.externalAnimalId;
    const externalAnimalId = typeof id === "string" && /^[A-Za-z0-9._:-]{1,120}$/.test(id) ? id : null;
    if (!externalAnimalId) issues.push("invalid external animal ID");
    else {
      const normalizedId = externalAnimalId.toUpperCase();
      if (seenIds.has(normalizedId)) issues.push("duplicate external animal ID in batch");
      seenIds.add(normalizedId);
    }

    const submission = value.submission;
    if (!record(submission)) issues.push("submission must be an object");
    else if (Object.keys(submission).some((key) => !Object.prototype.hasOwnProperty.call(animalSubmissionSchema.shape, key))) {
      issues.push("unknown submission field");
    }
    const parsed = animalSubmissionSchema.safeParse(submission);
    if (!parsed.success) issues.push(...parsed.error.issues.map((issue) => issue.path.join(".") || "submission"));
    const valid = issues.length === 0;
    const digest = valid && parsed.success ? createHash("sha256").update(JSON.stringify({
      organizationId, batchKey, externalAnimalId, submission: parsed.data
    })).digest("hex") : null;
    return { index, externalAnimalId, valid, issues: [...new Set(issues)], digest };
  });
  return { batchKey, acceptedForReview: rows.every((row) => row.valid), rowCount: rows.length, rows };
}

/** Reject oversized payloads while reading, including absent or false Content-Length. */
export async function readBatchJson(request: Request): Promise<unknown> {
  if (!request.body) throw new Error("batch body is required");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BATCH_BYTES) {
        await reader.cancel();
        throw new Error("batch body exceeds limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
