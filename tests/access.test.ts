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
