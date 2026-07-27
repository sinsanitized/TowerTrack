import { describe, expect, it } from "vitest";
import {
  actionableWorkingDaysRemaining,
  calendarDaysRemaining,
  complianceDateInfo,
  dateTimeLocalValue,
  formatComplianceDate,
  formatOperationalDate,
  formatComplianceDateTime,
  formatRelativeDate,
  formatRelativeWorkingDate,
  isWeekend,
  lastWorkingDayBefore,
  parseDateTimeInTimeZone,
  todayInTimeZone,
  weekendDatesInWindow,
  weekendDeadlineRisk,
  workingDaysRemaining,
  nextWorkingDate,
} from "@/lib/date";

describe("compliance date presentation", () => {
  it("formats date-only values with a weekday without local-time rollover", () => {
    expect(formatComplianceDate("2026-08-10")).toBe("Mon, Aug 10, 2026");
    expect(formatOperationalDate("2026-01-05")).toBe("Monday 01/05/2026");
  });

  it("formats exact compliance timestamps in New York time", () => {
    expect(formatComplianceDateTime("2026-07-16T18:30:00.000Z")).toContain(
      "2:30 PM EDT",
    );
  });

  it("derives the compliance day in the configured timezone", () => {
    expect(
      todayInTimeZone("America/New_York", new Date("2026-07-17T02:00:00.000Z")),
    ).toBe("2026-07-16");
  });

  it("preserves an instant when populating a local date-time editor", () => {
    expect(
      dateTimeLocalValue(
        new Date("2026-07-16T18:30:00.000Z"),
        "America/New_York",
      ),
    ).toBe("2026-07-16T14:30");
  });

  it("parses a New York local timestamp without server-timezone drift", () => {
    expect(parseDateTimeInTimeZone("2026-07-16T14:30").toISOString()).toBe(
      "2026-07-16T18:30:00.000Z",
    );
  });

  it("rejects a local timestamp skipped by daylight-saving time", () => {
    expect(() => parseDateTimeInTimeZone("2026-03-08T02:30")).toThrow(
      /does not exist/i,
    );
  });

  it("labels calendar-relative dates", () => {
    expect(formatRelativeDate("2026-07-16", "2026-07-16")).toBe("Today");
    expect(formatRelativeDate("2026-07-17", "2026-07-16")).toBe("Tomorrow");
    expect(formatRelativeDate("2026-07-15", "2026-07-16")).toBe("Yesterday");
    expect(formatRelativeDate("2026-07-21", "2026-07-16")).toBe(
      "In 5 calendar days",
    );
  });
});

describe("working-day intelligence", () => {
  it.each([
    ["Thursday to Friday", "2026-07-16", "2026-07-17", 1],
    ["Thursday to Monday", "2026-07-16", "2026-07-20", 2],
    ["Thursday to Tuesday", "2026-07-16", "2026-07-21", 3],
    ["Friday to Monday", "2026-07-17", "2026-07-20", 1],
    ["weekend deadline", "2026-07-16", "2026-07-19", 1],
    ["month boundary", "2026-07-30", "2026-08-03", 2],
    ["year boundary", "2026-12-31", "2027-01-04", 2],
  ])("counts %s", (_label, today, due, expected) => {
    expect(actionableWorkingDaysRemaining(due, today)).toBe(expected);
  });

  it("returns no actionable distance for an overdue deadline", () => {
    expect(
      actionableWorkingDaysRemaining("2026-07-15", "2026-07-16"),
    ).toBeNull();
  });
  it("uses Monday after a Friday for the next normal working date", () => {
    expect(nextWorkingDate("2026-07-17")).toBe("2026-07-20");
    expect(nextWorkingDate("2026-07-20")).toBe("2026-07-21");
  });
  it("counts weekdays after today through the deadline", () => {
    expect(calendarDaysRemaining("2026-07-20", "2026-07-16")).toBe(4);
    expect(workingDaysRemaining("2026-07-20", "2026-07-16")).toBe(2);
    expect(formatRelativeWorkingDate("2026-07-20", "2026-07-16")).toBe(
      "In 2 working days",
    );
  });

  it("counts overdue working days symmetrically", () => {
    expect(workingDaysRemaining("2026-07-17", "2026-07-20")).toBe(-1);
    expect(formatRelativeWorkingDate("2026-07-17", "2026-07-20")).toBe(
      "Overdue by 1 working day",
    );
  });

  it("detects weekends and the last normal workday", () => {
    expect(isWeekend("2026-07-18")).toBe(true);
    expect(isWeekend("2026-07-20")).toBe(false);
    expect(lastWorkingDayBefore("2026-07-20")).toBe("2026-07-17");
    expect(weekendDeadlineRisk("2026-07-20")).toEqual({
      kind: "WEEKEND_BEFORE_DEADLINE",
      label: "Weekend before deadline",
      lastWorkingDay: "2026-07-17",
    });
  });

  it("does not move a legal deadline that falls on a weekend", () => {
    const info = complianceDateInfo("2026-07-19", "2026-07-16");
    expect(info.date).toBe("2026-07-19");
    expect(info.weekendRisk).toEqual({
      kind: "DEADLINE_ON_WEEKEND",
      label: "Legal deadline falls on a weekend",
      lastWorkingDay: "2026-07-17",
    });
  });

  it("identifies every weekend date inside a compliance window", () => {
    expect(weekendDatesInWindow("2026-07-17", "2026-07-21")).toEqual([
      "2026-07-18",
      "2026-07-19",
    ]);
  });
});
