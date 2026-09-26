import { describe, expect, it } from "vitest";
import {
  matchesSampleQueueFilter,
  sampleQueueState,
  sortSampleQueue,
  type SampleQueueItem,
} from "@/lib/sample-queue";

const sample = (
  id: string,
  eventDate: string,
  responsibility: SampleQueueItem["responsibility"],
  resultEntered = false,
): SampleQueueItem => ({ id, eventDate, responsibility, resultEntered });

describe("sample action queue", () => {
  it("puts unknown responsibility and our oldest missing results first", () => {
    const ordered = sortSampleQueue([
      sample("complete", "2026-07-30", "OUR_COMPANY", true),
      sample("vendor", "2026-07-10", "OTHER_VENDOR"),
      sample("our-new", "2026-07-25", "OUR_COMPANY"),
      sample("unknown", "2026-07-29", null),
      sample("our-old", "2026-07-12", "OUR_COMPANY"),
    ]);

    expect(ordered.map(({ id }) => id)).toEqual([
      "unknown",
      "our-old",
      "our-new",
      "vendor",
      "complete",
    ]);
  });

  it("separates action, waiting, completed, and reference states", () => {
    const unknown = sample("unknown", "2026-07-01", null);
    const ours = sample("ours", "2026-07-01", "OUR_COMPANY");
    const customer = sample("customer", "2026-07-01", "CUSTOMER");
    const reference = sample("reference", "2026-07-01", "NOT_TRACKED");
    const complete = sample("complete", "2026-07-01", "OUR_COMPANY", true);

    expect(sampleQueueState(reference)).toBe("REFERENCE_ONLY");
    expect(matchesSampleQueueFilter(unknown, "ACTION_NEEDED")).toBe(true);
    expect(matchesSampleQueueFilter(ours, "ACTION_NEEDED")).toBe(true);
    expect(matchesSampleQueueFilter(customer, "WAITING")).toBe(true);
    expect(matchesSampleQueueFilter(complete, "COMPLETED")).toBe(true);
    expect(matchesSampleQueueFilter(reference, "WAITING")).toBe(true);
  });
});
