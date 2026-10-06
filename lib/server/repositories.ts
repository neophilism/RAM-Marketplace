import "server-only";
import { randomUUID } from "node:crypto";
import type { SessionPrincipal } from "@/lib/auth/token";
import { requireCapability } from "@/lib/access";
import type { AnimalSubmissionInput, ResearchNeedInput } from "@/lib/validation";
import { dataBackend, requirePrisma } from "@/lib/server/db";
import {
  getPrototypeAnimals,
  getPrototypeResearchNeeds,
  savePrototypeAnimal,
  savePrototypeResearchNeed
} from "@/lib/server/prototype-store";

export interface FarmCaseSummary {
  id: string;
  condition: string;
  status: string;
  action: string;
}

export interface ResearchNeedSummary {
  id: string;
  title: string;
  status: string;
  matches: number;
  updated: string;
}

function publicAnimalId(species: string) {
  const code = species.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "AN";
  return `RAM-${code}-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

function statusAction(status: string) {
  switch (status) {
    case "SUBMITTED":
      return "Awaiting RAM pre-screen";
    case "PRE_SCREENED":
      return "Awaiting veterinary assignment";
    case "VET_PENDING":
      return "Veterinary review in progress";
    case "VERIFIED":
      return "Preparing marketplace record";
    case "MATCHABLE":
      return "Available for research matching";
    case "RESERVED":
      return "Reserved for buyer clearance";
    case "SOLD_TO_RAM":
      return "Preparing transfer";
    case "TRANSFERRED":
      return "Transfer completed";
    default:
      return status.replaceAll("_", " ").toLowerCase();
  }
}

export async function createAnimalCandidate(
  principal: SessionPrincipal,
  input: AnimalSubmissionInput
): Promise<FarmCaseSummary> {
  requireCapability(principal.role, "animal:create");

  if (dataBackend() === "prototype") {
    return savePrototypeAnimal(input);
  }

  const prisma = requirePrisma();
  const farmSite = await prisma.farmSite.findFirst({
    where: { organizationId: principal.organizationId },
    include: { organization: true }
  });

  if (!farmSite) {
    throw new Error("Farm onboarding is incomplete: no farm site is configured");
  }

  const publicId = publicAnimalId(input.species);
  const submittedAt = new Date();
  const cullDecisionAt = new Date(`${input.cullDecisionDate}T00:00:00.000Z`);
  const plannedCullAt = new Date(`${input.plannedCullAt}T00:00:00.000Z`);

  await prisma.$transaction(async (tx) => {
    await tx.animalCase.create({
      data: {
        publicId,
        species: input.species,
        breed: input.breed,
        sex: input.sex,
        ageMonths: input.ageMonths,
        weightKg: input.weightKg,
        condition: input.condition,
        diseaseStage: input.diseaseStage,
        regionLabel: farmSite.regionLabel,
        publicSummary: "Submitted for RAM veterinary characterization; not yet marketable.",
        status: "SUBMITTED",
        sourceDisclosure: "PUBLIC_ANONYMIZED",
        sourceRecord: {
          create: {
            farmSiteId: farmSite.id,
            exactAddress: farmSite.exactAddress,
            legalOwnerName: farmSite.organization.name,
            ownerContactName: principal.name,
            ownerContactEmail: principal.email,
            privateHistory: {
              observedSigns: input.observedSigns,
              firstObservedDate: input.firstObservedDate ?? null,
              existingDiagnosis: input.existingDiagnosis ?? null,
              welfareUrgency: input.welfareUrgency
            },
            privateNotes: input.currentTreatment ?? null
          }
        },
        cullEvent: {
          create: {
            declaredAt: cullDecisionAt,
            plannedCullAt,
            reason: input.cullReason,
            independentlyIdentified: input.independentCullAttestation
          }
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "CANDIDATE_SUBMITTED",
        entityType: "AnimalCase",
        entityId: publicId,
        nextState: { status: "SUBMITTED" },
        metadata: {
          ownerAttestation: input.ownerAttestation,
          independentCullAttestation: input.independentCullAttestation
        }
      }
    });
  });

  return {
    id: publicId,
    condition: input.condition,
    status: "SUBMITTED",
    action: "Awaiting RAM pre-screen"
  };
}

export async function listFarmCases(principal: SessionPrincipal): Promise<FarmCaseSummary[]> {
  requireCapability(principal.role, "animal:create");

  if (dataBackend() === "prototype") {
    return getPrototypeAnimals();
  }

  const prisma = requirePrisma();
  const rows = await prisma.animalCase.findMany({
    where: {
      sourceRecord: {
        is: {
          farmSite: {
            organizationId: principal.organizationId
          }
        }
      }
    },
    orderBy: { createdAt: "desc" },
    select: {
      publicId: true,
      condition: true,
      status: true
    }
  });

  return rows.map((row) => ({
    id: row.publicId,
    condition: row.condition,
    status: row.status,
    action: statusAction(row.status)
  }));
}

export async function createResearchNeed(
  principal: SessionPrincipal,
  input: ResearchNeedInput
): Promise<ResearchNeedSummary> {
  requireCapability(principal.role, "research_need:create");

  if (dataBackend() === "prototype") {
    return savePrototypeResearchNeed(input);
  }

  const prisma = requirePrisma();
  const created = await prisma.$transaction(async (tx) => {
    const need = await tx.researchNeed.create({
      data: {
        organizationId: principal.organizationId,
        createdByUserId: principal.userId,
        title: input.title,
        condition: input.condition,
        species: input.species,
        minAgeMonths: input.minAgeMonths,
        maxAgeMonths: input.maxAgeMonths,
        sex: input.sex,
        diseaseStage: input.diseaseStage,
        requiredPhenotype: input.requiredPhenotype,
        exclusionCriteria: input.exclusionCriteria,
        acceptableComorbidities: input.acceptableComorbidities,
        requiredDiagnostics: input.requiredDiagnostics,
        procedures: input.procedures,
        quantity: input.quantity,
        timeline: input.timeline,
        budgetCents: input.budgetUsd ? Math.round(input.budgetUsd * 100) : null,
        protocolStatus: input.protocolStatus,
        scientificRationale: input.scientificRationale,
        status: "SUBMITTED"
      }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "RESEARCH_NEED_SUBMITTED",
        entityType: "ResearchNeed",
        entityId: need.id,
        nextState: { status: "SUBMITTED" }
      }
    });

    return need;
  });

  return {
    id: created.id,
    title: created.title,
    status: created.status,
    matches: 0,
    updated: "Just now"
  };
}

export async function listResearchNeeds(
  principal: SessionPrincipal
): Promise<ResearchNeedSummary[]> {
  requireCapability(principal.role, "research_need:create");

  if (dataBackend() === "prototype") {
    return getPrototypeResearchNeeds();
  }

  const prisma = requirePrisma();
  const rows = await prisma.researchNeed.findMany({
    where: { organizationId: principal.organizationId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
      _count: { select: { matches: true } }
    }
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    matches: row._count.matches,
    updated: row.updatedAt.toLocaleDateString()
  }));
}

export async function getOrganizationContext(principal: SessionPrincipal) {
  if (dataBackend() === "prototype") {
    return {
      id: principal.organizationId,
      name: "Prototype organization",
      type: principal.role.startsWith("SUPPLIER_") ? "FARM" : "RESEARCH_INSTITUTION",
      status: "ACTIVE"
    };
  }

  const prisma = requirePrisma();
  return prisma.organization.findUnique({
    where: { id: principal.organizationId },
    select: { id: true, name: true, type: true, status: true }
  });
}
