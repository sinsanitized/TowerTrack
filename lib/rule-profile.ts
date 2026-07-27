import type { TowerRuleConfig } from "@/lib/obligation-engine";
import { NYC_CHAPTER_8_RULES } from "@/lib/rules";

export type CompilableRuleDefinition = {
  id: string;
  revision: number;
  requirementType: string;
  sourceCitation: string;
  frequencyDays: number | null;
  minimumDaysAfterTrigger: number | null;
  maximumDaysAfterTrigger: number | null;
  enabled: boolean;
};

export type CompilableRuleProfile = {
  id: string;
  jurisdictionMode: string;
  legionellaIntervalDays: number | null;
  internalTargetIntervalDays: number | null;
  rules: CompilableRuleDefinition[];
};

const NYC_MODE = "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4";

export function nycRuleDisplayValues() {
  return {
    summertimeStart: NYC_CHAPTER_8_RULES.summertimeStart,
    summertimeEnd: NYC_CHAPTER_8_RULES.summertimeEnd,
    startupSampleMinimumDays: NYC_CHAPTER_8_RULES.startupSampleMinimumDays,
    startupSampleMaximumDays: NYC_CHAPTER_8_RULES.startupSampleMaximumDays,
    hyperSampleMinimumDays: NYC_CHAPTER_8_RULES.hyperSampleMinimumDays,
    hyperSampleMaximumDays: NYC_CHAPTER_8_RULES.hyperSampleMaximumDays,
    retestMinimumDays: NYC_CHAPTER_8_RULES.retestMinimumDays,
    retestMaximumDays: NYC_CHAPTER_8_RULES.retestMaximumDays,
  };
}

export class RuleConfigurationError extends Error {
  constructor(profileId: string, missingTypes: string[]) {
    super(
      `Rule profile ${profileId} is missing required definitions: ${missingTypes.join(", ")}.`,
    );
    this.name = "RuleConfigurationError";
  }
}

export function ruleSetVersion(profile: CompilableRuleProfile) {
  const revisions = [...profile.rules]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((rule) => `${rule.id}@${rule.revision}`)
    .join(",");
  return `${profile.id}[${revisions || "no-rules"}]`;
}

export function compileTowerRuleConfig(
  profile: CompilableRuleProfile,
  input: {
    operating: boolean;
    monthlyTargetStartDay: number;
    monthlyTargetEndDay: number;
  },
): TowerRuleConfig {
  const byType = new Map(
    profile.rules.map((rule) => [rule.requirementType, rule]),
  );
  const isNyc = profile.jurisdictionMode === NYC_MODE;
  const requiredTypes = [
    "ROUTINE_LEGIONELLA_SAMPLE",
    "PORTAL_SAMPLE_DATE",
    "COMPLIANCE_INSPECTION",
    "SUMMERTIME_HYPERHALOGENATION",
  ];
  const missingTypes = isNyc
    ? requiredTypes.filter((type) => !byType.has(type))
    : [];
  if (missingTypes.length)
    throw new RuleConfigurationError(profile.id, missingTypes);

  const routine = byType.get("ROUTINE_LEGIONELLA_SAMPLE");
  const portal = byType.get("PORTAL_SAMPLE_DATE");
  const inspection = byType.get("COMPLIANCE_INSPECTION");
  const hyper = byType.get("SUMMERTIME_HYPERHALOGENATION");

  return {
    isNyc,
    operating: input.operating,
    monthlyTargetStartDay: input.monthlyTargetStartDay,
    monthlyTargetEndDay: input.monthlyTargetEndDay,
    routineSampleMaxGapDays:
      routine?.frequencyDays ?? profile.legionellaIntervalDays,
    routineSampleTargetIntervalDays: profile.internalTargetIntervalDays,
    sampleDateReportDays: portal?.frequencyDays,
    inspectionIntervalDays: inspection?.frequencyDays,
    hyperSampleMinimumDays:
      hyper?.minimumDaysAfterTrigger ??
      NYC_CHAPTER_8_RULES.hyperSampleMinimumDays,
    hyperSampleMaximumDays:
      hyper?.maximumDaysAfterTrigger ??
      NYC_CHAPTER_8_RULES.hyperSampleMaximumDays,
    routineSampleEnabled: routine?.enabled ?? false,
    sampleDateReportingEnabled: portal?.enabled ?? false,
    inspectionEnabled: inspection?.enabled ?? false,
    hyperhalogenationEnabled: hyper?.enabled ?? false,
    sourceCitations: {
      routineSample: routine?.sourceCitation,
      sampleDateReporting: portal?.sourceCitation,
      inspection: inspection?.sourceCitation,
      hyperhalogenation: hyper?.sourceCitation,
    },
    responseTimings: {
      correctiveActionHours: NYC_CHAPTER_8_RULES.correctiveActionHours,
      level4RemediationHours: NYC_CHAPTER_8_RULES.level4RemediationHours,
      level4NotificationHours: NYC_CHAPTER_8_RULES.level4NotificationHours,
      retestMinimumDays: NYC_CHAPTER_8_RULES.retestMinimumDays,
      retestMaximumDays: NYC_CHAPTER_8_RULES.retestMaximumDays,
    },
    ruleSetVersion: ruleSetVersion(profile),
  };
}
