import "server-only";
import { randomUUID } from "node:crypto";
import type { SessionPrincipal } from "@/lib/auth/token";
import {
  initialRoleForOrganization,
  type OnboardingInput
} from "@/lib/onboarding";
import { dataBackend, requirePrisma } from "@/lib/server/db";

export async function createOnboardingAccount(
  input: OnboardingInput
): Promise<Omit<SessionPrincipal, "exp">> {
  const role = initialRoleForOrganization(input.organizationType);
  const email = input.email.trim().toLowerCase();

  if (dataBackend() === "prototype") {
    return {
      userId: `demo-user-${randomUUID()}`,
      organizationId: `demo-org-${randomUUID()}`,
      role,
      email,
      name: input.name.trim()
    };
  }

  const prisma = requirePrisma();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email },
      create: {
        email,
        name: input.name.trim()
      },
      update: {
        name: input.name.trim()
      }
    });

    const organization = await tx.organization.create({
      data: {
        name: input.organizationName.trim(),
        type: input.organizationType,
        status: "PENDING_VERIFICATION"
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
          role
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
