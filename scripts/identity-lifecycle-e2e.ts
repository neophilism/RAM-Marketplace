import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { createExternalIdentityAssertion } from "../lib/auth/external-assertion";

const base = process.env.RAM_E2E_BASE_URL ?? "http://127.0.0.1:3118";
const assertionSecret = process.env.RAM_IDENTITY_ASSERTION_SECRET;
const connectionString = process.env.DATABASE_URL;

if (!assertionSecret) {
  throw new Error("RAM_IDENTITY_ASSERTION_SECRET is required");
}
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

function fail(message: string): never {
  throw new Error(message);
}

function form(fields: Record<string, string>) {
  return new URLSearchParams(fields);
}

async function post(
  path: string,
  fields: Record<string, string>,
  options: { cookie?: string; origin?: string } = {}
) {
  const headers = new Headers();
  headers.set("Origin", options.origin ?? base);
  if (options.cookie) headers.set("Cookie", options.cookie);

  return fetch(base + path, {
    method: "POST",
    headers,
    body: form(fields),
    redirect: "manual"
  });
}

function cookieNamed(response: Response, name: string) {
  const header = response.headers.get("set-cookie") ?? "";
  const match = header.match(
    new RegExp("(?:^|,\\s*)" + name + "=([^;]+)")
  );
  if (!match) {
    fail("Expected " + name + " cookie; got: " + header);
  }
  return name + "=" + match[1];
}

function expectStatus(response: Response, status: number, label: string) {
  if (response.status !== status) {
    fail(label + " expected " + status + ", got " + response.status);
  }
}

function assertion(
  label: string,
  email: string,
  name: string,
  subject: string
) {
  const now = Math.floor(Date.now() / 1000);
  return createExternalIdentityAssertion(
    {
      v: 1,
      aud: "ram-marketplace",
      provider: "ci-idp",
      subject,
      email,
      name,
      emailVerified: true,
      mfa: true,
      amr: ["pwd", "mfa"],
      jti: "ci-" + label + "-" + now,
      iat: now,
      exp: now + 120
    },
    assertionSecret
  );
}

async function demoRamCookie() {
  const response = await post("/api/session/demo", { actor: "ram" });
  expectStatus(response, 303, "RAM demo login");
  return cookieNamed(response, "ram_session");
}

async function externalLogin(
  token: string,
  organizationId?: string
) {
  const response = await post(
    "/api/session/external",
    {
      assertion: token,
      ...(organizationId ? { organizationId } : {})
    },
    { origin: "https://identity.example.test" }
  );
  return response;
}

async function protectedResearchProbe(cookie: string) {
  return post("/api/research-needs", {}, { cookie });
}

async function membershipAction(
  ramCookie: string,
  membershipId: string,
  status: "ACTIVE" | "SUSPENDED" | "REVOKED",
  reason: string
) {
  const response = await post(
    "/api/ops/access/memberships/" + membershipId,
    { status, reason },
    { cookie: ramCookie }
  );
  expectStatus(response, 303, "membership " + status);
}

async function organizationAction(
  ramCookie: string,
  organizationId: string,
  action: "APPROVE" | "SUSPEND" | "REACTIVATE",
  extra: Record<string, string> = {}
) {
  const response = await post(
    "/api/ops/access/organizations/" + organizationId,
    { action, ...extra },
    { cookie: ramCookie }
  );
  expectStatus(response, 303, "organization " + action);
}

try {
  const ramCookie = await demoRamCookie();

  const scientistToken = assertion(
    "scientist",
    "scientist@demo.ram.invalid",
    "Dr. Maya Chen",
    "ci-scientist-subject"
  );

  const scientistLogin = await externalLogin(scientistToken);
  expectStatus(scientistLogin, 303, "external scientist login");
  if (
    new URL(scientistLogin.headers.get("location") ?? "/", base).pathname !==
    "/research"
  ) {
    fail("Active scientist should land in /research");
  }
  const scientistCookie = cookieNamed(scientistLogin, "ram_session");

  const replay = await externalLogin(scientistToken);
  expectStatus(replay, 401, "replayed external assertion");

  const scientistMembership = await prisma.membership.findFirst({
    where: {
      user: { email: "scientist@demo.ram.invalid" },
      role: "RESEARCH_PI"
    },
    select: {
      id: true,
      organizationId: true
    }
  });
  if (!scientistMembership) fail("Scientist membership not found");

  await membershipAction(
    ramCookie,
    scientistMembership.id,
    "SUSPENDED",
    "CI validates immediate durable-session revocation"
  );

  expectStatus(
    await protectedResearchProbe(scientistCookie),
    403,
    "same cookie after membership suspension"
  );

  await membershipAction(
    ramCookie,
    scientistMembership.id,
    "ACTIVE",
    "CI restores active membership after suspension test"
  );

  expectStatus(
    await protectedResearchProbe(scientistCookie),
    400,
    "same cookie after membership reactivation"
  );

  await organizationAction(
    ramCookie,
    scientistMembership.organizationId,
    "SUSPEND",
    { notes: "CI validates organization-level session revocation" }
  );

  expectStatus(
    await protectedResearchProbe(scientistCookie),
    403,
    "same cookie after organization suspension"
  );

  await organizationAction(
    ramCookie,
    scientistMembership.organizationId,
    "REACTIVATE"
  );

  expectStatus(
    await protectedResearchProbe(scientistCookie),
    400,
    "same cookie after organization reactivation"
  );

  const newcomerEmail = "new-verified-researcher@identity.ram.test";
  const newcomerToken = assertion(
    "newcomer",
    newcomerEmail,
    "New Verified Researcher",
    "ci-newcomer-subject"
  );

  const newcomerLogin = await externalLogin(newcomerToken);
  expectStatus(newcomerLogin, 303, "new verified identity login");
  if (
    new URL(newcomerLogin.headers.get("location") ?? "/", base).pathname !==
    "/onboarding"
  ) {
    fail("New verified identity should land in /onboarding");
  }
  const enrollmentCookie = cookieNamed(
    newcomerLogin,
    "ram_identity_enrollment"
  );

  const onboard = await post(
    "/api/onboarding",
    {
      name: "Ignored Unverified Name",
      email: "ignored@example.test",
      organizationName: "CI Pending Research Institution",
      organizationType: "RESEARCH_INSTITUTION"
    },
    { cookie: enrollmentCookie }
  );
  expectStatus(onboard, 303, "verified organization onboarding");
  const pendingCookie = cookieNamed(onboard, "ram_session");

  expectStatus(
    await protectedResearchProbe(pendingCookie),
    403,
    "pending organization operational access"
  );

  const newcomer = await prisma.user.findUnique({
    where: { email: newcomerEmail },
    include: {
      memberships: {
        include: {
          organization: true
        }
      }
    }
  });
  if (!newcomer || newcomer.memberships.length !== 1) {
    fail("Verified newcomer membership was not created");
  }

  const pendingOrganization = newcomer.memberships[0].organization;
  if (pendingOrganization.status !== "PENDING_VERIFICATION") {
    fail("New organization must begin pending verification");
  }

  await organizationAction(
    ramCookie,
    pendingOrganization.id,
    "APPROVE",
    {
      method: "CI_IDENTITY_AND_REGISTRY_CHECK",
      evidenceSummary:
        "CI verified the identity-bound onboarding record and organization lifecycle approval."
    }
  );

  expectStatus(
    await protectedResearchProbe(pendingCookie),
    400,
    "same cookie after organization approval"
  );

  const verification = await prisma.organizationVerification.findUnique({
    where: { organizationId: pendingOrganization.id }
  });
  if (verification?.decision !== "APPROVED") {
    fail("Organization approval record was not persisted");
  }

  console.log(
    "RAM identity lifecycle E2E passed: signed login, replay prevention, membership revocation, organization suspension, verified onboarding and approval."
  );
} finally {
  await prisma.$disconnect();
}
