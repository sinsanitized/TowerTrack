import { describe, expect, it } from "vitest";
import {
  accessibleRuleProfileWhere,
  organizationSystemWhere,
} from "@/lib/tenant-scope";

describe("tenant query scopes", () => {
  it("limits profiles to shared baselines or the current organization", () => {
    expect(accessibleRuleProfileWhere("org-a")).toEqual({
      OR: [{ organizationId: null }, { organizationId: "org-a" }],
    });
  });

  it("limits systems through their owning customer organization", () => {
    expect(organizationSystemWhere("org-a")).toEqual({
      building: { customer: { organizationId: "org-a" } },
    });
  });
});
