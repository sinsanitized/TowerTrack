import { describe, expect, it } from "vitest";
import {
  activitiesCanShareVisit,
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
});
