import { describe, expect, it } from "vitest";
import {
  calendarGridBounds,
  calendarMonthBounds,
  cleaningGapMessage,
  defaultCleaningDate,
  shiftCleaningDate,
} from "@/lib/cleaning-schedule";

describe("linked cleaning scheduling", () => {
  it("defaults Cleaning to the following calendar day, including Friday", () => {
    expect(defaultCleaningDate("2026-10-16")).toBe("2026-10-17");
  });

  it("warns without rejecting unusual sequencing", () => {
    expect(cleaningGapMessage("2026-10-16", "2026-10-15")).toContain("before");
    expect(cleaningGapMessage("2026-10-16", "2026-10-16")).toContain(
      "same date",
    );
    expect(cleaningGapMessage("2026-10-16", "2026-10-20")).toContain("4 days");
    expect(cleaningGapMessage("2026-10-16", "2026-10-17")).toBeNull();
  });

  it("can shift Cleaning by the same delta as Add", () => {
    expect(shiftCleaningDate("2026-10-16", "2026-10-19", "2026-10-17")).toBe(
      "2026-10-20",
    );
  });

  it("calculates monthly and visible grid boundaries as date-only values", () => {
    expect(calendarMonthBounds("2026-11")).toEqual({
      start: "2026-11-01",
      endExclusive: "2026-12-01",
    });
    expect(calendarGridBounds("2026-11")).toEqual({
      start: "2026-11-01",
      endExclusive: "2026-12-06",
    });
  });
});
