import type { TowerRuleConfig } from "@/lib/obligation-engine";
import { NYC_CHAPTER_8_RULES } from "@/lib/rules";

export type CompilableRuleDefinition = {
  id: string;
  revision: number;
  requirementType: string;
  ruleName?: string;
  sourceAuthority?: string;
  sourceCitation: string;
  dueDateCalculation?: string;
  triggerActivityType?: string | null;
  frequencyDays: number | null;
  minimumDaysAfterTrigger: number | null;
  maximumDaysAfterTrigger: number | null;
  enabled: boolean;
  sourceReferences?: RuleReference[];
};

export type CompilableRuleProfile = {
  id: string;
  jurisdictionMode: string;
  legionellaIntervalDays: number | null;
  internalTargetIntervalDays: number | null;
  rules: CompilableRuleDefinition[];
  includedJurisdictionModes?: string[];
};

export type TowerRuleConfiguration = "NYC_AND_NYS" | "NYS_ONLY" | "CUSTOM";

export type RuleReference = {
  profileId: string;
  ruleId: string;
  authority: string;
  citation: string;
};

const NYC_MODE = "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4";
const NYS_MODE = "NYS_PART_4_ONLY";

const activityEventTypes: Record<
  string,
  TowerRuleConfig["customRules"] extends Array<infer R> | undefined
    ? R extends { triggerEventType: infer E }
      ? E
      : never
    : never
> = {
  ROUTINE_LEGIONELLA_SAMPLE: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
  ROUTINE_BACTERIOLOGICAL_SAMPLE: "BACTERIOLOGICAL_SAMPLE_COLLECTED",
  COMPLIANCE_INSPECTION: "QUARTERLY_INSPECTION_COMPLETED",
  ROUTINE_CLEANING: "CLEANING_COMPLETED",
  CLEANING: "CLEANING_COMPLETED",
  STARTUP_CLEANING: "STARTUP_CLEANING_DISINFECTION",
  CLEANING_AND_DISINFECTION: "HIGH_LEGIONELLA_DISINFECTION",
  DISINFECTION: "HIGH_LEGIONELLA_DISINFECTION",
  CORRECTIVE_DISINFECTION: "HIGH_LEGIONELLA_DISINFECTION",
  FULL_REMEDIATION: "FULL_REMEDIATION",
  SUMMERTIME_HYPERHALOGENATION: "SUMMERTIME_HYPERHALOGENATION",
  STARTUP: "STARTUP",
  SHUTDOWN: "SHUTDOWN",
  OTHER: "MANUAL_RISK_EVENT",
};

function minimumDefined(values: Array<number | null>) {
  const defined = values.filter((value): value is number => value != null);
  return defined.length ? Math.min(...defined) : null;
}

function maximumDefined(values: Array<number | null>) {
  const defined = values.filter((value): value is number => value != null);
  return defined.length ? Math.max(...defined) : null;
}

export function compatibleRuleKey(rule: CompilableRuleDefinition) {
  return [
    rule.requirementType,
    rule.dueDateCalculation ?? "UNSPECIFIED",
    rule.triggerActivityType ?? "NO_TRIGGER_ACTIVITY",
  ].join("|");
}

export function composeCompatibleRuleDefinitions(
  profiles: CompilableRuleProfile[],
): CompilableRuleDefinition[] {
  const groups = new Map<
    string,
    Array<{ profile: CompilableRuleProfile; rule: CompilableRuleDefinition }>
  >();
  for (const profile of profiles)
    for (const rule of profile.rules) {
      const key = compatibleRuleKey(rule);
      groups.set(key, [...(groups.get(key) ?? []), { profile, rule }]);
    }

  return [...groups.values()]
    .map((items) => {
      const ordered = [...items].sort((a, b) =>
        a.rule.id.localeCompare(b.rule.id),
      );
      const references = ordered.flatMap(({ profile, rule }) =>
        rule.sourceReferences?.length
          ? rule.sourceReferences
          : [
              {
                profileId: profile.id,
                ruleId: rule.id,
                authority: rule.sourceAuthority ?? "UNKNOWN_REQUIRES_REVIEW",
                citation: rule.sourceCitation,
              },
            ],
      );
      const minimumDays = maximumDefined(
        ordered.map(({ rule }) => rule.minimumDaysAfterTrigger),
      );
      const maximumDays = minimumDefined(
        ordered.map(({ rule }) => rule.maximumDaysAfterTrigger),
      );
      if (
        minimumDays != null &&
        maximumDays != null &&
        minimumDays > maximumDays
      )
        return ordered.map(({ rule }) => rule);
      const first = ordered[0].rule;
      return [
        {
          ...first,
          id: `composed:${ordered.map(({ rule }) => rule.id).join("+")}`,
          revision: Math.max(...ordered.map(({ rule }) => rule.revision)),
          ruleName: ordered
            .map(({ rule }) => rule.ruleName)
            .filter(Boolean)
            .join(" + "),
          sourceCitation: [
            ...new Set(references.map(({ citation }) => citation)),
          ].join(" | "),
          frequencyDays: minimumDefined(
            ordered.map(({ rule }) => rule.frequencyDays),
          ),
          minimumDaysAfterTrigger: minimumDays,
          maximumDaysAfterTrigger: maximumDays,
          enabled: ordered.some(({ rule }) => rule.enabled),
          sourceReferences: references,
        },
      ];
    })
    .flat()
    .sort((a, b) => compatibleRuleKey(a).localeCompare(compatibleRuleKey(b)));
}

export function composeTowerRuleProfiles(
  configuration: TowerRuleConfiguration,
  availableProfiles: CompilableRuleProfile[],
  customProfileId?: string,
): CompilableRuleProfile {
  const profiles =
    configuration === "NYC_AND_NYS"
      ? availableProfiles.filter((profile) =>
          [NYC_MODE, NYS_MODE].includes(profile.jurisdictionMode),
        )
      : configuration === "NYS_ONLY"
        ? availableProfiles.filter(
            (profile) => profile.jurisdictionMode === NYS_MODE,
          )
        : availableProfiles.filter((profile) => profile.id === customProfileId);
  const requiredModes =
    configuration === "NYC_AND_NYS"
      ? [NYC_MODE, NYS_MODE]
      : configuration === "NYS_ONLY"
        ? [NYS_MODE]
        : [];
  const missingModes = requiredModes.filter(
    (mode) => !profiles.some((profile) => profile.jurisdictionMode === mode),
  );
  if (missingModes.length || !profiles.length)
    throw new RuleConfigurationError(
      customProfileId ?? configuration,
      missingModes.length ? missingModes : ["CUSTOM_PROFILE"],
    );
  const primary =
    configuration === "NYC_AND_NYS"
      ? profiles.find((profile) => profile.jurisdictionMode === NYC_MODE)!
      : profiles[0];
  return {
    ...primary,
    id: `${configuration}[${profiles
      .map(({ id }) => id)
      .sort()
      .join("+")}]`,
    jurisdictionMode:
      configuration === "NYC_AND_NYS"
        ? NYC_MODE
        : configuration === "NYS_ONLY"
          ? NYS_MODE
          : primary.jurisdictionMode,
    legionellaIntervalDays: minimumDefined(
      profiles.map(({ legionellaIntervalDays }) => legionellaIntervalDays),
    ),
    internalTargetIntervalDays: primary.internalTargetIntervalDays,
    rules: composeCompatibleRuleDefinitions(profiles),
    includedJurisdictionModes: profiles.map(
      ({ jurisdictionMode }) => jurisdictionMode,
    ),
  };
}

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
  const includesNys =
    profile.jurisdictionMode === NYS_MODE ||
    profile.includedJurisdictionModes?.includes(NYS_MODE) === true;
  const profileKind = isNyc
    ? "NYC"
    : profile.jurisdictionMode === NYS_MODE
      ? "NYS"
      : "CUSTOM";
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
  const bacteriological = byType.get("ROUTINE_BACTERIOLOGICAL_SAMPLE");
  const annualCertification = byType.get("ANNUAL_CERTIFICATION");
  const registryReporting = byType.get("NYS_REGISTRY_REPORTING");
  const builtInTypes = new Set([
    "ROUTINE_LEGIONELLA_SAMPLE",
    "ROUTINE_BACTERIOLOGICAL_SAMPLE",
    "COMPLIANCE_INSPECTION",
    "PORTAL_SAMPLE_DATE",
    "NYS_REGISTRY_REPORTING",
    "ANNUAL_CERTIFICATION",
    "SUMMERTIME_HYPERHALOGENATION",
  ]);

  return {
    isNyc,
    includesNys,
    profileKind,
    operating: input.operating,
    monthlyTargetStartDay: input.monthlyTargetStartDay,
    monthlyTargetEndDay: input.monthlyTargetEndDay,
    routineSampleMaxGapDays:
      routine?.frequencyDays ?? profile.legionellaIntervalDays,
    routineSampleTargetIntervalDays: profile.internalTargetIntervalDays,
    sampleDateReportDays: portal?.frequencyDays,
    inspectionIntervalDays: inspection?.frequencyDays,
    bacteriologicalSampleIntervalDays: bacteriological?.frequencyDays,
    registryReportingIntervalDays: registryReporting?.frequencyDays,
    hyperSampleMinimumDays:
      hyper?.minimumDaysAfterTrigger ??
      NYC_CHAPTER_8_RULES.hyperSampleMinimumDays,
    hyperSampleMaximumDays:
      hyper?.maximumDaysAfterTrigger ??
      NYC_CHAPTER_8_RULES.hyperSampleMaximumDays,
    routineSampleEnabled: routine?.enabled ?? false,
    sampleDateReportingEnabled: portal?.enabled ?? false,
    inspectionEnabled: inspection?.enabled ?? false,
    bacteriologicalSampleEnabled: bacteriological?.enabled ?? false,
    annualCertificationEnabled: annualCertification?.enabled ?? false,
    registryReportingEnabled: registryReporting?.enabled ?? false,
    hyperhalogenationEnabled: hyper?.enabled ?? false,
    customRules:
      profileKind === "CUSTOM"
        ? profile.rules.flatMap((rule) => {
            const triggerEventType = rule.triggerActivityType
              ? activityEventTypes[rule.triggerActivityType]
              : undefined;
            if (
              !rule.enabled ||
              builtInTypes.has(rule.requirementType) ||
              !triggerEventType
            )
              return [];
            return [
              {
                requirementType: rule.requirementType,
                ruleName: rule.ruleName ?? rule.requirementType,
                sourceAuthority:
                  rule.sourceAuthority ?? "UNKNOWN_REQUIRES_REVIEW",
                sourceCitation: rule.sourceCitation,
                triggerEventType,
                frequencyDays: rule.frequencyDays,
                minimumDaysAfterTrigger: rule.minimumDaysAfterTrigger,
                maximumDaysAfterTrigger: rule.maximumDaysAfterTrigger,
              },
            ];
          })
        : [],
    sourceCitations: {
      routineSample: routine?.sourceCitation,
      sampleDateReporting: portal?.sourceCitation,
      inspection: inspection?.sourceCitation,
      bacteriologicalSample: bacteriological?.sourceCitation,
      annualCertification: annualCertification?.sourceCitation,
      registryReporting: registryReporting?.sourceCitation,
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
