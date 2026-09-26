import { describe, expect, it } from "vitest";
import {
  actionableWorkingDaysRemaining,
  addDays,
  asUtc,
  calendarDaysRemaining,
  complianceDateInfo,
  dateTimeLocalValue,
  dateOnly,
  formatComplianceDate,
  formatLongDate,
  formatLongDateRange,
  formatOperationalDate,
  formatComplianceDateTime,
  formatRelativeDate,
  formatRelativeWorkingDate,
  formatWorkingDaysLeft,
  isWeekend,
  isCompanyHoliday,
  isWorkingDay,
  lastWorkingDayBefore,
  parseDateTimeInTimeZone,
  todayDateOnly,
  todayInTimeZone,
  weekendDatesInWindow,
  weekendDeadlineRisk,
  workingDaysRemaining,
  nextWorkingDate,
} from "@/lib/date";

describe("compliance date presentation", () => {
  it("rejects impossible calendar dates and invalid Date objects", () => {
    expect(() => dateOnly("2026-02-31")).toThrow(/invalid date-only/i);
    expect(() => asUtc("2027-02-29")).toThrow(/invalid date-only/i);
    expect(() => dateOnly(new Date(Number.NaN))).toThrow(/invalid date-only/i);
    expect(dateOnly("2028-02-29")).toBe("2028-02-29");
  });

  it("keeps validated arithmetic correct across month and year boundaries", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("rejects an invalid fixed test-clock date", () => {
    const priorClock = process.env.TOWERTRACK_TEST_CLOCK;
    const priorDate = process.env.TOWERTRACK_TEST_DATE;
    process.env.TOWERTRACK_TEST_CLOCK = "enabled";
    process.env.TOWERTRACK_TEST_DATE = "2026-02-31";
    try {
      expect(() => todayDateOnly()).toThrow(/invalid date-only/i);
    } finally {
      if (priorClock == null) delete process.env.TOWERTRACK_TEST_CLOCK;
      else process.env.TOWERTRACK_TEST_CLOCK = priorClock;
      if (priorDate == null) delete process.env.TOWERTRACK_TEST_DATE;
      else process.env.TOWERTRACK_TEST_DATE = priorDate;
    }
  });

  it("uses an explicit test clock only when its safety switch is enabled", () => {
    const priorClock = process.env.TOWERTRACK_TEST_CLOCK;
    const priorDate = process.env.TOWERTRACK_TEST_DATE;
    process.env.TOWERTRACK_TEST_DATE = "2026-07-14";
    delete process.env.TOWERTRACK_TEST_CLOCK;
    expect(todayDateOnly(new Date("2026-08-01T12:00:00Z"))).toBe("2026-08-01");
    process.env.TOWERTRACK_TEST_CLOCK = "enabled";
    expect(todayDateOnly(new Date("2026-08-01T12:00:00Z"))).toBe("2026-07-14");
    if (priorClock == null) delete process.env.TOWERTRACK_TEST_CLOCK;
    else process.env.TOWERTRACK_TEST_CLOCK = priorClock;
    if (priorDate == null) delete process.env.TOWERTRACK_TEST_DATE;
    else process.env.TOWERTRACK_TEST_DATE = priorDate;
  });

  it("formats date-only values with a weekday without local-time rollover", () => {
    expect(formatComplianceDate("2026-08-10")).toBe("Mon, Aug 10, 2026");
    expect(formatOperationalDate("2026-01-05")).toBe("Monday 01/05/2026");
    expect(formatLongDate("2026-08-04")).toBe("Tuesday, August 4, 2026");
    expect(formatLongDateRange("2026-08-03", "2026-08-07")).toBe(
      "Monday, August 3 – Friday, August 7, 2026",
    );
    expect(formatLongDateRange("2026-07-30", "2026-08-04")).toBe(
      "Thursday, July 30 – Tuesday, August 4, 2026",
    );
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
  it("uses the company holiday calendar, including observed dates", () => {
    expect(isCompanyHoliday("2026-06-19")).toBe(true);
    expect(isCompanyHoliday("2026-07-03")).toBe(true);
    expect(isCompanyHoliday("2027-12-31")).toBe(true);
    expect(isWorkingDay("2026-11-11")).toBe(true);
    expect(isCompanyHoliday("2026-11-27")).toBe(true);
  });

  it("skips Thanksgiving and the following company holiday", () => {
    expect(nextWorkingDate("2026-11-25")).toBe("2026-11-30");
    expect(workingDaysRemaining("2026-11-30", "2026-11-25")).toBe(1);
    expect(lastWorkingDayBefore("2026-11-30")).toBe("2026-11-25");
  });

  it("counts Veterans Day as a normal working day", () => {
    expect(workingDaysRemaining("2026-11-12", "2026-11-10")).toBe(2);
  });

  it.each([
    ["Thursday to Friday", "2026-07-16", "2026-07-17", 1],
    ["Thursday to Monday", "2026-07-16", "2026-07-20", 2],
    ["Thursday to Tuesday", "2026-07-16", "2026-07-21", 3],
    ["Friday to Monday", "2026-07-17", "2026-07-20", 1],
    ["weekend deadline", "2026-07-16", "2026-07-19", 1],
    ["month boundary", "2026-07-30", "2026-08-03", 2],
    ["year boundary with New Year's Day", "2026-12-31", "2027-01-04", 1],
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
    expect(nextWorkingDate("2026-12-31")).toBe("2027-01-04");
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
    expect(formatWorkingDaysLeft("2026-07-20", "2026-07-20")).toBe("Due today");
    expect(formatWorkingDaysLeft("2026-07-21", "2026-07-20")).toBe(
      "1 working day left",
    );
    expect(formatWorkingDaysLeft("2026-07-17", "2026-07-20")).toBe(
      "Overdue by 1 working day",
    );
    expect(formatWorkingDaysLeft("2026-07-17", "2026-07-18")).toBe(
      "Overdue; no working days have elapsed",
    );
    expect(formatWorkingDaysLeft("2026-07-19", "2026-07-18")).toBe(
      "Due before the next working day",
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
      label: "Compliance deadline falls on a weekend",
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
