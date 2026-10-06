import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { SessionPrincipal } from "@/lib/auth/token";
import {
  assertBlindAcquisitionProjection,
  assertBuyerOrderProjection
} from "@/lib/commercial-privacy";
import { requireCapability } from "@/lib/access";
import { canAdvanceOrder } from "@/lib/order-policy";
import {
  assertCandidateTransition,
  assertOrderTransition
} from "@/lib/state-machines";
import {
  canTransitionResearchNeed,
  requireResearchNeedTransition,
  type ResearchNeedStatus
} from "@/lib/workflows";
import {
  calculateIndependentSupplierCommitment,
  countBlockingClearanceFindings,
  createQuoteSnapshot,
  DEFAULT_HOLD_HOURS,
  DEFAULT_QUOTE_HOURS,
  expiresAt,
  isExpired
} from "@/lib/transaction-policy";
import type {
  BuyerCommitmentInput,
  ClearanceReviewInput,
  ReserveOrderInput,
  SupplierPricingPolicyInput
} from "@/lib/validation";
import { dataBackend, requirePrisma } from "@/lib/server/db";
import {
  getPrototypeActivePricingPolicy,
  getPrototypeAnimal,
  getPrototypeMatchesForNeed,
  getPrototypeOrder,
  getPrototypeOrders,
  getPrototypePricingPolicies,
  getPrototypeResearchNeed,
  savePrototypeOrder,
  savePrototypePricingPolicy,
  updatePrototypeAnimal,
  updatePrototypeOrder,
  updatePrototypeResearchNeed
} from "@/lib/server/prototype-store";

const ACTIVE_ORDER_STATUSES = [
  "DRAFT",
  "CANDIDATE_HELD",
  "CHECKOUT_PENDING",
  "BUYER_COMMITTED",
  "ACQUISITION_COMMITTED",
  "CLEARANCE_PENDING",
  "READY_FOR_PICKUP",
  "IN_TRANSIT",
  "DELIVERED",
  "ACCEPTED",
  "SETTLED",
  "DISPUTED"
] as const;

export interface BuyerOrderSummary {
  id: string;
  animalCaseId: string;
  species: string;
  condition: string;
  researchNeedId: string;
  researchNeedTitle: string;
  status: string;
  buyerPriceCents: number | null;
  holdExpiresAt: string | null;
  quoteExpiresAt: string | null;
  createdAt: string;
}

export interface BuyerOrderDetail extends BuyerOrderSummary {
  buyerPriceComponents: Record<string, number>;
  receivingFacilityName: string | null;
  receivingFacilityAddress: string | null;
  protocolReference: string | null;
  institutionalApprovalAttested: boolean;
  purchasingAuthorityAttested: boolean;
  buyerCommittedAt: string | null;
  acquisitionCommitted: boolean;
  clearanceDecision: string | null;
  clearanceNotes: string | null;
}

export interface PricingPolicyView {
  id: string;
  species: string;
  standardizedCullScheduleCents: number;
  marketCeilingCents: number;
  active: boolean;
  effectiveFrom: string;
}

export interface FinanceOrderSummary {
  id: string;
  animalCaseId: string;
  species: string;
  condition: string;
  status: string;
  pricingPolicy: PricingPolicyView | null;
}

export interface ComplianceOrderSummary {
  id: string;
  animalCaseId: string;
  species: string;
  condition: string;
  buyerOrganizationName: string;
  researchNeedTitle: string;
  status: string;
  protocolReference: string | null;
}

function recordOfNumbers(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1])
    )
  );
}

function lines(value: string | null | undefined) {
  return (value ?? "")
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function resetNeedTarget(status: ResearchNeedStatus) {
  if (status === "INSTITUTIONAL_CLEARANCE") return "SELECTED" as const;
  if (status === "SELECTED") return "MATCH_REVIEW" as const;
  if (status === "MATCH_REVIEW") return "ACTIVE" as const;
  return null;
}

function validateNeedResetPath(status: ResearchNeedStatus) {
  let current = status;
  const steps: ResearchNeedStatus[] = [];
  while (current !== "ACTIVE") {
    const next = resetNeedTarget(current);
    if (!next) break;
    requireResearchNeedTransition(current, next);
    steps.push(next);
    current = next;
  }
  return { finalStatus: current, steps };
}

async function expirePrototypeOrder(id: string, now = new Date()) {
  const order = getPrototypeOrder(id);
  if (!order) return;
  if (
    !["DRAFT", "CANDIDATE_HELD", "CHECKOUT_PENDING"].includes(order.status) ||
    !isExpired(order.holdExpiresAt, now)
  ) {
    return;
  }

  assertOrderTransition(order.status as never, "EXPIRED");
  updatePrototypeOrder(id, { status: "EXPIRED" });

  const animal = getPrototypeAnimal(order.animalCaseId);
  if (animal?.status === "RESERVED") {
    assertCandidateTransition("RESERVED", "MATCHABLE");
    updatePrototypeAnimal(order.animalCaseId, { status: "MATCHABLE" });
  }

  const need = getPrototypeResearchNeed(order.researchNeedId);
  if (need) {
    const reset = validateNeedResetPath(need.status as ResearchNeedStatus);
    if (reset.finalStatus === "ACTIVE") {
      updatePrototypeResearchNeed(order.researchNeedId, { status: "ACTIVE" });
    }
  }
}

export async function expireStaleHolds(now = new Date()) {
  if (dataBackend() === "prototype") {
    for (const order of getPrototypeOrders()) {
      await expirePrototypeOrder(order.id, now);
    }
    return;
  }

  const prisma = requirePrisma();
  const stale = await prisma.order.findMany({
    where: {
      status: { in: ["DRAFT", "CANDIDATE_HELD", "CHECKOUT_PENDING"] },
      holdExpiresAt: { lte: now }
    },
    select: {
      id: true,
      status: true,
      animalCaseId: true,
      researchNeedId: true
    }
  });

  for (const order of stale) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.order.findUnique({
        where: { id: order.id },
        select: {
          status: true,
          animalCaseId: true,
          researchNeedId: true
        }
      });
      if (
        !fresh ||
        !["DRAFT", "CANDIDATE_HELD", "CHECKOUT_PENDING"].includes(fresh.status)
      ) {
        return;
      }

      assertOrderTransition(fresh.status, "EXPIRED");
      await tx.order.update({
        where: { id: order.id },
        data: { status: "EXPIRED" }
      });

      const animal = await tx.animalCase.findUnique({
        where: { publicId: fresh.animalCaseId },
        select: { status: true }
      });
      if (animal?.status === "RESERVED") {
        assertCandidateTransition("RESERVED", "MATCHABLE");
        await tx.animalCase.update({
          where: { publicId: fresh.animalCaseId },
          data: { status: "MATCHABLE" }
        });
      }

      const need = await tx.researchNeed.findUnique({
        where: { id: fresh.researchNeedId },
        select: { status: true }
      });
      if (need) {
        const reset = validateNeedResetPath(need.status);
        if (reset.finalStatus === "ACTIVE" && need.status !== "ACTIVE") {
          await tx.researchNeed.update({
            where: { id: fresh.researchNeedId },
            data: { status: "ACTIVE" }
          });
        }
      }

      await tx.researchMatch.updateMany({
        where: {
          researchNeedId: fresh.researchNeedId,
          animalCaseId: fresh.animalCaseId,
          status: "SELECTED"
        },
        data: { status: "CANDIDATE" }
      });

      await tx.auditEvent.create({
        data: {
          action: "ORDER_HOLD_EXPIRED",
          entityType: "Order",
          entityId: order.id,
          previousState: { status: fresh.status },
          nextState: { status: "EXPIRED" }
        }
      });
    });
  }
}

export async function reserveMatchedCandidate(
  principal: SessionPrincipal,
  input: ReserveOrderInput
) {
  requireCapability(principal.role, "order:reserve");
  await expireStaleHolds();

  const now = new Date();
  const holdExpiresAt = expiresAt(DEFAULT_HOLD_HOURS, now);
  const quoteExpiresAt = expiresAt(DEFAULT_QUOTE_HOURS, now);

  if (dataBackend() === "prototype") {
    const animal = getPrototypeAnimal(input.animalCaseId);
    const need = getPrototypeResearchNeed(input.researchNeedId);
    if (!animal || !need) throw new Error("Candidate or research need not found");
    if (animal.status !== "MATCHABLE") throw new Error("Candidate is not available");
    if (!["ACTIVE", "MATCH_REVIEW"].includes(need.status)) {
      throw new Error("Research need is not active for selection");
    }
    if (
      !getPrototypeMatchesForNeed(input.researchNeedId).some(
        (match) => match.animalCaseId === input.animalCaseId && match.eligible
      )
    ) {
      throw new Error("Candidate is not an eligible match for this research need");
    }
    if (
      getPrototypeOrders().some(
        (order) =>
          order.animalCaseId === input.animalCaseId &&
          ACTIVE_ORDER_STATUSES.includes(order.status as never)
      )
    ) {
      throw new Error("Candidate already has an active order");
    }
    if (animal.listPriceCents == null) throw new Error("Candidate has no buyer price");

    assertCandidateTransition("MATCHABLE", "RESERVED");
    if (need.status === "ACTIVE") {
      requireResearchNeedTransition("ACTIVE", "MATCH_REVIEW");
    }
    requireResearchNeedTransition(
      need.status === "ACTIVE" ? "MATCH_REVIEW" : "MATCH_REVIEW",
      "SELECTED"
    );
    assertOrderTransition("DRAFT", "CANDIDATE_HELD");
    assertOrderTransition("CANDIDATE_HELD", "CHECKOUT_PENDING");

    const quote = createQuoteSnapshot(animal.listPriceCents);
    const order = savePrototypeOrder({
      animalCaseId: input.animalCaseId,
      buyerOrganizationId: principal.organizationId,
      researchNeedId: input.researchNeedId,
      createdByUserId: principal.userId,
      status: "CHECKOUT_PENDING",
      buyerPriceCents: quote.buyerPriceCents,
      buyerPriceComponents: quote.buyerPriceComponents,
      directCostsCents: 0,
      holdExpiresAt: holdExpiresAt.toISOString(),
      quoteIssuedAt: now.toISOString(),
      quoteExpiresAt: quoteExpiresAt.toISOString(),
      institutionalApprovalAttested: false,
      purchasingAuthorityAttested: false
    });
    updatePrototypeAnimal(input.animalCaseId, { status: "RESERVED" });
    updatePrototypeResearchNeed(input.researchNeedId, { status: "SELECTED" });
    return order;
  }

  const prisma = requirePrisma();

  return prisma.$transaction(async (tx) => {
    const [animal, need, match, activeOrder] = await Promise.all([
      tx.animalCase.findUnique({
        where: { publicId: input.animalCaseId },
        select: {
          publicId: true,
          status: true,
          listPriceCents: true
        }
      }),
      tx.researchNeed.findUnique({
        where: { id: input.researchNeedId },
        select: {
          id: true,
          organizationId: true,
          status: true
        }
      }),
      tx.researchMatch.findUnique({
        where: {
          researchNeedId_animalCaseId: {
            researchNeedId: input.researchNeedId,
            animalCaseId: input.animalCaseId
          }
        },
        select: { id: true, status: true }
      }),
      tx.order.findFirst({
        where: {
          animalCaseId: input.animalCaseId,
          status: { in: [...ACTIVE_ORDER_STATUSES] }
        },
        select: { id: true }
      })
    ]);

    if (!animal || !need) throw new Error("Candidate or research need not found");
    if (need.organizationId !== principal.organizationId) {
      throw new Error("Forbidden: research need belongs to another organization");
    }
    if (animal.status !== "MATCHABLE") throw new Error("Candidate is not available");
    if (!["ACTIVE", "MATCH_REVIEW"].includes(need.status)) {
      throw new Error("Research need is not active for selection");
    }
    if (!match) {
      throw new Error("Candidate is not an eligible match for this research need");
    }
    if (activeOrder) throw new Error("Candidate already has an active order");
    if (animal.listPriceCents == null) throw new Error("Candidate has no buyer price");

    assertCandidateTransition(animal.status, "RESERVED");
    let needState = need.status;
    if (needState === "ACTIVE") {
      requireResearchNeedTransition("ACTIVE", "MATCH_REVIEW");
      needState = "MATCH_REVIEW";
    }
    requireResearchNeedTransition(needState, "SELECTED");
    assertOrderTransition("DRAFT", "CANDIDATE_HELD");
    assertOrderTransition("CANDIDATE_HELD", "CHECKOUT_PENDING");

    const quote = createQuoteSnapshot(animal.listPriceCents);
    const created = await tx.order.create({
      data: {
        animalCaseId: input.animalCaseId,
        buyerOrganizationId: principal.organizationId,
        researchNeedId: input.researchNeedId,
        createdByUserId: principal.userId,
        status: "DRAFT",
        directCostsCents: 0
      }
    });

    await tx.order.update({
      where: { id: created.id },
      data: {
        status: "CANDIDATE_HELD",
        holdExpiresAt
      }
    });

    const order = await tx.order.update({
      where: { id: created.id },
      data: {
        status: "CHECKOUT_PENDING",
        buyerPriceCents: quote.buyerPriceCents,
        buyerPriceComponents: quote.buyerPriceComponents as Prisma.InputJsonValue,
        quoteIssuedAt: now,
        quoteExpiresAt
      }
    });

    const claimed = await tx.animalCase.updateMany({
      where: {
        publicId: input.animalCaseId,
        status: "MATCHABLE"
      },
      data: { status: "RESERVED" }
    });
    if (claimed.count !== 1) {
      throw new Error("Candidate was reserved by another buyer");
    }

    await tx.researchNeed.update({
      where: { id: input.researchNeedId },
      data: { status: "SELECTED" }
    });
    await tx.researchMatch.update({
      where: { id: match.id },
      data: { status: "SELECTED" }
    });

    await tx.auditEvent.createMany({
      data: [
        {
          actorUserId: principal.userId,
          organizationId: principal.organizationId,
          action: "CANDIDATE_RESERVED",
          entityType: "AnimalCase",
          entityId: input.animalCaseId,
          previousState: { status: "MATCHABLE" },
          nextState: { status: "RESERVED", orderId: created.id }
        },
        {
          actorUserId: principal.userId,
          organizationId: principal.organizationId,
          action: "ORDER_QUOTE_ISSUED",
          entityType: "Order",
          entityId: created.id,
          previousState: { status: "DRAFT" },
          nextState: {
            status: "CHECKOUT_PENDING",
            buyerPriceCents: quote.buyerPriceCents,
            holdExpiresAt: holdExpiresAt.toISOString(),
            quoteExpiresAt: quoteExpiresAt.toISOString()
          }
        }
      ]
    });

    return order;
  });
}

export async function listBuyerOrders(
  principal: SessionPrincipal
): Promise<BuyerOrderSummary[]> {
  requireCapability(principal.role, "order:reserve");
  await expireStaleHolds();

  if (dataBackend() === "prototype") {
    return getPrototypeOrders()
      .filter((order) => order.buyerOrganizationId === principal.organizationId)
      .map((order) => {
        const animal = getPrototypeAnimal(order.animalCaseId);
        const need = getPrototypeResearchNeed(order.researchNeedId);
        return {
          id: order.id,
          animalCaseId: order.animalCaseId,
          species: animal?.species ?? "Unknown",
          condition: animal?.condition ?? "Unknown",
          researchNeedId: order.researchNeedId,
          researchNeedTitle: need?.title ?? "Research need",
          status: order.status,
          buyerPriceCents: order.buyerPriceCents ?? null,
          holdExpiresAt: order.holdExpiresAt ?? null,
          quoteExpiresAt: order.quoteExpiresAt ?? null,
          createdAt: order.createdAt
        };
      });
  }

  const prisma = requirePrisma();
  const rows = await prisma.order.findMany({
    where: { buyerOrganizationId: principal.organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      animalCaseId: true,
      status: true,
      buyerPriceCents: true,
      holdExpiresAt: true,
      quoteExpiresAt: true,
      createdAt: true,
      animalCase: {
        select: {
          species: true,
          condition: true
        }
      },
      researchNeed: {
        select: {
          id: true,
          title: true
        }
      }
    }
  });

  return rows.map((row) => {
    const projected = {
    id: row.id,
    animalCaseId: row.animalCaseId,
    species: row.animalCase.species,
    condition: row.animalCase.condition,
    researchNeedId: row.researchNeed.id,
    researchNeedTitle: row.researchNeed.title,
    status: row.status,
    buyerPriceCents: row.buyerPriceCents,
    holdExpiresAt: row.holdExpiresAt?.toISOString() ?? null,
    quoteExpiresAt: row.quoteExpiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString()
    };
    assertBuyerOrderProjection(projected as unknown as Record<string, unknown>);
    return projected;
  });
}

export async function getBuyerOrder(
  principal: SessionPrincipal,
  orderId: string
): Promise<BuyerOrderDetail> {
  requireCapability(principal.role, "order:reserve");
  await expireStaleHolds();

  if (dataBackend() === "prototype") {
    const order = getPrototypeOrder(orderId);
    if (!order || order.buyerOrganizationId !== principal.organizationId) {
      throw new Error("Order not found");
    }
    const animal = getPrototypeAnimal(order.animalCaseId);
    const need = getPrototypeResearchNeed(order.researchNeedId);
    return {
      id: order.id,
      animalCaseId: order.animalCaseId,
      species: animal?.species ?? "Unknown",
      condition: animal?.condition ?? "Unknown",
      researchNeedId: order.researchNeedId,
      researchNeedTitle: need?.title ?? "Research need",
      status: order.status,
      buyerPriceCents: order.buyerPriceCents ?? null,
      buyerPriceComponents: order.buyerPriceComponents ?? {},
      holdExpiresAt: order.holdExpiresAt ?? null,
      quoteExpiresAt: order.quoteExpiresAt ?? null,
      createdAt: order.createdAt,
      receivingFacilityName: order.receivingFacilityName ?? null,
      receivingFacilityAddress: order.receivingFacilityAddress ?? null,
      protocolReference: order.protocolReference ?? null,
      institutionalApprovalAttested: order.institutionalApprovalAttested,
      purchasingAuthorityAttested: order.purchasingAuthorityAttested,
      buyerCommittedAt: order.buyerCommittedAt ?? null,
      acquisitionCommitted: Boolean(order.acquisitionCommittedAt),
      clearanceDecision: order.clearance?.decision ?? null,
      clearanceNotes: order.clearance?.notes ?? null
    };
  }

  const prisma = requirePrisma();
  const row = await prisma.order.findFirst({
    where: {
      id: orderId,
      buyerOrganizationId: principal.organizationId
    },
    select: {
      id: true,
      animalCaseId: true,
      status: true,
      buyerPriceCents: true,
      buyerPriceComponents: true,
      holdExpiresAt: true,
      quoteExpiresAt: true,
      createdAt: true,
      receivingFacilityName: true,
      receivingFacilityAddress: true,
      protocolReference: true,
      institutionalApprovalAttested: true,
      purchasingAuthorityAttested: true,
      buyerCommittedAt: true,
      acquisitionCommittedAt: true,
      animalCase: {
        select: {
          species: true,
          condition: true
        }
      },
      researchNeed: {
        select: {
          id: true,
          title: true
        }
      },
      clearance: {
        select: {
          decision: true,
          notes: true
        }
      }
    }
  });
  if (!row) throw new Error("Order not found");

  const projected = {
    id: row.id,
    animalCaseId: row.animalCaseId,
    species: row.animalCase.species,
    condition: row.animalCase.condition,
    researchNeedId: row.researchNeed.id,
    researchNeedTitle: row.researchNeed.title,
    status: row.status,
    buyerPriceCents: row.buyerPriceCents,
    buyerPriceComponents: recordOfNumbers(row.buyerPriceComponents),
    holdExpiresAt: row.holdExpiresAt?.toISOString() ?? null,
    quoteExpiresAt: row.quoteExpiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    receivingFacilityName: row.receivingFacilityName,
    receivingFacilityAddress: row.receivingFacilityAddress,
    protocolReference: row.protocolReference,
    institutionalApprovalAttested: row.institutionalApprovalAttested,
    purchasingAuthorityAttested: row.purchasingAuthorityAttested,
    buyerCommittedAt: row.buyerCommittedAt?.toISOString() ?? null,
    acquisitionCommitted: Boolean(row.acquisitionCommittedAt),
    clearanceDecision: row.clearance?.decision ?? null,
    clearanceNotes: row.clearance?.notes ?? null
  };
  assertBuyerOrderProjection(projected as unknown as Record<string, unknown>);
  return projected;
}

export async function commitBuyerOrder(
  principal: SessionPrincipal,
  input: BuyerCommitmentInput
) {
  requireCapability(principal.role, "order:buyer_commit");

  if (dataBackend() === "prototype") {
    const order = getPrototypeOrder(input.orderId);
    if (!order || order.buyerOrganizationId !== principal.organizationId) {
      throw new Error("Order not found");
    }
    if (order.status !== "CHECKOUT_PENDING") {
      throw new Error("Order is not awaiting buyer commitment");
    }
    if (isExpired(order.quoteExpiresAt) || isExpired(order.holdExpiresAt)) {
      await expirePrototypeOrder(order.id);
      throw new Error("Quote or reservation hold has expired");
    }
    assertOrderTransition("CHECKOUT_PENDING", "BUYER_COMMITTED");
    const need = getPrototypeResearchNeed(order.researchNeedId);
    if (need?.status === "SELECTED") {
      requireResearchNeedTransition("SELECTED", "INSTITUTIONAL_CLEARANCE");
      updatePrototypeResearchNeed(need.id, { status: "INSTITUTIONAL_CLEARANCE" });
    }
    return updatePrototypeOrder(order.id, {
      status: "BUYER_COMMITTED",
      receivingFacilityName: input.receivingFacilityName,
      receivingFacilityAddress: input.receivingFacilityAddress,
      protocolReference: input.protocolReference,
      institutionalApprovalAttested: input.institutionalApprovalAttested,
      purchasingAuthorityAttested: input.purchasingAuthorityAttested,
      buyerCommittedAt: new Date().toISOString()
    });
  }

  const prisma = requirePrisma();
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: {
        id: input.orderId,
        buyerOrganizationId: principal.organizationId
      },
      include: {
        researchNeed: {
          select: { status: true }
        }
      }
    });
    if (!order) throw new Error("Order not found");
    if (order.status !== "CHECKOUT_PENDING") {
      throw new Error("Order is not awaiting buyer commitment");
    }
    if (isExpired(order.quoteExpiresAt) || isExpired(order.holdExpiresAt)) {
      throw new Error("Quote or reservation hold has expired");
    }

    assertOrderTransition(order.status, "BUYER_COMMITTED");
    if (order.researchNeed.status === "SELECTED") {
      requireResearchNeedTransition("SELECTED", "INSTITUTIONAL_CLEARANCE");
      await tx.researchNeed.update({
        where: { id: order.researchNeedId },
        data: { status: "INSTITUTIONAL_CLEARANCE" }
      });
    }

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "BUYER_COMMITTED",
        receivingFacilityName: input.receivingFacilityName,
        receivingFacilityAddress: input.receivingFacilityAddress,
        protocolReference: input.protocolReference,
        institutionalApprovalAttested: input.institutionalApprovalAttested,
        purchasingAuthorityAttested: input.purchasingAuthorityAttested,
        buyerCommittedAt: new Date()
      }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "BUYER_COMMITTED_ORDER",
        entityType: "Order",
        entityId: order.id,
        previousState: { status: order.status },
        nextState: { status: "BUYER_COMMITTED" },
        metadata: {
          institutionalApprovalAttested: input.institutionalApprovalAttested,
          purchasingAuthorityAttested: input.purchasingAuthorityAttested,
          protocolReference: input.protocolReference
        }
      }
    });

    return updated;
  });
}

export async function cancelBuyerOrder(
  principal: SessionPrincipal,
  orderId: string
) {
  requireCapability(principal.role, "order:reserve");

  if (dataBackend() === "prototype") {
    const order = getPrototypeOrder(orderId);
    if (!order || order.buyerOrganizationId !== principal.organizationId) {
      throw new Error("Order not found");
    }
    if (!["DRAFT", "CANDIDATE_HELD", "CHECKOUT_PENDING", "BUYER_COMMITTED"].includes(order.status)) {
      throw new Error("Order can no longer be cancelled by the buyer");
    }
    assertOrderTransition(order.status as never, "BUYER_CANCELLED");
    updatePrototypeOrder(order.id, { status: "BUYER_CANCELLED" });
    const animal = getPrototypeAnimal(order.animalCaseId);
    if (animal?.status === "RESERVED") {
      assertCandidateTransition("RESERVED", "MATCHABLE");
      updatePrototypeAnimal(order.animalCaseId, { status: "MATCHABLE" });
    }
    const need = getPrototypeResearchNeed(order.researchNeedId);
    if (need) {
      const reset = validateNeedResetPath(need.status as ResearchNeedStatus);
      if (reset.finalStatus === "ACTIVE") {
        updatePrototypeResearchNeed(need.id, { status: "ACTIVE" });
      }
    }
    return order;
  }

  const prisma = requirePrisma();
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, buyerOrganizationId: principal.organizationId },
      include: {
        animalCase: { select: { status: true } },
        researchNeed: { select: { status: true } }
      }
    });
    if (!order) throw new Error("Order not found");
    if (!["DRAFT", "CANDIDATE_HELD", "CHECKOUT_PENDING", "BUYER_COMMITTED"].includes(order.status)) {
      throw new Error("Order can no longer be cancelled by the buyer");
    }

    assertOrderTransition(order.status, "BUYER_CANCELLED");
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: "BUYER_CANCELLED" }
    });

    if (order.animalCase.status === "RESERVED") {
      assertCandidateTransition("RESERVED", "MATCHABLE");
      await tx.animalCase.update({
        where: { publicId: order.animalCaseId },
        data: { status: "MATCHABLE" }
      });
    }

    const reset = validateNeedResetPath(order.researchNeed.status);
    if (reset.finalStatus === "ACTIVE" && order.researchNeed.status !== "ACTIVE") {
      await tx.researchNeed.update({
        where: { id: order.researchNeedId },
        data: { status: "ACTIVE" }
      });
    }
    await tx.researchMatch.updateMany({
      where: {
        researchNeedId: order.researchNeedId,
        animalCaseId: order.animalCaseId,
        status: "SELECTED"
      },
      data: { status: "CANDIDATE" }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "BUYER_CANCELLED_ORDER",
        entityType: "Order",
        entityId: order.id,
        previousState: { status: order.status },
        nextState: { status: "BUYER_CANCELLED" }
      }
    });

    return updated;
  });
}

export async function createSupplierPricingPolicy(
  principal: SessionPrincipal,
  input: SupplierPricingPolicyInput
): Promise<PricingPolicyView> {
  requireCapability(principal.role, "pricing:manage");
  const standardizedCullScheduleCents = Math.round(input.standardizedCullScheduleUsd * 100);
  const marketCeilingCents = Math.round(input.marketCeilingUsd * 100);

  calculateIndependentSupplierCommitment({
    standardizedCullScheduleCents,
    marketCeilingCents
  });

  if (dataBackend() === "prototype") {
    const policy = savePrototypePricingPolicy({
      species: input.species.trim(),
      standardizedCullScheduleCents,
      marketCeilingCents,
      active: true,
      createdByUserId: principal.userId
    });
    return {
      ...policy,
      effectiveFrom: policy.effectiveFrom
    };
  }

  const prisma = requirePrisma();
  const now = new Date();
  const policy = await prisma.$transaction(async (tx) => {
    await tx.supplierPricingPolicy.updateMany({
      where: {
        species: { equals: input.species.trim(), mode: "insensitive" },
        active: true
      },
      data: {
        active: false,
        effectiveTo: now
      }
    });

    const created = await tx.supplierPricingPolicy.create({
      data: {
        species: input.species.trim(),
        standardizedCullScheduleCents,
        marketCeilingCents,
        active: true,
        effectiveFrom: now,
        createdByUserId: principal.userId
      }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "SUPPLIER_PRICING_POLICY_CREATED",
        entityType: "SupplierPricingPolicy",
        entityId: created.id,
        nextState: {
          species: created.species,
          standardizedCullScheduleCents,
          marketCeilingCents,
          active: true
        }
      }
    });
    return created;
  });

  return {
    id: policy.id,
    species: policy.species,
    standardizedCullScheduleCents: policy.standardizedCullScheduleCents,
    marketCeilingCents: policy.marketCeilingCents,
    active: policy.active,
    effectiveFrom: policy.effectiveFrom.toISOString()
  };
}

export async function listSupplierPricingPolicies(
  principal: SessionPrincipal
): Promise<PricingPolicyView[]> {
  requireCapability(principal.role, "pricing:manage");

  if (dataBackend() === "prototype") {
    return getPrototypePricingPolicies().map((policy) => ({
      id: policy.id,
      species: policy.species,
      standardizedCullScheduleCents: policy.standardizedCullScheduleCents,
      marketCeilingCents: policy.marketCeilingCents,
      active: policy.active,
      effectiveFrom: policy.effectiveFrom
    }));
  }

  const prisma = requirePrisma();
  const rows = await prisma.supplierPricingPolicy.findMany({
    orderBy: [{ active: "desc" }, { effectiveFrom: "desc" }]
  });
  return rows.map((policy) => ({
    id: policy.id,
    species: policy.species,
    standardizedCullScheduleCents: policy.standardizedCullScheduleCents,
    marketCeilingCents: policy.marketCeilingCents,
    active: policy.active,
    effectiveFrom: policy.effectiveFrom.toISOString()
  }));
}

export async function listFinanceOrders(
  principal: SessionPrincipal
): Promise<FinanceOrderSummary[]> {
  requireCapability(principal.role, "order:acquisition_commit");

  if (dataBackend() === "prototype") {
    return getPrototypeOrders()
      .filter((order) => order.status === "BUYER_COMMITTED")
      .map((order) => {
        const animal = getPrototypeAnimal(order.animalCaseId);
        const policy = animal
          ? getPrototypeActivePricingPolicy(animal.species)
          : undefined;
        return {
          id: order.id,
          animalCaseId: order.animalCaseId,
          species: animal?.species ?? "Unknown",
          condition: animal?.condition ?? "Unknown",
          status: order.status,
          pricingPolicy: policy
            ? {
                id: policy.id,
                species: policy.species,
                standardizedCullScheduleCents: policy.standardizedCullScheduleCents,
                marketCeilingCents: policy.marketCeilingCents,
                active: policy.active,
                effectiveFrom: policy.effectiveFrom
              }
            : null
        };
      });
  }

  const prisma = requirePrisma();
  const rows = await prisma.order.findMany({
    where: { status: "BUYER_COMMITTED" },
    orderBy: { buyerCommittedAt: "asc" },
    select: {
      id: true,
      animalCaseId: true,
      status: true,
      animalCase: { select: { species: true, condition: true } }
    }
  });

  const policies = await prisma.supplierPricingPolicy.findMany({
    where: { active: true },
    orderBy: { effectiveFrom: "desc" }
  });

  return rows.map((row) => {
    const policy = policies.find(
      (candidate) =>
        candidate.species.toLowerCase() === row.animalCase.species.toLowerCase()
    );
    const projected = {
      id: row.id,
      animalCaseId: row.animalCaseId,
      species: row.animalCase.species,
      condition: row.animalCase.condition,
      status: row.status,
      pricingPolicy: policy
        ? {
            id: policy.id,
            species: policy.species,
            standardizedCullScheduleCents: policy.standardizedCullScheduleCents,
            marketCeilingCents: policy.marketCeilingCents,
            active: policy.active,
            effectiveFrom: policy.effectiveFrom.toISOString()
          }
        : null
    };
    assertBlindAcquisitionProjection(projected as unknown as Record<string, unknown>);
    return projected;
  });
}

export async function commitSupplierAcquisition(
  principal: SessionPrincipal,
  orderId: string
) {
  requireCapability(principal.role, "order:acquisition_commit");

  if (dataBackend() === "prototype") {
    const order = getPrototypeOrder(orderId);
    if (!order || order.status !== "BUYER_COMMITTED") {
      throw new Error("Order is not awaiting acquisition commitment");
    }
    const animal = getPrototypeAnimal(order.animalCaseId);
    if (!animal || animal.status !== "RESERVED") {
      throw new Error("Candidate is not reserved for this order");
    }
    const policy = getPrototypeActivePricingPolicy(animal.species);
    if (!policy) throw new Error("No active supplier pricing policy exists for this species");

    const supplierAcquisitionCents = calculateIndependentSupplierCommitment({
      standardizedCullScheduleCents: policy.standardizedCullScheduleCents,
      marketCeilingCents: policy.marketCeilingCents
    });
    assertOrderTransition("BUYER_COMMITTED", "ACQUISITION_COMMITTED");
    assertCandidateTransition("RESERVED", "SOLD_TO_RAM");
    assertOrderTransition("ACQUISITION_COMMITTED", "CLEARANCE_PENDING");

    updatePrototypeAnimal(animal.id, { status: "SOLD_TO_RAM" });
    return updatePrototypeOrder(order.id, {
      status: "CLEARANCE_PENDING",
      supplierPricingPolicyId: policy.id,
      supplierScheduleCents: policy.standardizedCullScheduleCents,
      supplierMarketCeilingCents: policy.marketCeilingCents,
      supplierAcquisitionCents,
      acquisitionCommittedAt: new Date().toISOString(),
      clearanceStartedAt: new Date().toISOString(),
      clearance: {
        decision: "PENDING",
        protocolConfirmed: false,
        receivingFacilityConfirmed: false,
        welfareConfirmed: false,
        biosecurityConfirmed: false,
        movementRequirementsConfirmed: false,
        transportPlanConfirmed: false,
        sourceProvenanceConfirmed: false,
        blockingFindings: []
      }
    });
  }

  const prisma = requirePrisma();
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        animalCase: {
          select: {
            status: true,
            species: true
          }
        }
      }
    });
    if (!order || order.status !== "BUYER_COMMITTED") {
      throw new Error("Order is not awaiting acquisition commitment");
    }
    if (order.animalCase.status !== "RESERVED") {
      throw new Error("Candidate is not reserved for this order");
    }

    const policy = await tx.supplierPricingPolicy.findFirst({
      where: {
        species: {
          equals: order.animalCase.species,
          mode: "insensitive"
        },
        active: true,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }]
      },
      orderBy: { effectiveFrom: "desc" }
    });
    if (!policy) throw new Error("No active supplier pricing policy exists for this species");

    const supplierAcquisitionCents = calculateIndependentSupplierCommitment({
      standardizedCullScheduleCents: policy.standardizedCullScheduleCents,
      marketCeilingCents: policy.marketCeilingCents
    });

    assertOrderTransition(order.status, "ACQUISITION_COMMITTED");
    assertCandidateTransition(order.animalCase.status, "SOLD_TO_RAM");
    assertOrderTransition("ACQUISITION_COMMITTED", "CLEARANCE_PENDING");

    const now = new Date();
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "ACQUISITION_COMMITTED",
        supplierPricingPolicyId: policy.id,
        supplierScheduleCents: policy.standardizedCullScheduleCents,
        supplierMarketCeilingCents: policy.marketCeilingCents,
        supplierAcquisitionCents,
        acquisitionCommittedAt: now
      }
    });
    await tx.animalCase.update({
      where: { publicId: order.animalCaseId },
      data: { status: "SOLD_TO_RAM" }
    });

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "CLEARANCE_PENDING",
        clearanceStartedAt: now,
        clearance: {
          create: {}
        }
      }
    });

    await tx.auditEvent.createMany({
      data: [
        {
          actorUserId: principal.userId,
          organizationId: principal.organizationId,
          action: "SUPPLIER_ACQUISITION_COMMITTED",
          entityType: "Order",
          entityId: order.id,
          previousState: { status: "BUYER_COMMITTED" },
          nextState: {
            status: "ACQUISITION_COMMITTED",
            supplierPricingPolicyId: policy.id,
            supplierAcquisitionCents
          },
          metadata: {
            standardizedCullScheduleCents: policy.standardizedCullScheduleCents,
            marketCeilingCents: policy.marketCeilingCents,
            buyerPriceUsedInSupplierCalculation: false
          }
        },
        {
          actorUserId: principal.userId,
          organizationId: principal.organizationId,
          action: "ORDER_CLEARANCE_STARTED",
          entityType: "Order",
          entityId: order.id,
          previousState: { status: "ACQUISITION_COMMITTED" },
          nextState: { status: "CLEARANCE_PENDING" }
        }
      ]
    });

    return updated;
  });
}

export async function listComplianceOrders(
  principal: SessionPrincipal
): Promise<ComplianceOrderSummary[]> {
  requireCapability(principal.role, "order:clearance");

  if (dataBackend() === "prototype") {
    return getPrototypeOrders()
      .filter((order) => order.status === "CLEARANCE_PENDING")
      .map((order) => {
        const animal = getPrototypeAnimal(order.animalCaseId);
        const need = getPrototypeResearchNeed(order.researchNeedId);
        return {
          id: order.id,
          animalCaseId: order.animalCaseId,
          species: animal?.species ?? "Unknown",
          condition: animal?.condition ?? "Unknown",
          buyerOrganizationName: "Prototype research organization",
          researchNeedTitle: need?.title ?? "Research need",
          status: order.status,
          protocolReference: order.protocolReference ?? null
        };
      });
  }

  const prisma = requirePrisma();
  const rows = await prisma.order.findMany({
    where: { status: "CLEARANCE_PENDING" },
    orderBy: { clearanceStartedAt: "asc" },
    select: {
      id: true,
      animalCaseId: true,
      status: true,
      protocolReference: true,
      buyerOrganization: { select: { name: true } },
      researchNeed: { select: { title: true } },
      animalCase: { select: { species: true, condition: true } }
    }
  });

  return rows.map((row) => ({
    id: row.id,
    animalCaseId: row.animalCaseId,
    species: row.animalCase.species,
    condition: row.animalCase.condition,
    buyerOrganizationName: row.buyerOrganization.name,
    researchNeedTitle: row.researchNeed.title,
    status: row.status,
    protocolReference: row.protocolReference
  }));
}

export async function getComplianceOrder(
  principal: SessionPrincipal,
  orderId: string
) {
  requireCapability(principal.role, "order:clearance");
  requireCapability(principal.role, "source:read_restricted");

  if (dataBackend() === "prototype") {
    const order = getPrototypeOrder(orderId);
    if (!order) throw new Error("Order not found");
    const animal = getPrototypeAnimal(order.animalCaseId);
    const need = getPrototypeResearchNeed(order.researchNeedId);
    return {
      id: order.id,
      status: order.status,
      buyerOrganizationName: "Prototype research organization",
      researchNeedTitle: need?.title ?? "Research need",
      protocolReference: order.protocolReference,
      receivingFacilityName: order.receivingFacilityName,
      receivingFacilityAddress: order.receivingFacilityAddress,
      animalCaseId: order.animalCaseId,
      species: animal?.species ?? "Unknown",
      condition: animal?.condition ?? "Unknown",
      transportReady: animal?.transportReady ?? false,
      sourceFarmName: "Prototype restricted farm",
      sourceExactAddress: "Restricted prototype address",
      cullReason: animal?.input.cullReason,
      independentCullAttestation: animal?.input.independentCullAttestation ?? false
    };
  }

  const prisma = requirePrisma();
  const row = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      protocolReference: true,
      receivingFacilityName: true,
      receivingFacilityAddress: true,
      buyerOrganization: { select: { name: true } },
      researchNeed: { select: { title: true } },
      animalCase: {
        select: {
          publicId: true,
          species: true,
          condition: true,
          transportReady: true,
          sourceRecord: {
            select: {
              legalOwnerName: true,
              exactAddress: true
            }
          },
          cullEvent: {
            select: {
              reason: true,
              independentlyIdentified: true
            }
          }
        }
      }
    }
  });
  if (!row) throw new Error("Order not found");

  return {
    id: row.id,
    status: row.status,
    buyerOrganizationName: row.buyerOrganization.name,
    researchNeedTitle: row.researchNeed.title,
    protocolReference: row.protocolReference,
    receivingFacilityName: row.receivingFacilityName,
    receivingFacilityAddress: row.receivingFacilityAddress,
    animalCaseId: row.animalCase.publicId,
    species: row.animalCase.species,
    condition: row.animalCase.condition,
    transportReady: row.animalCase.transportReady,
    sourceFarmName: row.animalCase.sourceRecord?.legalOwnerName,
    sourceExactAddress: row.animalCase.sourceRecord?.exactAddress,
    cullReason: row.animalCase.cullEvent?.reason,
    independentCullAttestation:
      row.animalCase.cullEvent?.independentlyIdentified ?? false
  };
}

export async function reviewOrderClearance(
  principal: SessionPrincipal,
  input: ClearanceReviewInput
) {
  requireCapability(principal.role, "order:clearance");

  const checks = {
    protocolConfirmed: input.protocolConfirmed,
    receivingFacilityConfirmed: input.receivingFacilityConfirmed,
    welfareConfirmed: input.welfareConfirmed,
    biosecurityConfirmed: input.biosecurityConfirmed,
    movementRequirementsConfirmed: input.movementRequirementsConfirmed,
    transportPlanConfirmed: input.transportPlanConfirmed,
    sourceProvenanceConfirmed: input.sourceProvenanceConfirmed
  };
  const findings = lines(input.blockingFindings);
  const blockingComplianceFindings = countBlockingClearanceFindings(
    checks,
    findings
  );

  if (dataBackend() === "prototype") {
    const order = getPrototypeOrder(input.orderId);
    if (!order || order.status !== "CLEARANCE_PENDING") {
      throw new Error("Order is not awaiting clearance");
    }

    if (input.decision === "CLEARED") {
      const animal = getPrototypeAnimal(order.animalCaseId);
      if (!animal?.transportReady) {
        throw new Error("Veterinary transport fitness is not confirmed");
      }
      if (!animal.input.independentCullAttestation) {
        throw new Error("Independent cull provenance is not confirmed");
      }
      if (
        !canAdvanceOrder({
          from: "CLEARANCE_PENDING",
          to: "READY_FOR_PICKUP",
          blockingComplianceFindings
        })
      ) {
        throw new Error("Blocking compliance findings prevent clearance");
      }
      const need = getPrototypeResearchNeed(order.researchNeedId);
      if (need?.status === "INSTITUTIONAL_CLEARANCE") {
        requireResearchNeedTransition("INSTITUTIONAL_CLEARANCE", "ORDERED");
        updatePrototypeResearchNeed(need.id, { status: "ORDERED" });
      }
      return updatePrototypeOrder(order.id, {
        status: "READY_FOR_PICKUP",
        clearedAt: new Date().toISOString(),
        clearance: {
          decision: "CLEARED",
          ...checks,
          blockingFindings: [],
          notes: input.notes,
          reviewerUserId: principal.userId,
          reviewedAt: new Date().toISOString()
        }
      });
    }

    assertOrderTransition("CLEARANCE_PENDING", "CLEARANCE_FAILED");
    const need = getPrototypeResearchNeed(order.researchNeedId);
    if (need) {
      const reset = validateNeedResetPath(need.status as ResearchNeedStatus);
      if (reset.finalStatus === "ACTIVE") {
        updatePrototypeResearchNeed(need.id, { status: "ACTIVE" });
      }
    }
    return updatePrototypeOrder(order.id, {
      status: "CLEARANCE_FAILED",
      clearance: {
        decision: "FAILED",
        ...checks,
        blockingFindings: findings,
        notes: input.notes,
        reviewerUserId: principal.userId,
        reviewedAt: new Date().toISOString()
      }
    });
  }

  const prisma = requirePrisma();
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: {
        researchNeed: { select: { status: true } },
        clearance: true,
        animalCase: {
          select: {
            transportReady: true,
            cullEvent: {
              select: { independentlyIdentified: true }
            }
          }
        }
      }
    });
    if (!order || order.status !== "CLEARANCE_PENDING") {
      throw new Error("Order is not awaiting clearance");
    }
    if (!order.clearance) throw new Error("Clearance record is missing");

    const now = new Date();
    if (input.decision === "CLEARED") {
      if (!order.animalCase.transportReady) {
        throw new Error("Veterinary transport fitness is not confirmed");
      }
      if (!order.animalCase.cullEvent?.independentlyIdentified) {
        throw new Error("Independent cull provenance is not confirmed");
      }
      if (
        !canAdvanceOrder({
          from: order.status,
          to: "READY_FOR_PICKUP",
          blockingComplianceFindings
        })
      ) {
        throw new Error("Blocking compliance findings prevent clearance");
      }

      if (order.researchNeed.status === "INSTITUTIONAL_CLEARANCE") {
        requireResearchNeedTransition("INSTITUTIONAL_CLEARANCE", "ORDERED");
        await tx.researchNeed.update({
          where: { id: order.researchNeedId },
          data: { status: "ORDERED" }
        });
      }

      await tx.orderClearance.update({
        where: { id: order.clearance.id },
        data: {
          decision: "CLEARED",
          reviewerUserId: principal.userId,
          ...checks,
          blockingFindings: [] as Prisma.InputJsonValue,
          notes: input.notes,
          reviewedAt: now
        }
      });

      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: "READY_FOR_PICKUP",
          clearedAt: now
        }
      });

      await tx.auditEvent.create({
        data: {
          actorUserId: principal.userId,
          organizationId: principal.organizationId,
          action: "ORDER_CLEARANCE_PASSED",
          entityType: "Order",
          entityId: order.id,
          previousState: { status: "CLEARANCE_PENDING" },
          nextState: { status: "READY_FOR_PICKUP" },
          metadata: { blockingComplianceFindings: 0 }
        }
      });
      return updated;
    }

    assertOrderTransition(order.status, "CLEARANCE_FAILED");
    const reset = validateNeedResetPath(order.researchNeed.status);
    if (
      reset.finalStatus === "ACTIVE" &&
      order.researchNeed.status !== "ACTIVE"
    ) {
      await tx.researchNeed.update({
        where: { id: order.researchNeedId },
        data: { status: "ACTIVE" }
      });
    }
    await tx.researchMatch.updateMany({
      where: {
        researchNeedId: order.researchNeedId,
        animalCaseId: order.animalCaseId,
        status: "SELECTED"
      },
      data: { status: "STALE" }
    });

    await tx.orderClearance.update({
      where: { id: order.clearance.id },
      data: {
        decision: "FAILED",
        reviewerUserId: principal.userId,
        ...checks,
        blockingFindings: findings as Prisma.InputJsonValue,
        notes: input.notes,
        reviewedAt: now
      }
    });
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: "CLEARANCE_FAILED" }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "ORDER_CLEARANCE_FAILED",
        entityType: "Order",
        entityId: order.id,
        previousState: { status: "CLEARANCE_PENDING" },
        nextState: { status: "CLEARANCE_FAILED" },
        metadata: {
          blockingComplianceFindings,
          findings
        }
      }
    });
    return updated;
  });
}
