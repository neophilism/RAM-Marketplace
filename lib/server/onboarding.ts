import "server-only";
import { randomUUID } from "node:crypto";
import type { SessionPrincipal } from "@/lib/auth/token";
import type { EnrollmentIdentity } from "@/lib/auth/enrollment-token";
import {
  initialRoleForOrganization,
  type OnboardingInput
} from "@/lib/onboarding";
import { dataBackend, requirePrisma } from "@/lib/server/db";

export async function createOnboardingAccount(
  input: OnboardingInput,
  verifiedIdentity?: EnrollmentIdentity
): Promise<Omit<SessionPrincipal, "exp">> {
  const role = initialRoleForOrganization(input.organizationType);
  const email = (verifiedIdentity?.email ?? input.email).trim().toLowerCase();
  const name = (verifiedIdentity?.name ?? input.name).trim();

  if (dataBackend() === "prototype") {
    return {
      userId: `demo-user-${randomUUID()}`,
      organizationId: `demo-org-${randomUUID()}`,
      role,
      email,
      name
    };
  }

  const prisma = requirePrisma();

  return prisma.$transaction(async (tx) => {
    let user;

    if (verifiedIdentity) {
      const linkedIdentity = await tx.externalIdentity.findUnique({
        where: {
          provider_subject: {
            provider: verifiedIdentity.provider,
            subject: verifiedIdentity.subject
          }
        },
        include: { user: true }
      });

      if (
        !linkedIdentity ||
        linkedIdentity.userId !== verifiedIdentity.userId ||
        linkedIdentity.user.email.toLowerCase() !== email ||
        !linkedIdentity.user.emailVerifiedAt
      ) {
        throw new Error("Verified identity enrollment no longer matches RAM account");
      }

      user = await tx.user.update({
        where: { id: linkedIdentity.userId },
        data: { name }
      });
    } else {
      user = await tx.user.upsert({
        where: { email },
        create: {
          email,
          name
        },
        update: {
          name
        }
      });
    }

    const organization = await tx.organization.create({
      data: {
        name: input.organizationName.trim(),
        type: input.organizationType,
        status: "PENDING_VERIFICATION",
        verification: {
          create: {
            decision: "PENDING",
            method: verifiedIdentity ? "VERIFIED_EXTERNAL_IDENTITY" : "MANUAL_ONBOARDING"
          }
        }
      }
    });

    await tx.membership.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role,
        status: "ACTIVE"
      }
    });

    if (input.organizationType === "FARM") {
      await tx.farmSite.create({
        data: {
          organizationId: organization.id,
          internalLabel: input.farmSiteLabel!.trim(),
          regionLabel: input.regionLabel!.trim(),
          countyLabel: input.countyLabel?.trim(),
          exactAddress: input.exactAddress!.trim(),
          permissions: {
            create: {}
          }
        }
      });
    }

    await tx.auditEvent.create({
      data: {
        actorUserId: user.id,
        organizationId: organization.id,
        action: "ORGANIZATION_ONBOARDED",
        entityType: "Organization",
        entityId: organization.id,
        nextState: {
          status: "PENDING_VERIFICATION",
          type: input.organizationType,
          role,
          identityProvider: verifiedIdentity?.provider ?? null
        }
      }
    });

    return {
      userId: user.id,
      organizationId: organization.id,
      role,
      email: user.email,
      name: user.name
    };
  });
}
