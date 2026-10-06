import "server-only";
import type { SessionPrincipal } from "@/lib/auth/token";
import type { ExternalIdentityAssertionPayload } from "@/lib/auth/external-assertion";
import { evaluateDurableAccess } from "@/lib/auth/access-state";
import { dataBackend, requirePrisma } from "@/lib/server/db";

export interface AccountAccessContext {
  principal: Omit<SessionPrincipal, "exp">;
  emailVerified: boolean;
  membershipStatus: "INVITED" | "ACTIVE" | "SUSPENDED" | "REVOKED";
  organizationStatus:
    | "PENDING_VERIFICATION"
    | "ACTIVE"
    | "SUSPENDED"
    | "CLOSED";
  organizationName: string;
  organizationType: string;
  accessReason: ReturnType<typeof evaluateDurableAccess>["reason"];
}

export interface IdentityMembershipChoice {
  organizationId: string;
  organizationName: string;
  organizationStatus: string;
  role: SessionPrincipal["role"];
  membershipStatus: string;
  operational: boolean;
}

export type ExternalIdentityResolution =
  | {
      kind: "SESSION";
      principal: Omit<SessionPrincipal, "exp">;
      operational: boolean;
      accessReason: ReturnType<typeof evaluateDurableAccess>["reason"];
    }
  | {
      kind: "ENROLLMENT";
      userId: string;
      email: string;
      name: string;
      provider: string;
      subject: string;
    }
  | {
      kind: "SELECT_ORGANIZATION";
      choices: IdentityMembershipChoice[];
    };

function accessError(reason: ReturnType<typeof evaluateDurableAccess>["reason"]) {
  switch (reason) {
    case "EMAIL_UNVERIFIED":
      return "Forbidden: verified email is required";
    case "MEMBERSHIP_REVOKED":
      return "Forbidden: membership has been revoked";
    case "MEMBERSHIP_SUSPENDED":
      return "Forbidden: membership is suspended";
    case "MEMBERSHIP_INVITED":
      return "Forbidden: membership is not active";
    case "ORGANIZATION_PENDING":
      return "Forbidden: organization is pending verification";
    case "ORGANIZATION_SUSPENDED":
      return "Forbidden: organization is suspended";
    case "ORGANIZATION_CLOSED":
      return "Forbidden: organization is closed";
    default:
      return "Forbidden: account is not authorized";
  }
}

export async function getAccountAccessContext(
  principal: SessionPrincipal
): Promise<AccountAccessContext> {
  if (dataBackend() === "prototype") {
    return {
      principal,
      emailVerified: true,
      membershipStatus: "ACTIVE",
      organizationStatus: "ACTIVE",
      organizationName: "Prototype organization",
      organizationType: principal.role.startsWith("SUPPLIER_")
        ? "FARM"
        : principal.role === "TRANSPORT_PROVIDER"
          ? "LOGISTICS"
          : principal.role.startsWith("RAM_")
            ? "RAM"
            : "RESEARCH_INSTITUTION",
      accessReason: "OK"
    };
  }

  const prisma = requirePrisma();
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId_role: {
        userId: principal.userId,
        organizationId: principal.organizationId,
        role: principal.role
      }
    },
    select: {
      status: true,
      user: {
        select: {
          email: true,
          name: true,
          emailVerifiedAt: true
        }
      },
      organization: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true
        }
      }
    }
  });

  if (!membership) {
    throw new Error("Forbidden: membership no longer exists");
  }

  if (membership.user.email.toLowerCase() !== principal.email.toLowerCase()) {
    throw new Error("Forbidden: session identity no longer matches account");
  }

  const decision = evaluateDurableAccess({
    emailVerified: Boolean(membership.user.emailVerifiedAt),
    membershipStatus: membership.status,
    organizationStatus: membership.organization.status
  });

  if (!decision.accountAllowed) {
    throw new Error(accessError(decision.reason));
  }

  return {
    principal: {
      userId: principal.userId,
      organizationId: membership.organization.id,
      role: principal.role,
      email: membership.user.email,
      name: membership.user.name
    },
    emailVerified: Boolean(membership.user.emailVerifiedAt),
    membershipStatus: membership.status,
    organizationStatus: membership.organization.status,
    organizationName: membership.organization.name,
    organizationType: membership.organization.type,
    accessReason: decision.reason
  };
}

export async function requireOperationalPrincipal(
  principal: SessionPrincipal
): Promise<SessionPrincipal> {
  const context = await getAccountAccessContext(principal);
  const decision = evaluateDurableAccess({
    emailVerified: context.emailVerified,
    membershipStatus: context.membershipStatus,
    organizationStatus: context.organizationStatus
  });

  if (!decision.operationalAllowed) {
    throw new Error(accessError(decision.reason));
  }

  return {
    ...context.principal,
    exp: principal.exp
  };
}

function authContext(assertion: ExternalIdentityAssertionPayload) {
  return {
    mfa: assertion.mfa,
    acr: assertion.acr ?? null,
    amr: assertion.amr ?? [],
    authenticatedAt: new Date(assertion.iat * 1000).toISOString()
  };
}

export async function consumeExternalIdentity(
  assertion: ExternalIdentityAssertionPayload,
  requestedOrganizationId?: string
): Promise<ExternalIdentityResolution> {
  if (dataBackend() !== "postgres") {
    throw new Error("External identity sign-in requires PostgreSQL persistence");
  }

  const prisma = requirePrisma();
  return prisma.$transaction(async (tx) => {
    const alreadyUsed = await tx.identityAssertionUse.findUnique({
      where: { jti: assertion.jti },
      select: { jti: true }
    });
    if (alreadyUsed) {
      throw new Error("External identity assertion has already been used");
    }

    await tx.identityAssertionUse.create({
      data: {
        jti: assertion.jti,
        provider: assertion.provider,
        subject: assertion.subject,
        expiresAt: new Date(assertion.exp * 1000)
      }
    });

    await tx.identityAssertionUse.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });

    let identity = await tx.externalIdentity.findUnique({
      where: {
        provider_subject: {
          provider: assertion.provider,
          subject: assertion.subject
        }
      },
      include: {
        user: true
      }
    });

    if (!identity) {
      let user = await tx.user.findUnique({
        where: { email: assertion.email }
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            email: assertion.email,
            emailVerifiedAt: new Date(),
            name: assertion.name
          }
        });
      } else {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
            name: assertion.name
          }
        });
      }

      identity = await tx.externalIdentity.create({
        data: {
          userId: user.id,
          provider: assertion.provider,
          subject: assertion.subject,
          emailAtLink: assertion.email,
          lastAuthenticatedAt: new Date(),
          lastAuthContext: authContext(assertion)
        },
        include: { user: true }
      });

      await tx.auditEvent.create({
        data: {
          actorUserId: user.id,
          action: "EXTERNAL_IDENTITY_LINKED",
          entityType: "User",
          entityId: user.id,
          nextState: {
            provider: assertion.provider,
            emailVerified: true
          }
        }
      });
    } else {
      if (identity.user.email.toLowerCase() !== assertion.email.toLowerCase()) {
        const conflicting = await tx.user.findUnique({
          where: { email: assertion.email }
        });
        if (conflicting && conflicting.id !== identity.user.id) {
          throw new Error(
            "External identity email conflicts with another RAM account"
          );
        }
      }

      const user = await tx.user.update({
        where: { id: identity.user.id },
        data: {
          email: assertion.email,
          emailVerifiedAt: identity.user.emailVerifiedAt ?? new Date(),
          name: assertion.name
        }
      });

      identity = await tx.externalIdentity.update({
        where: { id: identity.id },
        data: {
          lastAuthenticatedAt: new Date(),
          lastAuthContext: authContext(assertion)
        },
        include: { user: true }
      });

      await tx.auditEvent.create({
        data: {
          actorUserId: user.id,
          action: "EXTERNAL_IDENTITY_AUTHENTICATED",
          entityType: "User",
          entityId: user.id,
          metadata: {
            provider: assertion.provider,
            mfa: assertion.mfa
          }
        }
      });
    }

    const allMemberships = await tx.membership.findMany({
      where: {
        userId: identity.userId
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    if (allMemberships.length === 0) {
      return {
        kind: "ENROLLMENT",
        userId: identity.user.id,
        email: identity.user.email,
        name: identity.user.name,
        provider: assertion.provider,
        subject: assertion.subject
      };
    }

    const memberships = allMemberships.filter(
      (membership) =>
        membership.status !== "REVOKED" &&
        membership.organization.status !== "CLOSED"
    );

    if (memberships.length === 0) {
      throw new Error(
        "Forbidden: no available organization membership; contact RAM access administration"
      );
    }

    const choices = memberships.map((membership) => {
      const decision = evaluateDurableAccess({
        emailVerified: Boolean(identity.user.emailVerifiedAt),
        membershipStatus: membership.status,
        organizationStatus: membership.organization.status
      });
      return {
        organizationId: membership.organization.id,
        organizationName: membership.organization.name,
        organizationStatus: membership.organization.status,
        role: membership.role,
        membershipStatus: membership.status,
        operational: decision.operationalAllowed
      };
    });

    let selected =
      requestedOrganizationId
        ? memberships.find(
            (membership) =>
              membership.organizationId === requestedOrganizationId
          )
        : undefined;

    if (requestedOrganizationId && !selected) {
      throw new Error("Forbidden: requested organization membership is unavailable");
    }

    if (!selected) {
      const operational = memberships.filter((membership) => {
        const decision = evaluateDurableAccess({
          emailVerified: Boolean(identity.user.emailVerifiedAt),
          membershipStatus: membership.status,
          organizationStatus: membership.organization.status
        });
        return decision.operationalAllowed;
      });

      if (operational.length === 1) {
        selected = operational[0];
      } else if (memberships.length === 1) {
        selected = memberships[0];
      } else {
        return {
          kind: "SELECT_ORGANIZATION",
          choices
        };
      }
    }

    const decision = evaluateDurableAccess({
      emailVerified: Boolean(identity.user.emailVerifiedAt),
      membershipStatus: selected.status,
      organizationStatus: selected.organization.status
    });

    return {
      kind: "SESSION",
      principal: {
        userId: identity.user.id,
        organizationId: selected.organizationId,
        role: selected.role,
        email: identity.user.email,
        name: identity.user.name
      },
      operational: decision.operationalAllowed,
      accessReason: decision.reason
    };
  });
}
