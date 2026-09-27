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
  previousLegionella: {
    sampleId: "sample-previous",
    sampleCollectedDate: "2026-07-08",
    portalReportingStatus: "SUBMITTED",
    portalSubmittedDate: "2026-07-10",
    explanation:
      "The previous qualifying sample was submitted to the NYC portal.",
  },
  openObligations,
});

describe("all tower deadline rows", () => {
  it("excludes customer-managed sampling from deadline work", () => {
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
    expect(customer).toHaveLength(0);
    expect(
      filterTowerDeadlineRows([...our, ...customer], "2026-07-20", {
        responsibility: "CUSTOMER",
      }),
    ).toHaveLength(0);
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
      primaryActionLabel: "Assign owner",
    });
  });

  it.each([
    ["PENDING", "Completion not recorded"],
    ["SCHEDULED", "Completion not recorded"],
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
          obligation("resample", {
            type: "LEGIONELLA_LEVEL_3_RETEST",
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
      resample: expect.stringContaining("record=resample&obligation=resample"),
      inspection: expect.stringContaining("record=inspection"),
      cleaning: expect.stringContaining("record=cleaning"),
      corrective: expect.stringContaining("record=disinfection"),
      report: expect.stringContaining("#reporting-report"),
    });
    expect(
      rows.every((row) => !row.primaryActionHref.includes("record=event")),
    ).toBe(true);
    expect(
      rows
        .filter((row) => row.id !== "report")
        .every((row) => row.primaryActionHref.includes(`obligation=${row.id}`)),
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

  it("sorts every row by its hard deadline", () => {
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
      "missing",
      "soon",
      "later",
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
    expect(row.targetWindowDisplay).toBe("Tue, Aug 4 – Fri, Aug 7");
    expect(row.targetWindowAccessible).toContain(
      "Tuesday, August 4, 2026 through Friday, August 7, 2026",
    );
    expect(row.previousLegionellaSampleDisplay).toBe("Jul 8, 2026");
    expect(row.portalDisplay).toBe("Jul 10, 2026");
    expect(row.hardDueDateDisplay).toBe("Mon, Aug 3");
    expect(row.workingDaysDisplay).toBe("2 working days left");
    expect(row.workingDaysAccessible).toBe("2 working days left");
    expect(row.status).toBe("Due next week");
    expect(row.primaryActionLabel).toBe("Record sample");
  });

  it.each([
    ["exact due date", "2026-09-26", "2026-09-26", "Due today"],
    [
      "Sunday deadline viewed Saturday",
      "2026-09-26",
      "2026-09-27",
      "Due before the next working day",
    ],
    [
      "Friday deadline viewed Saturday",
      "2026-09-26",
      "2026-09-25",
      "Overdue; no working days have elapsed",
    ],
    [
      "Monday deadline viewed Saturday",
      "2026-09-26",
      "2026-09-28",
      "1 working day left",
    ],
  ])("labels %s from the actual dates", (_label, today, latest, expected) => {
    const [row] = buildTowerDeadlineRows(
      [
        tower("tower-weekend", "Weekend tower", [
          obligation("weekend", { latest }),
        ]),
      ],
      today,
    );
    expect(row.workingDaysDisplay).toBe(expected);
    expect(row.workingDaysAccessible).toBe(expected);
  });

  it("keeps sample collection and NYC portal submission dates separate", () => {
    const [row] = buildTowerDeadlineRows(
      [tower("tower-1", "Tower A", [obligation("due")])],
      "2026-07-30",
    );
    expect(row).toMatchObject({
      previousLegionellaSampleDate: "2026-07-08",
      previousLegionellaSampleDisplay: "Jul 8, 2026",
      portalReportingStatus: "SUBMITTED",
      portalSubmittedDate: "2026-07-10",
      portalDisplay: "Jul 10, 2026",
    });
    expect(row.previousLegionellaSampleAccessible).toContain(
      "collected on Wednesday, July 8, 2026",
    );
    expect(row.portalAccessible).toContain(
      "submitted to the NYC portal on Friday, July 10, 2026",
    );
  });

  it("shows missing and non-applicable previous-sample reporting states", () => {
    const missing = tower("missing", "Missing", [obligation("missing")]);
    missing.previousLegionella = {
      sampleId: null,
      sampleCollectedDate: null,
      portalReportingStatus: "REVIEW_REQUIRED",
      portalSubmittedDate: null,
      explanation:
        "No qualifying Legionella sample currently anchors the recurring calculation.",
    };
    const nys = tower("nys", "NYS", [obligation("nys")]);
    nys.ruleConfiguration = "NYS_ONLY";
    nys.previousLegionella = {
      sampleId: "nys-sample",
      sampleCollectedDate: "2026-07-09",
      portalReportingStatus: "NOT_APPLICABLE",
      portalSubmittedDate: null,
      explanation: "NYC portal reporting does not apply to this cooling tower.",
    };
    const rows = buildTowerDeadlineRows([missing, nys], "2026-07-30");
    expect(rows.find((row) => row.id === "missing")).toMatchObject({
      previousLegionellaSampleDisplay: "None recorded",
      portalDisplay: "Review",
    });
    expect(rows.find((row) => row.id === "nys")).toMatchObject({
      previousLegionellaSampleDisplay: "Jul 9, 2026",
      portalDisplay: "Not applicable",
    });
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
      workingDaysDisplay: "Overdue by 3 working days",
      status: "Overdue",
      primaryActionLabel: "Review issue",
    });
    expect(rows.find(({ id }) => id === "review")).toMatchObject({
      workingDaysDisplay: "Needs review",
      status: "Review required",
      primaryActionLabel: "Review details",
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
