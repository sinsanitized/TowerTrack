import { describe, expect, it } from "vitest";
import {
  complianceBaselineReview,
  bestVisitOpportunity,
  canShareSampleSatisfaction,
  getAttentionBucket,
  compareUrgentAttention,
  getUrgentAttentionPriority,
  activityTypeForObligation,
  getComplianceStatus,
  getUrgency,
  inactiveComplianceStatus,
  isVisitEligibleObligation,
  missedObligationConsequence,
  previewVisitCompletion,
  type VisitOpportunityObligation,
} from "@/lib/compliance-intelligence";

describe("home attention grouping", () => {
  const base = {
    latest: "2026-08-01",
    priority: "ROUTINE",
    targetStart: "2026-07-10",
    targetEnd: "2026-07-20",
  };

  it("uses the next-three-working-days hard-deadline boundary", () => {
    expect(
      getAttentionBucket({ ...base, latest: "2026-07-19" }, "2026-07-16"),
    ).toBe("URGENT");
    expect(
      getAttentionBucket({ ...base, latest: "2026-07-20" }, "2026-07-16"),
    ).toBe("URGENT");
  });

  it("uses the internal target range for ready work", () => {
    expect(getAttentionBucket(base, "2026-07-16")).toBe("READY_NOW");
    expect(getAttentionBucket(base, "2026-07-21")).toBe("UPCOMING");
  });

  it("always treats emergency work as urgent", () => {
    expect(
      getAttentionBucket(
        { ...base, latest: null, priority: "EMERGENCY" },
        "2026-07-16",
      ),
    ).toBe("URGENT");
  });

  it("sorts overdue first when presenting every urgent tower obligation", () => {
    const today = "2026-07-16";
    const overdue = { latest: "2026-07-15", priority: "ROUTINE" };
    const emergency = { latest: null, priority: "EMERGENCY" };
    const dueSoon = { latest: "2026-07-18", priority: "ROUTINE" };
    const sorted = [dueSoon, emergency, overdue].sort((a, b) =>
      compareUrgentAttention(a, b, today),
    );
    expect(sorted).toEqual([overdue, emergency, dueSoon]);
    expect(getUrgentAttentionPriority(overdue, today).label).toBe(
      "Overdue — compliance issue",
    );
  });
});

const obligation = (
  id: string,
  input: Partial<VisitOpportunityObligation> = {},
): VisitOpportunityObligation => ({
  id,
  type: "ROUTINE_OPERATING_SAMPLE",
  category: "SAMPLE",
  earliest: "2026-07-20",
  targetStart: "2026-07-22",
  targetEnd: "2026-07-25",
  latest: "2026-07-31",
  priority: "ROUTINE",
  status: "PENDING",
  reason: `${id} rule explanation`,
  ...input,
});

describe("central compliance urgency", () => {
  it("puts overdue and emergency obligations ahead of normal work", () => {
    expect(
      getUrgency({
        today: "2026-07-16",
        status: "PENDING",
        priority: "ROUTINE",
        latestDueDate: "2026-07-15",
      }).urgency,
    ).toBe("OVERDUE");
    expect(
      getUrgency({
        today: "2026-07-16",
        status: "PENDING",
        priority: "EMERGENCY",
        latestDueDate: null,
      }).urgency,
    ).toBe("EMERGENCY");
  });

  it("explains that scheduled work does not close the compliance clock", () => {
    expect(
      getUrgency({
        today: "2026-07-16",
        status: "SCHEDULED",
        priority: "ROUTINE",
        latestDueDate: "2026-07-31",
      }).explanation,
    ).toContain("remains open until completion");
  });

  it("does not let a scheduled visit hide an urgent deadline", () => {
    expect(
      getUrgency({
        today: "2026-07-16",
        status: "SCHEDULED",
        priority: "ROUTINE",
        latestDueDate: "2026-07-16",
      }).urgency,
    ).toBe("CRITICAL");
  });
});

describe("visit opportunity intersections", () => {
  it("proves shared sample satisfaction only for compatible, unmissed overlaps", () => {
    const routine = obligation("routine", {
      earliest: "2026-07-20",
      latest: "2026-07-31",
    });
    const postDisinfection = obligation("post", {
      type: "POST_DISINFECTION_RETEST",
      earliest: "2026-07-15",
      latest: "2026-07-26",
    });
    expect(
      canShareSampleSatisfaction(routine, postDisinfection, "2026-07-16"),
    ).toBe(true);
    expect(
      canShareSampleSatisfaction(
        routine,
        { ...postDisinfection, earliest: "2026-08-01", latest: "2026-08-05" },
        "2026-07-16",
      ),
    ).toBe(false);
    expect(
      canShareSampleSatisfaction(
        routine,
        { ...postDisinfection, status: "MISSED" },
        "2026-07-16",
      ),
    ).toBe(false);
  });
  it("finds the window that covers the most on-site obligations", () => {
    const result = bestVisitOpportunity(
      [
        obligation("sample", {
          earliest: "2026-07-20",
          latest: "2026-07-31",
        }),
        obligation("startup", {
          earliest: "2026-07-23",
          latest: "2026-07-28",
        }),
        obligation("inspection", {
          type: "QUARTERLY_COMPLIANCE_INSPECTION",
          category: "INSPECTION",
          earliest: "2026-07-25",
          latest: "2026-08-05",
        }),
      ],
      "2026-07-16",
    );
    expect(result).toMatchObject({
      start: "2026-07-25",
      end: "2026-07-28",
      controllingDeadline: "2026-07-28",
      additionalObligationsCovered: 2,
    });
    expect(result?.obligations).toHaveLength(3);
  });

  it("does not count portal reporting as an on-site visit obligation", () => {
    const portal = obligation("portal", {
      type: "PORTAL_SAMPLE_DATE",
      category: "REPORTING_ACTION",
    });
    expect(isVisitEligibleObligation(portal)).toBe(false);
    expect(
      bestVisitOpportunity([obligation("sample"), portal], "2026-07-16")
        ?.obligations,
    ).toHaveLength(1);
  });

  it("can bundle the next annual cleaning with an open sample", () => {
    const cleaning = obligation("cleaning", {
      type: "ANNUAL_CLEANING",
      category: "MAINTENANCE",
      earliest: "2026-01-01",
      targetStart: null,
      targetEnd: null,
      latest: "2026-12-31",
    });
    const result = bestVisitOpportunity(
      [obligation("sample"), cleaning],
      "2026-07-16",
    );
    expect(result?.obligations).toHaveLength(2);
    expect(
      activityTypeForObligation({
        type: "ANNUAL_CLEANING",
        category: "MAINTENANCE",
      }),
    ).toBe("ROUTINE_CLEANING");
  });

  it("never bundles annual cleaning with summertime hyperhalogenation", () => {
    const cleaning = obligation("cleaning", {
      type: "ANNUAL_CLEANING",
      category: "MAINTENANCE",
      earliest: "2026-07-01",
      targetStart: null,
      targetEnd: null,
      latest: "2026-08-31",
    });
    const hyper = obligation("hyper", {
      type: "SUMMERTIME_HYPERHALOGENATION_DUE",
      category: "REPORTING_ACTION",
      earliest: "2026-07-01",
      targetStart: null,
      targetEnd: null,
      latest: "2026-08-31",
    });
    const result = bestVisitOpportunity([cleaning, hyper], "2026-07-16");
    expect(result?.obligations).toHaveLength(1);
  });

  it("does not recommend waiting to bundle emergency work", () => {
    const emergency = obligation("emergency", {
      priority: "EMERGENCY",
      earliest: null,
      latest: null,
    });
    expect(bestVisitOpportunity([emergency], "2026-07-16")).toBeNull();
  });

  it("maps obligations to the field activity that can satisfy them", () => {
    expect(
      activityTypeForObligation({
        type: "POST_HYPERHALOGENATION_SAMPLE",
        category: "SAMPLE",
      }),
    ).toBe("POST_HYPERHALOGENATION_SAMPLE");
    expect(
      activityTypeForObligation({
        type: "PORTAL_SAMPLE_DATE",
        category: "REPORTING_ACTION",
      }),
    ).toBeNull();
  });
});

describe("explained compliance health", () => {
  it("describes a fully shut down tower as inactive instead of good", () => {
    expect(inactiveComplianceStatus("FULLY_SHUT_DOWN")).toMatchObject({
      label: "Inactive",
      color: "GRAY",
    });
    expect(inactiveComplianceStatus("OPERATING")).toBeNull();
  });

  it("keeps a new NYC tower in baseline review until startup or sampling anchors the clock", () => {
    expect(
      complianceBaselineReview({
        isNyc: true,
        operatingStatus: "UNKNOWN",
        hasSamplingAnchor: false,
      }),
    ).toMatchObject({
      label: "Baseline required",
      color: "PURPLE",
    });
    expect(
      complianceBaselineReview({
        isNyc: true,
        operatingStatus: "OPERATING",
        hasSamplingAnchor: true,
      }),
    ).toBeNull();
  });

  it("identifies the controlling obligation and explains critical health", () => {
    const result = getComplianceStatus(
      [obligation("future"), obligation("late", { latest: "2026-07-15" })],
      "2026-07-16",
    );
    expect(result).toMatchObject({
      health: "CRITICAL",
      label: "Critical",
      controllingObligationId: "late",
    });
    expect(result.reason).toContain("late rule explanation");
  });
});

describe("completion impact intelligence", () => {
  it("matches one selected sample to every open sample obligation covered on the date", () => {
    const result = previewVisitCompletion({
      performedDate: "2026-08-10",
      activities: [
        {
          id: "activity-1",
          activityType: "ROUTINE_LEGIONELLA_SAMPLE",
          systemName: "Tower A",
          qualifiesForRoutineLegionella: true,
          qualifiesForInspection: false,
          qualifiesForCleaning: false,
        },
      ],
      obligations: [
        {
          id: "monthly",
          type: "ROUTINE_OPERATING_SAMPLE",
          category: "SAMPLE",
          systemName: "Tower A",
          earliest: "2026-08-01",
          latest: "2026-08-15",
        },
        {
          id: "startup",
          type: "STARTUP_SAMPLE",
          category: "SAMPLE",
          systemName: "Tower A",
          earliest: "2026-08-08",
          latest: "2026-08-20",
        },
      ],
    });
    expect(result.satisfied.map((item) => item.id)).toEqual([
      "monthly",
      "startup",
    ]);
    expect(result.generated).toContain(
      "Next routine Legionella target and laboratory follow-up",
    );
  });

  it("explains that planned sampling does not close a missed obligation", () => {
    expect(
      missedObligationConsequence({
        category: "SAMPLE",
        type: "ROUTINE_OPERATING_SAMPLE",
        priority: "ROUTINE",
      }),
    ).toContain("cannot repair");
  });
});
