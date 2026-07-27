import { describe, expect, it } from "vitest";
import {
  canSampleSatisfyObligation,
  projectEventObligations,
} from "@/lib/obligation-engine";
import {
  activityTypeCoversObligation,
  bestVisitOpportunity,
} from "@/lib/compliance-intelligence";
import { complianceDateInfo, weekendDatesInWindow } from "@/lib/date";

const config = {
  isNyc: true,
  operating: true,
  monthlyTargetStartDay: 15,
  monthlyTargetEndDay: 22,
};

function disinfection(date: string, id = `disinfection-${date}`) {
  return projectEventObligations(
    {
      id,
      type: "HIGH_LEGIONELLA_DISINFECTION",
      date,
    },
    config,
  ).sample[0];
}

describe("post-disinfection operational workflow", () => {
  it("uses calendar days after a Friday without shifting dates", () => {
    expect(disinfection("2026-07-17")).toMatchObject({
      obligationType: "POST_DISINFECTION_RETEST",
      earliestDueDate: "2026-07-20",
      latestDueDate: "2026-07-24",
    });
  });

  it("keeps a weekend opening date and identifies it in the window", () => {
    const obligation = disinfection("2026-07-15");
    expect(obligation.earliestDueDate).toBe("2026-07-18");
    expect(
      weekendDatesInWindow(
        obligation.earliestDueDate as string,
        obligation.latestDueDate as string,
      ),
    ).toContain("2026-07-18");
  });

  it("keeps a weekend legal deadline and warns about the last workday", () => {
    const obligation = disinfection("2026-07-11");
    expect(obligation.latestDueDate).toBe("2026-07-18");
    expect(
      complianceDateInfo(obligation.latestDueDate as string).weekendRisk,
    ).toMatchObject({
      kind: "DEADLINE_ON_WEEKEND",
      lastWorkingDay: "2026-07-17",
    });
  });

  it("allows one monthly collection inside the window to satisfy the retest", () => {
    const obligation = disinfection("2026-07-15");
    expect(canSampleSatisfyObligation("2026-07-20", obligation)).toBe(true);
  });

  it("accepts the legal opening date but not a collection before it", () => {
    const obligation = disinfection("2026-07-15");
    expect(canSampleSatisfyObligation("2026-07-18", obligation)).toBe(true);
    expect(canSampleSatisfyObligation("2026-07-17", obligation)).toBe(false);
  });

  it("recalculates both ends when the triggering date is corrected", () => {
    const original = disinfection("2026-07-15", "original");
    const corrected = disinfection("2026-07-17", "replacement");
    expect(original).toMatchObject({
      earliestDueDate: "2026-07-18",
      latestDueDate: "2026-07-22",
    });
    expect(corrected).toMatchObject({
      earliestDueDate: "2026-07-20",
      latestDueDate: "2026-07-24",
    });
  });

  it("recognizes a corrective-retest activity as valid rescheduled coverage", () => {
    expect(
      activityTypeCoversObligation("CORRECTIVE_RETEST", {
        category: "SAMPLE",
        type: "POST_DISINFECTION_RETEST",
      }),
    ).toBe(true);
  });

  it("combines compatible routine and post-disinfection sampling", () => {
    const opportunity = bestVisitOpportunity(
      [
        {
          id: "routine",
          type: "ROUTINE_OPERATING_SAMPLE",
          category: "SAMPLE",
          earliest: "2026-07-16",
          targetStart: "2026-07-20",
          targetEnd: "2026-07-20",
          latest: "2026-07-31",
          priority: "ROUTINE",
          status: "PENDING",
          reason: "Routine operating sample",
        },
        {
          id: "retest",
          type: "POST_DISINFECTION_RETEST",
          category: "SAMPLE",
          earliest: "2026-07-18",
          targetStart: "2026-07-18",
          targetEnd: "2026-07-22",
          latest: "2026-07-22",
          priority: "CRITICAL",
          status: "PENDING",
          reason: "Post-disinfection retest",
        },
      ],
      "2026-07-17",
    );
    expect(opportunity?.obligations.map((item) => item.id).sort()).toEqual([
      "retest",
      "routine",
    ]);
  });

  it("does not pull a recurring inspection forward before its target range", () => {
    const opportunity = bestVisitOpportunity(
      [
        {
          id: "routine",
          type: "ROUTINE_OPERATING_SAMPLE",
          category: "SAMPLE",
          earliest: "2026-07-15",
          targetStart: "2026-07-18",
          targetEnd: "2026-07-22",
          latest: "2026-08-14",
          priority: "ROUTINE",
          status: "PENDING",
          reason: "Routine operating sample",
        },
        {
          id: "inspection",
          type: "QUARTERLY_COMPLIANCE_INSPECTION",
          category: "INSPECTION",
          earliest: "2026-07-15",
          targetStart: "2026-09-28",
          targetEnd: "2026-10-12",
          latest: "2026-10-12",
          priority: "ROUTINE",
          status: "PENDING",
          reason: "Quarterly inspection",
        },
      ],
      "2026-07-17",
    );
    expect(opportunity?.obligations.map((item) => item.id)).toEqual([
      "routine",
    ]);
    expect(opportunity?.start).toBe("2026-07-18");
  });
});
