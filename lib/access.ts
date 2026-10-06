export type UserRole =
  | "FARM_ADMIN"
  | "FARM_STAFF"
  | "RESEARCH_ADMIN"
  | "RESEARCHER"
  | "VETERINARIAN"
  | "RAM_OPERATIONS"
  | "RAM_SCIENTIFIC"
  | "RAM_COMPLIANCE"
  | "RAM_ADMIN";

export type Capability =
  | "animal:create"
  | "animal:read_own"
  | "animal:read_marketplace"
  | "animal:verify"
  | "source:read_restricted"
  | "source:approve_disclosure"
  | "research_need:create"
  | "research_need:read_own"
  | "match:review"
  | "operations:manage"
  | "organization:manage";

const grants: Record<UserRole, ReadonlySet<Capability>> = {
  FARM_ADMIN: new Set([
    "animal:create",
    "animal:read_own",
    "source:approve_disclosure",
    "organization:manage"
  ]),
  FARM_STAFF: new Set(["animal:create", "animal:read_own"]),
  RESEARCH_ADMIN: new Set([
    "animal:read_marketplace",
    "research_need:create",
    "research_need:read_own",
    "organization:manage"
  ]),
  RESEARCHER: new Set([
    "animal:read_marketplace",
    "research_need:create",
    "research_need:read_own"
  ]),
  VETERINARIAN: new Set(["animal:verify"]),
  RAM_OPERATIONS: new Set([
    "animal:read_marketplace",
    "source:read_restricted",
    "operations:manage",
    "match:review"
  ]),
  RAM_SCIENTIFIC: new Set([
    "animal:read_marketplace",
    "source:read_restricted",
    "match:review",
    "animal:verify"
  ]),
  RAM_COMPLIANCE: new Set([
    "source:read_restricted",
    "source:approve_disclosure",
    "operations:manage"
  ]),
  RAM_ADMIN: new Set([
    "animal:create",
    "animal:read_own",
    "animal:read_marketplace",
    "animal:verify",
    "source:read_restricted",
    "source:approve_disclosure",
    "research_need:create",
    "research_need:read_own",
    "match:review",
    "operations:manage",
    "organization:manage"
  ])
};

export function can(role: UserRole, capability: Capability) {
  return grants[role].has(capability);
}

export function requireCapability(role: UserRole, capability: Capability) {
  if (!can(role, capability)) {
    throw new Error(`Forbidden: ${role} lacks ${capability}`);
  }
}

export const demoActors = {
  scientist: {
    name: "Dr. Maya Chen",
    role: "RESEARCHER" as const,
    organization: "Example Translational Sciences Lab"
  },
  farmer: {
    name: "Alex Morgan",
    role: "FARM_ADMIN" as const,
    organization: "Anonymous Partner Farm"
  },
  veterinarian: {
    name: "Dr. Jordan Reyes",
    role: "VETERINARIAN" as const,
    organization: "RAM Veterinary Network"
  },
  ram: {
    name: "RAM Operations",
    role: "RAM_ADMIN" as const,
    organization: "RAM Corporation"
  }
};
