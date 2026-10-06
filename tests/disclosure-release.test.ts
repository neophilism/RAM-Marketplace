import assert from "node:assert/strict";
import test from "node:test";
import {
  assertScopedReleaseSnapshot,
  buildDisclosureReleaseSnapshot
} from "../lib/disclosure-release";

const source = {
  generalHusbandry:
    "Acme Farm uses group housing. Contact owner@example.com. Site: 123 Private Farm Road.",
  countyLabel: "Example County",
  legalOwnerName: "Acme Farm",
  exactAddress: "123 Private Farm Road",
  ownerContactName: "Alex Owner",
  ownerContactEmail: "owner@example.com",
  localVetName: "Dr. Local Vet",
  localVetContact: "202-555-0112"
};

test("release contains only explicitly approved fields", () => {
  const snapshot = buildDisclosureReleaseSnapshot(
    ["GENERAL_HUSBANDRY"],
    source
  );

  assert.deepEqual(snapshot.releasedFields, ["GENERAL_HUSBANDRY"]);
  assert.equal(typeof snapshot.releasedData.GENERAL_HUSBANDRY, "string");
  assert.equal(snapshot.releasedData.COUNTY, undefined);
  assert.equal(snapshot.releasedData.FARM_IDENTITY, undefined);
  assert.doesNotThrow(() => assertScopedReleaseSnapshot(snapshot));
});

test("released husbandry narrative is sanitized of source identity and contact data", () => {
  const snapshot = buildDisclosureReleaseSnapshot(
    ["GENERAL_HUSBANDRY"],
    source
  );
  const value = snapshot.releasedData.GENERAL_HUSBANDRY ?? "";

  assert.equal(value.includes("Acme Farm"), false);
  assert.equal(value.includes("123 Private Farm Road"), false);
  assert.equal(value.includes("owner@example.com"), false);
});

test("county may be released without exposing exact address", () => {
  const snapshot = buildDisclosureReleaseSnapshot(["COUNTY"], source);

  assert.equal(snapshot.releasedData.COUNTY, "Example County");
  assert.equal(
    JSON.stringify(snapshot.releasedData).includes("123 Private Farm Road"),
    false
  );
});

test("farm identity release contains name only, never exact address or contacts", () => {
  const snapshot = buildDisclosureReleaseSnapshot(
    ["FARM_IDENTITY"],
    source
  );

  assert.equal(snapshot.releasedData.FARM_IDENTITY, "Acme Farm");
  assert.equal(
    JSON.stringify(snapshot.releasedData).includes("123 Private Farm Road"),
    false
  );
  assert.equal(
    JSON.stringify(snapshot.releasedData).includes("owner@example.com"),
    false
  );
});
