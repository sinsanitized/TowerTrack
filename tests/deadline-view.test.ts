import { describe, expect, it } from "vitest";
import {
  buildTowerDeadlineRows,
  deadlinePeriodBounds,
  deadlinePeriodForDate,
  filterTowerDeadlineRows,
  formatCoolingTowerTonnage,
  operatingScheduleLabel,
  type DeadlineTowerInput,
} from "@/lib/deadline-view";

const obligation = (
  id: string,
  values: Partial<DeadlineTowerInput["openObligations"][number]> = {},
) => ({
  id,
  type: "ROUTINE_OPERATING_SAMPLE",
  category: "SAMPLE" as const,
  earliest: "2026-07-21",
  targetStart: "2026-08-20",
  targetEnd: "2026-08-25",
  latest: "2026-08-20",
  priority: "ROUTINE",
  status: "PENDING",
  reason: "Routine sample is due.",
  ...values,
});

const tower = (
  id: string,
  systemName: string,
  openObligations: DeadlineTowerInput["openObligations"],
): DeadlineTowerInput => ({
  id,
  building: `${systemName} facility`,
  customer: `${systemName} customer`,
  systemName,
  address: "123 Main Street, Brooklyn, NY 11201",
  tonnage: 600,
  operatingSchedule: "SEASONAL",
  ruleConfiguration: "NYC_AND_NYS",
  legionellaResponsibility: "OUR_COMPANY",
  openObligations,
});

describe("all tower deadline rows", () => {
  it("filters responsibility without adding responsibility to the table shape", () => {
    const our = buildTowerDeadlineRows(
      [tower("ours", "Ours", [obligation("o")])],
      "2026-07-20",
    );
    const customerTower = {
      ...tower("customer", "Customer", [obligation("c")]),
      legionellaResponsibility: "CUSTOMER" as const,
    };
    const customer = buildTowerDeadlineRows([customerTower], "2026-07-20");
    expect(
      filterTowerDeadlineRows([...our, ...customer], "2026-07-20", {}),
    ).toHaveLength(1);
    expect(
      filterTowerDeadlineRows([...our, ...customer], "2026-07-20", {
        responsibility: "CUSTOMER",
      })[0],
    ).toMatchObject({
      responsibility: "CUSTOMER",
      responsibilityLabel: "Customer managed",
    });
  });

  it("keeps unconfirmed responsibility visible in the default company view", () => {
    const unknown = buildTowerDeadlineRows(
      [
        {
          ...tower("unknown", "Unknown", [obligation("unknown-obligation")]),
          legionellaResponsibility: null,
        },
      ],
      "2026-07-20",
    );
    expect(filterTowerDeadlineRows(unknown, "2026-07-20", {})).toHaveLength(1);
    expect(unknown[0]).toMatchObject({
      responsibility: null,
      executionState: "Waiting",
      primaryActionLabel: "Review issue",
    });
  });

  it.each([
    ["PENDING", "Unscheduled"],
    ["SCHEDULED", "Scheduled—still open"],
    ["COMPLETED", "Completed"],
  ])("shows %s as %s", (status, executionState) => {
    const [row] = buildTowerDeadlineRows(
      [tower("tower-state", "State tower", [obligation("state", { status })])],
      "2026-07-20",
    );
    expect(row.executionState).toBe(executionState);
  });

  it("maps each obligation family to a working focused completion path", () => {
    const rows = buildTowerDeadlineRows(
      [
        tower("tower-actions", "Action tower", [
          obligation("sample"),
          obligation("inspection", {
            type: "QUARTERLY_COMPLIANCE_INSPECTION",
            category: "INSPECTION",
          }),
          obligation("cleaning", {
            type: "ANNUAL_CLEANING",
            category: "MAINTENANCE",
          }),
          obligation("corrective", {
            type: "LEVEL_3_CORRECTIVE_ACTION",
            category: "REPORTING_ACTION",
          }),
          obligation("report", {
            type: "PORTAL_SAMPLE_DATE",
            category: "REPORTING_ACTION",
          }),
        ]),
      ],
      "2026-07-20",
    );
    expect(
      Object.fromEntries(rows.map((row) => [row.id, row.primaryActionHref])),
    ).toMatchObject({
      sample: expect.stringContaining("record=sample"),
      inspection: expect.stringContaining("record=inspection"),
      cleaning: expect.stringContaining("record=cleaning"),
      corrective: expect.stringContaining("record=disinfection"),
      report: expect.stringContaining("#reporting-report"),
    });
    expect(
      rows.every((row) => !row.primaryActionHref.includes("record=event")),
    ).toBe(true);
  });
  it("uses non-overlapping calendar-week and month buckets", () => {
    expect(deadlinePeriodBounds("2026-07-06")).toMatchObject({
      thisWeekEnd: "2026-07-12",
      nextWeekStart: "2026-07-13",
      nextWeekEnd: "2026-07-19",
    });
    expect(deadlinePeriodForDate("2026-07-05", "2026-07-06")).toBe("OVERDUE");
    expect(deadlinePeriodForDate("2026-07-12", "2026-07-06")).toBe("THIS_WEEK");
    expect(deadlinePeriodForDate("2026-07-19", "2026-07-06")).toBe("NEXT_WEEK");
    expect(deadlinePeriodForDate("2026-07-25", "2026-07-06")).toBe("LATER");
    expect(deadlinePeriodForDate("2026-08-10", "2026-07-06")).toBe("LATER");
    expect(deadlinePeriodForDate("2026-09-01", "2026-07-06")).toBe("LATER");
    expect(deadlinePeriodForDate(null, "2026-07-06")).toBe("LATER");
  });

  it("keeps a week bucket ahead of the month bucket at month boundaries", () => {
    expect(deadlinePeriodForDate("2026-08-01", "2026-07-30")).toBe("THIS_WEEK");
    expect(deadlinePeriodForDate("2026-08-05", "2026-07-30")).toBe("NEXT_WEEK");
    expect(deadlinePeriodForDate("2026-08-12", "2026-07-30")).toBe("LATER");
  });

  it("keeps tower identity and a clear required action without a satisfied field", () => {
    const [row] = buildTowerDeadlineRows(
      [
        tower("tower-1", "Tower A", [
          obligation("inspection", {
            type: "QUARTERLY_COMPLIANCE_INSPECTION",
            category: "INSPECTION",
          }),
        ]),
      ],
      "2026-07-30",
    );
    expect(row).toMatchObject({
      systemName: "Tower A",
      address: "123 Main Street, Brooklyn, NY 11201",
      tonnageDisplay: "600 tons",
      operatingScheduleDisplay: "Seasonal",
      requiredAction: "Complete the qualified-person compliance inspection",
    });
    expect("obligationSatisfied" in row).toBe(false);
  });

  it("formats known and missing reference metadata without fabricating values", () => {
    expect(formatCoolingTowerTonnage(600)).toBe("600 tons");
    expect(formatCoolingTowerTonnage(1234.5)).toBe("1,234.5 tons");
    expect(formatCoolingTowerTonnage(null)).toBe("Tonnage not recorded");
    expect(formatCoolingTowerTonnage(0)).toBe("Tonnage not recorded");
    expect(operatingScheduleLabel("YEAR_ROUND")).toBe("Year-round");
    expect(operatingScheduleLabel("SEASONAL")).toBe("Seasonal");
    expect(operatingScheduleLabel(null)).toBe("Schedule not set");
  });

  it("repeats the same tower metadata for every obligation", () => {
    const rows = buildTowerDeadlineRows(
      [
        tower("tower-1", "Tower A", [
          obligation("sample"),
          obligation("inspection", {
            type: "QUARTERLY_COMPLIANCE_INSPECTION",
            category: "INSPECTION",
          }),
        ]),
      ],
      "2026-07-30",
    );
    expect(rows).toHaveLength(2);
    expect(
      rows.map(({ tonnageDisplay, operatingScheduleDisplay }) => ({
        tonnageDisplay,
        operatingScheduleDisplay,
      })),
    ).toEqual([
      { tonnageDisplay: "600 tons", operatingScheduleDisplay: "Seasonal" },
      { tonnageDisplay: "600 tons", operatingScheduleDisplay: "Seasonal" },
    ]);
  });

  it("sorts overdue first, then target date ascending", () => {
    const rows = buildTowerDeadlineRows(
      [
        tower("tower-c", "Tower C", [
          obligation("missing", {
            targetStart: null,
            targetEnd: null,
            latest: "2026-08-01",
          }),
        ]),
        tower("tower-b", "Tower B", [
          obligation("later", { targetStart: "2026-08-12" }),
        ]),
        tower("tower-a", "Tower A", [
          obligation("soon", { targetStart: "2026-08-04" }),
          obligation("overdue", {
            targetStart: "2026-08-30",
            latest: "2026-07-29",
            status: "MISSED",
          }),
        ]),
      ],
      "2026-07-30",
    );
    expect(rows.map((row) => row.id)).toEqual([
      "overdue",
      "soon",
      "later",
      "missing",
    ]);
  });

  it("uses compact dates and concise working-day wording", () => {
    const [row] = buildTowerDeadlineRows(
      [
        tower("tower-1", "Tower A", [
          obligation("due", {
            targetStart: "2026-08-04",
            targetEnd: "2026-08-07",
            latest: "2026-08-03",
          }),
        ]),
      ],
      "2026-07-30",
    );
    expect(row.targetDateDisplay).toBe("Tue, Aug 4");
    expect(row.targetWindowDisplay).toBe("Aug 4–7");
    expect(row.hardDueDateDisplay).toBe("Mon, Aug 3");
    expect(row.workingDaysDisplay).toBe("2 days");
    expect(row.workingDaysAccessible).toBe("2 working days left");
    expect(row.status).toBe("Due Next Week");
    expect(row.primaryActionLabel).toBe("Complete obligation");
  });

  it("uses concise overdue and review states", () => {
    const rows = buildTowerDeadlineRows(
      [
        tower("tower-1", "Tower A", [
          obligation("overdue", { latest: "2026-07-27" }),
          obligation("review", {
            targetStart: null,
            targetEnd: null,
            earliest: null,
            latest: null,
          }),
        ]),
      ],
      "2026-07-30",
    );
    expect(rows.find(({ id }) => id === "overdue")).toMatchObject({
      workingDaysDisplay: "3 overdue",
      status: "Overdue",
      primaryActionLabel: "Review issue",
    });
    expect(rows.find(({ id }) => id === "review")).toMatchObject({
      workingDaysDisplay: "Review",
      status: "Review Required",
      primaryActionLabel: "Review issue",
    });
  });

  it("filters by hard-deadline period and work type without changing rows", () => {
    const rows = buildTowerDeadlineRows(
      [
        tower("tower-1", "Tower A", [
          obligation("sample-this-week", {
            latest: "2026-07-10",
            targetStart: "2026-07-09",
          }),
          obligation("inspection-next-week", {
            type: "QUARTERLY_COMPLIANCE_INSPECTION",
            category: "INSPECTION",
            latest: "2026-07-15",
            targetStart: "2026-07-14",
          }),
        ]),
      ],
      "2026-07-06",
    );
    expect(
      filterTowerDeadlineRows(rows, "2026-07-06", {
        period: "THIS_WEEK",
        action: "SAMPLE",
      }).map(({ id }) => id),
    ).toEqual(["sample-this-week"]);
    expect(
      filterTowerDeadlineRows(rows, "2026-07-06", {
        period: "NEXT_WEEK",
        action: "INSPECTION",
      }).map(({ id }) => id),
    ).toEqual(["inspection-next-week"]);
    expect(rows).toHaveLength(2);
  });

  it("filters schedules without changing tonnage reference data", () => {
    const seasonal = tower("seasonal", "Seasonal", [obligation("seasonal")]);
    seasonal.tonnage = 75;
    const yearRound = tower("year-round", "Year-round", [
      obligation("year-round"),
    ]);
    yearRound.tonnage = 1000;
    yearRound.operatingSchedule = "YEAR_ROUND";
    const unset = tower("unset", "Unset", [obligation("unset")]);
    unset.tonnage = null;
    unset.operatingSchedule = null;
    const rows = buildTowerDeadlineRows(
      [yearRound, unset, seasonal],
      "2026-07-30",
    );

    expect(
      filterTowerDeadlineRows(rows, "2026-07-30", {
        schedule: "YEAR_ROUND",
      }).map(({ id }) => id),
    ).toEqual(["year-round"]);
    expect(
      filterTowerDeadlineRows(rows, "2026-07-30", {
        schedule: "NOT_SET",
      }).map(({ id }) => id),
    ).toEqual(["unset"]);
    expect(rows.map(({ tonnage }) => tonnage).sort()).toEqual(
      [1000, 75, null].sort(),
    );
  });

  it("searches tower, facility, customer, address, and required action", () => {
    const rows = buildTowerDeadlineRows(
      [tower("tower-1", "North Tower", [obligation("sample")])],
      "2026-07-30",
    );
    for (const search of [
      "North Tower",
      "North Tower facility",
      "North Tower customer",
      "Brooklyn",
      "Legionella",
    ])
      expect(
        filterTowerDeadlineRows(rows, "2026-07-30", { search }),
      ).toHaveLength(1);
    expect(
      filterTowerDeadlineRows(rows, "2026-07-30", { search: "no match" }),
    ).toHaveLength(0);
  });
});
