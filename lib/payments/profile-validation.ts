import { z } from "zod";

export const paymentProfileUpsertSchema = z
  .object({
    organizationId: z.string().min(1).max(160),
    externalAccountReference: z.string().min(3).max(240),
    buyerCollectionEnabled: z.boolean(),
    supplierPayoutEnabled: z.boolean(),
    notes: z.string().max(2000).optional(),
    verificationAttestation: z.literal(true)
  })
  .superRefine((value, ctx) => {
    if (!value.buyerCollectionEnabled && !value.supplierPayoutEnabled) {
      ctx.addIssue({
        code: "custom",
        path: ["buyerCollectionEnabled"],
        message: "At least one payment capability must be enabled"
      });
    }
  });

export const paymentProfileStatusSchema = z.object({
  profileId: z.string().min(1).max(160),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  reason: z.string().min(3).max(2000)
});

export type PaymentProfileUpsertInput = z.infer<
  typeof paymentProfileUpsertSchema
>;
export type PaymentProfileStatusInput = z.infer<
  typeof paymentProfileStatusSchema
>;
