import assert from "node:assert/strict";
import test from "node:test";
import { can, requireCapability } from "../lib/access";

test("research PIs cannot read restricted source records", () => {
  assert.equal(can("RESEARCH_PI", "source:read_restricted"), false);
});

test("RAM marketplace operations can read restricted source records", () => {
  assert.equal(can("RAM_MARKETPLACE_OPS", "source:read_restricted"), true);
});

test("capability enforcement throws when access is missing", () => {
  assert.throws(
    () => requireCapability("SUPPLIER_STAFF", "operations:manage"),
    /Forbidden/
  );
});


test("research PI can reserve but cannot commercially commit the institution", () => {
  assert.equal(can("RESEARCH_PI", "order:reserve"), true);
  assert.equal(can("RESEARCH_PI", "order:buyer_commit"), false);
});

test("research procurement can commit buyer quotes for the organization", () => {
  assert.equal(can("RESEARCH_PROCUREMENT", "order:reserve"), true);
  assert.equal(can("RESEARCH_PROCUREMENT", "order:buyer_commit"), true);
});

test("RAM finance and compliance powers are separated", () => {
  assert.equal(can("RAM_FINANCE_ADMIN", "pricing:manage"), true);
  assert.equal(can("RAM_FINANCE_ADMIN", "order:acquisition_commit"), true);
  assert.equal(can("RAM_FINANCE_ADMIN", "order:clearance"), false);

  assert.equal(can("RAM_COMPLIANCE", "order:clearance"), true);
  assert.equal(can("RAM_COMPLIANCE", "order:acquisition_commit"), false);
});


test("source disclosure authority remains role-separated", () => {
  assert.equal(can("RESEARCH_PI", "disclosure:request"), true);
  assert.equal(can("RESEARCH_PI", "disclosure:ram_review"), false);
  assert.equal(can("SUPPLIER_OWNER_ADMIN", "disclosure:supplier_review"), true);
  assert.equal(can("SUPPLIER_STAFF", "disclosure:supplier_review"), false);
  assert.equal(can("RAM_COMPLIANCE", "disclosure:ram_review"), true);
});
