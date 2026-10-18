import { createHash } from "node:crypto";

/** A revision is a review artifact, never a live movement permission. */
export interface RuleDraftInput {
  ruleId: string;
  originState: string;
  destinationState: string;
  species: string;
  conditionFamily: string;
  prohibited: boolean;
  rationale: string;
  sourceReferences: readonly string[];
  effectiveFrom: string;
  effectiveUntil: string;
  authorId: string;
}

export interface RuleDraft extends RuleDraftInput {
  revision: number;
  status: "DRAFT";
  sourceReferences: readonly string[];
  digest: string;
}

const stateCode = /^[A-Z]{2}$/;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function normalized(input: RuleDraftInput): RuleDraftInput {
  if (!input.ruleId.trim() || !input.authorId.trim()) throw new Error("rule and author are required");
  if (!stateCode.test(input.originState) || !stateCode.test(input.destinationState)) {
    throw new Error("origin and destination must be state codes");
  }
  if (!input.species.trim() || !input.conditionFamily.trim() || !input.rationale.trim()) {
    throw new Error("species, condition family and rationale are required");
  }
  if (typeof input.prohibited !== "boolean") throw new Error("prohibited must be boolean");
  for (const date of [input.effectiveFrom, input.effectiveUntil]) {
    if (!isoDate.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
        new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
      throw new Error("effective dates must be valid ISO calendar dates");
    }
  }
  if (input.effectiveFrom > input.effectiveUntil) throw new Error("effective interval is reversed");
  const sources = [...new Set(input.sourceReferences.map((value) => value.trim()))].sort();
  if (sources.length === 0 || sources.some((value) => !value)) {
    throw new Error("at least one nonempty source reference is required");
  }
  return {
    ruleId: input.ruleId.trim(),
    originState: input.originState,
    destinationState: input.destinationState,
    species: input.species.trim(),
    conditionFamily: input.conditionFamily.trim(),
    prohibited: input.prohibited,
    rationale: input.rationale.trim(),
    sourceReferences: sources,
    effectiveFrom: input.effectiveFrom,
    effectiveUntil: input.effectiveUntil,
    authorId: input.authorId.trim()
  };
}

function build(input: RuleDraftInput, revision: number): RuleDraft {
  const fields = normalized(input);
  const digest = createHash("sha256").update(JSON.stringify({ ...fields, revision, status: "DRAFT" })).digest("hex");
  return { ...fields, revision, status: "DRAFT", digest };
}

export function createRuleDraft(input: RuleDraftInput): RuleDraft {
  return build(input, 1);
}

/** Optimistic revision boundary; callers must persist the compare-and-swap atomically. */
export function reviseRuleDraft(current: RuleDraft, expectedDigest: string, input: RuleDraftInput): RuleDraft {
  if (current.status !== "DRAFT" || current.digest !== expectedDigest) throw new Error("stale or non-draft rule revision");
  if (input.ruleId !== current.ruleId) throw new Error("rule identity cannot change during revision");
  const verifiedCurrent = build(current, current.revision);
  if (verifiedCurrent.digest !== current.digest) throw new Error("current rule revision has been altered");
  return build(input, current.revision + 1);
}
