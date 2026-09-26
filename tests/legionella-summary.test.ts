import { describe, expect, it } from "vitest";
import { previousLegionellaSummary } from "@/lib/legionella-summary";

const anchor = (
  sampleId: string,
  sampleCollectedDate: string,
  portalObligations: Array<{
    status: string;
    submittedDate: string | null;
  }> = [],
) => ({ sampleId, sampleCollectedDate, portalObligations });

describe("previous qualifying Legionella summary", () => {
  it("uses the latest qualifying collection date and its separate submission", () => {
    expect(
      previousLegionellaSummary({
        ruleConfiguration: "NYC_AND_NYS",
        anchors: [
          anchor("older", "2026-06-08"),
          anchor("current", "2026-07-08", [
            { status: "COMPLETED", submittedDate: "2026-07-10" },
          ]),
        ],
      }),
    ).toMatchObject({
      sampleId: "current",
      sampleCollectedDate: "2026-07-08",
      portalReportingStatus: "SUBMITTED",
      portalSubmittedDate: "2026-07-10",
    });
  });

  it("does not infer submission from the collection date", () => {
    expect(
      previousLegionellaSummary({
        ruleConfiguration: "NYC_AND_NYS",
        anchors: [
          anchor("sample", "2026-07-08", [
            { status: "PENDING", submittedDate: null },
          ]),
        ],
      }),
    ).toMatchObject({
      sampleCollectedDate: "2026-07-08",
      portalReportingStatus: "NOT_SUBMITTED",
      portalSubmittedDate: null,
    });
  });

  it("shows a missing submission date instead of fabricating one", () => {
    expect(
      previousLegionellaSummary({
        ruleConfiguration: "NYC_AND_NYS",
        anchors: [
          anchor("sample", "2026-07-08", [
            { status: "COMPLETED", submittedDate: null },
          ]),
        ],
      }).portalReportingStatus,
    ).toBe("SUBMISSION_DATE_MISSING");
  });

  it.each(["NYS_ONLY", "CUSTOM"] as const)(
    "marks NYC reporting not applicable for %s towers",
    (ruleConfiguration) => {
      expect(
        previousLegionellaSummary({
          ruleConfiguration,
          anchors: [anchor("sample", "2026-07-08")],
        }).portalReportingStatus,
      ).toBe("NOT_APPLICABLE");
    },
  );

  it("does not treat duplicate projections for one sample as ambiguous", () => {
    expect(
      previousLegionellaSummary({
        ruleConfiguration: "NYC_AND_NYS",
        anchors: [
          anchor("same-sample", "2026-07-08"),
          anchor("same-sample", "2026-07-08"),
        ],
      }).sampleId,
    ).toBe("same-sample");
  });

  it("requires review when different qualifying samples share the latest date", () => {
    expect(
      previousLegionellaSummary({
        ruleConfiguration: "NYC_AND_NYS",
        anchors: [
          anchor("sample-a", "2026-07-08"),
          anchor("sample-b", "2026-07-08"),
        ],
      }),
    ).toMatchObject({
      sampleId: null,
      sampleCollectedDate: null,
      portalReportingStatus: "REVIEW_REQUIRED",
    });
  });

  it("does not fabricate a prior sample when no anchor exists", () => {
    expect(
      previousLegionellaSummary({
        ruleConfiguration: "NYC_AND_NYS",
        anchors: [],
      }),
    ).toMatchObject({
      sampleId: null,
      sampleCollectedDate: null,
      portalReportingStatus: "REVIEW_REQUIRED",
    });
  });
});
