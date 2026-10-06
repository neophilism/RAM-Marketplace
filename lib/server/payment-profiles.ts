import "server-only";
import type { SessionPrincipal } from "@/lib/auth/token";
import { requireCapability } from "@/lib/access";
import { paymentGatewayConfig } from "@/lib/payments/gateway";
import type {
  PaymentProfileStatusInput,
  PaymentProfileUpsertInput
} from "@/lib/payments/profile-validation";
import { dataBackend, requirePrisma } from "@/lib/server/db";

export async function listPaymentProfiles(
  principal: SessionPrincipal
) {
  requireCapability(principal.role, "settlement:manage");

  if (dataBackend() === "prototype") {
    return { organizations: [], profiles: [] };
  }

  const prisma = requirePrisma();

  const [organizations, rawProfiles] = await Promise.all([
    prisma.organization.findMany({
      where: {
        status: { in: ["ACTIVE", "SUSPENDED"] },
        type: {
          in: [
            "FARM",
            "RESEARCH_INSTITUTION",
            "BIOTECH",
            "PHARMA",
            "CRO"
          ]
        }
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
        status: true
      }
    }),
    prisma.organizationPaymentProfile.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true
          }
        },
        verifiedBy: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })
  ]);

  const profiles = rawProfiles.map((profile) => ({
    id: profile.id,
    organizationId: profile.organizationId,
    gateway: profile.gateway,
    status: profile.status,
    buyerCollectionEnabled: profile.buyerCollectionEnabled,
    supplierPayoutEnabled: profile.supplierPayoutEnabled,
    verifiedAt: profile.verifiedAt,
    notes: profile.notes,
    accountReferenceMasked:
      profile.externalAccountReference.length <= 6
        ? "••••••"
        : "••••••" + profile.externalAccountReference.slice(-6),
    organization: profile.organization,
    verifiedBy: profile.verifiedBy
  }));

  return { organizations, profiles };
}

export async function upsertPaymentProfile(
  principal: SessionPrincipal,
  input: PaymentProfileUpsertInput
) {
  requireCapability(principal.role, "settlement:manage");
  if (dataBackend() !== "postgres") {
    throw new Error("Payment profile management requires PostgreSQL persistence");
  }
  const config = paymentGatewayConfig();
  if (!config) throw new Error("Payment gateway is not configured");

  const prisma = requirePrisma();
  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.findUnique({
      where: { id: input.organizationId },
      select: {
        id: true,
        name: true,
        type: true,
        status: true
      }
    });
    if (!organization) throw new Error("Organization not found");
    if (organization.status !== "ACTIVE") {
      throw new Error("Payment profiles require an active organization");
    }

    if (
      input.supplierPayoutEnabled &&
      organization.type !== "FARM"
    ) {
      throw new Error(
        "Supplier payout capability may only be enabled for farm organizations"
      );
    }

    if (
      input.buyerCollectionEnabled &&
      ![
        "RESEARCH_INSTITUTION",
        "BIOTECH",
        "PHARMA",
        "CRO"
      ].includes(organization.type)
    ) {
      throw new Error(
        "Buyer collection capability requires a research/buyer organization"
      );
    }

    const previous = await tx.organizationPaymentProfile.findUnique({
      where: { organizationId: organization.id }
    });

    const profile = await tx.organizationPaymentProfile.upsert({
      where: { organizationId: organization.id },
      create: {
        organizationId: organization.id,
        gateway: config.name,
        externalAccountReference: input.externalAccountReference.trim(),
        status: "ACTIVE",
        buyerCollectionEnabled: input.buyerCollectionEnabled,
        supplierPayoutEnabled: input.supplierPayoutEnabled,
        verifiedByUserId: principal.userId,
        verifiedAt: new Date(),
        notes: input.notes?.trim() ?? null
      },
      update: {
        gateway: config.name,
        externalAccountReference: input.externalAccountReference.trim(),
        status: "ACTIVE",
        buyerCollectionEnabled: input.buyerCollectionEnabled,
        supplierPayoutEnabled: input.supplierPayoutEnabled,
        verifiedByUserId: principal.userId,
        verifiedAt: new Date(),
        notes: input.notes?.trim() ?? null
      }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: organization.id,
        action: previous
          ? "PAYMENT_PROFILE_UPDATED"
          : "PAYMENT_PROFILE_CREATED",
        entityType: "OrganizationPaymentProfile",
        entityId: profile.id,
        previousState: previous
          ? {
              gateway: previous.gateway,
              status: previous.status,
              buyerCollectionEnabled: previous.buyerCollectionEnabled,
              supplierPayoutEnabled: previous.supplierPayoutEnabled
            }
          : undefined,
        nextState: {
          gateway: profile.gateway,
          status: profile.status,
          buyerCollectionEnabled: profile.buyerCollectionEnabled,
          supplierPayoutEnabled: profile.supplierPayoutEnabled
        },
        metadata: {
          verificationAttestation: input.verificationAttestation,
          accountReferencePresent: true
        }
      }
    });

    return profile;
  });
}

export async function updatePaymentProfileStatus(
  principal: SessionPrincipal,
  input: PaymentProfileStatusInput
) {
  requireCapability(principal.role, "settlement:manage");
  if (dataBackend() !== "postgres") {
    throw new Error("Payment profile management requires PostgreSQL persistence");
  }
  const prisma = requirePrisma();

  return prisma.$transaction(async (tx) => {
    const profile = await tx.organizationPaymentProfile.findUnique({
      where: { id: input.profileId },
      include: {
        organization: {
          select: { status: true }
        }
      }
    });
    if (!profile) throw new Error("Payment profile not found");

    if (profile.status === input.status) return profile;

    if (
      input.status === "ACTIVE" &&
      profile.organization.status !== "ACTIVE"
    ) {
      throw new Error(
        "Payment profile cannot be reactivated while the organization is not active"
      );
    }

    if (input.status === "ACTIVE") {
      const config = paymentGatewayConfig();
      if (!config || profile.gateway !== config.name) {
        throw new Error(
          "Payment profile gateway does not match the configured payment gateway"
        );
      }
    }

    const updated = await tx.organizationPaymentProfile.update({
      where: { id: profile.id },
      data: { status: input.status }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: profile.organizationId,
        action:
          input.status === "SUSPENDED"
            ? "PAYMENT_PROFILE_SUSPENDED"
            : "PAYMENT_PROFILE_REACTIVATED",
        entityType: "OrganizationPaymentProfile",
        entityId: profile.id,
        previousState: { status: profile.status },
        nextState: { status: input.status },
        reason: input.reason.trim()
      }
    });

    return updated;
  });
}
