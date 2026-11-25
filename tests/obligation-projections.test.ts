import { describe, expect, it } from "vitest";
import { annualNysCertificationObligation } from "@/lib/obligation-engine";
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

  it("gives each annual certification period a stable distinct identity", () => {
    const annual2026 = annualNysCertificationObligation(
      "event-1",
      2026,
      "rules-v1",
    );
    const annual2027 = annualNysCertificationObligation(
      "event-1",
      2027,
      "rules-v1",
    );
    expect(annual2026.identityKey).toBe("NYS_ANNUAL_CERTIFICATION:2026");
    expect(
      projectionObligationId(
        "REPORTING_ACTION",
        annual2026.triggerEventId,
        annual2026.identityKey!,
      ),
    ).not.toBe(
      projectionObligationId(
        "REPORTING_ACTION",
        annual2027.triggerEventId,
        annual2027.identityKey!,
      ),
    );
  });
});
