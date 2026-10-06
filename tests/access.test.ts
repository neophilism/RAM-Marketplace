import { describe, expect, it } from "vitest";
import { can, requireCapability } from "@/lib/access";

describe("role access", () => {
  it("does not permit researchers to read restricted source records", () => {
    expect(can("RESEARCHER", "source:read_restricted")).toBe(false);
  });

  it("permits RAM operations to access restricted source records", () => {
    expect(can("RAM_OPERATIONS", "source:read_restricted")).toBe(true);
  });

  it("throws when a capability is missing", () => {
    expect(() => requireCapability("FARM_STAFF", "operations:manage")).toThrow(/Forbidden/);
  });
});
