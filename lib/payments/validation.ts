import { z } from "zod";

export const paymentExecutionRequestSchema = z.object({
  settlementId: z.string().min(3).max(120),
  type: z.enum([
    "BUYER_COLLECTION",
    "SUPPLIER_PAYOUT",
    "BUYER_REFUND"
  ]),
  amountUsd: z.coerce.number().positive().max(100_000_000)
});

export const paymentWebhookSchema = z.object({
  eventId: z.string().min(8).max(240),
  gateway: z.string().min(1).max(120),
  provider: z.string().min(1).max(120),
  providerReference: z.string().min(1).max(240),
  executionId: z.string().min(1).max(240),
  status: z.enum(["PROCESSING", "SUCCEEDED", "FAILED", "CANCELED"]),
  occurredAt: z.string().datetime(),
  failureCode: z.string().max(240).optional(),
  failureMessage: z.string().max(2000).optional()
});

export type PaymentExecutionRequest = z.infer<
  typeof paymentExecutionRequestSchema
>;
export type PaymentWebhookInput = z.infer<typeof paymentWebhookSchema>;
