import type { DisclosureTier } from "./domain";

export const DISCLOSURE_FIELDS = [
  "GENERAL_HUSBANDRY",
  "COUNTY",
  "FARM_IDENTITY"
] as const;

export type DisclosureField = (typeof DISCLOSURE_FIELDS)[number];

export interface FarmDisclosureRules {
  shareGeneralHusbandry: boolean;
  shareCountyAfterNda: boolean;
  shareIdentityPrePurchase: boolean;
  shareIdentityPostPurchase: boolean;
}

export type BuyerMilestone = "NONE" | "RESERVED" | "BUYER_COMMITTED";

export function buyerMilestoneForOrderStatus(
  status: string | null | undefined
): BuyerMilestone {
  if (status === "CANDIDATE_HELD" || status === "CHECKOUT_PENDING") {
    return "RESERVED";
  }

  if (
    [
      "BUYER_COMMITTED",
      "ACQUISITION_COMMITTED",
      "CLEARANCE_PENDING",
      "READY_FOR_PICKUP",
      "IN_TRANSIT",
      "DELIVERED",
      "ACCEPTED",
      "SETTLED",
      "CLOSED",
      "CLEARANCE_FAILED",
      "DISPUTED"
    ].includes(status ?? "")
  ) {
    return "BUYER_COMMITTED";
  }

  return "NONE";
}

export interface DisclosurePolicyDecision {
  ndaRequired: boolean;
  supplierApprovalRequired: boolean;
  reasons: string[];
}

export function evaluateDisclosurePolicy(input: {
  requestedFields: DisclosureField[];
  farmPolicy: FarmDisclosureRules;
  buyerMilestone: BuyerMilestone;
  sourceDisclosure: DisclosureTier;
}): DisclosurePolicyDecision {
  const reasons: string[] = [];
  let ndaRequired = false;
  let supplierApprovalRequired = false;

  if (input.sourceDisclosure === "RAM_INTERNAL_ONLY") {
    throw new Error("This source record is not externally requestable");
  }

  if (input.sourceDisclosure === "PUBLIC_ANONYMIZED") {
    throw new Error("This source record is limited to its public anonymized profile");
  }

  if (
    input.sourceDisclosure === "POST_RESERVATION" &&
    input.buyerMilestone === "NONE"
  ) {
    throw new Error("Additional source information is available only after reservation");
  }

  if (
    input.sourceDisclosure === "POST_PURCHASE" &&
    input.buyerMilestone !== "BUYER_COMMITTED"
  ) {
    throw new Error("Additional source information is available only after buyer commitment");
  }

  for (const field of input.requestedFields) {
    if (field === "GENERAL_HUSBANDRY") {
      if (!input.farmPolicy.shareGeneralHusbandry) {
        supplierApprovalRequired = true;
        reasons.push("General husbandry is not pre-authorized by the farm policy.");
      } else {
        reasons.push("General husbandry is pre-authorized by the farm policy.");
      }
    }

    if (field === "COUNTY") {
      ndaRequired = true;
      if (!input.farmPolicy.shareCountyAfterNda) {
        supplierApprovalRequired = true;
        reasons.push("County disclosure requires case-specific farm approval.");
      } else {
        reasons.push("County disclosure is pre-authorized after NDA acceptance.");
      }
    }

    if (field === "FARM_IDENTITY") {
      ndaRequired = true;
      if (input.farmPolicy.shareIdentityPrePurchase) {
        reasons.push("Farm identity is pre-authorized before purchase.");
      } else if (
        input.buyerMilestone === "BUYER_COMMITTED" &&
        input.farmPolicy.shareIdentityPostPurchase
      ) {
        reasons.push("Farm identity is pre-authorized after buyer commitment.");
      } else {
        supplierApprovalRequired = true;
        reasons.push("Farm identity requires case-specific farm approval.");
      }
    }
  }

  return {
    ndaRequired,
    supplierApprovalRequired,
    reasons
  };
}

function escapeRegExp(value: string) {
  const slash = String.fromCharCode(92);
  const special = "^$.*+?()[]{}|" + slash;

  return value
    .split("")
    .map((character) =>
      special.includes(character) ? slash + character : character
    )
    .join("");
}

export function sanitizeRestrictedNarrative(
  value: string,
  sourceIdentifiers: Array<string | null | undefined>
) {
  let sanitized = value;

  for (const identifier of sourceIdentifiers) {
    const trimmed = identifier?.trim();
    if (!trimmed) continue;
    sanitized = sanitized.replace(
      new RegExp(escapeRegExp(trimmed), "gi"),
      "[redacted source identifier]"
    );
  }

  sanitized = sanitized
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]")
    .replace(/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, "[redacted phone]")
    .replace(/\b-?\d{1,2}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}\b/g, "[redacted coordinates]");

  return sanitized;
}
