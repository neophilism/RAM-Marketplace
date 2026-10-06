import type { DisputeResolutionType } from "@/lib/dispute-policy";

export interface PrototypeOrderDispute {
  id: string;
  orderId: string;
  status: "OPEN" | "RESOLVED";
  reason: string;
  openedByUserId: string;
  openedAt: string;
  resolutionType?: DisputeResolutionType;
  resolutionNotes?: string;
  resolvedByUserId?: string;
  resolvedAt?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __ramPrototypeOrderDisputes: PrototypeOrderDispute[] | undefined;
}

function records() {
  if (!globalThis.__ramPrototypeOrderDisputes) {
    globalThis.__ramPrototypeOrderDisputes = [];
  }
  return globalThis.__ramPrototypeOrderDisputes;
}

export function listPrototypeOrderDisputes() {
  return [...records()];
}

export function getPrototypeOrderDispute(id: string) {
  return records().find((dispute) => dispute.id === id);
}

export function getPrototypeOrderDisputeForOrder(orderId: string) {
  return records().find((dispute) => dispute.orderId === orderId);
}

export function createPrototypeOrderDispute(input: {
  orderId: string;
  reason: string;
  openedByUserId: string;
}) {
  if (getPrototypeOrderDisputeForOrder(input.orderId)) {
    throw new Error("Order dispute already exists");
  }

  const dispute: PrototypeOrderDispute = {
    id: `OD-${String(records().length + 1).padStart(6, "0")}`,
    orderId: input.orderId,
    status: "OPEN",
    reason: input.reason,
    openedByUserId: input.openedByUserId,
    openedAt: new Date().toISOString()
  };
  records().unshift(dispute);
  return dispute;
}

export function resolvePrototypeOrderDispute(
  id: string,
  input: {
    resolutionType: DisputeResolutionType;
    resolutionNotes: string;
    resolvedByUserId: string;
  }
) {
  const dispute = getPrototypeOrderDispute(id);
  if (!dispute) throw new Error("Order dispute not found");
  if (dispute.status !== "OPEN") throw new Error("Order dispute is already resolved");

  dispute.status = "RESOLVED";
  dispute.resolutionType = input.resolutionType;
  dispute.resolutionNotes = input.resolutionNotes;
  dispute.resolvedByUserId = input.resolvedByUserId;
  dispute.resolvedAt = new Date().toISOString();
  return dispute;
}
