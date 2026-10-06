import { z } from "zod";

export const organizationAccessActionSchema = z
  .object({
    organizationId: z.string().min(1),
    action: z.enum(["APPROVE", "REJECT", "SUSPEND", "REACTIVATE"]),
    method: z.string().max(160).optional(),
    evidenceSummary: z.string().max(2000).optional(),
    notes: z.string().max(2000).optional()
  })
  .superRefine((value, ctx) => {
    if (value.action === "APPROVE") {
      if (!value.method?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["method"],
          message: "Verification method is required for approval"
        });
      }
      if (!value.evidenceSummary?.trim() || value.evidenceSummary.trim().length < 10) {
        ctx.addIssue({
          code: "custom",
          path: ["evidenceSummary"],
          message: "Verification evidence summary is required for approval"
        });
      }
    }

    if (
      (value.action === "REJECT" || value.action === "SUSPEND") &&
      !value.notes?.trim()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["notes"],
        message: "Reason is required for rejection or suspension"
      });
    }
  });

export const membershipAccessActionSchema = z.object({
  membershipId: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED", "REVOKED"]),
  reason: z.string().min(3).max(2000)
});

export type OrganizationAccessAction = z.infer<
  typeof organizationAccessActionSchema
>;
export type MembershipAccessAction = z.infer<
  typeof membershipAccessActionSchema
>;
