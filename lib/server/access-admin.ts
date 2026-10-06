import "server-only";
import type { SessionPrincipal } from "@/lib/auth/token";
import { requireCapability } from "@/lib/access";
import type {
  MembershipAccessAction,
  OrganizationAccessAction
} from "@/lib/account-lifecycle";
import { dataBackend, requirePrisma } from "@/lib/server/db";

export async function listAccessAdministration(
  principal: SessionPrincipal
) {
  requireCapability(principal.role, "admin:manage");

  if (dataBackend() === "prototype") {
    return {
      organizations: [],
      memberships: []
    };
  }

  const prisma = requirePrisma();
  const [organizations, memberships] = await Promise.all([
    prisma.organization.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        verification: true,
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                emailVerifiedAt: true
              }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      }
    }),
    prisma.membership.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            emailVerifiedAt: true
          }
        },
        organization: {
          select: {
            id: true,
            name: true,
            status: true,
            type: true
          }
        }
      }
    })
  ]);

  return { organizations, memberships };
}

export async function updateOrganizationAccess(
  principal: SessionPrincipal,
  input: OrganizationAccessAction
) {
  requireCapability(principal.role, "admin:manage");

  if (dataBackend() !== "postgres") {
    throw new Error("Organization verification requires PostgreSQL persistence");
  }

  const prisma = requirePrisma();

  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.findUnique({
      where: { id: input.organizationId },
      include: { verification: true }
    });

    if (!organization) {
      throw new Error("Organization not found");
    }

    let nextStatus = organization.status;
    let auditAction = "ORGANIZATION_ACCESS_UPDATED";

    if (input.action === "APPROVE") {
      if (organization.status !== "PENDING_VERIFICATION") {
        throw new Error("Only pending organizations can be approved");
      }
      nextStatus = "ACTIVE";
      auditAction = "ORGANIZATION_VERIFICATION_APPROVED";

      await tx.organizationVerification.upsert({
        where: { organizationId: organization.id },
        create: {
          organizationId: organization.id,
          decision: "APPROVED",
          method: input.method!.trim(),
          evidenceSummary: input.evidenceSummary!.trim(),
          notes: input.notes?.trim(),
          reviewedByUserId: principal.userId,
          reviewedAt: new Date()
        },
        update: {
          decision: "APPROVED",
          method: input.method!.trim(),
          evidenceSummary: input.evidenceSummary!.trim(),
          notes: input.notes?.trim(),
          reviewedByUserId: principal.userId,
          reviewedAt: new Date()
        }
      });
    } else if (input.action === "REJECT") {
      if (organization.status !== "PENDING_VERIFICATION") {
        throw new Error("Only pending organizations can be rejected");
      }
      nextStatus = "CLOSED";
      auditAction = "ORGANIZATION_VERIFICATION_REJECTED";

      await tx.organizationVerification.upsert({
        where: { organizationId: organization.id },
        create: {
          organizationId: organization.id,
          decision: "REJECTED",
          notes: input.notes!.trim(),
          reviewedByUserId: principal.userId,
          reviewedAt: new Date()
        },
        update: {
          decision: "REJECTED",
          notes: input.notes!.trim(),
          reviewedByUserId: principal.userId,
          reviewedAt: new Date()
        }
      });
    } else if (input.action === "SUSPEND") {
      if (organization.status !== "ACTIVE") {
        throw new Error("Only active organizations can be suspended");
      }
      nextStatus = "SUSPENDED";
      auditAction = "ORGANIZATION_SUSPENDED";
    } else if (input.action === "REACTIVATE") {
      if (organization.status !== "SUSPENDED") {
        throw new Error("Only suspended organizations can be reactivated");
      }
      if (organization.verification?.decision !== "APPROVED") {
        throw new Error("Organization must have an approved verification before reactivation");
      }
      nextStatus = "ACTIVE";
      auditAction = "ORGANIZATION_REACTIVATED";
    }

    const updated = await tx.organization.update({
      where: { id: organization.id },
      data: { status: nextStatus }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: organization.id,
        action: auditAction,
        entityType: "Organization",
        entityId: organization.id,
        previousState: {
          status: organization.status,
          verificationDecision: organization.verification?.decision ?? "PENDING"
        },
        nextState: {
          status: nextStatus,
          action: input.action
        },
        reason: input.notes?.trim(),
        metadata: {
          method: input.method?.trim() ?? null,
          evidenceSummary: input.evidenceSummary?.trim() ?? null
        }
      }
    });

    return updated;
  });
}

export async function updateMembershipAccess(
  principal: SessionPrincipal,
  input: MembershipAccessAction
) {
  requireCapability(principal.role, "admin:manage");

  if (dataBackend() !== "postgres") {
    throw new Error("Membership lifecycle requires PostgreSQL persistence");
  }

  const prisma = requirePrisma();

  return prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findUnique({
      where: { id: input.membershipId },
      include: {
        user: { select: { id: true, email: true } },
        organization: { select: { id: true, name: true, status: true } }
      }
    });

    if (!membership) {
      throw new Error("Membership not found");
    }

    if (
      membership.userId === principal.userId &&
      membership.organizationId === principal.organizationId &&
      membership.role === principal.role &&
      input.status !== "ACTIVE"
    ) {
      throw new Error("Forbidden: you cannot suspend or revoke your current admin membership");
    }

    if (
      input.status === "ACTIVE" &&
      membership.organization.status === "CLOSED"
    ) {
      throw new Error("Closed organization memberships cannot be activated");
    }

    const updated = await tx.membership.update({
      where: { id: membership.id },
      data: { status: input.status }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: membership.organizationId,
        action: "MEMBERSHIP_STATUS_CHANGED",
        entityType: "Membership",
        entityId: membership.id,
        previousState: {
          status: membership.status,
          role: membership.role,
          userId: membership.userId
        },
        nextState: {
          status: input.status,
          role: membership.role,
          userId: membership.userId
        },
        reason: input.reason.trim()
      }
    });

    return updated;
  });
}
