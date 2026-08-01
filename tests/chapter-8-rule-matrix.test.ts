import { describe, expect, it } from "vitest";
import {
  annualSummertimeHyperhalogenationObligation,
  nextAnnualCleaningObligation,
  projectEventObligations,
  type RegulatoryEventInput,
  type RegulatoryEventType,
} from "@/lib/obligation-engine";

const config = {
  isNyc: true,
  includesNys: true,
  profileKind: "NYC" as const,
  operating: true,
  monthlyTargetStartDay: 20,
  monthlyTargetEndDay: 25,
  routineSampleMaxGapDays: 31,
  sampleDateReportDays: 5,
  bacteriologicalSampleEnabled: true,
  bacteriologicalSampleIntervalDays: 30,
  inspectionIntervalDays: 90,
  registryReportingEnabled: true,
  registryReportingIntervalDays: 90,
  hyperhalogenationEnabled: true,
};

const matrix: Record<
  RegulatoryEventType,
  { extra?: Partial<RegulatoryEventInput>; obligations: string[] }
> = {
  ROUTINE_LEGIONELLA_SAMPLE_COLLECTED: {
    obligations: [
      "ROUTINE_OPERATING_SAMPLE",
      "PORTAL_SAMPLE_DATE",
      "NYS_LEGIONELLA_RESULT_REPORTING",
    ],
  },
  BACTERIOLOGICAL_SAMPLE_COLLECTED: {
    obligations: [
      "ROUTINE_BACTERIOLOGICAL_SAMPLE",
      "NYS_BACTERIOLOGICAL_RESULT_REPORTING",
    ],
  },
  LEGIONELLA_RESULT_RECEIVED: {
    extra: { cfuPerMl: 1_200 },
    obligations: [
      "LEGIONELLA_LEVEL_4_RETEST",
      "LEVEL_4_CORRECTIVE_ACTION",
      "LEVEL_4_FULL_REMEDIATION",
      "LEVEL_4_DOH_NOTIFICATION",
    ],
  },
  QUARTERLY_INSPECTION_COMPLETED: {
    obligations: ["QUARTERLY_COMPLIANCE_INSPECTION"],
  },
  STARTUP: {
    obligations: [
      "ROUTINE_BACTERIOLOGICAL_SAMPLE",
      "STARTUP_CLEANING_DISINFECTION",
      "STARTUP_SAMPLE",
      "STARTUP_DOH_NOTIFICATION",
      "NYS_REGISTRY_UPDATE",
    ],
  },
  SHUTDOWN: { obligations: ["SHUTDOWN_DOH_NOTIFICATION"] },
  STARTUP_CLEANING_DISINFECTION: { obligations: [] },
  SUMMERTIME_HYPERHALOGENATION: {
    obligations: [
      "POST_HYPERHALOGENATION_SAMPLE",
      "HYPERHALOGENATION_DECLARATION",
    ],
  },
  HIGH_LEGIONELLA_DISINFECTION: {
    obligations: ["POST_DISINFECTION_RETEST"],
  },
  FULL_REMEDIATION: { obligations: ["POST_DISINFECTION_RETEST"] },
  POWER_FAILURE: { obligations: ["EMERGENCY_SAMPLE"] },
  BIOCIDE_LOSS: { obligations: ["EMERGENCY_SAMPLE"] },
  CONDUCTIVITY_CONTROL_FAILURE: { obligations: ["EMERGENCY_SAMPLE"] },
  DOH_DIRECTED_SAMPLE: { obligations: ["EMERGENCY_SAMPLE"] },
  OTHER_DOH_CONDITION: { obligations: ["EMERGENCY_SAMPLE"] },
  MANUAL_RISK_EVENT: { obligations: ["EMERGENCY_SAMPLE"] },
  WEEKLY_BIOLOGICAL_INDICATOR_RESULT: {
    extra: { cfuPerMl: 10_000, residualRestoredWithin3Days: null },
    obligations: ["BIOLOGICAL_INDICATOR_RESIDUAL_MONITORING"],
  },
  CLEANING_COMPLETED: { obligations: [] },
  REPORT_SUBMITTED: { obligations: [] },
};

function obligationTypes(event: RegulatoryEventInput) {
  const projection = projectEventObligations(event, config);
  return [
    ...projection.sample,
    ...projection.inspection,
    ...projection.maintenance,
    ...projection.reporting,
  ]
    .map((item) => item.obligationType)
    .sort();
}

describe("NYC Chapter 8 trigger-to-deadline rule matrix", () => {
  it.each(Object.entries(matrix))(
    "%s produces every expected follow-up obligation",
    (type, expectation) => {
      expect(
        obligationTypes({
          id: `matrix-${type}`,
          type: type as RegulatoryEventType,
          date: "2026-07-01",
          ...expectation.extra,
        }),
      ).toEqual([...expectation.obligations].sort());
    },
  );

  it("covers every supported regulatory event type exhaustively", () => {
    expect(Object.keys(matrix)).toHaveLength(19);
  });

  it("covers Chapter 8 calendar-generated annual deadlines", () => {
    expect(
      nextAnnualCleaningObligation({
        systemId: "tower-1",
        year: 2026,
        completed: 0,
      }),
    ).toMatchObject({
      obligationType: "ANNUAL_CLEANING",
      earliestDueDate: "2026-01-01",
      latestDueDate: "2026-12-31",
    });
    expect(
      annualSummertimeHyperhalogenationObligation("tower-1", 2026),
    ).toMatchObject({
      obligationType: "SUMMERTIME_HYPERHALOGENATION_DUE",
      earliestDueDate: "2026-07-01",
      latestDueDate: "2026-08-31",
    });
  });
});
