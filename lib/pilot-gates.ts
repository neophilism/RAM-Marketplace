import { z } from "zod";
import {
  PILOT_MANUAL_GATES,
  type PilotManualGateKey
} from "@/lib/pilot-readiness";

export const pilotGateKeys = new Set<PilotManualGateKey>(
  PILOT_MANUAL_GATES.map((gate) => gate.key)
);

export const verifyPilotGateSchema = z.object({
  gateKey: z.string().min(1),
  ownerUserId: z.string().min(1),
  evidenceSummary: z.string().min(10).max(4000),
  reviewDueAt: z.string().optional(),
  notes: z.string().max(4000).optional()
});

export const resetPilotGateSchema = z.object({
  gateKey: z.string().min(1),
  reason: z.string().min(3).max(4000)
});

export type VerifyPilotGateInput = z.infer<typeof verifyPilotGateSchema>;
export type ResetPilotGateInput = z.infer<typeof resetPilotGateSchema>;
