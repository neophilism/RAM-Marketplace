import { PILOT_MANUAL_GATES } from "./pilot-readiness";

export type PilotGateEffectiveStatus = "PENDING" | "VERIFIED" | "EXPIRED";
export interface PilotGateEvidence {
  status?: string;
  ownerUserId?: string | null;
  verifiedByUserId?: string | null;
  evidenceSummary?: string | null;
  verifiedAt?: Date | null;
  reviewDueAt?: Date | null;
}

function boundedText(value: unknown, minimum: number, label: string): string {
  if (typeof value !== "string" || value.length > 4000 || value.trim().length < minimum) {
    throw new Error(label + " must contain meaningful text within the 4000-character limit");
  }
  return value.trim();
}
export function pilotVerificationEvidence(value: unknown): string {
  return boundedText(value, 10, "Pilot verification evidence");
}
export function pilotResetReason(value: unknown): string {
  return boundedText(value, 3, "Pilot reset reason");
}
function validDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}
function identity(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Assess persisted evidence only; this function never grants verification authority. */
export function pilotGateEffectiveStatus(record: PilotGateEvidence | null | undefined, now: Date): PilotGateEffectiveStatus {
  if (!record || record.status !== "VERIFIED" || !validDate(now) ||
      !identity(record.ownerUserId) || !identity(record.verifiedByUserId) ||
      !validDate(record.verifiedAt) || record.verifiedAt.getTime() > now.getTime()) return "PENDING";
  try { pilotVerificationEvidence(record.evidenceSummary); } catch { return "PENDING"; }
  if (record.reviewDueAt != null && (!validDate(record.reviewDueAt) || record.reviewDueAt.getTime() <= now.getTime())) {
    return "EXPIRED";
  }
  return "VERIFIED";
}

/** Every canonical gate must be present exactly once. Empty or partial data is not readiness. */
export function pilotGateSummary(gates: readonly { key?: string; effectiveStatus: PilotGateEffectiveStatus }[]) {
  const required = new Set<string>(PILOT_MANUAL_GATES.map((gate) => gate.key));
  const seen = new Set<string>();
  let complete = gates.length === required.size;
  for (const gate of gates) {
    if (typeof gate.key !== "string" || !required.has(gate.key) || seen.has(gate.key)) complete = false;
    else seen.add(gate.key);
  }
  const verified = gates.filter((gate) => gate.effectiveStatus === "VERIFIED").length;
  const expired = gates.filter((gate) => gate.effectiveStatus === "EXPIRED").length;
  return { total: gates.length, verified, expired, pending: gates.length - verified - expired,
    ready: complete && seen.size === required.size && verified === required.size };
}
