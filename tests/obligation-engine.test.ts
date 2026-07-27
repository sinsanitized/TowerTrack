import { describe, expect, it } from "vitest";
import {
  annualCleaningProgress,
  annualSummertimeHyperhalogenationObligation,
  canSampleSatisfyObligation,
  nextAnnualCleaningObligation,
  projectEventObligations,
  stableMonthlyTargetWindow,
  windowsOverlap,
  type RegulatoryEventInput,
} from "@/lib/obligation-engine";

const config = {
  isNyc: true,
  operating: true,
  monthlyTargetStartDay: 15,
  monthlyTargetEndDay: 22,
};
const event = (
  type: RegulatoryEventInput["type"],
  extra: Partial<RegulatoryEventInput> = {},
): RegulatoryEventInput => ({
  id: `event-${type}`,
  type,
  date: "2026-07-01",
  ...extra,
});

describe("routine operating sample projection", () => {
  it("keeps a fixed monthly target inside the 31-day legal window", () => {
    const projection = projectEventObligations(
      event("ROUTINE_LEGIONELLA_SAMPLE_COLLECTED"),
      config,
    );
    const result = projection.sample[0];
    expect(result).toMatchObject({
      obligationType: "ROUTINE_OPERATING_SAMPLE",
      earliestDueDate: "2026-07-02",
      targetStartDate: "2026-07-15",
      targetEndDate: "2026-07-22",
      latestDueDate: "2026-08-01",
    });
    expect(projection.reporting[0]).toMatchObject({
      obligationType: "PORTAL_SAMPLE_DATE",
      earliestDueDate: "2026-07-01",
      latestDueDate: "2026-07-06",
    });
  });

  it("uses an administrator-configured routine interval", () => {
    const result = projectEventObligations(
      event("ROUTINE_LEGIONELLA_SAMPLE_COLLECTED"),
      { ...config, routineSampleMaxGapDays: 28 },
    ).sample[0];
    expect(result.latestDueDate).toBe("2026-07-29");
    expect(result.reason).toContain("28 days");
  });

  it("uses the earlier internal interval as the service target", () => {
    const result = projectEventObligations(
      event("ROUTINE_LEGIONELLA_SAMPLE_COLLECTED"),
      {
        ...config,
        routineSampleMaxGapDays: 31,
        routineSampleTargetIntervalDays: 25,
      },
    ).sample[0];
    expect(result).toMatchObject({
      targetStartDate: "2026-07-26",
      targetEndDate: "2026-07-26",
      latestDueDate: "2026-08-01",
    });
    expect(result.reason).toContain("internal service target is day 25");
  });

  it("stamps generated obligations with the active database revision", () => {
    const result = projectEventObligations(
      event("ROUTINE_LEGIONELLA_SAMPLE_COLLECTED"),
      { ...config, ruleSetVersion: "nyc-2026.r4" },
    );
    expect(result.sample[0].ruleSetVersion).toBe("nyc-2026.r4");
  });

  it("does not cascade a target beyond the legal latest date", () => {
    expect(
      stableMonthlyTargetWindow({
        lastSample: "2026-06-17",
        legalLatest: "2026-07-18",
        preferredStartDay: 20,
        preferredEndDay: 25,
      }),
    ).toEqual({ start: "2026-06-20", end: "2026-06-25" });
  });

  it("does not generate routine operating sampling while shut down", () => {
    expect(
      projectEventObligations(event("ROUTINE_LEGIONELLA_SAMPLE_COLLECTED"), {
        ...config,
        operating: false,
      }).sample,
    ).toEqual([]);
  });
});

describe("startup, cleaning, inspection, and summertime rules", () => {
  it("tracks the two distinct cleaning dates required each calendar year", () => {
    expect(
      annualCleaningProgress(
        ["2025-12-31", "2026-02-10", "2026-02-10", "2026-07-10"],
        2026,
      ),
    ).toEqual({
      year: 2026,
      required: 2,
      completed: 2,
      remaining: 0,
      lastCompletedDate: "2026-07-10",
    });
  });

  it("projects only the next unsatisfied annual cleaning", () => {
    expect(
      nextAnnualCleaningObligation({
        systemId: "tower-1",
        year: 2026,
        completed: 1,
      }),
    ).toMatchObject({
      obligationType: "ANNUAL_CLEANING",
      earliestDueDate: "2026-01-01",
      latestDueDate: "2026-12-31",
    });
    expect(
      nextAnnualCleaningObligation({
        systemId: "tower-1",
        year: 2026,
        completed: 2,
      }),
    ).toBeNull();
  });

  it("creates the annual July 1–August 31 summertime workflow", () => {
    expect(
      annualSummertimeHyperhalogenationObligation("baseline-event", 2026),
    ).toMatchObject({
      triggerEventId: "baseline-event",
      obligationType: "SUMMERTIME_HYPERHALOGENATION_DUE",
      earliestDueDate: "2026-07-01",
      latestDueDate: "2026-08-31",
    });
  });
  it("uses startup, not startup cleaning, for the 3–14 day window", () => {
    const startup = projectEventObligations(event("STARTUP"), config);
    const cleaning = projectEventObligations(
      event("STARTUP_CLEANING_DISINFECTION"),
      config,
    );
    expect(startup.sample[0]).toMatchObject({
      earliestDueDate: "2026-07-04",
      latestDueDate: "2026-07-15",
    });
    expect(startup.reporting[0]).toMatchObject({
      obligationType: "STARTUP_DOH_NOTIFICATION",
      latestDueDate: "2026-07-06",
    });
    expect(cleaning.sample).toEqual([]);
  });

  it("requires startup cleaning and disinfection during the 15 days before startup", () => {
    const projection = projectEventObligations(event("STARTUP"), config);
    expect(projection.maintenance).toEqual([
      expect.objectContaining({
        obligationType: "STARTUP_CLEANING_DISINFECTION",
        earliestDueDate: "2026-06-16",
        latestDueDate: "2026-07-01",
        priority: "CRITICAL",
      }),
    ]);
  });

  it("keeps cleaning separate from sampling", () => {
    expect(
      projectEventObligations(event("CLEANING_COMPLETED"), config).sample,
    ).toEqual([]);
  });

  it("creates the next 90-day inspection without creating a sample", () => {
    const result = projectEventObligations(
      event("QUARTERLY_INSPECTION_COMPLETED"),
      config,
    );
    expect(result.sample).toEqual([]);
    expect(result.inspection[0]).toMatchObject({
      latestDueDate: "2026-09-29",
      obligationType: "QUARTERLY_COMPLIANCE_INSPECTION",
    });
  });

  it("uses configured inspection and post-hyperhalogenation windows", () => {
    const inspection = projectEventObligations(
      event("QUARTERLY_INSPECTION_COMPLETED"),
      { ...config, inspectionIntervalDays: 60 },
    );
    const hyper = projectEventObligations(
      event("SUMMERTIME_HYPERHALOGENATION"),
      {
        ...config,
        hyperSampleMinimumDays: 5,
        hyperSampleMaximumDays: 20,
      },
    );
    expect(inspection.inspection[0].latestDueDate).toBe("2026-08-30");
    expect(hyper.sample[0]).toMatchObject({
      earliestDueDate: "2026-07-06",
      latestDueDate: "2026-07-21",
    });
  });

  it("creates hyperhalogenation sampling and declaration windows", () => {
    const result = projectEventObligations(
      event("SUMMERTIME_HYPERHALOGENATION"),
      config,
    );
    expect(result.sample[0]).toMatchObject({
      earliestDueDate: "2026-07-04",
      latestDueDate: "2026-08-01",
    });
    expect(result.reporting[0]).toMatchObject({
      obligationType: "HYPERHALOGENATION_DECLARATION",
      latestDueDate: "2026-07-31",
    });
  });
});

describe("Legionella result response", () => {
  it.each([
    [0, "LEVEL_1", 0],
    [9.9, "LEVEL_1", 0],
    [10, "LEVEL_2", 1],
    [99.9, "LEVEL_2", 1],
    [100, "LEVEL_3", 1],
    [999.9, "LEVEL_3", 1],
    [1000, "LEVEL_4", 1],
  ] as const)("classifies %s CFU/mL as %s", (cfuPerMl, level, samples) => {
    const result = projectEventObligations(
      event("LEGIONELLA_RESULT_RECEIVED", {
        cfuPerMl,
        timestamp: "2026-07-01T14:30:00.000Z",
      }),
      config,
    );
    expect(result.labResult?.level).toBe(level);
    expect(result.sample).toHaveLength(samples);
    if (samples)
      expect(result.sample[0]).toMatchObject({
        earliestDueDate: "2026-07-04",
        latestDueDate: "2026-07-08",
      });
  });

  it("flags exact Level 4 hourly deadlines for review when receipt is date-only", () => {
    const result = projectEventObligations(
      event("LEGIONELLA_RESULT_RECEIVED", {
        cfuPerMl: 1200,
        timestamp: "2026-07-01T14:30:00.000Z",
      }),
      config,
    );
    expect(result.labResult).toMatchObject({
      correctiveActionDueAt: null,
      remediationDueAt: null,
      chainClosed: false,
    });
    expect(result.reporting.map((item) => item.reason).join(" ")).toContain(
      "human compliance review",
    );
    expect(result.reporting.map((item) => item.obligationType)).toEqual([
      "LEVEL_4_CORRECTIVE_ACTION",
      "LEVEL_4_FULL_REMEDIATION",
      "LEVEL_4_DOH_NOTIFICATION",
    ]);
  });

  it("marks Level 1 as closing a retest chain", () => {
    expect(
      projectEventObligations(
        event("LEGIONELLA_RESULT_RECEIVED", { cfuPerMl: 4 }),
        config,
      ).labResult?.chainClosed,
    ).toBe(true);
  });
});

describe("emergency and weekly biological indicator triggers", () => {
  it.each([
    "POWER_FAILURE",
    "BIOCIDE_LOSS",
    "CONDUCTIVITY_CONTROL_FAILURE",
    "DOH_DIRECTED_SAMPLE",
    "OTHER_DOH_CONDITION",
    "MANUAL_RISK_EVENT",
  ] as const)(
    "makes %s urgent without inventing a legal latest date",
    (type) => {
      expect(
        projectEventObligations(event(type), config).sample[0],
      ).toMatchObject({
        obligationType: "EMERGENCY_SAMPLE",
        priority: "EMERGENCY",
        earliestDueDate: "2026-07-01",
        latestDueDate: null,
      });
    },
  );

  it("starts residual monitoring at 10,000 CFU/mL", () => {
    const result = projectEventObligations(
      event("WEEKLY_BIOLOGICAL_INDICATOR_RESULT", {
        cfuPerMl: 10000,
        residualRestoredWithin3Days: null,
      }),
      config,
    );
    expect(result.reporting[0].obligationType).toBe(
      "BIOLOGICAL_INDICATOR_RESIDUAL_MONITORING",
    );
    expect(result.sample).toEqual([]);
  });

  it("creates sampling only when high indicator residual was not restored", () => {
    const notRestored = projectEventObligations(
      event("WEEKLY_BIOLOGICAL_INDICATOR_RESULT", {
        cfuPerMl: 10000,
        residualRestoredWithin3Days: false,
      }),
      config,
    );
    const restored = projectEventObligations(
      event("WEEKLY_BIOLOGICAL_INDICATOR_RESULT", {
        cfuPerMl: 10000,
        residualRestoredWithin3Days: true,
      }),
      config,
    );
    expect(notRestored.sample[0]).toMatchObject({
      obligationType: "BIOLOGICAL_INDICATOR_ESCALATION_SAMPLE",
      earliestDueDate: "2026-07-04",
      latestDueDate: null,
    });
    expect(restored.sample).toEqual([]);
  });

  it("does nothing below the biological indicator threshold", () => {
    expect(
      projectEventObligations(
        event("WEEKLY_BIOLOGICAL_INDICATOR_RESULT", {
          cfuPerMl: 9999,
          residualRestoredWithin3Days: false,
        }),
        config,
      ),
    ).toMatchObject({ sample: [], reporting: [] });
  });
});

describe("obligation coverage and bundling", () => {
  it("lets one collection satisfy each obligation whose legal window contains it", () => {
    expect(
      canSampleSatisfyObligation("2026-07-06", {
        earliestDueDate: "2026-07-04",
        latestDueDate: "2026-07-08",
      }),
    ).toBe(true);
  });

  it("never lets an outside or future sample satisfy a legal window", () => {
    expect(
      canSampleSatisfyObligation("2026-07-09", {
        earliestDueDate: "2026-07-04",
        latestDueDate: "2026-07-08",
      }),
    ).toBe(false);
    expect(
      canSampleSatisfyObligation("2026-07-03", {
        earliestDueDate: "2026-07-04",
        latestDueDate: "2026-07-08",
      }),
    ).toBe(false);
  });

  it("detects sample and inspection windows that can share a visit", () => {
    expect(
      windowsOverlap(
        { earliestDueDate: "2026-07-15", latestDueDate: "2026-07-22" },
        { earliestDueDate: "2026-07-20", latestDueDate: "2026-07-30" },
      ),
    ).toBe(true);
    expect(
      windowsOverlap(
        { earliestDueDate: "2026-07-15", latestDueDate: "2026-07-18" },
        { earliestDueDate: "2026-07-20", latestDueDate: "2026-07-30" },
      ),
    ).toBe(false);
  });
});
