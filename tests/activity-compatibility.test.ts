import { describe, expect, it } from "vitest";
import {
  activitiesCanShareVisit,
  annualCleaningCompletionDates,
  completedEventsConflictOnSameDate,
} from "@/lib/activity-compatibility";

describe("annual cleaning and hyperhalogenation compatibility", () => {
  it("requires separate visits for annual cleaning and hyperhalogenation", () => {
    expect(
      activitiesCanShareVisit(
        "ROUTINE_CLEANING",
        "SUMMERTIME_HYPERHALOGENATION",
      ),
    ).toBe(false);
    expect(
      activitiesCanShareVisit("ROUTINE_LEGIONELLA_SAMPLE", "ROUTINE_CLEANING"),
    ).toBe(true);
  });

  it("rejects completed cleaning and hyperhalogenation on the same date", () => {
    expect(
      completedEventsConflictOnSameDate(
        "CLEANING_COMPLETED",
        "SUMMERTIME_HYPERHALOGENATION",
      ),
    ).toBe(true);
    expect(
      completedEventsConflictOnSameDate(
        "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
        "SUMMERTIME_HYPERHALOGENATION",
      ),
    ).toBe(false);
  });

  it("counts only completed work that includes cleaning", () => {
    expect(
      annualCleaningCompletionDates([
        { eventType: "CLEANING_COMPLETED", eventDate: "2026-02-10" },
        {
          eventType: "STARTUP_CLEANING_DISINFECTION",
          eventDate: "2026-04-15",
        },
        { eventType: "FULL_REMEDIATION", eventDate: "2026-07-20" },
        {
          eventType: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
          eventDate: "2026-08-01",
        },
        {
          eventType: "QUARTERLY_INSPECTION_COMPLETED",
          eventDate: "2026-08-02",
        },
      ]),
    ).toEqual(["2026-02-10", "2026-04-15", "2026-07-20"]);
  });
});
