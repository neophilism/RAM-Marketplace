import { z } from "zod";
import type { Role } from "@/lib/rbac";

export const PUBLIC_ORGANIZATION_TYPES = [
  "FARM",
  "RESEARCH_INSTITUTION",
  "BIOTECH",
  "PHARMA",
  "CRO",
  "VETERINARY",
  "LOGISTICS"
] as const;

export type PublicOrganizationType = (typeof PUBLIC_ORGANIZATION_TYPES)[number];

export const onboardingSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(320),
  organizationName: z.string().min(2).max(200),
  organizationType: z.enum(PUBLIC_ORGANIZATION_TYPES),
  regionLabel: z.string().max(160).optional(),
  farmSiteLabel: z.string().max(160).optional(),
  exactAddress: z.string().max(500).optional()
}).superRefine((value, ctx) => {
  if (value.organizationType === "FARM") {
    for (const key of ["regionLabel", "farmSiteLabel", "exactAddress"] as const) {
      if (!value[key]?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "Required for farm organizations"
        });
      }
    }
  }
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export function initialRoleForOrganization(type: PublicOrganizationType): Role {
  switch (type) {
    case "FARM":
      return "SUPPLIER_OWNER_ADMIN";
    case "VETERINARY":
      return "VETERINARIAN";
    case "LOGISTICS":
      return "TRANSPORT_PROVIDER";
    default:
      return "RESEARCH_PI";
  }
}

export function landingPageForRole(role: Role) {
  if (role === "SUPPLIER_OWNER_ADMIN" || role === "SUPPLIER_STAFF") return "/farm";
  if (role === "VETERINARIAN") return "/vet";
  if (role === "TRANSPORT_PROVIDER") return "/account";
  if (role === "RAM_FINANCE_ADMIN") return "/finance";
  if (role === "RAM_COMPLIANCE") return "/compliance";
  if (role.startsWith("RAM_")) return "/ops";
  return "/research";
}
