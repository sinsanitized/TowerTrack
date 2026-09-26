import { describe, expect, it } from "vitest";
import {
  formatLegionellaResult,
  lowercaseWithJurisdictionAcronyms,
  plainEnumLabel,
} from "@/lib/labels";

describe("Legionella result presentation", () => {
  it("always capitalizes NYC and NYS in generated wording", () => {
    expect(plainEnumLabel("NYS_LEGIONELLA_RESULT_REPORTING")).toBe(
      "NYS legionella result reporting",
    );
    expect(plainEnumLabel("NYC_DOH_NOTIFICATION")).toBe("NYC DOH notification");
    expect(
      lowercaseWithJurisdictionAcronyms("Submit the NYC and NYS reports"),
    ).toBe("submit the NYC and NYS reports");
  });

  it("displays an entered zero as None detected", () => {
    expect(formatLegionellaResult(0)).toBe("None detected");
  });

  it("preserves the distinction between no result and detected values", () => {
    expect(formatLegionellaResult(null)).toBe("No result entered");
    expect(formatLegionellaResult(undefined)).toBe("No result entered");
    expect(formatLegionellaResult(25)).toBe("25 CFU/mL");
  });
});
