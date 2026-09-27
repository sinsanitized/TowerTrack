import { describe, expect, it } from "vitest";
import {
  compileTowerRuleConfig,
  composeCompatibleRuleDefinitions,
  composeTowerRuleProfiles,
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

  it("compiles NYS rules independently without NYC hyperhalogenation", () => {
    const nys = compileTowerRuleConfig(
      {
        id: "nys",
        jurisdictionMode: "NYS_PART_4_ONLY",
        legionellaIntervalDays: 90,
        internalTargetIntervalDays: null,
        rules: [
          {
            ...profile.rules[0],
            id: "nys-legionella",
            frequencyDays: 90,
          },
          {
            ...profile.rules[2],
            id: "nys-inspection",
          },
          {
            ...profile.rules[0],
            id: "nys-bac",
            requirementType: "ROUTINE_BACTERIOLOGICAL_SAMPLE",
            frequencyDays: 30,
          },
          {
            ...profile.rules[0],
            id: "nys-reporting",
            requirementType: "NYS_REGISTRY_REPORTING",
            frequencyDays: 90,
          },
          {
            ...profile.rules[0],
            id: "nys-certification",
            requirementType: "ANNUAL_CERTIFICATION",
            frequencyDays: null,
          },
        ],
      },
      {
        operating: true,
        monthlyTargetStartDay: 20,
        monthlyTargetEndDay: 25,
      },
    );
    expect(nys).toMatchObject({
      profileKind: "NYS",
      routineSampleMaxGapDays: 90,
      bacteriologicalSampleIntervalDays: 30,
      inspectionIntervalDays: 90,
      annualCertificationEnabled: true,
      hyperhalogenationEnabled: false,
    });
  });

  it("composes NYC and NYS profiles and consolidates compatible work", () => {
    const nysProfile: CompilableRuleProfile = {
      id: "nys",
      jurisdictionMode: "NYS_PART_4_ONLY",
      legionellaIntervalDays: 90,
      internalTargetIntervalDays: null,
      rules: [
        {
          ...profile.rules[0],
          id: "nys-routine",
          sourceAuthority: "REGULATORY",
          sourceCitation: "10 NYCRR §4-1.4(b)(2)",
          frequencyDays: 90,
          dueDateCalculation: "LAST_SAMPLE_PLUS_INTERVAL",
        },
        {
          ...profile.rules[0],
          id: "nys-bacteriological",
          requirementType: "ROUTINE_BACTERIOLOGICAL_SAMPLE",
          sourceCitation: "10 NYCRR §4-1.4(b)(1)",
          frequencyDays: 30,
        },
      ],
    };
    const nycProfile: CompilableRuleProfile = {
      ...profile,
      rules: profile.rules.map((rule) =>
        rule.requirementType === "ROUTINE_LEGIONELLA_SAMPLE"
          ? {
              ...rule,
              sourceAuthority: "REGULATORY",
              dueDateCalculation: "LAST_SAMPLE_PLUS_INTERVAL",
            }
          : rule,
      ),
    };
    const composed = composeTowerRuleProfiles("NYC_AND_NYS", [
      nycProfile,
      nysProfile,
    ]);
    const routine = composed.rules.find(
      ({ requirementType }) => requirementType === "ROUTINE_LEGIONELLA_SAMPLE",
    );
    expect(composed.includedJurisdictionModes).toEqual([
      "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4",
      "NYS_PART_4_ONLY",
    ]);
    expect(routine).toMatchObject({ frequencyDays: 31 });
    expect(routine?.sourceReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ profileId: "nyc" }),
        expect.objectContaining({ profileId: "nys" }),
      ]),
    );
    const config = compileTowerRuleConfig(composed, {
      operating: true,
      monthlyTargetStartDay: 20,
      monthlyTargetEndDay: 25,
    });
    expect(config).toMatchObject({
      isNyc: true,
      includesNys: true,
      routineSampleMaxGapDays: 31,
      bacteriologicalSampleEnabled: true,
      hyperhalogenationEnabled: true,
    });
  });

  it("keeps NYC rules out of an NYS-only tower", () => {
    const nycProfile: CompilableRuleProfile = {
      ...profile,
      id: "nyc",
      jurisdictionMode: "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4",
    };
    const nysProfile: CompilableRuleProfile = {
      ...profile,
      id: "nys",
      jurisdictionMode: "NYS_PART_4_ONLY",
      rules: profile.rules.map((rule) => ({
        ...rule,
        id: `nys-${rule.id}`,
      })),
    };

    const composed = composeTowerRuleProfiles("NYS_ONLY", [
      nycProfile,
      nysProfile,
    ]);

    expect(composed.jurisdictionMode).toBe("NYS_PART_4_ONLY");
    expect(composed.includedJurisdictionModes).toEqual(["NYS_PART_4_ONLY"]);
    expect(composed.rules.every((rule) => rule.id.includes("nys-"))).toBe(true);
  });

  it("keeps incompatible same-type rules separate", () => {
    const rules = composeCompatibleRuleDefinitions([
      {
        ...profile,
        rules: [
          {
            ...profile.rules[0],
            dueDateCalculation: "LAST_SAMPLE_PLUS_INTERVAL",
          },
        ],
      },
      {
        ...profile,
        id: "customer-profile",
        rules: [
          {
            ...profile.rules[0],
            id: "customer-routine",
            dueDateCalculation: "FIXED_CALENDAR_DATE",
          },
        ],
      },
    ]);
    expect(rules).toHaveLength(2);
  });

  it("loads only the assigned custom profile version", () => {
    const custom = composeTowerRuleProfiles(
      "CUSTOM",
      [
        {
          ...profile,
          id: "custom-v2",
          jurisdictionMode: "CUSTOM_JURISDICTION",
        },
        {
          ...profile,
          id: "custom-v3",
          jurisdictionMode: "CUSTOM_JURISDICTION",
        },
      ],
      "custom-v3",
    );
    expect(custom.id).toContain("custom-v3");
    expect(custom.id).not.toContain("custom-v2");
  });

  it("compiles configured custom follow-up rules without regulatory defaults", () => {
    const custom = compileTowerRuleConfig(
      {
        id: "company-v3",
        jurisdictionMode: "CUSTOM_JURISDICTION",
        legionellaIntervalDays: null,
        internalTargetIntervalDays: null,
        rules: [
          {
            id: "post-cleaning",
            revision: 3,
            requirementType: "POST_CLEANING_SAMPLE",
            ruleName: "Collect the customer post-cleaning sample",
            sourceAuthority: "CONTRACT_REQUIREMENT",
            sourceCitation: "Customer MPP section 4",
            dueDateCalculation: "TRIGGER_DATE_PLUS_WINDOW",
            triggerActivityType: "CLEANING",
            frequencyDays: null,
            minimumDaysAfterTrigger: 3,
            maximumDaysAfterTrigger: 7,
            enabled: true,
          },
        ],
      },
      { operating: true, monthlyTargetStartDay: 20, monthlyTargetEndDay: 25 },
    );
    expect(custom.profileKind).toBe("CUSTOM");
    expect(custom.isNyc).toBe(false);
    expect(custom.customRules).toEqual([
      expect.objectContaining({
        requirementType: "POST_CLEANING_SAMPLE",
        sourceAuthority: "CONTRACT_REQUIREMENT",
        triggerEventType: "CLEANING_COMPLETED",
        minimumDaysAfterTrigger: 3,
        maximumDaysAfterTrigger: 7,
      }),
    ]);
  });
});
