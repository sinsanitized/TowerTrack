import { describe, expect, it } from "vitest";
import { projectionObligationId } from "@/lib/obligation-projections";

describe("projection obligation identity", () => {
  it("is stable when the same projection is rebuilt", () => {
    expect(
      projectionObligationId("SAMPLE", "event-1", "ROUTINE_OPERATING_SAMPLE"),
    ).toBe(
      projectionObligationId("SAMPLE", "event-1", "ROUTINE_OPERATING_SAMPLE"),
    );
  });

  it("keeps categories, triggers, and obligation types distinct", () => {
    const ids = new Set([
      projectionObligationId("SAMPLE", "event-1", "ROUTINE_OPERATING_SAMPLE"),
      projectionObligationId(
        "INSPECTION",
        "event-1",
        "ROUTINE_OPERATING_SAMPLE",
      ),
      projectionObligationId("SAMPLE", "event-2", "ROUTINE_OPERATING_SAMPLE"),
      projectionObligationId("SAMPLE", "event-1", "POST_CLEANING_SAMPLE"),
    ]);

    expect(ids).toHaveLength(4);
  });
});
