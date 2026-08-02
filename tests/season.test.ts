import { describe, expect, it } from "vitest";
import { seasonLabel, seasonalStatus } from "@/lib/season";

const seasonalTower = {
  seasonal: true,
  seasonStartMonth: 5,
  seasonStartDay: 1,
  seasonEndMonth: 10,
  seasonEndDay: 31,
};

describe("seasonal operation helpers", () => {
  it("requires review when the operating schedule is missing", () => {
    expect(seasonLabel({ ...seasonalTower, operationPeriodType: null })).toBe(
      "Schedule not set",
    );
    expect(
      seasonalStatus(
        { ...seasonalTower, operationPeriodType: null },
        "2026-07-14",
      ),
    ).toBe("Review required");
  });
  it("labels year-round towers plainly", () => {
    expect(
      seasonLabel({
        ...seasonalTower,
        seasonal: false,
      }),
    ).toBe("Year-round tower");
  });

  it("labels editable seasonal windows", () => {
    expect(seasonLabel(seasonalTower)).toBe("Seasonal tower · May 1–Oct 31");
  });

  it("shows pre-season before the configured start", () => {
    expect(seasonalStatus(seasonalTower, "2026-04-15")).toBe("Pre-season");
  });

  it("uses actual startup to confirm active operation", () => {
    expect(
      seasonalStatus(
        { ...seasonalTower, actualStartupDate: "2026-05-05" },
        "2026-07-14",
      ),
    ).toBe("Operating season");
  });

  it("uses actual shutdown to show the season is shut down", () => {
    expect(
      seasonalStatus(
        {
          ...seasonalTower,
          actualStartupDate: "2026-05-05",
          actualShutdownDate: "2026-09-15",
        },
        "2026-09-20",
      ),
    ).toBe("Shut down for the season");
  });
});
