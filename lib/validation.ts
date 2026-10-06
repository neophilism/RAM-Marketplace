import { z } from "zod";

export const animalSubmissionSchema = z.object({
  species: z.string().min(2).max(80),
  breed: z.string().max(120).optional(),
  sex: z.enum(["Female", "Male", "Unknown"]),
  ageMonths: z.coerce.number().int().positive().max(600).optional(),
  weightKg: z.coerce.number().positive().max(5000).optional(),
  condition: z.string().min(3).max(200),
  diseaseStage: z.string().max(120).optional(),
  observedSigns: z.string().min(10).max(4000),
  firstObservedDate: z.string().optional(),
  existingDiagnosis: z.string().max(500).optional(),
  currentTreatment: z.string().max(2000).optional(),
  cullDecisionDate: z.string().min(1),
  plannedCullAt: z.string().min(1),
  cullReason: z.string().min(5).max(1200),
  welfareUrgency: z.enum(["ROUTINE", "SOON", "URGENT"]),
  independentCullAttestation: z.literal(true),
  ownerAttestation: z.literal(true)
});

export const researchNeedSchema = z.object({
  title: z.string().min(5).max(160),
  condition: z.string().min(3).max(200),
  species: z.string().max(100).optional(),
  minAgeMonths: z.coerce.number().int().nonnegative().optional(),
  maxAgeMonths: z.coerce.number().int().positive().optional(),
  sex: z.enum(["Female", "Male", "Any"]).default("Any"),
  diseaseStage: z.string().max(120).optional(),
  etiologyRequirement: z.string().max(1200).optional(),
  requiredPhenotype: z.string().min(10).max(4000),
  exclusionCriteria: z.string().max(4000).optional(),
  acceptableComorbidities: z.string().max(4000).optional(),
  requiredDiagnostics: z.string().max(3000).optional(),
  procedures: z.string().max(4000).optional(),
  quantity: z.coerce.number().int().positive().max(1000),
  timeline: z.string().min(3).max(300),
  budgetUsd: z.coerce.number().positive().optional(),
  protocolStatus: z.enum(["NOT_STARTED", "DRAFT", "SUBMITTED", "APPROVED"]),
  scientificRationale: z.string().min(20).max(6000)
});

export type AnimalSubmissionInput = z.infer<typeof animalSubmissionSchema>;
export type ResearchNeedInput = z.infer<typeof researchNeedSchema>;


export const veterinaryReviewSchema = z.object({
  animalCaseId: z.string().min(3).max(120),
  outcome: z.enum(["NEEDS_DIAGNOSTICS", "ELIGIBLE", "INELIGIBLE", "WELFARE_HOLD"]),
  diagnosis: z.string().min(3).max(1200).optional(),
  diseaseStage: z.string().max(160).optional(),
  etiology: z.string().max(1200).optional(),
  diagnosticConfidence: z.enum(["Confirmed", "High", "Moderate"]).optional(),
  phenotype: z.string().max(6000).optional(),
  comorbidities: z.string().max(4000).optional(),
  diagnosticEvidence: z.string().max(6000).optional(),
  publicSummary: z.string().max(1200).optional(),
  welfareNotes: z.string().max(3000).optional(),
  diagnosticPlan: z.string().max(3000).optional(),
  transportReady: z.boolean().optional(),
  reviewerAttestation: z.literal(true)
}).superRefine((value, ctx) => {
  if (value.outcome === "ELIGIBLE") {
    const required = [
      ["diagnosis", value.diagnosis],
      ["diagnosticConfidence", value.diagnosticConfidence],
      ["phenotype", value.phenotype],
      ["publicSummary", value.publicSummary]
    ] as const;
    for (const [field, fieldValue] of required) {
      if (!fieldValue || String(fieldValue).trim().length === 0) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Required when marking a candidate eligible"
        });
      }
    }
  }
  if (value.outcome === "NEEDS_DIAGNOSTICS" && !value.diagnosticPlan?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["diagnosticPlan"],
      message: "A diagnostic plan is required when additional diagnostics are needed"
    });
  }
});

export const candidatePublishSchema = z.object({
  animalCaseId: z.string().min(3).max(120),
  listPriceUsd: z.coerce.number().positive().max(1_000_000),
  availabilityText: z.string().min(3).max(200),
  sourceDisclosure: z.enum([
    "PUBLIC_ANONYMIZED",
    "REQUESTABLE",
    "POST_RESERVATION",
    "POST_PURCHASE"
  ]),
  publishAttestation: z.literal(true)
});

export type VeterinaryReviewInput = z.infer<typeof veterinaryReviewSchema>;
export type CandidatePublishInput = z.infer<typeof candidatePublishSchema>;
