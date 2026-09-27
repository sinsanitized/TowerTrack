import { describe, expect, it } from "vitest";
import { addDays, todayDateOnly } from "@/lib/date";
import {
  assignStatus,
  canResetRoutineLegionellaClock,
  calculateLegionellaPlan,
  completionFollowUps,
  correctiveAction,
  dateEntryWarnings,
  DEFAULT_ROUTINE_SAMPLE_TARGET_WINDOW,
  groupByRoute,
  hyperhalogenationFollowUp,
  noCirculationActions,
  recommendationScore,
  ruleProfileWarnings,
  startupWindow,
} from "@/lib/rules";

const base = { today: "2026-07-13", operatingStatus: "OPERATING" as const };
describe("routine sampling defaults", () => {
  it("targets collection between the 20th and 25th", () => {
    expect(DEFAULT_ROUTINE_SAMPLE_TARGET_WINDOW).toEqual({
      startDay: 20,
      endDay: 25,
    });
  });
});
describe("date-only arithmetic", () => {
  it("crosses month and year boundaries", () =>
    expect(addDays("2026-12-20", 31)).toBe("2027-01-20"));
  it("handles leap years", () =>
    expect(addDays("2028-02-01", 28)).toBe("2028-02-29"));
  it("derives today from the configured local calendar without UTC rollover", () =>
    expect(todayDateOnly(new Date(2026, 6, 14, 23, 59))).toBe("2026-07-14"));
});
describe("jurisdiction rule profiles", () => {
  it("uses 31 days for NYC", () =>
    expect(
      calculateLegionellaPlan({
        ...base,
        profile: "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4",
        lastSample: "2026-07-01",
      }).hardDueDate,
    ).toBe("2026-08-01"));
  it("does not let a misconfigured interval replace the NYC 31-day rule", () =>
    expect(
      calculateLegionellaPlan({
        ...base,
        profile: "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4",
        configuredIntervalDays: 90,
        lastSample: "2026-07-01",
      }).hardDueDate,
    ).toBe("2026-08-01"));
  it("uses 90 days for NYS-only and never NYC 31", () =>
    expect(
      calculateLegionellaPlan({
        ...base,
        profile: "NYS_PART_4_ONLY",
        lastSample: "2026-07-01",
      }).hardDueDate,
    ).toBe("2026-09-29"));
  it("uses configurable out-of-state interval", () =>
    expect(
      calculateLegionellaPlan({
        ...base,
        profile: "OUT_OF_STATE_COMPANY_POLICY",
        configuredIntervalDays: 60,
        lastSample: "2026-07-01",
      }).hardDueDate,
    ).toBe("2026-08-30"));
  it("labels out-of-state policy correctly", () =>
    expect(
      calculateLegionellaPlan({
        ...base,
        profile: "OUT_OF_STATE_COMPANY_POLICY",
        lastSample: "2026-07-01",
      }).authority,
    ).toBe("COMPANY_POLICY"));
  it("does not generate pending hard dates", () => {
    const p = calculateLegionellaPlan({
      ...base,
      profile: "PENDING_REGULATION",
      lastSample: "2026-07-01",
    });
    expect(p.hardDueDate).toBeNull();
    expect(p.status.color).toBe("PURPLE");
  });
  it("allows a converted custom interval while retaining review authority", () => {
    const p = calculateLegionellaPlan({
      ...base,
      profile: "CUSTOM_JURISDICTION",
      configuredIntervalDays: 45,
      lastSample: "2026-07-01",
    });
    expect(p.hardDueDate).toBe("2026-08-15");
    expect(p.authority).toBe("UNKNOWN_REQUIRES_REVIEW");
  });
  it("shows company target separately from regulatory hard due", () => {
    const p = calculateLegionellaPlan({
      ...base,
      profile: "NYS_PART_4_ONLY",
      lastSample: "2026-07-01",
      companyTargetIntervalDays: 31,
    });
    expect(p.hardDueDate).toBe("2026-09-29");
    expect(p.companyTargetDate).toBe("2026-08-01");
  });
});
describe("routine clock reset eligibility", () => {
  it("does not reset from completed cleaning", () =>
    expect(
      canResetRoutineLegionellaClock({
        activityType: "CLEANING",
        status: "COMPLETED",
        qualifiesForRoutineLegionella: true,
        performedDate: "2026-07-13",
      }),
    ).toBe(false));
  it("does not reset from a planned sample", () =>
    expect(
      canResetRoutineLegionellaClock({
        activityType: "ROUTINE_LEGIONELLA_SAMPLE",
        status: "PLANNED",
        qualifiesForRoutineLegionella: true,
        performedDate: null,
      }),
    ).toBe(false));
  it("resets from a completed explicitly qualifying sample", () =>
    expect(
      canResetRoutineLegionellaClock({
        activityType: "CORRECTIVE_RETEST",
        status: "COMPLETED",
        qualifiesForRoutineLegionella: true,
        performedDate: "2026-07-13",
      }),
    ).toBe(true));
  it("creates the NYC next due date, lab status, and five-day portal follow-up", () => {
    const followUps = completionFollowUps({
      profile: "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4",
      performedDate: "2026-07-15",
      operatingStatus: "OPERATING",
    });
    expect(followUps.nextSample.hardDueDate).toBe("2026-08-15");
    expect(followUps.portalDueDate).toBe("2026-07-20");
    expect(followUps.labResultStatus).toBe("WAITING_ON_LAB");
  });
});
describe("error prevention", () => {
  it("warns when NYC rules are assigned outside NYC", () =>
    expect(
      ruleProfileWarnings({
        profile: "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4",
        configuredIntervalDays: 31,
        state: "NJ",
        borough: null,
      }),
    ).toContain("NYC rules are assigned to a system outside New York City."));
  it("warns about impossible downstream date order", () =>
    expect(
      dateEntryWarnings({
        sampleDate: "2026-07-13",
        labResultDate: "2026-07-12",
        portalSubmissionDate: "2026-07-11",
      }),
    ).toEqual([
      "The lab result date cannot be before the sample date.",
      "The portal submission date cannot be before the sample date.",
    ]));
});
describe("anti-cascade planning", () => {
  it("preserves preferred day after an early sample", () => {
    const p = calculateLegionellaPlan({
      ...base,
      profile: "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4",
      lastSample: "2026-06-17",
      preferredTargetDay: 15,
    });
    expect(p.internalTargetDate).toBe("2026-07-15");
  });
  it("clamps target before latest safe date", () => {
    const p = calculateLegionellaPlan({
      ...base,
      profile: "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4",
      lastSample: "2026-06-01",
      preferredTargetDay: 30,
    });
    expect(p.internalTargetDate).toBe("2026-06-29");
  });
  it("planned coverage does not move hard due", () => {
    const p = calculateLegionellaPlan({
      ...base,
      profile: "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4",
      lastSample: "2026-06-17",
      plannedDate: "2026-07-15",
    });
    expect(p.hardDueDate).toBe("2026-07-18");
    expect(p.status.label).toBe("Completion date set");
  });
  it("late planned coverage stays overdue", () => {
    const p = calculateLegionellaPlan({
      ...base,
      profile: "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4",
      lastSample: "2026-06-01",
      plannedDate: "2026-07-15",
    });
    expect(p.status.label).toBe("Overdue");
  });
});
describe("operation and status", () => {
  it("suspends shutdown", () =>
    expect(
      calculateLegionellaPlan({
        ...base,
        profile: "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4",
        lastSample: "2026-07-01",
        operatingStatus: "FULLY_SHUT_DOWN",
      }).status.color,
    ).toBe("GRAY"));
  it("treats NYC partial operation as operating", () =>
    expect(
      calculateLegionellaPlan({
        ...base,
        profile: "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4",
        lastSample: "2026-07-01",
        operatingStatus: "PARTIALLY_OPERATING",
      }).hardDueDate,
    ).toBe("2026-08-01"));
  it("marks missing sample for review", () =>
    expect(
      calculateLegionellaPlan({
        ...base,
        profile: "NYS_PART_4_ONLY",
        lastSample: null,
      }).status.color,
    ).toBe("PURPLE"));
  it.each([
    ["2026-07-12", "OVERDUE", "RED"],
    ["2026-07-13", "DUE_TODAY", "RED"],
    ["2026-07-16", "DUE_SOON", "RED"],
    ["2026-07-20", "DUE_SOON", "YELLOW"],
    ["2026-07-30", "READY_TO_SCHEDULE", "YELLOW"],
  ])("assigns due %s", (due, status, color) => {
    expect(
      assignStatus({
        today: "2026-07-13",
        due,
        planning: 21,
        warning: 7,
        critical: 3,
      }),
    ).toMatchObject({ status, color });
  });
  it("keeps lab waiting blue", () =>
    expect(
      assignStatus({
        today: "2026-07-13",
        due: "2026-08-01",
        planning: 21,
        warning: 7,
        critical: 3,
        waitingOnLab: true,
      }).color,
    ).toBe("BLUE"));
});
describe("trigger windows", () => {
  it("calculates NYC startup 3–14 days", () =>
    expect(
      startupWindow("NYC_CHAPTER_8_2026_PLUS_NYS_PART_4", "2026-07-01"),
    ).toEqual({ start: "2026-07-04", end: "2026-07-15" }));
  it("calculates NYS startup through 14 days", () =>
    expect(startupWindow("NYS_PART_4_ONLY", "2026-07-01")).toEqual({
      start: "2026-07-01",
      end: "2026-07-15",
    }));
  it("calculates hyperhalogenation follow-up", () =>
    expect(hyperhalogenationFollowUp("2026-07-10")).toEqual({
      start: "2026-07-13",
      end: "2026-08-10",
      declarationDue: "2026-08-09",
    }));
  it("handles three and five day idle triggers", () => {
    expect(noCirculationActions(3)).toEqual({
      riskReview: true,
      cleanBeforeRestart: false,
    });
    expect(noCirculationActions(5)).toEqual({
      riskReview: true,
      cleanBeforeRestart: true,
    });
  });
});
describe("corrective thresholds", () => {
  it.each([
    [0, false, "LEVEL_1"],
    [5, true, "LEVEL_1_REVIEW"],
    [10, true, "LEVEL_2"],
    [99, true, "LEVEL_2"],
    [100, true, "LEVEL_3"],
    [999, true, "LEVEL_3"],
    [1000, true, "LEVEL_4"],
  ] as const)("classifies %s", (value, detected, level) =>
    expect(correctiveAction(value, detected).level).toBe(level),
  );
  it("sets level 4 deadlines", () =>
    expect(correctiveAction(1200)).toMatchObject({
      disinfectionHours: 24,
      remediationHours: 48,
      retestDays: [3, 7],
    }));
});
describe("routes and recommendations", () => {
  it("keeps individual system rows when grouped", () => {
    const grouped = groupByRoute([
      { routeZone: "MIDTOWN", systemId: "ct1", hardDueDate: "2026-07-18" },
      { routeZone: "MIDTOWN", systemId: "ct2", hardDueDate: "2026-07-24" },
    ]);
    expect(grouped.MIDTOWN).toHaveLength(2);
    expect(grouped.MIDTOWN.map((x) => x.hardDueDate)).toEqual([
      "2026-07-18",
      "2026-07-24",
    ]);
  });
  it("penalizes work after hard due", () => {
    const safe = recommendationScore({
      daysRemaining: 3,
      overlapCount: 2,
      routeMatch: true,
      targetDistanceDays: 1,
      technicianAvailable: true,
      afterHardDue: false,
      afterLatestSafe: false,
    });
    const late = recommendationScore({
      daysRemaining: -1,
      overlapCount: 2,
      routeMatch: true,
      targetDistanceDays: 1,
      technicianAvailable: true,
      afterHardDue: true,
      afterLatestSafe: true,
    });
    expect(safe.score).toBeGreaterThan(late.score);
    expect(late.parts.riskPenalty).toBe(100);
  });
});

describe("NYC two-tower acceptance flow", () => {
  it("keeps separate clocks, prioritizes the urgent tower, and recalculates completion", () => {
    const systems = [
      {
        routeZone: "DOWNTOWN BROOKLYN",
        systemId: "ct-1",
        lastSample: "2026-06-20",
      },
      {
        routeZone: "DOWNTOWN BROOKLYN",
        systemId: "ct-2",
        lastSample: "2026-06-25",
      },
    ].map((system) => ({
      ...system,
      hardDueDate: calculateLegionellaPlan({
        ...base,
        profile: "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4",
        lastSample: system.lastSample,
      }).hardDueDate,
    }));
    const grouped = groupByRoute(systems);
    expect(grouped["DOWNTOWN BROOKLYN"]).toHaveLength(2);
    expect(
      grouped["DOWNTOWN BROOKLYN"].map((system) => system.hardDueDate),
    ).toEqual(["2026-07-21", "2026-07-26"]);
    expect("2026-07-22" > (systems[0].hardDueDate as string)).toBe(true);

    const completed = completionFollowUps({
      profile: "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4",
      performedDate: "2026-07-20",
      operatingStatus: "OPERATING",
    });
    expect(completed.nextSample.hardDueDate).toBe("2026-08-20");
    expect(completed.portalDueDate).toBe("2026-07-25");
  });
});
