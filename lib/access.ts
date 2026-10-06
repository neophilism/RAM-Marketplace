import { hasPermission, type Permission, type Role } from "./rbac";

export type Capability =
  | "animal:create"
  | "animal:read_marketplace"
  | "animal:verify"
  | "source:read_restricted"
  | "source:approve_disclosure"
  | "research_need:create"
  | "match:review"
  | "order:reserve"
  | "order:buyer_commit"
  | "order:acquisition_commit"
  | "order:clearance"
  | "pricing:manage"
  | "disclosure:request"
  | "disclosure:ram_review"
  | "disclosure:supplier_review"
  | "transport:assign"
  | "transport:update"
  | "operations:manage";

const capabilityPermission: Record<Capability, Permission> = {
  "animal:create": "CANDIDATE_CREATE",
  "animal:read_marketplace": "MATCH_REVIEW",
  "animal:verify": "VET_EXAM_WRITE",
  "source:read_restricted": "SOURCE_READ_RESTRICTED",
  "source:approve_disclosure": "SOURCE_DISCLOSURE_APPROVE",
  "research_need:create": "RESEARCH_REQUEST_MANAGE",
  "match:review": "MATCH_REVIEW",
  "order:reserve": "MATCH_REVIEW",
  "order:buyer_commit": "QUOTE_APPROVE",
  "order:acquisition_commit": "PAYOUT_MANAGE",
  "order:clearance": "COMPLIANCE_REVIEW",
  "pricing:manage": "PRICING_POLICY_MANAGE",
  "disclosure:request": "MATCH_REVIEW",
  "disclosure:ram_review": "SOURCE_DISCLOSURE_APPROVE",
  "disclosure:supplier_review": "SOURCE_DISCLOSURE_APPROVE",
  "transport:assign": "MARKETPLACE_OPERATE",
  "transport:update": "TRANSPORT_UPDATE",
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
    organization: "Example Translational Sciences Lab",
    organizationId: "demo-research-organization"
  },
  procurement: {
    name: "Avery Brooks",
    role: "RESEARCH_PROCUREMENT" as const,
    organization: "Example Translational Sciences Lab",
    organizationId: "demo-research-organization"
  },
  farmer: {
    name: "Alex Morgan",
    role: "SUPPLIER_OWNER_ADMIN" as const,
    organization: "Anonymous Partner Farm",
    organizationId: "demo-farm-organization"
  },
  veterinarian: {
    name: "Dr. Jordan Reyes",
    role: "VETERINARIAN" as const,
    organization: "RAM Veterinary Network",
    organizationId: "demo-veterinary-organization"
  },
  ram: {
    name: "RAM Operations",
    role: "RAM_SUPER_ADMIN" as const,
    organization: "RAM Corporation",
    organizationId: "demo-ram-organization"
  },
  finance: {
    name: "RAM Finance",
    role: "RAM_FINANCE_ADMIN" as const,
    organization: "RAM Corporation",
    organizationId: "demo-ram-organization"
  },
  compliance: {
    name: "RAM Compliance",
    role: "RAM_COMPLIANCE" as const,
    organization: "RAM Corporation",
    organizationId: "demo-ram-organization"
  },
  transporter: {
    name: "Taylor Reed",
    role: "TRANSPORT_PROVIDER" as const,
    organization: "RAM Logistics Demo",
    organizationId: "demo-logistics-organization"
  }
};
