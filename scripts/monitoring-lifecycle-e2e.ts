import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const base = process.env.RAM_E2E_BASE_URL ?? "http://127.0.0.1:3118";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(name + " is required");
  return value;
}

const connectionString = requiredEnv("DATABASE_URL");
const runToken = requiredEnv("RAM_MONITORING_RUN_TOKEN");

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

async function loginRamAdmin() {
  const response = await postForm("/api/session/demo", { actor: "ram" });
  if (response.status !== 303) {
    fail("RAM admin login failed: " + response.status);
  }
  const setCookie = response.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0];
  if (!cookie) fail("RAM admin login did not issue session cookie");
  return cookie;
}

async function monitoringRun(token: string) {
  return fetch(base + "/api/monitoring/run", {
    method: "POST",
    headers: {
      authorization: "Bearer " + token
    }
  });
}

try {
  const live = await fetch(base + "/api/health/live");
  if (!live.ok) fail("Liveness probe failed");

  const ready = await fetch(base + "/api/health/ready");
  if (!ready.ok) fail("Readiness probe failed");

  const staleOrgId = "monitoring-stale-org-" + Date.now();
  await prisma.organization.create({
    data: {
      id: staleOrgId,
      name: "CI stale verification organization",
      type: "CRO",
      status: "PENDING_VERIFICATION",
      createdAt: new Date(Date.now() - 72 * 3_600_000)
    }
  });

  const settlement = await prisma.financialSettlement.findFirst({
    where: { status: "OPEN" },
    orderBy: { openedAt: "desc" }
  });
  if (!settlement) {
    fail("Expected open settlement from payment lifecycle E2E");
  }

  const stalePayment = await prisma.paymentExecution.create({
    data: {
      settlementId: settlement.id,
      counterpartyOrganizationId: "demo-research-organization",
      accountReference: "ci-buyer-account-ref",
      type: "BUYER_COLLECTION",
      status: "SUBMISSION_UNKNOWN",
      amountCents: 1,
      currency: "USD",
      gateway: "ci-gateway",
      idempotencyKey: "monitoring-e2e-" + Date.now(),
      requestedByUserId: "demo-finance-user",
      createdAt: new Date(Date.now() - 10 * 60_000),
      updatedAt: new Date(Date.now() - 10 * 60_000)
    }
  });

  const denied = await monitoringRun("wrong-token");
  if (denied.status !== 401) {
    fail("Monitoring scheduler should reject wrong bearer token");
  }

  const first = await monitoringRun(runToken);
  const firstBody = await first.text();
  if (!first.ok) {
    fail("Monitoring run failed: " + first.status + " " + firstBody);
  }

  const paymentIncident = await prisma.operationalIncident.findUnique({
    where: {
      fingerprint: "PAYMENT_SUBMISSION_UNKNOWN:" + stalePayment.id
    }
  });
  const orgIncident = await prisma.operationalIncident.findUnique({
    where: {
      fingerprint: "ORGANIZATION_VERIFICATION_STALE:" + staleOrgId
    }
  });

  if (!paymentIncident || !orgIncident) {
    fail("Monitoring cycle did not create expected incidents");
  }

  const sentAfterFirst = await prisma.alertDelivery.count({
    where: {
      incidentId: { in: [paymentIncident.id, orgIncident.id] },
      status: "SENT"
    }
  });
  if (sentAfterFirst !== 2) {
    fail("Expected one signed alert for each new incident");
  }

  const second = await monitoringRun(runToken);
  if (!second.ok) {
    fail("Second monitoring run failed: " + second.status);
  }

  const sentAfterSecond = await prisma.alertDelivery.count({
    where: {
      incidentId: { in: [paymentIncident.id, orgIncident.id] },
      status: "SENT"
    }
  });
  if (sentAfterSecond !== sentAfterFirst) {
    fail("Repeated monitoring scan should not resend open-incident alerts");
  }

  const refreshedPaymentIncident =
    await prisma.operationalIncident.findUniqueOrThrow({
      where: { id: paymentIncident.id }
    });
  if (refreshedPaymentIncident.occurrenceCount < 2) {
    fail("Repeated active signal did not increment incident occurrence count");
  }

  const adminCookie = await loginRamAdmin();

  const acknowledge = await postForm(
    "/api/ops/monitoring/incidents/" + paymentIncident.id + "/acknowledge",
    {},
    adminCookie
  );
  if (acknowledge.status !== 303) {
    fail("Incident acknowledge failed: " + acknowledge.status);
  }

  const resolve = await postForm(
    "/api/ops/monitoring/incidents/" + paymentIncident.id + "/resolve",
    { resolutionNotes: "CI operator reviewed the ambiguous payment." },
    adminCookie
  );
  if (resolve.status !== 303) {
    fail("Incident resolution failed: " + resolve.status);
  }

  const reopenRun = await monitoringRun(runToken);
  if (!reopenRun.ok) {
    fail("Monitoring reopen run failed: " + reopenRun.status);
  }

  const reopened = await prisma.operationalIncident.findUniqueOrThrow({
    where: { id: paymentIncident.id }
  });
  if (reopened.status !== "OPEN") {
    fail("Persistent condition did not reopen a resolved incident");
  }

  const sentAfterReopen = await prisma.alertDelivery.count({
    where: {
      incidentId: paymentIncident.id,
      status: "SENT"
    }
  });
  if (sentAfterReopen !== 2) {
    fail("Reopened incident should generate exactly one new signed alert");
  }

  await prisma.paymentExecution.update({
    where: { id: stalePayment.id },
    data: {
      status: "CANCELED",
      completedAt: new Date()
    }
  });

  const resolveAfterClear = await postForm(
    "/api/ops/monitoring/incidents/" + paymentIncident.id + "/resolve",
    { resolutionNotes: "CI underlying payment condition is now cleared." },
    adminCookie
  );
  if (resolveAfterClear.status !== 303) {
    fail("Incident resolution after condition clear failed");
  }

  const clearedRun = await monitoringRun(runToken);
  if (!clearedRun.ok) {
    fail("Monitoring cleared-condition run failed");
  }

  const remainsResolved = await prisma.operationalIncident.findUniqueOrThrow({
    where: { id: paymentIncident.id }
  });
  if (remainsResolved.status !== "RESOLVED") {
    fail("Cleared condition should not reopen resolved incident");
  }

  const verifyGate = await postForm(
    "/api/ops/pilot/gates/manual_monitoring/verify",
    {
      ownerUserId: "demo-ram-user",
      evidenceSummary:
        "CI verified scheduler authentication, signed alert delivery and incident lifecycle.",
      notes: "Controlled CI verification."
    },
    adminCookie
  );
  if (verifyGate.status !== 303) {
    fail("Pilot gate verification failed: " + verifyGate.status);
  }

  const gate = await prisma.pilotGateVerification.findUnique({
    where: { gateKey: "manual_monitoring" }
  });
  if (gate?.status !== "VERIFIED" || gate.ownerUserId !== "demo-ram-user") {
    fail("Pilot gate verification was not persisted with accountable owner");
  }

  const resetGate = await postForm(
    "/api/ops/pilot/gates/manual_monitoring/reset",
    { reason: "CI returns gate to pending after verification test." },
    adminCookie
  );
  if (resetGate.status !== 303) {
    fail("Pilot gate reset failed: " + resetGate.status);
  }

  const reset = await prisma.pilotGateVerification.findUniqueOrThrow({
    where: { gateKey: "manual_monitoring" }
  });
  if (reset.status !== "PENDING") {
    fail("Pilot gate reset did not persist");
  }

  const successfulRun = await prisma.monitoringRun.findFirst({
    where: { status: "SUCCESS" },
    orderBy: { completedAt: "desc" }
  });
  if (!successfulRun?.completedAt) {
    fail("Monitoring heartbeat was not persisted");
  }

  console.log(
    "RAM monitoring E2E passed: health probes, bearer scheduler, incident dedupe/reopen, signed alerts, operator lifecycle and accountable pilot gate verification."
  );
} finally {
  await prisma.$disconnect();
}
