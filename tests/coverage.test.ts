import { describe, expect, it } from "vitest";
import { coverageRecommendations, type CoverageRow } from "@/lib/coverage";

function row(overrides: Partial<CoverageRow> = {}): CoverageRow {
  return {
    id: "system-1",
    systemId: "system-1",
    building: "100 Park Avenue",
    buildingId: "building-1",
    systemName: "CT-1",
    jobNumber: "JOB-1",
    customer: "Acme",
    address: "100 Park Avenue, New York",
    state: "NY",
    routeZone: "MIDTOWN EAST",
    borough: "Manhattan",
    county: "New York",
    municipality: "New York",
    postalCode: "10017",
    authority: "REGULATORY",
    seasonal: false,
    seasonLabel: "Year-round tower",
    seasonStatus: "Continuous operation",
    actualStartupDate: null,
    actualShutdownDate: null,
    lastSample: "2026-06-07",
    lastCleaning: "2026-07-01",
    plannedDate: null,
    plannedVisitId: null,
    hardDueDate: "2026-07-08",
    targetDate: "2026-07-08",
    daysRemaining: 0,
    technician: "Responsibility not assigned",
    status: {
      color: "RED",
      label: "Due today",
      nextAction: "Complete sampling today",
    },
    openRequirements: [],
    ...overrides,
  };
}

describe("coverageRecommendations", () => {
  it("shows when one sample visit can complete routine and startup obligations", () => {
    const recommendations = coverageRecommendations(
      row({
        openRequirements: [
          {
            id: "monthly",
            type: "ROUTINE_LEGIONELLA_SAMPLE",
            sourceRule: "NYC monthly Legionella",
            status: "DUE_TODAY",
            color: "RED",
            hardDueDate: "2026-07-08",
            preferredDate: "2026-07-08",
            earliestAllowedDate: "2026-06-17",
            schedulingWindowStart: "2026-06-17",
            latestAllowedDate: "2026-07-08",
            scheduledActivityId: null,
            explanation: "Monthly Legionella sample is due July 8.",
          },
          {
            id: "startup",
            type: "ROUTINE_LEGIONELLA_SAMPLE",
            sourceRule: "NYC startup Legionella sample",
            status: "READY_TO_SCHEDULE",
            color: "YELLOW",
            hardDueDate: "2026-07-15",
            preferredDate: "2026-07-04",
            earliestAllowedDate: "2026-07-04",
            schedulingWindowStart: "2026-07-04",
            latestAllowedDate: "2026-07-15",
            scheduledActivityId: null,
            explanation:
              "Startup on 2026-07-01 requires a Legionella sample between 2026-07-04 and 2026-07-15.",
          },
        ],
      }),
    );

    expect(recommendations[0].date).toBe("2026-07-08");
    expect(recommendations[0].activityLabels).toEqual(["Legionella sample"]);
    expect(
      recommendations[0].coveredRequirements.map((item) => item.id),
    ).toEqual(["monthly", "startup"]);
    expect(recommendations[0].coveredCount).toBe(2);
    expect(recommendations[0].remainingCount).toBe(0);
    expect(recommendations[0].combinesMultipleObligations).toBe(true);
    expect(recommendations[0].why).toContain(
      "Combined visit: one visit can satisfy all 2 requirements.",
    );
  });
});
