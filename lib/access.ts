import { hasPermission, type Permission, type Role } from "./rbac";

export type Capability =
  | "animal:create"
  | "animal:read_marketplace"
  | "animal:verify"
  | "source:read_restricted"
  | "source:approve_disclosure"
  | "research_need:create"
  | "match:review"
  | "operations:manage";

const capabilityPermission: Record<Capability, Permission> = {
  "animal:create": "CANDIDATE_CREATE",
  "animal:read_marketplace": "MATCH_REVIEW",
  "animal:verify": "VET_EXAM_WRITE",
  "source:read_restricted": "SOURCE_READ_RESTRICTED",
  "source:approve_disclosure": "SOURCE_DISCLOSURE_APPROVE",
  "research_need:create": "RESEARCH_REQUEST_MANAGE",
  "match:review": "MATCH_REVIEW",
  "operations:manage": "MARKETPLACE_OPERATE"
};

export function can(role: Role, capability: Capability) {
  return hasPermission(role, capabilityPermission[capability]);
}

export function requireCapability(role: Role, capability: Capability) {
  if (!can(role, capability)) {
    throw new Error(`Forbidden: ${role} lacks ${capability}`);
  }
}

export const demoActors = {
  scientist: {
    name: "Dr. Maya Chen",
    role: "RESEARCH_PI" as const,
    organization: "Example Translational Sciences Lab"
  },
  farmer: {
    name: "Alex Morgan",
    role: "SUPPLIER_OWNER_ADMIN" as const,
    organization: "Anonymous Partner Farm"
  },
  veterinarian: {
    name: "Dr. Jordan Reyes",
    role: "VETERINARIAN" as const,
    organization: "RAM Veterinary Network"
  },
  ram: {
    name: "RAM Operations",
    role: "RAM_SUPER_ADMIN" as const,
    organization: "RAM Corporation"
  }
};
