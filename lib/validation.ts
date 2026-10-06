import { z } from "zod";
import { DISCLOSURE_FIELDS } from "./disclosure-policy";

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
  generalHusbandry: z.string().max(4000).optional(),
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


export const reserveOrderSchema = z.object({
  animalCaseId: z.string().min(3).max(120),
  researchNeedId: z.string().min(3).max(120)
});

export const buyerCommitmentSchema = z.object({
  orderId: z.string().min(3).max(120),
  receivingFacilityName: z.string().min(2).max(240),
  receivingFacilityAddress: z.string().min(5).max(800),
  protocolReference: z.string().min(2).max(240),
  institutionalApprovalAttested: z.literal(true),
  purchasingAuthorityAttested: z.literal(true)
});

export const supplierPricingPolicySchema = z.object({
  species: z.string().min(2).max(80),
  standardizedCullScheduleUsd: z.coerce.number().nonnegative().max(1_000_000),
  marketCeilingUsd: z.coerce.number().nonnegative().max(1_000_000)
});

export const clearanceReviewSchema = z.object({
  orderId: z.string().min(3).max(120),
  decision: z.enum(["CLEARED", "FAILED"]),
  protocolConfirmed: z.boolean(),
  receivingFacilityConfirmed: z.boolean(),
  welfareConfirmed: z.boolean(),
  biosecurityConfirmed: z.boolean(),
  movementRequirementsConfirmed: z.boolean(),
  transportPlanConfirmed: z.boolean(),
  sourceProvenanceConfirmed: z.boolean(),
  blockingFindings: z.string().max(6000).optional(),
  notes: z.string().max(6000).optional()
}).superRefine((value, ctx) => {
  if (value.decision === "CLEARED") {
    const requiredChecks = [
      ["protocolConfirmed", value.protocolConfirmed],
      ["receivingFacilityConfirmed", value.receivingFacilityConfirmed],
      ["welfareConfirmed", value.welfareConfirmed],
      ["biosecurityConfirmed", value.biosecurityConfirmed],
      ["movementRequirementsConfirmed", value.movementRequirementsConfirmed],
      ["transportPlanConfirmed", value.transportPlanConfirmed],
      ["sourceProvenanceConfirmed", value.sourceProvenanceConfirmed]
    ] as const;

    for (const [field, confirmed] of requiredChecks) {
      if (!confirmed) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "All clearance gates must be confirmed before an order can be cleared"
        });
      }
    }

    if (value.blockingFindings?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["blockingFindings"],
        message: "A cleared order cannot contain blocking findings"
      });
    }
  }

  if (value.decision === "FAILED" && !value.blockingFindings?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["blockingFindings"],
      message: "A failed clearance requires at least one blocking finding"
    });
  }
});

export type ReserveOrderInput = z.infer<typeof reserveOrderSchema>;
export type BuyerCommitmentInput = z.infer<typeof buyerCommitmentSchema>;
export type SupplierPricingPolicyInput = z.infer<typeof supplierPricingPolicySchema>;
export type ClearanceReviewInput = z.infer<typeof clearanceReviewSchema>;


export const disclosureRequestSchema = z.object({
  animalCaseId: z.string().min(3).max(120),
  researchNeedId: z.string().min(3).max(120),
  requestedFields: z.array(z.enum(DISCLOSURE_FIELDS)).min(1).max(DISCLOSURE_FIELDS.length),
  scientificReason: z.string().min(20).max(4000)
});

export const disclosureRamReviewSchema = z.object({
  requestId: z.string().min(3).max(120),
  decision: z.enum(["APPROVE", "DENY"]),
  denialReason: z.string().max(2000).optional()
}).superRefine((value, ctx) => {
  if (value.decision === "DENY" && !value.denialReason?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["denialReason"],
      message: "A denial reason is required"
    });
  }
});

export const disclosureSupplierReviewSchema = z.object({
  requestId: z.string().min(3).max(120),
  decision: z.enum(["APPROVE", "DENY"]),
  denialReason: z.string().max(2000).optional()
}).superRefine((value, ctx) => {
  if (value.decision === "DENY" && !value.denialReason?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["denialReason"],
      message: "A denial reason is required"
    });
  }
});

export const disclosureNdaAcceptSchema = z.object({
  requestId: z.string().min(3).max(120),
  accepted: z.literal(true)
});

export const farmDisclosurePolicySchema = z.object({
  shareGeneralHusbandry: z.boolean(),
  shareCountyAfterNda: z.boolean(),
  shareIdentityPrePurchase: z.boolean(),
  shareIdentityPostPurchase: z.boolean()
});

export type DisclosureRequestInput = z.infer<typeof disclosureRequestSchema>;
export type DisclosureRamReviewInput = z.infer<typeof disclosureRamReviewSchema>;
export type DisclosureSupplierReviewInput = z.infer<typeof disclosureSupplierReviewSchema>;
export type DisclosureNdaAcceptInput = z.infer<typeof disclosureNdaAcceptSchema>;
export type FarmDisclosurePolicyInput = z.infer<typeof farmDisclosurePolicySchema>;


export const transportAssignmentSchema = z.object({
  orderId: z.string().min(3).max(120),
  transportOrganizationId: z.string().min(3).max(120),
  assignedTransportUserId: z.string().min(3).max(120).optional(),
  pickupWindowStart: z.string().optional(),
  pickupWindowEnd: z.string().optional(),
  deliveryWindowStart: z.string().optional(),
  deliveryWindowEnd: z.string().optional(),
  movementDocumentRefs: z.string().max(4000).optional(),
  sanitationRequirements: z.string().max(4000).optional(),
  specialInstructions: z.string().max(4000).optional()
}).superRefine((value, ctx) => {
  const pairs = [
    ["pickupWindowStart", value.pickupWindowStart, "pickupWindowEnd", value.pickupWindowEnd],
    ["deliveryWindowStart", value.deliveryWindowStart, "deliveryWindowEnd", value.deliveryWindowEnd]
  ] as const;

  for (const [startKey, start, endKey, end] of pairs) {
    if ((start && !end) || (!start && end)) {
      ctx.addIssue({
        code: "custom",
        path: [start ? endKey : startKey],
        message: "Both start and end are required when a transport window is specified"
      });
    }
    if (start && end && new Date(start).getTime() >= new Date(end).getTime()) {
      ctx.addIssue({
        code: "custom",
        path: [endKey],
        message: "Transport window end must be after its start"
      });
    }
  }
});

export const transportEventSchema = z.object({
  assignmentId: z.string().min(3).max(120),
  eventType: z.enum([
    "PICKUP_CONFIRMED",
    "DELIVERY_CONFIRMED",
    "EXCEPTION_REPORTED",
    "RESUME_TRANSIT"
  ]),
  notes: z.string().max(6000).optional(),
  sanitationConfirmed: z.boolean().optional(),
  custodyAttestation: z.boolean().optional()
}).superRefine((value, ctx) => {
  if (value.eventType === "PICKUP_CONFIRMED") {
    if (value.sanitationConfirmed !== true) {
      ctx.addIssue({
        code: "custom",
        path: ["sanitationConfirmed"],
        message: "Sanitation must be confirmed at pickup"
      });
    }
    if (value.custodyAttestation !== true) {
      ctx.addIssue({
        code: "custom",
        path: ["custodyAttestation"],
        message: "Chain-of-custody attestation is required at pickup"
      });
    }
  }

  if (
    value.eventType === "DELIVERY_CONFIRMED" &&
    value.custodyAttestation !== true
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["custodyAttestation"],
      message: "Chain-of-custody attestation is required at delivery"
    });
  }

  if (
    value.eventType === "EXCEPTION_REPORTED" &&
    (value.notes?.trim().length ?? 0) < 10
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["notes"],
      message: "Transport exceptions require a meaningful description"
    });
  }
});

export type TransportAssignmentInput = z.infer<typeof transportAssignmentSchema>;
export type TransportEventInput = z.infer<typeof transportEventSchema>;
