import { describe, expect, it } from "vitest";
import {
  parseServiceEventCommand,
  serviceEventTypeForActivity,
} from "@/lib/service-event-command";

const baseInput = {
  eventType: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
  eventDate: "2026-07-17",
  eventTimestamp: "",
  cfuPerMl: "",
  residualOutcome: "UNKNOWN",
  reportType: "",
  reportingObligationId: "",
  sampleEventId: "sample-1",
  chemical: "",
  quantity: "",
  contactTime: "",
  ph: "",
  freeHalogenResidual: "",
  technician: "",
  notes: "",
};

describe("service event commands", () => {
  it("requires a recorded sample for every Legionella lab result", () => {
    expect(() =>
      parseServiceEventCommand(
        {
          ...baseInput,
          eventType: "LEGIONELLA_RESULT_RECEIVED",
          sampleEventId: "",
          cfuPerMl: "25",
          eventTimestamp: "2026-07-17T09:00",
        },
        {
          today: "2026-07-17",
          now: new Date("2026-07-17T14:00:00Z"),
        },
      ),
    ).toThrow("Choose the recorded sample");
  });

  it("rejects future completed work", () => {
    expect(() =>
      parseServiceEventCommand(
        { ...baseInput, eventDate: "2026-07-18" },
        { today: "2026-07-17" },
      ),
    ).toThrow(/future date/i);
  });

  it("accepts a Legionella result with a date only", () => {
    const command = parseServiceEventCommand(
      {
        ...baseInput,
        eventType: "LEGIONELLA_RESULT_RECEIVED",
        cfuPerMl: "25",
      },
      { today: "2026-07-17" },
    );
    expect(command.eventDate).toBe("2026-07-17");
    expect(command.eventTimestamp).toBeNull();
  });

  it("does not persist a supplied time for a date-only Legionella result", () => {
    const command = parseServiceEventCommand(
      {
        ...baseInput,
        eventType: "LEGIONELLA_RESULT_RECEIVED",
        cfuPerMl: "25",
        eventTimestamp: "2026-07-17T14:30",
      },
      {
        today: "2026-07-17",
        now: new Date("2026-07-17T20:00:00.000Z"),
      },
    );
    expect(command.eventTimestamp).toBeNull();
  });

  it("requires the complete hyperhalogenation field record", () => {
    expect(() =>
      parseServiceEventCommand(
        {
          ...baseInput,
          eventType: "SUMMERTIME_HYPERHALOGENATION",
          chemical: "Sodium hypochlorite",
        },
        { today: "2026-07-17" },
      ),
    ).toThrow(/chemical, quantity, contact time/i);
  });

  it("preserves the sample subtype through the activity mapping boundary", () => {
    expect(serviceEventTypeForActivity("CORRECTIVE_RETEST")).toBe(
      "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
    );
    expect(serviceEventTypeForActivity("FULL_REMEDIATION")).toBe(
      "FULL_REMEDIATION",
    );
  });
});
