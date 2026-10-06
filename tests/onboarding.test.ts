import assert from "node:assert/strict";
import test from "node:test";
import {
  initialRoleForOrganization,
  onboardingSchema
} from "../lib/onboarding";

test("farm onboarding requires restricted site fields", () => {
  const incomplete = onboardingSchema.safeParse({
    name: "Farm Owner",
    email: "owner@example.test",
    organizationName: "Example Farm",
    organizationType: "FARM"
  });
  assert.equal(incomplete.success, false);

  const complete = onboardingSchema.safeParse({
    name: "Farm Owner",
    email: "owner@example.test",
    organizationName: "Example Farm",
    organizationType: "FARM",
    regionLabel: "Midwest U.S.",
    farmSiteLabel: "Main site",
    exactAddress: "123 Private Farm Road"
  });
  assert.equal(complete.success, true);
});

test("research onboarding does not require farm source fields", () => {
  const parsed = onboardingSchema.safeParse({
    name: "Principal Investigator",
    email: "pi@example.test",
    organizationName: "Example University",
    organizationType: "RESEARCH_INSTITUTION"
  });
  assert.equal(parsed.success, true);
});

test("organization types map to least-privilege initial roles", () => {
  assert.equal(initialRoleForOrganization("FARM"), "SUPPLIER_OWNER_ADMIN");
  assert.equal(initialRoleForOrganization("RESEARCH_INSTITUTION"), "RESEARCH_PI");
  assert.equal(initialRoleForOrganization("VETERINARY"), "VETERINARIAN");
  assert.equal(initialRoleForOrganization("LOGISTICS"), "TRANSPORT_PROVIDER");
});
