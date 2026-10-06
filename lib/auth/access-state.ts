export interface DurableAccessState {
  emailVerified: boolean;
  membershipStatus: "INVITED" | "ACTIVE" | "SUSPENDED" | "REVOKED";
  organizationStatus:
    | "PENDING_VERIFICATION"
    | "ACTIVE"
    | "SUSPENDED"
    | "CLOSED";
}

export interface DurableAccessDecision {
  accountAllowed: boolean;
  operationalAllowed: boolean;
  reason:
    | "OK"
    | "EMAIL_UNVERIFIED"
    | "MEMBERSHIP_INVITED"
    | "MEMBERSHIP_SUSPENDED"
    | "MEMBERSHIP_REVOKED"
    | "ORGANIZATION_PENDING"
    | "ORGANIZATION_SUSPENDED"
    | "ORGANIZATION_CLOSED";
}

export function evaluateDurableAccess(
  state: DurableAccessState
): DurableAccessDecision {
  if (!state.emailVerified) {
    return {
      accountAllowed: false,
      operationalAllowed: false,
      reason: "EMAIL_UNVERIFIED"
    };
  }

  if (state.membershipStatus === "REVOKED") {
    return {
      accountAllowed: false,
      operationalAllowed: false,
      reason: "MEMBERSHIP_REVOKED"
    };
  }

  if (state.organizationStatus === "CLOSED") {
    return {
      accountAllowed: false,
      operationalAllowed: false,
      reason: "ORGANIZATION_CLOSED"
    };
  }

  if (state.membershipStatus === "SUSPENDED") {
    return {
      accountAllowed: true,
      operationalAllowed: false,
      reason: "MEMBERSHIP_SUSPENDED"
    };
  }

  if (state.organizationStatus === "SUSPENDED") {
    return {
      accountAllowed: true,
      operationalAllowed: false,
      reason: "ORGANIZATION_SUSPENDED"
    };
  }

  if (state.membershipStatus === "INVITED") {
    return {
      accountAllowed: true,
      operationalAllowed: false,
      reason: "MEMBERSHIP_INVITED"
    };
  }

  if (state.organizationStatus === "PENDING_VERIFICATION") {
    return {
      accountAllowed: true,
      operationalAllowed: false,
      reason: "ORGANIZATION_PENDING"
    };
  }

  return {
    accountAllowed: true,
    operationalAllowed: true,
    reason: "OK"
  };
}
