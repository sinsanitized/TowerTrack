import { describe, expect, it } from "vitest";
import { formatLegionellaResult } from "@/lib/labels";

describe("Legionella result presentation", () => {
  it("displays an entered zero as None detected", () => {
    expect(formatLegionellaResult(0)).toBe("None detected");
  });

  it("preserves the distinction between no result and detected values", () => {
    expect(formatLegionellaResult(null)).toBe("No result entered");
    expect(formatLegionellaResult(undefined)).toBe("No result entered");
    expect(formatLegionellaResult(25)).toBe("25 CFU/mL");
  });
});
