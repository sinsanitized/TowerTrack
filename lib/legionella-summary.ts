export type LegionellaSampleReportingStatus =
  | "SUBMITTED"
  | "NOT_SUBMITTED"
  | "SUBMISSION_DATE_MISSING"
  | "NOT_APPLICABLE"
  | "REVIEW_REQUIRED";

export type PreviousLegionellaSummary = {
  sampleId: string | null;
  sampleCollectedDate: string | null;
  portalReportingStatus: LegionellaSampleReportingStatus;
  portalSubmittedDate: string | null;
  explanation: string;
};

export type RoutineLegionellaAnchor = {
  sampleId: string;
  sampleCollectedDate: string;
  portalObligations: Array<{
    status: string;
    submittedDate: string | null;
  }>;
};

export function previousLegionellaSummary(input: {
  ruleConfiguration: "NYC_AND_NYS" | "NYS_ONLY" | "CUSTOM";
  anchors: RoutineLegionellaAnchor[];
}): PreviousLegionellaSummary {
  const uniqueAnchors = [
    ...new Map(
      input.anchors.map((anchor) => [anchor.sampleId, anchor]),
    ).values(),
  ];
  const latestDate = uniqueAnchors
    .map((anchor) => anchor.sampleCollectedDate)
    .sort()
    .at(-1);
  const latest = latestDate
    ? uniqueAnchors.filter(
        (anchor) => anchor.sampleCollectedDate === latestDate,
      )
    : [];
  const applicable = input.ruleConfiguration === "NYC_AND_NYS";

  if (latest.length > 1)
    return {
      sampleId: null,
      sampleCollectedDate: null,
      portalReportingStatus: applicable ? "REVIEW_REQUIRED" : "NOT_APPLICABLE",
      portalSubmittedDate: null,
      explanation:
        "Multiple possible qualifying Legionella samples were found for the current recurring calculation.",
    };

  const anchor = latest[0];
  if (!anchor)
    return {
      sampleId: null,
      sampleCollectedDate: null,
      portalReportingStatus: applicable ? "REVIEW_REQUIRED" : "NOT_APPLICABLE",
      portalSubmittedDate: null,
      explanation:
        "No qualifying Legionella sample currently anchors the recurring calculation.",
    };

  if (!applicable)
    return {
      sampleId: anchor.sampleId,
      sampleCollectedDate: anchor.sampleCollectedDate,
      portalReportingStatus: "NOT_APPLICABLE",
      portalSubmittedDate: null,
      explanation: "NYC portal reporting does not apply to this cooling tower.",
    };

  const submitted = anchor.portalObligations
    .filter((item) => item.status === "COMPLETED")
    .sort((a, b) =>
      (b.submittedDate ?? "").localeCompare(a.submittedDate ?? ""),
    )[0];
  if (submitted?.submittedDate)
    return {
      sampleId: anchor.sampleId,
      sampleCollectedDate: anchor.sampleCollectedDate,
      portalReportingStatus: "SUBMITTED",
      portalSubmittedDate: submitted.submittedDate,
      explanation:
        "The previous qualifying sample was submitted to the NYC portal.",
    };
  if (submitted)
    return {
      sampleId: anchor.sampleId,
      sampleCollectedDate: anchor.sampleCollectedDate,
      portalReportingStatus: "SUBMISSION_DATE_MISSING",
      portalSubmittedDate: null,
      explanation:
        "The previous qualifying sample is marked submitted, but its submission date is missing.",
    };
  if (anchor.portalObligations.length)
    return {
      sampleId: anchor.sampleId,
      sampleCollectedDate: anchor.sampleCollectedDate,
      portalReportingStatus: "NOT_SUBMITTED",
      portalSubmittedDate: null,
      explanation:
        "The previous qualifying sample has not been submitted to the NYC portal.",
    };
  return {
    sampleId: anchor.sampleId,
    sampleCollectedDate: anchor.sampleCollectedDate,
    portalReportingStatus: "REVIEW_REQUIRED",
    portalSubmittedDate: null,
    explanation:
      "No NYC portal reporting record was found for the previous qualifying sample.",
  };
}
