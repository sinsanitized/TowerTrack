import { describe, expect, it } from "vitest";
import {
  compileTowerRuleConfig,
  RuleConfigurationError,
  ruleSetVersion,
  type CompilableRuleProfile,
} from "@/lib/rule-profile";

const profile: CompilableRuleProfile = {
  id: "nyc",
  jurisdictionMode: "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4",
  legionellaIntervalDays: 31,
  internalTargetIntervalDays: 27,
  rules: [
    {
      id: "routine",
      revision: 2,
      requirementType: "ROUTINE_LEGIONELLA_SAMPLE",
      sourceCitation: "routine citation",
      frequencyDays: 31,
      minimumDaysAfterTrigger: null,
      maximumDaysAfterTrigger: null,
      enabled: true,
    },
    {
      id: "portal",
      revision: 3,
      requirementType: "PORTAL_SAMPLE_DATE",
      sourceCitation: "portal citation",
      frequencyDays: 5,
      minimumDaysAfterTrigger: null,
      maximumDaysAfterTrigger: null,
      enabled: true,
    },
    {
      id: "inspection",
      revision: 1,
      requirementType: "COMPLIANCE_INSPECTION",
      sourceCitation: "inspection citation",
      frequencyDays: 90,
      minimumDaysAfterTrigger: null,
      maximumDaysAfterTrigger: null,
      enabled: true,
    },
    {
      id: "hyper",
      revision: 4,
      requirementType: "SUMMERTIME_HYPERHALOGENATION",
      sourceCitation: "hyper citation",
      frequencyDays: null,
      minimumDaysAfterTrigger: 4,
      maximumDaysAfterTrigger: 30,
      enabled: true,
    },
  ],
};

describe("compiled rule profiles", () => {
  it("includes every rule revision in the explainable version", () => {
    expect(ruleSetVersion(profile)).toBe(
      "nyc[hyper@4,inspection@1,portal@3,routine@2]",
    );
  });

  it("uses persisted timing and citation values for projections", () => {
    const config = compileTowerRuleConfig(profile, {
      operating: true,
      monthlyTargetStartDay: 8,
      monthlyTargetEndDay: 14,
    });
    expect(config).toMatchObject({
      routineSampleMaxGapDays: 31,
      routineSampleTargetIntervalDays: 27,
      sampleDateReportDays: 5,
      inspectionIntervalDays: 90,
      hyperSampleMinimumDays: 4,
      hyperSampleMaximumDays: 30,
      sourceCitations: { sampleDateReporting: "portal citation" },
    });
  });

  it("fails closed when an NYC profile is incomplete", () => {
    expect(() =>
      compileTowerRuleConfig(
        { ...profile, rules: profile.rules.slice(0, 1) },
        {
          operating: true,
          monthlyTargetStartDay: 8,
          monthlyTargetEndDay: 14,
        },
      ),
    ).toThrow(RuleConfigurationError);
  });
});
