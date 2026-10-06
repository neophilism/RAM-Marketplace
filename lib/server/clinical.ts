import "server-only";
import type { SessionPrincipal } from "@/lib/auth/token";
import { requireCapability } from "@/lib/access";
import {
  candidateStatusForVeterinaryOutcome,
  phenotypeLines
} from "@/lib/clinical-policy";
import { rankMatches, scoreMatch, type MatchAnimal, type MatchNeed } from "@/lib/matching";
import { assertCandidateTransition } from "@/lib/state-machines";
import {
  canTransitionResearchNeed,
  requireResearchNeedTransition
} from "@/lib/workflows";
import type {
  CandidatePublishInput,
  VeterinaryReviewInput
} from "@/lib/validation";
import { dataBackend, requirePrisma } from "@/lib/server/db";
import {
  getPrototypeAnimal,
  getPrototypeAnimals,
  getPrototypeMatchesForNeed,
  getPrototypeResearchNeed,
  getPrototypeResearchNeeds,
  replacePrototypeMatchesForAnimal,
  replacePrototypeMatchesForNeed,
  updatePrototypeAnimal,
  updatePrototypeResearchNeed
} from "@/lib/server/prototype-store";

export interface OpsCandidateSummary {
  id: string;
  species: string;
  condition: string;
  status: string;
  plannedCullAt?: string;
  reviewOutcome?: string;
}

export interface VetQueueSummary {
  id: string;
  species: string;
  condition: string;
  status: string;
  ageLabel: string;
  assignedToMe: boolean;
  diagnosticPlan?: string;
}

export interface ResearchOpsSummary {
  id: string;
  title: string;
  condition: string;
  species?: string | null;
  status: string;
}

export interface MatchView {
  animalCaseId: string;
  totalScore: number;
  components: {
    phenotypeFit: number;
    diagnosticConfidence: number;
    etiologyFit: number;
    comorbidityFit: number;
    timingAvailability: number;
    logisticsFit: number;
    priceFit: number;
  };
  reviewFlags: string[];
  reasons: string[];
}

function jsonStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function ageLabel(months: number | null | undefined) {
  if (months == null) return "Age unconfirmed";
  if (months < 24) return `${months} mo`;
  const years = months / 12;
  return `${Number.isInteger(years) ? years : years.toFixed(1)} yr`;
}

function toMatchAnimal(row: {
  publicId: string;
  status: string;
  species: string;
  sex: string | null;
  ageMonths: number | null;
  condition: string;
  diseaseStage: string | null;
  etiology: string | null;
  diagnosticConfidence: string | null;
  phenotype: unknown;
  comorbidities: unknown;
  diagnosticEvidence: unknown;
  publicSummary: string;
  listPriceCents: number | null;
  transportReady: boolean;
  availabilityText: string | null;
}): MatchAnimal {
  return {
    id: row.publicId,
    status: row.status,
    species: row.species,
    sex: row.sex,
    ageMonths: row.ageMonths,
    condition: row.condition,
    diseaseStage: row.diseaseStage,
    etiology: row.etiology,
    diagnosticConfidence: row.diagnosticConfidence,
    phenotype: jsonStrings(row.phenotype),
    comorbidities: jsonStrings(row.comorbidities),
    diagnosticEvidence: jsonStrings(row.diagnosticEvidence),
    publicSummary: row.publicSummary,
    listPriceCents: row.listPriceCents,
    transportReady: row.transportReady,
    availabilityText: row.availabilityText
  };
}

function toMatchNeed(row: {
  id: string;
  status: string;
  condition: string;
  species: string | null;
  minAgeMonths: number | null;
  maxAgeMonths: number | null;
  sex: string | null;
  diseaseStage: string | null;
  etiologyRequirement: string | null;
  requiredPhenotype: string;
  exclusionCriteria: string | null;
  acceptableComorbidities: string | null;
  requiredDiagnostics: string | null;
  timeline: string;
  budgetCents: number | null;
}): MatchNeed {
  return {
    id: row.id,
    status: row.status,
    condition: row.condition,
    species: row.species,
    minAgeMonths: row.minAgeMonths,
    maxAgeMonths: row.maxAgeMonths,
    sex: row.sex,
    diseaseStage: row.diseaseStage,
    etiologyRequirement: row.etiologyRequirement,
    requiredPhenotype: row.requiredPhenotype,
    exclusionCriteria: row.exclusionCriteria,
    acceptableComorbidities: row.acceptableComorbidities,
    requiredDiagnostics: row.requiredDiagnostics,
    timeline: row.timeline,
    budgetCents: row.budgetCents
  };
}

function prototypeMatchAnimal(id: string): MatchAnimal {
  const animal = getPrototypeAnimal(id);
  if (!animal) throw new Error("Candidate not found");
  return {
    id: animal.id,
    status: animal.status,
    species: animal.species,
    sex: animal.sex,
    ageMonths: animal.ageMonths,
    condition: animal.condition,
    diseaseStage: animal.diseaseStage,
    etiology: animal.etiology,
    diagnosticConfidence: animal.diagnosticConfidence,
    phenotype: animal.phenotype,
    comorbidities: animal.comorbidities,
    diagnosticEvidence: animal.diagnosticEvidence,
    publicSummary: animal.publicSummary,
    listPriceCents: animal.listPriceCents,
    transportReady: animal.transportReady,
    availabilityText: animal.availabilityText
  };
}

function prototypeMatchNeed(id: string): MatchNeed {
  const need = getPrototypeResearchNeed(id);
  if (!need) throw new Error("Research need not found");
  return {
    id: need.id,
    status: need.status,
    condition: need.input.condition,
    species: need.input.species,
    minAgeMonths: need.input.minAgeMonths,
    maxAgeMonths: need.input.maxAgeMonths,
    sex: need.input.sex,
    diseaseStage: need.input.diseaseStage,
    etiologyRequirement: need.input.etiologyRequirement,
    requiredPhenotype: need.input.requiredPhenotype,
    exclusionCriteria: need.input.exclusionCriteria,
    acceptableComorbidities: need.input.acceptableComorbidities,
    requiredDiagnostics: need.input.requiredDiagnostics,
    timeline: need.input.timeline,
    budgetCents: need.input.budgetUsd
      ? Math.round(need.input.budgetUsd * 100)
      : undefined
  };
}

async function refreshMatchesForNeed(researchNeedId: string) {
  if (dataBackend() === "prototype") {
    const need = prototypeMatchNeed(researchNeedId);
    const animals = getPrototypeAnimals()
      .filter((animal) => animal.status === "MATCHABLE")
      .map((animal) => prototypeMatchAnimal(animal.id));
    return replacePrototypeMatchesForNeed(researchNeedId, rankMatches(animals, need));
  }

  const prisma = requirePrisma();
  const needRow = await prisma.researchNeed.findUnique({
    where: { id: researchNeedId }
  });
  if (!needRow || needRow.status !== "ACTIVE") {
    await prisma.researchMatch.deleteMany({ where: { researchNeedId } });
    return [];
  }

  const animalRows = await prisma.animalCase.findMany({
    where: { status: "MATCHABLE" },
    select: {
      publicId: true,
      status: true,
      species: true,
      sex: true,
      ageMonths: true,
      condition: true,
      diseaseStage: true,
      etiology: true,
      diagnosticConfidence: true,
      phenotype: true,
      comorbidities: true,
      diagnosticEvidence: true,
      publicSummary: true,
      listPriceCents: true,
      transportReady: true,
      availabilityText: true
    }
  });

  const matches = rankMatches(
    animalRows.map(toMatchAnimal),
    toMatchNeed(needRow)
  );

  await prisma.$transaction(async (tx) => {
    await tx.researchMatch.deleteMany({ where: { researchNeedId } });
    for (const match of matches) {
      await tx.researchMatch.create({
        data: {
          researchNeedId,
          animalCaseId: match.animalCaseId,
          totalScore: match.totalScore,
          phenotypeFit: match.components.phenotypeFit,
          diagnosticConfidence: match.components.diagnosticConfidence,
          etiologyFit: match.components.etiologyFit,
          comorbidityFit: match.components.comorbidityFit,
          timingAvailability: match.components.timingAvailability,
          logisticsFit: match.components.logisticsFit,
          priceFit: match.components.priceFit,
          hardGates: match.hardGates,
          reviewFlags: match.reviewFlags,
          reasons: match.reasons
        }
      });
    }
  });

  return matches;
}

async function refreshMatchesForAnimal(animalCaseId: string) {
  if (dataBackend() === "prototype") {
    const animal = prototypeMatchAnimal(animalCaseId);
    const needs = getPrototypeResearchNeeds().filter((need) => need.status === "ACTIVE");
    const matches = needs
      .map((need) => scoreMatch(animal, prototypeMatchNeed(need.id)))
      .filter((match) => match.eligible);
    return replacePrototypeMatchesForAnimal(animalCaseId, matches);
  }

  const prisma = requirePrisma();
  const animalRow = await prisma.animalCase.findUnique({
    where: { publicId: animalCaseId },
    select: {
      publicId: true,
      status: true,
      species: true,
      sex: true,
      ageMonths: true,
      condition: true,
      diseaseStage: true,
      etiology: true,
      diagnosticConfidence: true,
      phenotype: true,
      comorbidities: true,
      diagnosticEvidence: true,
      publicSummary: true,
      listPriceCents: true,
      transportReady: true,
      availabilityText: true
    }
  });
  if (!animalRow || animalRow.status !== "MATCHABLE") {
    await prisma.researchMatch.deleteMany({ where: { animalCaseId } });
    return [];
  }

  const needs = await prisma.researchNeed.findMany({ where: { status: "ACTIVE" } });
  const animal = toMatchAnimal(animalRow);
  const matches = needs
    .map((need) => scoreMatch(animal, toMatchNeed(need)))
    .filter((match) => match.eligible);

  await prisma.$transaction(async (tx) => {
    await tx.researchMatch.deleteMany({ where: { animalCaseId } });
    for (const match of matches) {
      await tx.researchMatch.create({
        data: {
          researchNeedId: match.researchNeedId,
          animalCaseId,
          totalScore: match.totalScore,
          phenotypeFit: match.components.phenotypeFit,
          diagnosticConfidence: match.components.diagnosticConfidence,
          etiologyFit: match.components.etiologyFit,
          comorbidityFit: match.components.comorbidityFit,
          timingAvailability: match.components.timingAvailability,
          logisticsFit: match.components.logisticsFit,
          priceFit: match.components.priceFit,
          hardGates: match.hardGates,
          reviewFlags: match.reviewFlags,
          reasons: match.reasons
        }
      });
    }
  });

  return matches;
}

export async function listOpsCandidateQueue(
  principal: SessionPrincipal
): Promise<OpsCandidateSummary[]> {
  requireCapability(principal.role, "operations:manage");

  if (dataBackend() === "prototype") {
    return getPrototypeAnimals()
      .filter((animal) =>
        ["SUBMITTED", "PRE_SCREENED", "VET_PENDING", "VERIFIED"].includes(animal.status)
      )
      .map((animal) => ({
        id: animal.id,
        species: animal.species,
        condition: animal.condition,
        status: animal.status,
        reviewOutcome: animal.veterinaryReview?.outcome
      }));
  }

  const prisma = requirePrisma();
  const rows = await prisma.animalCase.findMany({
    where: {
      status: { in: ["SUBMITTED", "PRE_SCREENED", "VET_PENDING", "VERIFIED"] }
    },
    orderBy: { createdAt: "asc" },
    select: {
      publicId: true,
      species: true,
      condition: true,
      status: true,
      cullEvent: { select: { plannedCullAt: true } },
      veterinaryReviews: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { outcome: true }
      }
    }
  });

  return rows.map((row) => ({
    id: row.publicId,
    species: row.species,
    condition: row.condition,
    status: row.status,
    plannedCullAt: row.cullEvent?.plannedCullAt.toLocaleDateString(),
    reviewOutcome: row.veterinaryReviews[0]?.outcome
  }));
}

export async function preScreenCandidate(
  principal: SessionPrincipal,
  animalCaseId: string
) {
  requireCapability(principal.role, "operations:manage");

  if (dataBackend() === "prototype") {
    const animal = getPrototypeAnimal(animalCaseId);
    if (!animal) throw new Error("Candidate not found");
    assertCandidateTransition(animal.status as never, "PRE_SCREENED");
    return updatePrototypeAnimal(animalCaseId, { status: "PRE_SCREENED" });
  }

  const prisma = requirePrisma();
  const animal = await prisma.animalCase.findUnique({ where: { publicId: animalCaseId } });
  if (!animal) throw new Error("Candidate not found");
  assertCandidateTransition(animal.status, "PRE_SCREENED");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.animalCase.update({
      where: { publicId: animalCaseId },
      data: { status: "PRE_SCREENED" }
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "CANDIDATE_PRE_SCREENED",
        entityType: "AnimalCase",
        entityId: animalCaseId,
        previousState: { status: animal.status },
        nextState: { status: "PRE_SCREENED" }
      }
    });
    return updated;
  });
}

export async function listVeterinaryQueue(
  principal: SessionPrincipal
): Promise<VetQueueSummary[]> {
  requireCapability(principal.role, "animal:verify");

  if (dataBackend() === "prototype") {
    return getPrototypeAnimals()
      .filter((animal) => ["PRE_SCREENED", "VET_PENDING"].includes(animal.status))
      .map((animal) => ({
        id: animal.id,
        species: animal.species,
        condition: animal.condition,
        status: animal.status,
        ageLabel: ageLabel(animal.ageMonths),
        assignedToMe: animal.vetReviewerUserId === principal.userId,
        diagnosticPlan: animal.veterinaryReview?.diagnosticPlan
      }));
  }

  const prisma = requirePrisma();
  const rows = await prisma.animalCase.findMany({
    where: { status: { in: ["PRE_SCREENED", "VET_PENDING"] } },
    orderBy: { updatedAt: "asc" },
    select: {
      publicId: true,
      species: true,
      condition: true,
      status: true,
      ageMonths: true,
      veterinaryReviews: {
        where: { outcome: { in: ["PENDING", "NEEDS_DIAGNOSTICS"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          reviewerUserId: true,
          diagnosticPlan: true
        }
      }
    }
  });

  return rows.map((row) => ({
    id: row.publicId,
    species: row.species,
    condition: row.condition,
    status: row.status,
    ageLabel: ageLabel(row.ageMonths),
    assignedToMe: row.veterinaryReviews[0]?.reviewerUserId === principal.userId,
    diagnosticPlan: row.veterinaryReviews[0]?.diagnosticPlan ?? undefined
  }));
}

export async function claimVeterinaryCandidate(
  principal: SessionPrincipal,
  animalCaseId: string
) {
  requireCapability(principal.role, "animal:verify");

  if (dataBackend() === "prototype") {
    const animal = getPrototypeAnimal(animalCaseId);
    if (!animal) throw new Error("Candidate not found");
    assertCandidateTransition(animal.status as never, "VET_PENDING");
    return updatePrototypeAnimal(animalCaseId, {
      status: "VET_PENDING",
      vetReviewerUserId: principal.userId
    });
  }

  const prisma = requirePrisma();
  return prisma.$transaction(async (tx) => {
    const animal = await tx.animalCase.findUnique({ where: { publicId: animalCaseId } });
    if (!animal) throw new Error("Candidate not found");
    assertCandidateTransition(animal.status, "VET_PENDING");

    const updated = await tx.animalCase.update({
      where: { publicId: animalCaseId },
      data: { status: "VET_PENDING" }
    });
    await tx.veterinaryReview.create({
      data: {
        animalCaseId,
        reviewerUserId: principal.userId,
        outcome: "PENDING"
      }
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "VETERINARY_REVIEW_CLAIMED",
        entityType: "AnimalCase",
        entityId: animalCaseId,
        previousState: { status: animal.status },
        nextState: { status: "VET_PENDING" }
      }
    });
    return updated;
  });
}

export async function submitVeterinaryReview(
  principal: SessionPrincipal,
  input: VeterinaryReviewInput
) {
  requireCapability(principal.role, "animal:verify");
  const nextStatus = candidateStatusForVeterinaryOutcome(input.outcome);

  if (dataBackend() === "prototype") {
    const animal = getPrototypeAnimal(input.animalCaseId);
    if (!animal) throw new Error("Candidate not found");
    if (animal.status !== "VET_PENDING") {
      throw new Error("Candidate is not in veterinary review");
    }
    if (animal.vetReviewerUserId && animal.vetReviewerUserId !== principal.userId) {
      throw new Error("Forbidden: candidate is assigned to another veterinarian");
    }
    if (nextStatus !== "VET_PENDING") {
      assertCandidateTransition(animal.status as never, nextStatus);
    }
    return updatePrototypeAnimal(input.animalCaseId, {
      status: nextStatus,
      diseaseStage: input.diseaseStage ?? animal.diseaseStage,
      etiology: input.etiology ?? animal.etiology,
      diagnosticConfidence: input.diagnosticConfidence ?? animal.diagnosticConfidence,
      phenotype: input.phenotype ? phenotypeLines(input.phenotype) : animal.phenotype,
      comorbidities: input.comorbidities ? phenotypeLines(input.comorbidities) : animal.comorbidities,
      diagnosticEvidence: input.diagnosticEvidence ? phenotypeLines(input.diagnosticEvidence) : animal.diagnosticEvidence,
      publicSummary: input.publicSummary ?? animal.publicSummary,
      transportReady: input.transportReady ?? animal.transportReady,
      veterinaryReview: input,
      vetReviewerUserId: principal.userId
    });
  }

  const prisma = requirePrisma();
  return prisma.$transaction(async (tx) => {
    const animal = await tx.animalCase.findUnique({ where: { publicId: input.animalCaseId } });
    if (!animal) throw new Error("Candidate not found");
    if (animal.status !== "VET_PENDING") throw new Error("Candidate is not in veterinary review");

    const pendingReview = await tx.veterinaryReview.findFirst({
      where: {
        animalCaseId: input.animalCaseId,
        reviewerUserId: principal.userId,
        outcome: { in: ["PENDING", "NEEDS_DIAGNOSTICS"] }
      },
      orderBy: { createdAt: "desc" }
    });
    if (!pendingReview) {
      throw new Error("Forbidden: claim this candidate before submitting a review");
    }

    if (nextStatus !== "VET_PENDING") {
      assertCandidateTransition(animal.status, nextStatus);
    }

    await tx.veterinaryReview.update({
      where: { id: pendingReview.id },
      data: {
        outcome: input.outcome,
        diagnosis: input.diagnosis,
        welfareNotes: input.welfareNotes,
        diagnosticPlan: input.diagnosticPlan,
        diseaseStage: input.diseaseStage,
        etiology: input.etiology,
        diagnosticConfidence: input.diagnosticConfidence,
        phenotype: input.phenotype ? phenotypeLines(input.phenotype) : undefined,
        comorbidities: input.comorbidities ? phenotypeLines(input.comorbidities) : undefined,
        diagnosticEvidence: input.diagnosticEvidence ? phenotypeLines(input.diagnosticEvidence) : undefined,
        publicSummary: input.publicSummary,
        transportReady: input.transportReady,
        reviewedAt: new Date()
      }
    });

    const updated = await tx.animalCase.update({
      where: { publicId: input.animalCaseId },
      data: {
        status: nextStatus,
        diseaseStage: input.diseaseStage ?? undefined,
        etiology: input.etiology ?? undefined,
        diagnosticConfidence: input.diagnosticConfidence ?? undefined,
        phenotype: input.phenotype ? phenotypeLines(input.phenotype) : undefined,
        comorbidities: input.comorbidities ? phenotypeLines(input.comorbidities) : undefined,
        diagnosticEvidence: input.diagnosticEvidence ? phenotypeLines(input.diagnosticEvidence) : undefined,
        publicSummary: input.publicSummary ?? undefined,
        transportReady: input.transportReady ?? undefined
      }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "VETERINARY_REVIEW_SUBMITTED",
        entityType: "AnimalCase",
        entityId: input.animalCaseId,
        previousState: { status: animal.status },
        nextState: { status: nextStatus, outcome: input.outcome },
        metadata: {
          reviewerAttestation: input.reviewerAttestation,
          diagnosticConfidence: input.diagnosticConfidence ?? null
        }
      }
    });

    return updated;
  });
}

export async function publishCandidate(
  principal: SessionPrincipal,
  input: CandidatePublishInput
) {
  requireCapability(principal.role, "operations:manage");

  if (dataBackend() === "prototype") {
    const animal = getPrototypeAnimal(input.animalCaseId);
    if (!animal) throw new Error("Candidate not found");
    assertCandidateTransition(animal.status as never, "MATCHABLE");
    const updated = updatePrototypeAnimal(input.animalCaseId, {
      status: "MATCHABLE",
      listPriceCents: Math.round(input.listPriceUsd * 100),
      availabilityText: input.availabilityText
    });
    await refreshMatchesForAnimal(input.animalCaseId);
    return updated;
  }

  const prisma = requirePrisma();
  const animal = await prisma.animalCase.findUnique({
    where: { publicId: input.animalCaseId }
  });
  if (!animal) throw new Error("Candidate not found");
  assertCandidateTransition(animal.status, "MATCHABLE");

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.animalCase.update({
      where: { publicId: input.animalCaseId },
      data: {
        status: "MATCHABLE",
        listPriceCents: Math.round(input.listPriceUsd * 100),
        availabilityText: input.availabilityText,
        sourceDisclosure: input.sourceDisclosure
      }
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "CANDIDATE_PUBLISHED",
        entityType: "AnimalCase",
        entityId: input.animalCaseId,
        previousState: { status: animal.status },
        nextState: {
          status: "MATCHABLE",
          listPriceCents: Math.round(input.listPriceUsd * 100),
          sourceDisclosure: input.sourceDisclosure
        },
        metadata: { publishAttestation: input.publishAttestation }
      }
    });
    return result;
  });

  await refreshMatchesForAnimal(input.animalCaseId);
  return updated;
}

export async function listResearchNeedsForOps(
  principal: SessionPrincipal
): Promise<ResearchOpsSummary[]> {
  requireCapability(principal.role, "operations:manage");

  if (dataBackend() === "prototype") {
    return getPrototypeResearchNeeds()
      .filter((need) => ["SUBMITTED", "VERIFIED"].includes(need.status))
      .map((need) => ({
        id: need.id,
        title: need.title,
        condition: need.input.condition,
        species: need.input.species,
        status: need.status
      }));
  }

  const prisma = requirePrisma();
  return prisma.researchNeed.findMany({
    where: { status: { in: ["SUBMITTED", "VERIFIED"] } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      condition: true,
      species: true,
      status: true
    }
  });
}

export async function activateResearchNeed(
  principal: SessionPrincipal,
  researchNeedId: string
) {
  requireCapability(principal.role, "operations:manage");

  if (dataBackend() === "prototype") {
    const need = getPrototypeResearchNeed(researchNeedId);
    if (!need) throw new Error("Research need not found");
    if (need.status === "SUBMITTED") {
      requireResearchNeedTransition("SUBMITTED", "VERIFIED");
      updatePrototypeResearchNeed(researchNeedId, { status: "VERIFIED" });
    }
    const afterVerify = getPrototypeResearchNeed(researchNeedId)!;
    requireResearchNeedTransition(afterVerify.status as never, "ACTIVE");
    const updated = updatePrototypeResearchNeed(researchNeedId, { status: "ACTIVE" });
    await refreshMatchesForNeed(researchNeedId);
    return updated;
  }

  const prisma = requirePrisma();
  const need = await prisma.researchNeed.findUnique({ where: { id: researchNeedId } });
  if (!need) throw new Error("Research need not found");

  let current = need.status;
  if (current === "SUBMITTED") {
    requireResearchNeedTransition("SUBMITTED", "VERIFIED");
    current = "VERIFIED";
  }
  if (!canTransitionResearchNeed(current, "ACTIVE")) {
    throw new Error(`Research need cannot be activated from ${need.status}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.researchNeed.update({
      where: { id: researchNeedId },
      data: { status: "ACTIVE" }
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "RESEARCH_NEED_ACTIVATED",
        entityType: "ResearchNeed",
        entityId: researchNeedId,
        previousState: { status: need.status },
        nextState: { status: "ACTIVE" }
      }
    });
    return result;
  });

  await refreshMatchesForNeed(researchNeedId);
  return updated;
}

export async function listResearchNeedMatches(
  principal: SessionPrincipal,
  researchNeedId: string
): Promise<MatchView[]> {
  requireCapability(principal.role, "match:review");

  if (dataBackend() === "prototype") {
    return getPrototypeMatchesForNeed(researchNeedId).map((match) => ({
      animalCaseId: match.animalCaseId,
      totalScore: match.totalScore,
      components: match.components,
      reviewFlags: match.reviewFlags,
      reasons: match.reasons
    }));
  }

  const prisma = requirePrisma();
  const need = await prisma.researchNeed.findUnique({
    where: { id: researchNeedId },
    select: { organizationId: true }
  });
  if (!need) throw new Error("Research need not found");
  if (
    need.organizationId !== principal.organizationId &&
    !principal.role.startsWith("RAM_")
  ) {
    throw new Error("Forbidden: research need belongs to another organization");
  }

  const rows = await prisma.researchMatch.findMany({
    where: { researchNeedId },
    orderBy: { totalScore: "desc" }
  });

  return rows.map((row) => ({
    animalCaseId: row.animalCaseId,
    totalScore: row.totalScore,
    components: {
      phenotypeFit: row.phenotypeFit,
      diagnosticConfidence: row.diagnosticConfidence,
      etiologyFit: row.etiologyFit,
      comorbidityFit: row.comorbidityFit,
      timingAvailability: row.timingAvailability,
      logisticsFit: row.logisticsFit,
      priceFit: row.priceFit
    },
    reviewFlags: jsonStrings(row.reviewFlags),
    reasons: jsonStrings(row.reasons)
  }));
}

export async function getVeterinaryCandidate(
  principal: SessionPrincipal,
  animalCaseId: string
) {
  requireCapability(principal.role, "animal:verify");

  if (dataBackend() === "prototype") {
    const animal = getPrototypeAnimal(animalCaseId);
    if (!animal) throw new Error("Candidate not found");
    return {
      id: animal.id,
      species: animal.species,
      condition: animal.condition,
      status: animal.status,
      ageLabel: ageLabel(animal.ageMonths),
      assignedToMe: animal.vetReviewerUserId === principal.userId,
      observedSigns: animal.input.observedSigns,
      existingDiagnosis: animal.input.existingDiagnosis,
      currentTreatment: animal.input.currentTreatment,
      cullReason: animal.input.cullReason
    };
  }

  const prisma = requirePrisma();
  const row = await prisma.animalCase.findUnique({
    where: { publicId: animalCaseId },
    select: {
      publicId: true,
      species: true,
      condition: true,
      status: true,
      ageMonths: true,
      sourceRecord: {
        select: {
          privateHistory: true,
          privateNotes: true
        }
      },
      cullEvent: { select: { reason: true } },
      veterinaryReviews: {
        where: { outcome: { in: ["PENDING", "NEEDS_DIAGNOSTICS"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { reviewerUserId: true }
      }
    }
  });
  if (!row) throw new Error("Candidate not found");

  const history =
    row.sourceRecord?.privateHistory &&
    typeof row.sourceRecord.privateHistory === "object" &&
    !Array.isArray(row.sourceRecord.privateHistory)
      ? row.sourceRecord.privateHistory as Record<string, unknown>
      : {};

  return {
    id: row.publicId,
    species: row.species,
    condition: row.condition,
    status: row.status,
    ageLabel: ageLabel(row.ageMonths),
    assignedToMe: row.veterinaryReviews[0]?.reviewerUserId === principal.userId,
    observedSigns:
      typeof history.observedSigns === "string" ? history.observedSigns : undefined,
    existingDiagnosis:
      typeof history.existingDiagnosis === "string" ? history.existingDiagnosis : undefined,
    currentTreatment: row.sourceRecord?.privateNotes ?? undefined,
    cullReason: row.cullEvent?.reason
  };
}

export async function getOpsCandidate(
  principal: SessionPrincipal,
  animalCaseId: string
) {
  requireCapability(principal.role, "operations:manage");

  if (dataBackend() === "prototype") {
    const animal = getPrototypeAnimal(animalCaseId);
    if (!animal) throw new Error("Candidate not found");
    return {
      id: animal.id,
      species: animal.species,
      condition: animal.condition,
      status: animal.status,
      diseaseStage: animal.diseaseStage,
      etiology: animal.etiology,
      diagnosticConfidence: animal.diagnosticConfidence,
      phenotype: animal.phenotype,
      comorbidities: animal.comorbidities,
      diagnosticEvidence: animal.diagnosticEvidence,
      publicSummary: animal.publicSummary,
      transportReady: animal.transportReady
    };
  }

  const prisma = requirePrisma();
  const row = await prisma.animalCase.findUnique({
    where: { publicId: animalCaseId },
    select: {
      publicId: true,
      species: true,
      condition: true,
      status: true,
      diseaseStage: true,
      etiology: true,
      diagnosticConfidence: true,
      phenotype: true,
      comorbidities: true,
      diagnosticEvidence: true,
      publicSummary: true,
      transportReady: true
    }
  });
  if (!row) throw new Error("Candidate not found");
  return {
    id: row.publicId,
    species: row.species,
    condition: row.condition,
    status: row.status,
    diseaseStage: row.diseaseStage,
    etiology: row.etiology,
    diagnosticConfidence: row.diagnosticConfidence,
    phenotype: jsonStrings(row.phenotype),
    comorbidities: jsonStrings(row.comorbidities),
    diagnosticEvidence: jsonStrings(row.diagnosticEvidence),
    publicSummary: row.publicSummary,
    transportReady: row.transportReady
  };
}
