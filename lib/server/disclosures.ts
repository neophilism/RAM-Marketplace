import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { SessionPrincipal } from "@/lib/auth/token";
import { requireCapability } from "@/lib/access";
import {
  buyerMilestoneForOrderStatus,
  evaluateDisclosurePolicy,
  type DisclosureField,
  type FarmDisclosureRules
} from "@/lib/disclosure-policy";
import {
  assertScopedReleaseSnapshot,
  buildDisclosureReleaseSnapshot
} from "@/lib/disclosure-release";
import type {
  DisclosureNdaAcceptInput,
  DisclosureRamReviewInput,
  DisclosureRequestInput,
  DisclosureSupplierReviewInput,
  FarmDisclosurePolicyInput
} from "@/lib/validation";
import { dataBackend, requirePrisma } from "@/lib/server/db";
import {
  getPrototypeAnimal,
  getPrototypeDisclosureRequest,
  getPrototypeDisclosureRequests,
  getPrototypeFarmDisclosurePolicy,
  getPrototypeMatchesForNeed,
  getPrototypeOrders,
  getPrototypeResearchNeed,
  getPrototypeResearchNeeds,
  savePrototypeDisclosureRequest,
  updatePrototypeDisclosureRequest,
  updatePrototypeFarmDisclosurePolicy
} from "@/lib/server/prototype-store";

const DEFAULT_FARM_POLICY: FarmDisclosureRules = {
  shareGeneralHusbandry: true,
  shareCountyAfterNda: false,
  shareIdentityPrePurchase: false,
  shareIdentityPostPurchase: true
};

const ACTIVE_NEED_STATUSES = [
  "ACTIVE",
  "MATCH_REVIEW",
  "SELECTED",
  "INSTITUTIONAL_CLEARANCE",
  "ORDERED",
  "IN_STUDY"
] as const;

function disclosureFields(value: unknown): DisclosureField[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is DisclosureField =>
      item === "GENERAL_HUSBANDRY" ||
      item === "COUNTY" ||
      item === "FARM_IDENTITY"
  );
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
}

function assertRamReviewer(principal: SessionPrincipal) {
  requireCapability(principal.role, "disclosure:ram_review");
  if (!principal.role.startsWith("RAM_")) {
    throw new Error("Forbidden: RAM disclosure review requires a RAM role");
  }
}

function assertSupplierReviewer(principal: SessionPrincipal) {
  requireCapability(principal.role, "disclosure:supplier_review");
  if (principal.role !== "SUPPLIER_OWNER_ADMIN") {
    throw new Error("Forbidden: farm disclosure approval requires supplier owner authority");
  }
}

function prototypeRelatedOrder(
  requesterOrganizationId: string,
  researchNeedId: string,
  animalCaseId: string
) {
  return getPrototypeOrders()
    .filter(
      (order) =>
        order.buyerOrganizationId === requesterOrganizationId &&
        order.researchNeedId === researchNeedId &&
        order.animalCaseId === animalCaseId
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function prototypeSourceFacts(animalCaseId: string) {
  const animal = getPrototypeAnimal(animalCaseId);
  if (!animal) throw new Error("Candidate not found");

  return {
    generalHusbandry: animal.input.generalHusbandry ?? null,
    countyLabel: "Prototype County",
    legalOwnerName: "Anonymous Partner Farm",
    exactAddress: "Restricted prototype address",
    ownerContactName: "Prototype Farm Owner",
    ownerContactEmail: "farm-owner@demo.ram.invalid",
    localVetName: null,
    localVetContact: null
  };
}

function prototypePolicyContext(request: {
  animalCaseId: string;
  requesterOrganizationId: string;
  researchNeedId: string;
}) {
  const animal = getPrototypeAnimal(request.animalCaseId);
  if (!animal) throw new Error("Candidate not found");
  const order = prototypeRelatedOrder(
    request.requesterOrganizationId,
    request.researchNeedId,
    request.animalCaseId
  );
  const farmPolicy = getPrototypeFarmDisclosurePolicy();

  return {
    farmPolicy,
    buyerMilestone: buyerMilestoneForOrderStatus(order?.status),
    sourceDisclosure: animal.sourceDisclosure,
    orderId: order?.id
  };
}

async function releasePrototypeRequest(requestId: string) {
  const request = getPrototypeDisclosureRequest(requestId);
  if (!request) throw new Error("Disclosure request not found");

  const context = prototypePolicyContext(request);
  evaluateDisclosurePolicy({
    requestedFields: request.requestedFields as DisclosureField[],
    farmPolicy: context.farmPolicy,
    buyerMilestone: context.buyerMilestone,
    sourceDisclosure: context.sourceDisclosure
  });

  if (request.ndaRequired && !request.ndaAcceptedAt) {
    throw new Error("NDA acceptance is required before release");
  }
  if (request.supplierApproved === false) {
    throw new Error("Farm denied this disclosure request");
  }

  const snapshot = buildDisclosureReleaseSnapshot(
    request.requestedFields as DisclosureField[],
    prototypeSourceFacts(request.animalCaseId)
  );
  assertScopedReleaseSnapshot(snapshot);

  return updatePrototypeDisclosureRequest(request.id, {
    status: "RELEASED",
    releasedFields: snapshot.releasedFields,
    releasedData: snapshot.releasedData as Record<string, string>,
    releasedAt: new Date().toISOString()
  });
}

async function dbPolicyContext(input: {
  animalCaseId: string;
  requesterOrganizationId: string;
  researchNeedId: string;
  orderId?: string | null;
}) {
  const prisma = requirePrisma();

  const animal = await prisma.animalCase.findUnique({
    where: { publicId: input.animalCaseId },
    select: {
      sourceDisclosure: true,
      sourceRecord: {
        select: {
          farmSite: {
            select: {
              permissions: {
                select: {
                  shareGeneralHusbandry: true,
                  shareCountyAfterNda: true,
                  shareIdentityPrePurchase: true,
                  shareIdentityPostPurchase: true
                }
              }
            }
          }
        }
      }
    }
  });
  if (!animal) throw new Error("Candidate not found");

  const order = input.orderId
    ? await prisma.order.findFirst({
        where: {
          id: input.orderId,
          buyerOrganizationId: input.requesterOrganizationId,
          researchNeedId: input.researchNeedId,
          animalCaseId: input.animalCaseId
        },
        select: { id: true, status: true }
      })
    : await prisma.order.findFirst({
        where: {
          buyerOrganizationId: input.requesterOrganizationId,
          researchNeedId: input.researchNeedId,
          animalCaseId: input.animalCaseId
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true }
      });

  return {
    farmPolicy: animal.sourceRecord?.farmSite.permissions ?? DEFAULT_FARM_POLICY,
    buyerMilestone: buyerMilestoneForOrderStatus(order?.status),
    sourceDisclosure: animal.sourceDisclosure,
    orderId: order?.id
  };
}

async function releaseDbRequest(requestId: string) {
  const prisma = requirePrisma();

  return prisma.$transaction(async (tx) => {
    const request = await tx.disclosureRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        animalCaseId: true,
        requesterOrganizationId: true,
        researchNeedId: true,
        orderId: true,
        requestedFields: true,
        ndaRequired: true,
        ndaAcceptedAt: true,
        supplierApproved: true,
        animalCase: {
          select: {
            sourceDisclosure: true,
            sourceRecord: {
              select: {
                generalHusbandry: true,
                legalOwnerName: true,
                exactAddress: true,
                ownerContactName: true,
                ownerContactEmail: true,
                localVetName: true,
                localVetContact: true,
                farmSite: {
                  select: {
                    countyLabel: true,
                    permissions: {
                      select: {
                        shareGeneralHusbandry: true,
                        shareCountyAfterNda: true,
                        shareIdentityPrePurchase: true,
                        shareIdentityPostPurchase: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
    if (!request) throw new Error("Disclosure request not found");
    if (!request.animalCase.sourceRecord) {
      throw new Error("Restricted source record is missing");
    }

    const order = request.orderId
      ? await tx.order.findFirst({
          where: {
            id: request.orderId,
            buyerOrganizationId: request.requesterOrganizationId,
            researchNeedId: request.researchNeedId,
            animalCaseId: request.animalCaseId
          },
          select: { status: true }
        })
      : await tx.order.findFirst({
          where: {
            buyerOrganizationId: request.requesterOrganizationId,
            researchNeedId: request.researchNeedId,
            animalCaseId: request.animalCaseId
          },
          orderBy: { createdAt: "desc" },
          select: { status: true }
        });

    const fields = disclosureFields(request.requestedFields);
    evaluateDisclosurePolicy({
      requestedFields: fields,
      farmPolicy:
        request.animalCase.sourceRecord.farmSite.permissions ?? DEFAULT_FARM_POLICY,
      buyerMilestone: buyerMilestoneForOrderStatus(order?.status),
      sourceDisclosure: request.animalCase.sourceDisclosure
    });

    if (request.ndaRequired && !request.ndaAcceptedAt) {
      throw new Error("NDA acceptance is required before release");
    }
    if (request.supplierApproved === false) {
      throw new Error("Farm denied this disclosure request");
    }

    const source = request.animalCase.sourceRecord;
    const snapshot = buildDisclosureReleaseSnapshot(fields, {
      generalHusbandry: source.generalHusbandry,
      countyLabel: source.farmSite.countyLabel,
      legalOwnerName: source.legalOwnerName,
      exactAddress: source.exactAddress,
      ownerContactName: source.ownerContactName,
      ownerContactEmail: source.ownerContactEmail,
      localVetName: source.localVetName,
      localVetContact: source.localVetContact
    });
    assertScopedReleaseSnapshot(snapshot);

    const updated = await tx.disclosureRequest.update({
      where: { id: request.id },
      data: {
        status: "RELEASED",
        releasedFields: snapshot.releasedFields as Prisma.InputJsonValue,
        releasedData: snapshot.releasedData as Prisma.InputJsonValue,
        releasedAt: new Date()
      }
    });

    await tx.auditEvent.create({
      data: {
        action: "DISCLOSURE_RELEASED",
        entityType: "DisclosureRequest",
        entityId: request.id,
        nextState: {
          status: "RELEASED",
          releasedFields: snapshot.releasedFields
        }
      }
    });

    return updated;
  });
}

export async function listDisclosureEligibleResearchNeeds(
  principal: SessionPrincipal,
  animalCaseId: string
) {
  requireCapability(principal.role, "disclosure:request");

  if (dataBackend() === "prototype") {
    return getPrototypeResearchNeeds()
      .filter((need) =>
        ACTIVE_NEED_STATUSES.includes(need.status as (typeof ACTIVE_NEED_STATUSES)[number])
      )
      .filter((need) =>
        getPrototypeMatchesForNeed(need.id).some(
          (match) => match.animalCaseId === animalCaseId && match.eligible
        ) ||
        getPrototypeOrders().some(
          (order) =>
            order.buyerOrganizationId === principal.organizationId &&
            order.researchNeedId === need.id &&
            order.animalCaseId === animalCaseId
        )
      )
      .map((need) => ({
        id: need.id,
        title: need.title,
        status: need.status
      }));
  }

  const prisma = requirePrisma();
  return prisma.researchNeed.findMany({
    where: {
      organizationId: principal.organizationId,
      status: { in: [...ACTIVE_NEED_STATUSES] },
      OR: [
        { matches: { some: { animalCaseId } } },
        {
          orders: {
            some: {
              animalCaseId,
              buyerOrganizationId: principal.organizationId
            }
          }
        }
      ]
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true
    }
  });
}

export async function createDisclosureRequest(
  principal: SessionPrincipal,
  input: DisclosureRequestInput
) {
  requireCapability(principal.role, "disclosure:request");

  if (dataBackend() === "prototype") {
    const need = getPrototypeResearchNeed(input.researchNeedId);
    const animal = getPrototypeAnimal(input.animalCaseId);
    if (!need || !animal) throw new Error("Research need or animal not found");

    const eligibleMatch = getPrototypeMatchesForNeed(input.researchNeedId).some(
      (match) => match.animalCaseId === input.animalCaseId && match.eligible
    );
    const order = prototypeRelatedOrder(
      principal.organizationId,
      input.researchNeedId,
      input.animalCaseId
    );
    if (!eligibleMatch && !order) {
      throw new Error("Source information may be requested only for an eligible match or related order");
    }

    const context = prototypePolicyContext({
      animalCaseId: input.animalCaseId,
      requesterOrganizationId: principal.organizationId,
      researchNeedId: input.researchNeedId
    });
    evaluateDisclosurePolicy({
      requestedFields: input.requestedFields,
      farmPolicy: context.farmPolicy,
      buyerMilestone: context.buyerMilestone,
      sourceDisclosure: context.sourceDisclosure
    });

    return savePrototypeDisclosureRequest({
      animalCaseId: input.animalCaseId,
      requesterUserId: principal.userId,
      requesterOrganizationId: principal.organizationId,
      researchNeedId: input.researchNeedId,
      orderId: order?.id,
      requestedFields: input.requestedFields,
      scientificReason: input.scientificReason,
      status: "PENDING_RAM_REVIEW",
      reviewedByRam: false,
      ndaRequired: false
    });
  }

  const prisma = requirePrisma();
  const [need, match, order] = await Promise.all([
    prisma.researchNeed.findFirst({
      where: {
        id: input.researchNeedId,
        organizationId: principal.organizationId
      },
      select: { id: true }
    }),
    prisma.researchMatch.findUnique({
      where: {
        researchNeedId_animalCaseId: {
          researchNeedId: input.researchNeedId,
          animalCaseId: input.animalCaseId
        }
      },
      select: { id: true }
    }),
    prisma.order.findFirst({
      where: {
        buyerOrganizationId: principal.organizationId,
        researchNeedId: input.researchNeedId,
        animalCaseId: input.animalCaseId
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true }
    })
  ]);

  if (!need) throw new Error("Research need does not belong to this organization");
  if (!match && !order) {
    throw new Error("Source information may be requested only for an eligible match or related order");
  }

  const context = await dbPolicyContext({
    animalCaseId: input.animalCaseId,
    requesterOrganizationId: principal.organizationId,
    researchNeedId: input.researchNeedId,
    orderId: order?.id
  });

  evaluateDisclosurePolicy({
    requestedFields: input.requestedFields,
    farmPolicy: context.farmPolicy,
    buyerMilestone: context.buyerMilestone,
    sourceDisclosure: context.sourceDisclosure
  });

  return prisma.$transaction(async (tx) => {
    const created = await tx.disclosureRequest.create({
      data: {
        animalCaseId: input.animalCaseId,
        requesterUserId: principal.userId,
        requesterOrganizationId: principal.organizationId,
        researchNeedId: input.researchNeedId,
        orderId: order?.id,
        requestedFields: input.requestedFields as Prisma.InputJsonValue,
        scientificReason: input.scientificReason,
        status: "PENDING_RAM_REVIEW"
      }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "DISCLOSURE_REQUESTED",
        entityType: "DisclosureRequest",
        entityId: created.id,
        nextState: {
          status: "PENDING_RAM_REVIEW",
          animalCaseId: input.animalCaseId,
          researchNeedId: input.researchNeedId,
          requestedFields: input.requestedFields
        }
      }
    });

    return created;
  });
}

export async function listRequesterDisclosureRequests(
  principal: SessionPrincipal
) {
  requireCapability(principal.role, "disclosure:request");

  if (dataBackend() === "prototype") {
    return getPrototypeDisclosureRequests()
      .filter(
        (request) =>
          request.requesterOrganizationId === principal.organizationId
      )
      .map((request) => ({
        id: request.id,
        animalCaseId: request.animalCaseId,
        researchNeedId: request.researchNeedId,
        researchNeedTitle:
          getPrototypeResearchNeed(request.researchNeedId)?.title ?? "Research need",
        requestedFields: request.requestedFields,
        status: request.status,
        ndaRequired: request.ndaRequired,
        ndaAccepted: Boolean(request.ndaAcceptedAt),
        releasedAt: request.releasedAt ?? null,
        createdAt: request.createdAt
      }));
  }

  const prisma = requirePrisma();
  const rows = await prisma.disclosureRequest.findMany({
    where: { requesterOrganizationId: principal.organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      animalCaseId: true,
      researchNeedId: true,
      requestedFields: true,
      status: true,
      ndaRequired: true,
      ndaAcceptedAt: true,
      releasedAt: true,
      createdAt: true,
      researchNeed: { select: { title: true } }
    }
  });

  return rows.map((row) => ({
    id: row.id,
    animalCaseId: row.animalCaseId,
    researchNeedId: row.researchNeedId,
    researchNeedTitle: row.researchNeed.title,
    requestedFields: disclosureFields(row.requestedFields),
    status: row.status,
    ndaRequired: row.ndaRequired,
    ndaAccepted: Boolean(row.ndaAcceptedAt),
    releasedAt: row.releasedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString()
  }));
}

export async function getRequesterDisclosureRequest(
  principal: SessionPrincipal,
  requestId: string
) {
  requireCapability(principal.role, "disclosure:request");

  if (dataBackend() === "prototype") {
    const request = getPrototypeDisclosureRequest(requestId);
    if (
      !request ||
      request.requesterOrganizationId !== principal.organizationId
    ) {
      throw new Error("Disclosure request not found");
    }
    return {
      id: request.id,
      animalCaseId: request.animalCaseId,
      researchNeedId: request.researchNeedId,
      researchNeedTitle:
        getPrototypeResearchNeed(request.researchNeedId)?.title ?? "Research need",
      requestedFields: request.requestedFields,
      scientificReason: request.scientificReason,
      status: request.status,
      ndaRequired: request.ndaRequired,
      ndaAccepted: Boolean(request.ndaAcceptedAt),
      denialReason: request.denialReason ?? null,
      releasedFields: request.releasedFields ?? [],
      releasedData: request.status === "RELEASED" ? request.releasedData ?? {} : {},
      releasedAt: request.releasedAt ?? null,
      createdAt: request.createdAt
    };
  }

  const prisma = requirePrisma();

  // Deliberately do not join AnimalSourceRecord here. Scientists can read only
  // the immutable release snapshot created after all approvals.
  const row = await prisma.disclosureRequest.findFirst({
    where: {
      id: requestId,
      requesterOrganizationId: principal.organizationId
    },
    select: {
      id: true,
      animalCaseId: true,
      researchNeedId: true,
      requestedFields: true,
      scientificReason: true,
      status: true,
      ndaRequired: true,
      ndaAcceptedAt: true,
      denialReason: true,
      releasedFields: true,
      releasedData: true,
      releasedAt: true,
      createdAt: true,
      researchNeed: { select: { title: true } }
    }
  });
  if (!row) throw new Error("Disclosure request not found");

  return {
    id: row.id,
    animalCaseId: row.animalCaseId,
    researchNeedId: row.researchNeedId,
    researchNeedTitle: row.researchNeed.title,
    requestedFields: disclosureFields(row.requestedFields),
    scientificReason: row.scientificReason,
    status: row.status,
    ndaRequired: row.ndaRequired,
    ndaAccepted: Boolean(row.ndaAcceptedAt),
    denialReason: row.denialReason,
    releasedFields:
      row.status === "RELEASED" ? disclosureFields(row.releasedFields) : [],
    releasedData:
      row.status === "RELEASED" ? stringRecord(row.releasedData) : {},
    releasedAt: row.releasedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString()
  };
}

export async function listRamDisclosureQueue(principal: SessionPrincipal) {
  assertRamReviewer(principal);

  if (dataBackend() === "prototype") {
    return getPrototypeDisclosureRequests()
      .filter((request) => request.status === "PENDING_RAM_REVIEW")
      .map((request) => ({
        id: request.id,
        animalCaseId: request.animalCaseId,
        researchNeedTitle:
          getPrototypeResearchNeed(request.researchNeedId)?.title ?? "Research need",
        requestedFields: request.requestedFields,
        scientificReason: request.scientificReason,
        status: request.status,
        createdAt: request.createdAt
      }));
  }

  const prisma = requirePrisma();
  const rows = await prisma.disclosureRequest.findMany({
    where: { status: "PENDING_RAM_REVIEW" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      animalCaseId: true,
      requestedFields: true,
      scientificReason: true,
      status: true,
      createdAt: true,
      researchNeed: { select: { title: true } }
    }
  });

  return rows.map((row) => ({
    id: row.id,
    animalCaseId: row.animalCaseId,
    researchNeedTitle: row.researchNeed.title,
    requestedFields: disclosureFields(row.requestedFields),
    scientificReason: row.scientificReason,
    status: row.status,
    createdAt: row.createdAt.toISOString()
  }));
}

export async function getRamDisclosureRequest(
  principal: SessionPrincipal,
  requestId: string
) {
  assertRamReviewer(principal);
  requireCapability(principal.role, "source:read_restricted");

  if (dataBackend() === "prototype") {
    const request = getPrototypeDisclosureRequest(requestId);
    if (!request) throw new Error("Disclosure request not found");
    const animal = getPrototypeAnimal(request.animalCaseId);
    const context = prototypePolicyContext(request);
    return {
      id: request.id,
      animalCaseId: request.animalCaseId,
      condition: animal?.condition ?? "Unknown",
      researchNeedTitle:
        getPrototypeResearchNeed(request.researchNeedId)?.title ?? "Research need",
      requestedFields: request.requestedFields,
      scientificReason: request.scientificReason,
      status: request.status,
      sourceDisclosure: animal?.sourceDisclosure ?? "PUBLIC_ANONYMIZED",
      buyerMilestone: context.buyerMilestone,
      farmPolicy: context.farmPolicy,
      availableFacts: {
        generalHusbandry: Boolean(animal?.input.generalHusbandry),
        county: true,
        farmIdentity: true
      }
    };
  }

  const prisma = requirePrisma();
  const row = await prisma.disclosureRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      animalCaseId: true,
      requesterOrganizationId: true,
      researchNeedId: true,
      orderId: true,
      requestedFields: true,
      scientificReason: true,
      status: true,
      researchNeed: { select: { title: true } },
      animalCase: {
        select: {
          condition: true,
          sourceDisclosure: true,
          sourceRecord: {
            select: {
              generalHusbandry: true,
              legalOwnerName: true,
              farmSite: {
                select: {
                  countyLabel: true,
                  permissions: {
                    select: {
                      shareGeneralHusbandry: true,
                      shareCountyAfterNda: true,
                      shareIdentityPrePurchase: true,
                      shareIdentityPostPurchase: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
  if (!row) throw new Error("Disclosure request not found");

  const context = await dbPolicyContext(row);
  return {
    id: row.id,
    animalCaseId: row.animalCaseId,
    condition: row.animalCase.condition,
    researchNeedTitle: row.researchNeed.title,
    requestedFields: disclosureFields(row.requestedFields),
    scientificReason: row.scientificReason,
    status: row.status,
    sourceDisclosure: row.animalCase.sourceDisclosure,
    buyerMilestone: context.buyerMilestone,
    farmPolicy: context.farmPolicy,
    availableFacts: {
      generalHusbandry: Boolean(row.animalCase.sourceRecord?.generalHusbandry),
      county: Boolean(row.animalCase.sourceRecord?.farmSite.countyLabel),
      farmIdentity: Boolean(row.animalCase.sourceRecord?.legalOwnerName)
    }
  };
}

export async function reviewDisclosureByRam(
  principal: SessionPrincipal,
  input: DisclosureRamReviewInput
) {
  assertRamReviewer(principal);

  if (dataBackend() === "prototype") {
    const request = getPrototypeDisclosureRequest(input.requestId);
    if (!request || request.status !== "PENDING_RAM_REVIEW") {
      throw new Error("Disclosure request is not awaiting RAM review");
    }

    if (input.decision === "DENY") {
      return updatePrototypeDisclosureRequest(request.id, {
        status: "DENIED",
        reviewedByRam: true,
        ramReviewerUserId: principal.userId,
        ramReviewedAt: new Date().toISOString(),
        denialReason: input.denialReason
      });
    }

    const context = prototypePolicyContext(request);
    const decision = evaluateDisclosurePolicy({
      requestedFields: request.requestedFields as DisclosureField[],
      farmPolicy: context.farmPolicy,
      buyerMilestone: context.buyerMilestone,
      sourceDisclosure: context.sourceDisclosure
    });

    const updated = updatePrototypeDisclosureRequest(request.id, {
      reviewedByRam: true,
      ramReviewerUserId: principal.userId,
      ramReviewedAt: new Date().toISOString(),
      ndaRequired: decision.ndaRequired,
      status: decision.supplierApprovalRequired
        ? "PENDING_SUPPLIER_APPROVAL"
        : decision.ndaRequired
          ? "APPROVED"
          : "APPROVED"
    });

    if (!decision.supplierApprovalRequired && !decision.ndaRequired) {
      return releasePrototypeRequest(updated.id);
    }
    return updated;
  }

  const prisma = requirePrisma();
  const request = await prisma.disclosureRequest.findUnique({
    where: { id: input.requestId },
    select: {
      id: true,
      animalCaseId: true,
      requesterOrganizationId: true,
      researchNeedId: true,
      orderId: true,
      requestedFields: true,
      status: true
    }
  });
  if (!request || request.status !== "PENDING_RAM_REVIEW") {
    throw new Error("Disclosure request is not awaiting RAM review");
  }

  if (input.decision === "DENY") {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.disclosureRequest.update({
        where: { id: request.id },
        data: {
          status: "DENIED",
          reviewedByRam: true,
          ramReviewerUserId: principal.userId,
          ramReviewedAt: new Date(),
          denialReason: input.denialReason
        }
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: principal.userId,
          organizationId: principal.organizationId,
          action: "DISCLOSURE_DENIED_BY_RAM",
          entityType: "DisclosureRequest",
          entityId: request.id,
          nextState: { status: "DENIED" },
          reason: input.denialReason
        }
      });
      return updated;
    });
  }

  const context = await dbPolicyContext(request);
  const decision = evaluateDisclosurePolicy({
    requestedFields: disclosureFields(request.requestedFields),
    farmPolicy: context.farmPolicy,
    buyerMilestone: context.buyerMilestone,
    sourceDisclosure: context.sourceDisclosure
  });

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.disclosureRequest.update({
      where: { id: request.id },
      data: {
        reviewedByRam: true,
        ramReviewerUserId: principal.userId,
        ramReviewedAt: new Date(),
        ndaRequired: decision.ndaRequired,
        orderId: request.orderId ?? context.orderId,
        status: decision.supplierApprovalRequired
          ? "PENDING_SUPPLIER_APPROVAL"
          : "APPROVED"
      }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "DISCLOSURE_APPROVED_BY_RAM",
        entityType: "DisclosureRequest",
        entityId: request.id,
        nextState: {
          status: decision.supplierApprovalRequired
            ? "PENDING_SUPPLIER_APPROVAL"
            : "APPROVED",
          ndaRequired: decision.ndaRequired,
          supplierApprovalRequired: decision.supplierApprovalRequired
        },
        metadata: { policyReasons: decision.reasons }
      }
    });
    return result;
  });

  if (!decision.supplierApprovalRequired && !decision.ndaRequired) {
    return releaseDbRequest(updated.id);
  }
  return updated;
}

export async function listSupplierDisclosureQueue(
  principal: SessionPrincipal
) {
  assertSupplierReviewer(principal);

  if (dataBackend() === "prototype") {
    return getPrototypeDisclosureRequests()
      .filter((request) => request.status === "PENDING_SUPPLIER_APPROVAL")
      .map((request) => ({
        id: request.id,
        animalCaseId: request.animalCaseId,
        requestedFields: request.requestedFields,
        scientificReason: request.scientificReason,
        status: request.status,
        createdAt: request.createdAt
      }));
  }

  const prisma = requirePrisma();
  const rows = await prisma.disclosureRequest.findMany({
    where: {
      status: "PENDING_SUPPLIER_APPROVAL",
      animalCase: {
        sourceRecord: {
          is: {
            farmSite: {
              organizationId: principal.organizationId
            }
          }
        }
      }
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      animalCaseId: true,
      requestedFields: true,
      scientificReason: true,
      status: true,
      createdAt: true
    }
  });

  // Deliberately excludes requester / buyer organization identity.
  return rows.map((row) => ({
    id: row.id,
    animalCaseId: row.animalCaseId,
    requestedFields: disclosureFields(row.requestedFields),
    scientificReason: row.scientificReason,
    status: row.status,
    createdAt: row.createdAt.toISOString()
  }));
}

export async function reviewDisclosureBySupplier(
  principal: SessionPrincipal,
  input: DisclosureSupplierReviewInput
) {
  assertSupplierReviewer(principal);

  if (dataBackend() === "prototype") {
    const request = getPrototypeDisclosureRequest(input.requestId);
    if (!request || request.status !== "PENDING_SUPPLIER_APPROVAL") {
      throw new Error("Disclosure request is not awaiting farm approval");
    }

    if (input.decision === "DENY") {
      return updatePrototypeDisclosureRequest(request.id, {
        status: "DENIED",
        supplierApproved: false,
        supplierReviewerUserId: principal.userId,
        supplierReviewedAt: new Date().toISOString(),
        denialReason: input.denialReason
      });
    }

    const context = prototypePolicyContext(request);
    evaluateDisclosurePolicy({
      requestedFields: request.requestedFields as DisclosureField[],
      farmPolicy: context.farmPolicy,
      buyerMilestone: context.buyerMilestone,
      sourceDisclosure: context.sourceDisclosure
    });

    const updated = updatePrototypeDisclosureRequest(request.id, {
      status: request.ndaRequired ? "APPROVED" : "APPROVED",
      supplierApproved: true,
      supplierReviewerUserId: principal.userId,
      supplierReviewedAt: new Date().toISOString()
    });

    if (!request.ndaRequired) {
      return releasePrototypeRequest(updated.id);
    }
    return updated;
  }

  const prisma = requirePrisma();
  const request = await prisma.disclosureRequest.findFirst({
    where: {
      id: input.requestId,
      status: "PENDING_SUPPLIER_APPROVAL",
      animalCase: {
        sourceRecord: {
          is: {
            farmSite: {
              organizationId: principal.organizationId
            }
          }
        }
      }
    },
    select: {
      id: true,
      animalCaseId: true,
      requesterOrganizationId: true,
      researchNeedId: true,
      orderId: true,
      requestedFields: true,
      ndaRequired: true
    }
  });
  if (!request) {
    throw new Error("Disclosure request is not awaiting this farm's approval");
  }

  if (input.decision === "DENY") {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.disclosureRequest.update({
        where: { id: request.id },
        data: {
          status: "DENIED",
          supplierApproved: false,
          supplierReviewerUserId: principal.userId,
          supplierReviewedAt: new Date(),
          denialReason: input.denialReason
        }
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: principal.userId,
          organizationId: principal.organizationId,
          action: "DISCLOSURE_DENIED_BY_SUPPLIER",
          entityType: "DisclosureRequest",
          entityId: request.id,
          nextState: { status: "DENIED" },
          reason: input.denialReason
        }
      });
      return updated;
    });
  }

  const context = await dbPolicyContext(request);
  evaluateDisclosurePolicy({
    requestedFields: disclosureFields(request.requestedFields),
    farmPolicy: context.farmPolicy,
    buyerMilestone: context.buyerMilestone,
    sourceDisclosure: context.sourceDisclosure
  });

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.disclosureRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        supplierApproved: true,
        supplierReviewerUserId: principal.userId,
        supplierReviewedAt: new Date(),
        orderId: request.orderId ?? context.orderId
      }
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "DISCLOSURE_APPROVED_BY_SUPPLIER",
        entityType: "DisclosureRequest",
        entityId: request.id,
        nextState: {
          status: "APPROVED",
          ndaRequired: request.ndaRequired
        }
      }
    });
    return result;
  });

  if (!request.ndaRequired) {
    return releaseDbRequest(updated.id);
  }
  return updated;
}

export async function acceptDisclosureNda(
  principal: SessionPrincipal,
  input: DisclosureNdaAcceptInput
) {
  requireCapability(principal.role, "disclosure:request");

  if (dataBackend() === "prototype") {
    const request = getPrototypeDisclosureRequest(input.requestId);
    if (
      !request ||
      request.requesterOrganizationId !== principal.organizationId ||
      request.status !== "APPROVED"
    ) {
      throw new Error("Disclosure request is not awaiting NDA acceptance");
    }
    if (!request.ndaRequired) {
      throw new Error("This disclosure request does not require an NDA");
    }
    updatePrototypeDisclosureRequest(request.id, {
      ndaAcceptedAt: new Date().toISOString()
    });
    return releasePrototypeRequest(request.id);
  }

  const prisma = requirePrisma();
  const request = await prisma.disclosureRequest.findFirst({
    where: {
      id: input.requestId,
      requesterOrganizationId: principal.organizationId,
      status: "APPROVED"
    },
    select: {
      id: true,
      ndaRequired: true
    }
  });
  if (!request) {
    throw new Error("Disclosure request is not awaiting NDA acceptance");
  }
  if (!request.ndaRequired) {
    throw new Error("This disclosure request does not require an NDA");
  }

  await prisma.$transaction(async (tx) => {
    await tx.disclosureRequest.update({
      where: { id: request.id },
      data: { ndaAcceptedAt: new Date() }
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "DISCLOSURE_NDA_ACCEPTED",
        entityType: "DisclosureRequest",
        entityId: request.id,
        nextState: { ndaAccepted: true }
      }
    });
  });

  return releaseDbRequest(request.id);
}

export async function getFarmDisclosurePolicy(
  principal: SessionPrincipal
) {
  assertSupplierReviewer(principal);

  if (dataBackend() === "prototype") {
    return getPrototypeFarmDisclosurePolicy();
  }

  const prisma = requirePrisma();
  const site = await prisma.farmSite.findFirst({
    where: { organizationId: principal.organizationId },
    orderBy: { createdAt: "asc" },
    select: {
      permissions: {
        select: {
          shareGeneralHusbandry: true,
          shareCountyAfterNda: true,
          shareIdentityPrePurchase: true,
          shareIdentityPostPurchase: true
        }
      }
    }
  });
  if (!site) throw new Error("Farm site not found");
  return site.permissions ?? DEFAULT_FARM_POLICY;
}

export async function updateFarmDisclosurePolicy(
  principal: SessionPrincipal,
  input: FarmDisclosurePolicyInput
) {
  assertSupplierReviewer(principal);

  if (dataBackend() === "prototype") {
    return updatePrototypeFarmDisclosurePolicy(input);
  }

  const prisma = requirePrisma();
  const site = await prisma.farmSite.findFirst({
    where: { organizationId: principal.organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });
  if (!site) throw new Error("Farm site not found");

  const updated = await prisma.farmDisclosurePolicy.upsert({
    where: { farmSiteId: site.id },
    create: {
      farmSiteId: site.id,
      ...input
    },
    update: input
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: principal.userId,
      organizationId: principal.organizationId,
      action: "FARM_DISCLOSURE_POLICY_UPDATED",
      entityType: "FarmSite",
      entityId: site.id,
      nextState: input
    }
  });

  return updated;
}
