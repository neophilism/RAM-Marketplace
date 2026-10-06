import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

const organizations = [
  {
    id: "demo-farm-organization",
    name: "Anonymous Partner Farm",
    type: "FARM" as const
  },
  {
    id: "demo-research-organization",
    name: "Example Translational Sciences Lab",
    type: "RESEARCH_INSTITUTION" as const
  },
  {
    id: "demo-veterinary-organization",
    name: "RAM Veterinary Network",
    type: "VETERINARY" as const
  },
  {
    id: "demo-logistics-organization",
    name: "RAM Logistics Demo",
    type: "LOGISTICS" as const
  },
  {
    id: "demo-ram-organization",
    name: "RAM Corporation",
    type: "RAM" as const
  }
];

const actors = [
  {
    key: "farmer",
    name: "Alex Morgan",
    organizationId: "demo-farm-organization",
    role: "SUPPLIER_OWNER_ADMIN" as const
  },
  {
    key: "scientist",
    name: "Dr. Maya Chen",
    organizationId: "demo-research-organization",
    role: "RESEARCH_PI" as const
  },
  {
    key: "procurement",
    name: "Avery Brooks",
    organizationId: "demo-research-organization",
    role: "RESEARCH_PROCUREMENT" as const
  },
  {
    key: "receiver",
    name: "Dr. Morgan Lee",
    organizationId: "demo-research-organization",
    role: "RESEARCH_COMPLIANCE" as const
  },
  {
    key: "veterinarian",
    name: "Dr. Jordan Reyes",
    organizationId: "demo-veterinary-organization",
    role: "VETERINARIAN" as const
  },
  {
    key: "ram",
    name: "RAM Operations",
    organizationId: "demo-ram-organization",
    role: "RAM_SUPER_ADMIN" as const
  },
  {
    key: "finance",
    name: "RAM Finance",
    organizationId: "demo-ram-organization",
    role: "RAM_FINANCE_ADMIN" as const
  },
  {
    key: "compliance",
    name: "RAM Compliance",
    organizationId: "demo-ram-organization",
    role: "RAM_COMPLIANCE" as const
  },
  {
    key: "transporter",
    name: "Taylor Reed",
    organizationId: "demo-logistics-organization",
    role: "TRANSPORT_PROVIDER" as const
  }
];

try {
  for (const organization of organizations) {
    await prisma.organization.upsert({
      where: { id: organization.id },
      create: {
        ...organization,
        status: "ACTIVE"
      },
      update: {
        name: organization.name,
        type: organization.type,
        status: "ACTIVE"
      }
    });
  }

  for (const organization of organizations) {
    await prisma.organizationVerification.upsert({
      where: { organizationId: organization.id },
      create: {
        organizationId: organization.id,
        decision: "APPROVED",
        method: "CI_SEED",
        evidenceSummary: "Controlled CI organization seeded for verified lifecycle testing.",
        reviewedAt: new Date()
      },
      update: {
        decision: "APPROVED",
        method: "CI_SEED",
        evidenceSummary: "Controlled CI organization seeded for verified lifecycle testing.",
        reviewedAt: new Date()
      }
    });
  }

  for (const actor of actors) {
    const id = "demo-" + actor.key + "-user";
    const email = actor.key + "@demo.ram.invalid";

    await prisma.user.upsert({
      where: { id },
      create: {
        id,
        email,
        name: actor.name,
        emailVerifiedAt: new Date()
      },
      update: {
        email,
        name: actor.name,
        emailVerifiedAt: new Date()
      }
    });

    await prisma.membership.upsert({
      where: {
        userId_organizationId_role: {
          userId: id,
          organizationId: actor.organizationId,
          role: actor.role
        }
      },
      create: {
        userId: id,
        organizationId: actor.organizationId,
        role: actor.role,
        status: "ACTIVE"
      },
      update: {
        status: "ACTIVE"
      }
    });
  }

  const paymentGatewayName =
    process.env.RAM_PAYMENT_GATEWAY_NAME ?? "ci-gateway";

  await prisma.organizationPaymentProfile.upsert({
    where: { organizationId: "demo-research-organization" },
    create: {
      organizationId: "demo-research-organization",
      gateway: paymentGatewayName,
      externalAccountReference: "ci-buyer-account-ref",
      status: "ACTIVE",
      buyerCollectionEnabled: true,
      supplierPayoutEnabled: false,
      verifiedByUserId: "demo-finance-user",
      verifiedAt: new Date(),
      notes: "Controlled CI buyer payment profile."
    },
    update: {
      gateway: paymentGatewayName,
      externalAccountReference: "ci-buyer-account-ref",
      status: "ACTIVE",
      buyerCollectionEnabled: true,
      supplierPayoutEnabled: false,
      verifiedByUserId: "demo-finance-user",
      verifiedAt: new Date(),
      notes: "Controlled CI buyer payment profile."
    }
  });

  await prisma.organizationPaymentProfile.upsert({
    where: { organizationId: "demo-farm-organization" },
    create: {
      organizationId: "demo-farm-organization",
      gateway: paymentGatewayName,
      externalAccountReference: "ci-supplier-account-ref",
      status: "ACTIVE",
      buyerCollectionEnabled: false,
      supplierPayoutEnabled: true,
      verifiedByUserId: "demo-finance-user",
      verifiedAt: new Date(),
      notes: "Controlled CI supplier payment profile."
    },
    update: {
      gateway: paymentGatewayName,
      externalAccountReference: "ci-supplier-account-ref",
      status: "ACTIVE",
      buyerCollectionEnabled: false,
      supplierPayoutEnabled: true,
      verifiedByUserId: "demo-finance-user",
      verifiedAt: new Date(),
      notes: "Controlled CI supplier payment profile."
    }
  });

  await prisma.farmSite.upsert({
    where: { id: "demo-farm-site" },
    create: {
      id: "demo-farm-site",
      organizationId: "demo-farm-organization",
      internalLabel: "Pilot source site",
      regionLabel: "Mid-Atlantic",
      countyLabel: "Pilot County",
      exactAddress: "1 Restricted Farm Lane, Pilot County, MD 20000"
    },
    update: {
      organizationId: "demo-farm-organization",
      internalLabel: "Pilot source site",
      regionLabel: "Mid-Atlantic",
      countyLabel: "Pilot County",
      exactAddress: "1 Restricted Farm Lane, Pilot County, MD 20000"
    }
  });

  await prisma.farmDisclosurePolicy.upsert({
    where: { farmSiteId: "demo-farm-site" },
    create: {
      farmSiteId: "demo-farm-site"
    },
    update: {}
  });

  await prisma.facility.upsert({
    where: { id: "demo-research-facility" },
    create: {
      id: "demo-research-facility",
      organizationId: "demo-research-organization",
      name: "Example Translational Sciences Lab",
      facilityType: "RESEARCH_RECEIVING",
      regionLabel: "Mid-Atlantic",
      exactAddress: "100 Research Way, Test City, MD 20000"
    },
    update: {
      organizationId: "demo-research-organization",
      name: "Example Translational Sciences Lab",
      facilityType: "RESEARCH_RECEIVING",
      regionLabel: "Mid-Atlantic",
      exactAddress: "100 Research Way, Test City, MD 20000"
    }
  });

  console.log(
    "Seeded PostgreSQL E2E identities: " +
      actors.length +
      " users across " +
      organizations.length +
      " organizations."
  );
} finally {
  await prisma.$disconnect();
}
