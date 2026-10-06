import { createHmac } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const base = process.env.RAM_E2E_BASE_URL ?? "http://127.0.0.1:3118";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(name + " is required");
  return value;
}

const connectionString = requiredEnv("DATABASE_URL");
const gatewaySecret = requiredEnv("RAM_PAYMENT_GATEWAY_SECRET");
const gatewayName = requiredEnv("RAM_PAYMENT_GATEWAY_NAME");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

function fail(message: string): never {
  throw new Error(message);
}

function form(fields: Record<string, string>) {
  return new URLSearchParams(fields);
}

async function postForm(
  path: string,
  fields: Record<string, string>,
  cookie?: string
) {
  const headers = new Headers({ Origin: base });
  if (cookie) headers.set("Cookie", cookie);

  return fetch(base + path, {
    method: "POST",
    headers,
    body: form(fields),
    redirect: "manual"
  });
}

async function getPage(path: string, cookie: string) {
  const response = await fetch(base + path, {
    method: "GET",
    headers: { Cookie: cookie },
    redirect: "manual"
  });
  const body = await response.text();
  if (!response.ok) {
    fail("GET " + path + " failed: " + response.status + " " + body);
  }
  return body;
}

async function loginFinance() {
  const response = await postForm("/api/session/demo", { actor: "finance" });
  if (response.status !== 303) {
    fail("Finance login failed: " + response.status);
  }
  const setCookie = response.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0];
  if (!cookie) fail("Finance login did not issue session cookie");
  return cookie;
}

function sign(rawBody: string, timestamp: string) {
  return createHmac("sha256", gatewaySecret)
    .update(timestamp)
    .update(".")
    .update(rawBody)
    .digest("hex");
}

async function webhook(payload: Record<string, unknown>) {
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const response = await fetch(base + "/api/payments/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ram-gateway-timestamp": timestamp,
      "x-ram-gateway-signature": sign(rawBody, timestamp)
    },
    body: rawBody
  });

  const body = await response.text();
  if (!response.ok) {
    fail("Payment webhook failed: " + response.status + " " + body);
  }
  return JSON.parse(body) as {
    ok: boolean;
    duplicate?: boolean;
    result?: string;
  };
}

async function ledgerCount(settlementId: string, type: string) {
  return prisma.financialLedgerEntry.count({
    where: {
      settlementId,
      type: type as never
    }
  });
}

async function runProviderExecution(options: {
  settlementId: string;
  type: "BUYER_COLLECTION" | "SUPPLIER_PAYOUT" | "BUYER_REFUND";
  amountUsd: string;
  ledgerType: "BUYER_PAYMENT" | "SUPPLIER_PAYOUT" | "BUYER_REFUND";
  expectedOrganizationId: string;
  expectedAccountReference: string;
  financeCookie: string;
  testManualCollision?: boolean;
  testDuplicateWebhook?: boolean;
}) {
  const initiate = await postForm(
    "/api/finance/settlements/" + options.settlementId + "/execute",
    {
      type: options.type,
      amountUsd: options.amountUsd
    },
    options.financeCookie
  );

  if (initiate.status !== 303) {
    fail(
      options.type +
        " initiation failed: " +
        initiate.status +
        " " +
        (await initiate.text())
    );
  }

  const execution = await prisma.paymentExecution.findFirst({
    where: {
      settlementId: options.settlementId,
      type: options.type
    },
    orderBy: { createdAt: "desc" }
  });

  if (!execution || execution.status !== "SUBMITTED") {
    fail("Expected submitted " + options.type + " execution");
  }
  if (!execution.providerReference) {
    fail("Gateway acknowledgment did not persist provider reference");
  }
  if (!execution.requestPayloadHash || !/^[a-f0-9]{64}$/.test(execution.requestPayloadHash)) {
    fail("Signed outbound payment request hash was not persisted");
  }
  if (execution.counterpartyOrganizationId !== options.expectedOrganizationId) {
    fail(
      options.type +
        " routed to wrong organization: " +
        execution.counterpartyOrganizationId
    );
  }
  if (execution.accountReference !== options.expectedAccountReference) {
    fail(options.type + " did not snapshot expected opaque account reference");
  }

  if (options.testManualCollision) {
    const movementType =
      options.type === "BUYER_COLLECTION"
        ? "BUYER_PAYMENT"
        : options.type === "SUPPLIER_PAYOUT"
          ? "SUPPLIER_PAYOUT"
          : "BUYER_REFUND";

    const manual = await postForm(
      "/api/finance/settlements/" + options.settlementId + "/movement",
      {
        movementType,
        amountUsd: options.amountUsd,
        externalReference: "should-be-blocked-" + options.type
      },
      options.financeCookie
    );

    if (manual.status !== 400) {
      fail(
        "Manual movement should be blocked while " +
          options.type +
          " is unresolved; got " +
          manual.status
      );
    }
  }

  const before = await ledgerCount(options.settlementId, options.ledgerType);

  const event = {
    eventId: "evt-success-" + execution.id,
    gateway: gatewayName,
    provider: execution.provider ?? "ci-provider",
    providerReference: execution.providerReference,
    executionId: execution.id,
    type: execution.type,
    amountCents: execution.amountCents,
    currency: execution.currency,
    status: "SUCCEEDED",
    occurredAt: new Date().toISOString()
  };

  const first = await webhook(event);
  if (first.result !== "SUCCEEDED") {
    fail("Expected successful " + options.type + " webhook result");
  }

  const afterFirst = await ledgerCount(options.settlementId, options.ledgerType);
  if (afterFirst !== before + 1) {
    fail(options.type + " success did not append exactly one ledger entry");
  }

  if (options.testDuplicateWebhook) {
    const second = await webhook(event);
    if (second.duplicate !== true) {
      fail("Duplicate provider event was not recognized idempotently");
    }

    const afterDuplicate = await ledgerCount(
      options.settlementId,
      options.ledgerType
    );
    if (afterDuplicate !== afterFirst) {
      fail("Duplicate provider event appended a second ledger entry");
    }
  }

  const ledgerEntry = await prisma.financialLedgerEntry.findFirst({
    where: {
      settlementId: options.settlementId,
      type: options.ledgerType
    },
    orderBy: { occurredAt: "desc" }
  });

  if (
    ledgerEntry?.externalReference !==
    (execution.provider ?? "ci-provider") + ":" + execution.providerReference
  ) {
    fail("Provider reference was not preserved on append-only ledger entry");
  }

  const completedExecution = await prisma.paymentExecution.findUnique({
    where: { id: execution.id }
  });
  if (!ledgerEntry || completedExecution?.ledgerEntryId !== ledgerEntry.id) {
    fail("Successful payment execution does not point to its immutable ledger evidence");
  }

  return completedExecution ?? execution;
}

try {
  const financeCookie = await loginFinance();

  const profileUpdate = await postForm(
    "/api/finance/payment-profiles",
    {
      organizationId: "demo-research-organization",
      externalAccountReference: "ci-buyer-account-ref",
      buyerCollectionEnabled: "on",
      verificationAttestation: "on",
      notes: "CI re-verifies buyer payment routing through the finance API."
    },
    financeCookie
  );

  if (profileUpdate.status !== 303) {
    fail(
      "Buyer payment profile update failed: " +
        profileUpdate.status +
        " " +
        (await profileUpdate.text())
    );
  }

  const profilePage = await getPage("/finance/payment-profiles", financeCookie);
  if (
    profilePage.includes("ci-buyer-account-ref") ||
    profilePage.includes("ci-supplier-account-ref")
  ) {
    fail("Finance payment profile page exposed a full provider account reference");
  }

  const organization = await prisma.organization.findUnique({
    where: { id: "demo-research-organization" }
  });
  const ramUser = await prisma.user.findUnique({
    where: { id: "demo-finance-user" }
  });
  const scientistUser = await prisma.user.findUnique({
    where: { id: "demo-scientist-user" }
  });

  if (!organization || !ramUser || !scientistUser) {
    fail("Required seeded finance/research identities missing");
  }

  const animal = await prisma.animalCase.findFirst({
    orderBy: { createdAt: "asc" }
  });
  const researchNeed = await prisma.researchNeed.findFirst({
    orderBy: { createdAt: "asc" }
  });

  if (!animal || !researchNeed) {
    fail("Expected transaction E2E seed records");
  }

  const order = await prisma.order.create({
    data: {
      animalCaseId: animal.publicId,
      researchNeedId: researchNeed.id,
      buyerOrganizationId: organization.id,
      createdByUserId: scientistUser.id,
      status: "ACCEPTED",
      buyerPriceCents: 10_000,
      supplierScheduleCents: 2_500,
      supplierMarketCeilingCents: 2_000,
      supplierAcquisitionCents: 2_000,
      directCostsCents: 0,
      buyerCommittedAt: new Date(),
      acquisitionCommittedAt: new Date()
    }
  });

  const paymentSettlement = await prisma.financialSettlement.create({
    data: {
      orderId: order.id,
      status: "OPEN",
      buyerReceivableCents: 10_000,
      supplierPayableCents: 2_000,
      supplierScheduleCents: 2_500,
      supplierMarketCeilingCents: 2_000,
      directCostsCents: 0,
      grossSpreadCents: 8_000,
      entries: {
        create: [
          {
            type: "BUYER_RECEIVABLE",
            amountCents: 10_000,
            recordedByUserId: ramUser.id
          },
          {
            type: "SUPPLIER_PAYABLE",
            amountCents: 2_000,
            recordedByUserId: ramUser.id
          }
        ]
      }
    }
  });

  await runProviderExecution({
    settlementId: paymentSettlement.id,
    type: "BUYER_COLLECTION",
    amountUsd: "100",
    ledgerType: "BUYER_PAYMENT",
    expectedOrganizationId: "demo-research-organization",
    expectedAccountReference: "ci-buyer-account-ref",
    financeCookie,
    testManualCollision: true,
    testDuplicateWebhook: true
  });

  const farmProfile = await prisma.organizationPaymentProfile.findUnique({
    where: { organizationId: "demo-farm-organization" }
  });
  if (!farmProfile) {
    fail("Seeded farm payment profile is missing");
  }

  const suspendFarm = await postForm(
    "/api/finance/payment-profiles/" + farmProfile.id + "/status",
    {
      status: "SUSPENDED",
      reason: "CI verifies suspended payout routing blocks execution"
    },
    financeCookie
  );
  if (suspendFarm.status !== 303) {
    fail("Farm payment profile suspension failed: " + suspendFarm.status);
  }

  const blockedSupplier = await postForm(
    "/api/finance/settlements/" + paymentSettlement.id + "/execute",
    {
      type: "SUPPLIER_PAYOUT",
      amountUsd: "20"
    },
    financeCookie
  );
  if (blockedSupplier.status !== 400) {
    fail(
      "Suspended supplier payment profile should block payout initiation; got " +
        blockedSupplier.status
    );
  }

  const reactivateFarm = await postForm(
    "/api/finance/payment-profiles/" + farmProfile.id + "/status",
    {
      status: "ACTIVE",
      reason: "CI reactivates verified farm payout routing"
    },
    financeCookie
  );
  if (reactivateFarm.status !== 303) {
    fail("Farm payment profile reactivation failed: " + reactivateFarm.status);
  }

  await runProviderExecution({
    settlementId: paymentSettlement.id,
    type: "SUPPLIER_PAYOUT",
    amountUsd: "20",
    ledgerType: "SUPPLIER_PAYOUT",
    expectedOrganizationId: "demo-farm-organization",
    expectedAccountReference: "ci-supplier-account-ref",
    financeCookie,
    testManualCollision: true
  });

  const credit = await postForm(
    "/api/finance/settlements/" + paymentSettlement.id + "/movement",
    {
      movementType: "BUYER_CREDIT",
      amountUsd: "100",
      externalReference: "ci-accept-with-credit",
      notes: "CI credit creates buyer refund due for provider refund testing."
    },
    financeCookie
  );

  if (credit.status !== 303) {
    fail(
      "Buyer credit setup failed: " +
        credit.status +
        " " +
        (await credit.text())
    );
  }

  await runProviderExecution({
    settlementId: paymentSettlement.id,
    type: "BUYER_REFUND",
    amountUsd: "100",
    ledgerType: "BUYER_REFUND",
    expectedOrganizationId: "demo-research-organization",
    expectedAccountReference: "ci-buyer-account-ref",
    financeCookie,
    testManualCollision: true
  });

  console.log(
    "RAM payment lifecycle E2E passed: buyer collection, supplier payout, buyer refund, profile masking/suspension, signed acknowledgments, webhook idempotency and correct organization routing."
  );
} finally {
  await prisma.$disconnect();
}
