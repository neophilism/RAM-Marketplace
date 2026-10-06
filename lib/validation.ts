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
  welfareUrgency: z.enum(["ROUTINE", "SOON", "URGENT"]),
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
