import { describe, expect, it } from "vitest";
import {
  eventEntryHref,
  eventTypeForEntryIntent,
  isResampleObligation,
  parseEventEntryIntent,
} from "@/lib/event-entry-intent";

describe("event entry intents", () => {
  it("round-trips a contextual resample as a refresh-safe URL", () => {
    const href = eventEntryHref({
      type: "resample",
      towerId: "tower-1",
      obligationId: "obligation-1",
      triggerEventId: "result-1",
      sampleEventId: "sample-1",
      returnTo: "/deadlines?period=THIS_WEEK",
    });
    const url = new URL(href, "https://towertrack.test");
    expect(
      parseEventEntryIntent("tower-1", {
        record: url.searchParams.get("record")!,
        obligation: url.searchParams.get("obligation")!,
        trigger: url.searchParams.get("trigger")!,
        sample: url.searchParams.get("sample")!,
        returnTo: url.searchParams.get("returnTo")!,
      }),
    ).toEqual({
      type: "resample",
      towerId: "tower-1",
      obligationId: "obligation-1",
      triggerEventId: "result-1",
      sampleEventId: "sample-1",
      returnTo: "/deadlines?period=THIS_WEEK",
    });
    expect(url.hash).toBe("#record-event");
  });

  it("rejects unknown intents and unsafe return paths", () => {
    expect(parseEventEntryIntent("tower-1", { record: "unknown" })).toBeNull();
    expect(
      parseEventEntryIntent("tower-1", {
        record: "inspection",
        returnTo: "//malicious.test",
      })?.returnTo,
    ).toBeUndefined();
  });

  it("maps corrective sample requirements to the resample workflow", () => {
    expect(isResampleObligation("POST_DISINFECTION_RETEST")).toBe(true);
    expect(isResampleObligation("LEGIONELLA_LEVEL_2_RETEST")).toBe(true);
    expect(isResampleObligation("ROUTINE_OPERATING_SAMPLE")).toBe(false);
    expect(eventTypeForEntryIntent("resample")).toBe(
      "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
    );
  });
});
