import { describe, expect, it } from "vitest";
import { buttonClass } from "@/lib/button-variants";
import {
  eventDefinitionsForLocation,
  isOfficeOnlyEvent,
  isOwnerManagedObligation,
} from "@/lib/event-workflow";
import {
  previewEventImpact,
  sampleObligationsCoveredByEvent,
  type TowerRuleConfig,
} from "@/lib/obligation-engine";

const config: TowerRuleConfig = {
  isNyc: true,
  includesNys: true,
  profileKind: "NYC",
  operating: true,
  monthlyTargetStartDay: 20,
  monthlyTargetEndDay: 25,
  routineSampleMaxGapDays: 31,
  routineSampleTargetIntervalDays: 25,
  routineSampleEnabled: true,
  sampleDateReportingEnabled: true,
  sampleDateReportDays: 5,
  bacteriologicalSampleEnabled: true,
  bacteriologicalSampleIntervalDays: 30,
  registryReportingEnabled: true,
  registryReportingIntervalDays: 90,
  ruleSetVersion: "combined-test",
};

describe("Record an Event workflow hierarchy", () => {
  it("keeps frequent work primary and moves cleaning to More Event Types", () => {
    expect(
      eventDefinitionsForLocation("PRIMARY").map(({ type }) => type),
    ).toEqual([
      "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
      "LEGIONELLA_RESULT_RECEIVED",
      "QUARTERLY_INSPECTION_COMPLETED",
      "HIGH_LEGIONELLA_DISINFECTION",
    ]);
    expect(
      eventDefinitionsForLocation("MORE").map(({ type }) => type),
    ).toContain("CLEANING_COMPLETED");
    expect(
      eventDefinitionsForLocation("PRIMARY").map(({ type }) => type),
    ).not.toContain("CLEANING_COMPLETED");
  });

  it("keeps bacteriological confirmation office-only and owner-managed", () => {
    expect(isOfficeOnlyEvent("BACTERIOLOGICAL_SAMPLE_COLLECTED")).toBe(true);
    expect(isOwnerManagedObligation("ROUTINE_BACTERIOLOGICAL_SAMPLE")).toBe(
      true,
    );
    expect(
      eventDefinitionsForLocation("OFFICE_ONLY").map(({ type }) => type),
    ).toEqual(["BACTERIOLOGICAL_SAMPLE_COLLECTED"]);
  });

  it("provides shared semantic button variants", () => {
    expect(buttonClass("primary")).toBe("btn btn-primary");
    expect(buttonClass("secondary")).toBe("btn");
    expect(buttonClass("destructive")).toBe("btn btn-destructive");
    expect(buttonClass("ghost")).toBe("btn btn-ghost");
  });
});

describe("event impact preview", () => {
  const obligations = [
    {
      id: "combined-legionella",
      type: "ROUTINE_OPERATING_SAMPLE",
      earliest: "2026-08-01",
      latest: "2026-08-31",
      status: "PENDING",
      sourceCitation: "NYC Chapter 8 | 10 NYCRR §4-1.4(b)(2)",
    },
    {
      id: "bacteriological",
      type: "ROUTINE_BACTERIOLOGICAL_SAMPLE",
      earliest: "2026-08-01",
      latest: "2026-08-30",
      status: "PENDING",
      sourceCitation: "10 NYCRR §4-1.4(b)(1)",
    },
  ];

  it("consolidates compatible Legionella coverage but not bacteriological analysis", () => {
    const proposedEvent = {
      id: "preview",
      type: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED" as const,
      date: "2026-08-20",
    };
    expect(
      sampleObligationsCoveredByEvent(proposedEvent, obligations).map(
        ({ id }) => id,
      ),
    ).toEqual(["combined-legionella"]);
    const preview = previewEventImpact({
      proposedEvent,
      ruleConfig: config,
      openSampleObligations: obligations,
    });
    expect(preview.messages.join(" ")).toContain(
      "New York State 90-day Legionella requirement",
    );
    expect(preview.satisfied.map(({ id }) => id)).toEqual([
      "combined-legionella",
    ]);
  });

  it("does not claim late work restores a missed obligation", () => {
    const preview = previewEventImpact({
      proposedEvent: {
        id: "preview",
        type: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
        date: "2026-08-20",
      },
      ruleConfig: config,
      openSampleObligations: [
        { ...obligations[0], id: "missed", status: "MISSED" },
      ],
    });
    expect(preview.satisfied).toEqual([]);
    expect(preview.messages).toContain(
      "This event will not restore the missed obligation.",
    );
  });

  it("keeps owner bacteriological confirmation separate from Legionella", () => {
    const preview = previewEventImpact({
      proposedEvent: {
        id: "preview",
        type: "BACTERIOLOGICAL_SAMPLE_COLLECTED",
        date: "2026-08-20",
      },
      ruleConfig: config,
      openSampleObligations: obligations,
    });
    expect(preview.satisfied.map(({ id }) => id)).toEqual(["bacteriological"]);
    expect(preview.messages.join(" ")).toContain(
      "does not satisfy a Legionella requirement",
    );
  });
});
