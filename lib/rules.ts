import { addDays, clampDate, diffDays } from "@/lib/date";

export const NYC_CHAPTER_8_RULESET_VERSION = "NYC_CH8_2026.1";
export const DEFAULT_ROUTINE_SAMPLE_TARGET_WINDOW = {
  startDay: 20,
  endDay: 25,
} as const;
export const NYC_CHAPTER_8_RULES = {
  routineSampleMaxGapDays: 31,
  routineWarningDay: 25,
  routineCriticalDay: 29,
  inspectionIntervalDays: 90,
  startupSampleMinimumDays: 3,
  startupSampleMaximumDays: 14,
  startupReportDays: 5,
  sampleDateReportDays: 5,
  summertimeStart: "07-01",
  summertimeEnd: "08-31",
  cleaningsPerCalendarYear: 2,
  hyperSampleMinimumDays: 3,
  hyperSampleMaximumDays: 31,
  hyperDeclarationDays: 30,
  correctiveActionHours: 24,
  level4RemediationHours: 48,
  retestMinimumDays: 3,
  retestMaximumDays: 7,
  level4NotificationHours: 24,
  biologicalIndicatorThresholdCfuMl: 10_000,
  biologicalIndicatorEscalationDays: 3,
} as const;

export type ProfileMode =
  | "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4"
  | "NYS_PART_4_ONLY"
  | "OUT_OF_STATE_COMPANY_POLICY"
  | "OUT_OF_STATE_GUIDANCE"
  | "PENDING_REGULATION"
  | "CUSTOM_JURISDICTION";
export type Authority =
  | "REGULATORY"
  | "GUIDANCE"
  | "COMPANY_POLICY"
  | "CONTRACT_REQUIREMENT"
  | "PENDING_REGULATION"
  | "UNKNOWN_REQUIRES_REVIEW";
export type Operating =
  | "OPERATING"
  | "PARTIALLY_OPERATING"
  | "STARTING_UP"
  | "FULLY_SHUT_DOWN"
  | "SEASONALLY_INACTIVE"
  | "DECOMMISSIONED"
  | "UNKNOWN";
export type StatusResult = {
  status: string;
  label: string;
  color: "GREEN" | "YELLOW" | "RED" | "BLUE" | "GRAY" | "PURPLE";
  nextAction: string;
};

export const PROFILE_RULES: Record<
  ProfileMode,
  {
    interval: number | null;
    authority: Authority;
    citation: string;
    partial: boolean;
  }
> = {
  NYC_CHAPTER_8_2026_PLUS_NYS_PART_4: {
    interval: 31,
    authority: "REGULATORY",
    citation: "NYC Chapter 8 (effective May 8, 2026) + 10 NYCRR Part 4",
    partial: true,
  },
  NYS_PART_4_ONLY: {
    interval: 90,
    authority: "REGULATORY",
    citation: "10 NYCRR Part 4, Subpart 4-1",
    partial: true,
  },
  OUT_OF_STATE_COMPANY_POLICY: {
    interval: 90,
    authority: "COMPANY_POLICY",
    citation: "TowerTrack company policy",
    partial: true,
  },
  OUT_OF_STATE_GUIDANCE: {
    interval: 90,
    authority: "GUIDANCE",
    citation: "Configured jurisdiction guidance",
    partial: true,
  },
  PENDING_REGULATION: {
    interval: null,
    authority: "PENDING_REGULATION",
    citation: "Pending regulation — review only",
    partial: false,
  },
  CUSTOM_JURISDICTION: {
    interval: null,
    authority: "UNKNOWN_REQUIRES_REVIEW",
    citation: "Custom rule awaiting verified citation",
    partial: false,
  },
};

export interface LegionellaInput {
  profile: ProfileMode;
  lastSample: string | null;
  today: string;
  operatingStatus: Operating;
  configuredIntervalDays?: number | null;
  companyTargetIntervalDays?: number | null;
  preferredTargetDay?: number | null;
  planningHorizonDays?: number;
  warningDays?: number;
  criticalDays?: number;
  plannedDate?: string | null;
  completed?: boolean;
  waitingOnLab?: boolean;
  ownerFollowUp?: boolean;
  needsReview?: boolean;
}

export interface LegionellaPlan {
  hardDueDate: string | null;
  earliestUsefulDate: string | null;
  internalTargetDate: string | null;
  latestSafeDate: string | null;
  daysRemaining: number | null;
  authority: Authority;
  intervalDays: number | null;
  companyTargetDate: string | null;
  status: StatusResult;
  explanation: string;
}

export interface ClockActivity {
  activityType: string;
  status: string;
  qualifiesForRoutineLegionella: boolean;
  performedDate: string | null;
}

export function isLegionellaSampleActivityType(activityType: string): boolean {
  return [
    "ROUTINE_LEGIONELLA_SAMPLE",
    "STARTUP_LEGIONELLA_SAMPLE",
    "POST_HYPERHALOGENATION_SAMPLE",
    "CORRECTIVE_RETEST",
    "EMERGENCY_SAMPLE",
  ].includes(activityType);
}

export function canResetRoutineLegionellaClock(
  activity: ClockActivity,
): boolean {
  return Boolean(
    activity.status === "COMPLETED" &&
    activity.qualifiesForRoutineLegionella &&
    isLegionellaSampleActivityType(activity.activityType) &&
    activity.performedDate,
  );
}

export function latestQualifyingLegionellaSample(
  activities: ClockActivity[],
): string | null {
  return (
    activities
      .filter(canResetRoutineLegionellaClock)
      .map((activity) => activity.performedDate as string)
      .sort()
      .at(-1) ?? null
  );
}

function intervalForProfile(
  profile: ProfileMode,
  configuredIntervalDays?: number | null,
): number | null {
  if (profile === "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4") return 31;
  if (profile === "NYS_PART_4_ONLY") return 90;
  return configuredIntervalDays ?? PROFILE_RULES[profile].interval;
}

export function ruleProfileWarnings(input: {
  profile: ProfileMode;
  configuredIntervalDays?: number | null;
  state: string;
  borough?: string | null;
  hardDueDate?: string | null;
}): string[] {
  const warnings: string[] = [];
  const isNyc = input.state === "NY" && Boolean(input.borough);
  if (input.profile === "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4" && !isNyc)
    warnings.push("NYC rules are assigned to a system outside New York City.");
  if (input.profile === "NYS_PART_4_ONLY" && isNyc)
    warnings.push("A New York City system is assigned the NYS-only profile.");
  if (
    input.profile === "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4" &&
    input.configuredIntervalDays !== 31
  )
    warnings.push("The NYC profile interval must be 31 calendar days.");
  if (
    input.profile === "NYS_PART_4_ONLY" &&
    input.configuredIntervalDays !== 90
  )
    warnings.push("The NYS-only profile interval must be 90 calendar days.");
  if (input.profile === "PENDING_REGULATION" && input.hardDueDate)
    warnings.push("A pending regulation must not create a hard deadline.");
  return warnings;
}

export function dateEntryWarnings(input: {
  sampleDate: string;
  referenceSampleDate?: string | null;
  labResultDate?: string | null;
  portalSubmissionDate?: string | null;
}): string[] {
  const warnings: string[] = [];
  if (
    input.referenceSampleDate &&
    input.sampleDate.slice(0, 4) !== input.referenceSampleDate.slice(0, 4) &&
    Math.abs(diffDays(input.referenceSampleDate, input.sampleDate)) > 180
  )
    warnings.push("The sample date may use the wrong year.");
  if (input.labResultDate && input.labResultDate < input.sampleDate)
    warnings.push("The lab result date cannot be before the sample date.");
  if (
    input.portalSubmissionDate &&
    input.portalSubmissionDate < input.sampleDate
  )
    warnings.push(
      "The portal submission date cannot be before the sample date.",
    );
  return warnings;
}

function stableTarget(hardDue: string, preferredDay?: number | null): string {
  if (!preferredDay) return addDays(hardDue, -7);
  const date = new Date(`${hardDue}T12:00:00Z`);
  const candidate = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      Math.min(
        preferredDay,
        new Date(
          Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
        ).getUTCDate(),
      ),
      12,
    ),
  );
  let iso = candidate.toISOString().slice(0, 10);
  if (iso < addDays(hardDue, -21)) {
    const previous = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, preferredDay, 12),
    );
    iso = previous.toISOString().slice(0, 10);
  }
  return iso;
}

export function assignStatus(args: {
  today: string;
  due: string | null;
  planning: number;
  warning: number;
  critical: number;
  plannedDate?: string | null;
  inactive?: boolean;
  completed?: boolean;
  waitingOnLab?: boolean;
  ownerFollowUp?: boolean;
  needsReview?: boolean;
}): StatusResult {
  if (args.inactive)
    return {
      status: "SUSPENDED",
      label: "Inactive",
      color: "GRAY",
      nextAction: "No routine action while shut down",
    };
  if (args.needsReview || !args.due)
    return {
      status: "REQUIRES_REVIEW",
      label: "Needs review",
      color: "PURPLE",
      nextAction: "Have a qualified person review this rule",
    };
  if (args.ownerFollowUp)
    return {
      status: "OWNER_FOLLOW_UP",
      label: "Owner follow-up",
      color: "BLUE",
      nextAction: "Follow up with the assigned owner contact",
    };
  if (args.waitingOnLab)
    return {
      status: "WAITING_ON_LAB",
      label: "Waiting on laboratory",
      color: "BLUE",
      nextAction: "Monitor the laboratory result",
    };
  if (args.completed)
    return {
      status: "COMPLETED",
      label: "Good",
      color: "GREEN",
      nextAction: "No action needed",
    };
  if (args.plannedDate && args.plannedDate <= args.due)
    return {
      status: "SCHEDULED_PENDING",
      label: "Completion date set",
      color: "GREEN",
      nextAction: "Record the completed work",
    };
  const days = diffDays(args.today, args.due);
  if (days < 0)
    return {
      status: "OVERDUE",
      label: "Overdue",
      color: "RED",
      nextAction: "Collect the sample immediately",
    };
  if (days === 0)
    return {
      status: "DUE_TODAY",
      label: "Due today",
      color: "RED",
      nextAction: "Complete sampling today",
    };
  if (days <= args.critical)
    return {
      status: "DUE_SOON",
      label: "Due soon",
      color: "RED",
      nextAction: "Complete work before the hard due date",
    };
  if (days <= args.warning)
    return {
      status: "DUE_SOON",
      label: "Due soon",
      color: "YELLOW",
      nextAction: "Add to a safe route",
    };
  if (days <= args.planning)
    return {
      status: "READY_TO_SCHEDULE",
      label: "Completion needed",
      color: "YELLOW",
      nextAction: "Complete or combine this work",
    };
  return {
    status: "FUTURE",
    label: "Future",
    color: "GREEN",
    nextAction: "No action yet",
  };
}

export function calculateLegionellaPlan(
  input: LegionellaInput,
): LegionellaPlan {
  const base = PROFILE_RULES[input.profile];
  const interval = intervalForProfile(
    input.profile,
    input.configuredIntervalDays,
  );
  const inactive = [
    "FULLY_SHUT_DOWN",
    "SEASONALLY_INACTIVE",
    "DECOMMISSIONED",
  ].includes(input.operatingStatus);
  const needsReview = Boolean(
    input.needsReview ||
    input.profile === "PENDING_REGULATION" ||
    !input.lastSample ||
    !interval ||
    (input.operatingStatus === "PARTIALLY_OPERATING" && !base.partial),
  );
  const hardDue =
    !needsReview && input.lastSample && interval
      ? addDays(input.lastSample, interval)
      : null;
  const planning = input.planningHorizonDays ?? 21;
  const warning = input.warningDays ?? 7;
  const critical = input.criticalDays ?? 3;
  const earliest = hardDue ? addDays(hardDue, -planning) : null;
  const latest = hardDue ? addDays(hardDue, -critical) : null;
  const rawTarget = hardDue
    ? stableTarget(hardDue, input.preferredTargetDay)
    : null;
  const target =
    hardDue && earliest && latest && rawTarget
      ? clampDate(rawTarget, earliest, latest)
      : null;
  const companyTargetDate =
    input.lastSample && input.companyTargetIntervalDays
      ? addDays(input.lastSample, input.companyTargetIntervalDays)
      : null;
  const status = assignStatus({
    today: input.today,
    due: hardDue,
    planning,
    warning,
    critical,
    plannedDate: input.plannedDate,
    inactive,
    completed: input.completed,
    waitingOnLab: input.waitingOnLab,
    ownerFollowUp: input.ownerFollowUp,
    needsReview,
  });
  const explanation =
    hardDue && input.lastSample
      ? `Last qualifying sample ${input.lastSample} + ${interval} calendar days under ${base.citation} = ${hardDue}. The stable target is kept inside the safe window.`
      : input.profile === "PENDING_REGULATION"
        ? "Pending regulations create review work only; no hard compliance deadline is generated."
        : inactive
          ? "Routine work is suspended while the system is inactive."
          : "Add or verify a qualifying sample and rule interval to calculate a deadline.";
  return {
    hardDueDate: hardDue,
    earliestUsefulDate: earliest,
    internalTargetDate: target,
    latestSafeDate: latest,
    daysRemaining: hardDue ? diffDays(input.today, hardDue) : null,
    authority: base.authority,
    intervalDays: interval,
    companyTargetDate,
    status,
    explanation,
  };
}

export function completionFollowUps(input: {
  profile: ProfileMode;
  performedDate: string;
  operatingStatus: Operating;
  configuredIntervalDays?: number | null;
  preferredTargetDay?: number | null;
  planningHorizonDays?: number;
  warningDays?: number;
}) {
  const nextSample = calculateLegionellaPlan({
    ...input,
    lastSample: input.performedDate,
    today: input.performedDate,
  });
  return {
    nextSample,
    portalDueDate:
      input.profile === "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4"
        ? addDays(input.performedDate, 5)
        : null,
    labResultStatus: "WAITING_ON_LAB" as const,
  };
}

export function startupWindow(profile: ProfileMode, startup: string) {
  return profile === "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4"
    ? { start: addDays(startup, 3), end: addDays(startup, 14) }
    : { start: startup, end: addDays(startup, 14) };
}
export function hyperhalogenationFollowUp(performed: string) {
  return {
    start: addDays(performed, 3),
    end: addDays(performed, 31),
    declarationDue: addDays(performed, 30),
  };
}
export function noCirculationActions(days: number) {
  return { riskReview: days >= 3, cleanBeforeRestart: days >= 5 };
}
export function correctiveAction(value: number, detected = true) {
  if (value < 10)
    return {
      level: detected ? "LEVEL_1_REVIEW" : "LEVEL_1",
      disinfectionHours: null,
      remediationHours: null,
      retestDays: null,
    };
  if (value < 100)
    return {
      level: "LEVEL_2",
      disinfectionHours: 24,
      remediationHours: null,
      retestDays: [3, 7] as const,
    };
  if (value < 1000)
    return {
      level: "LEVEL_3",
      disinfectionHours: 24,
      remediationHours: null,
      retestDays: [3, 7] as const,
    };
  return {
    level: "LEVEL_4",
    disinfectionHours: 24,
    remediationHours: 48,
    retestDays: [3, 7] as const,
  };
}

export function recommendationScore(input: {
  daysRemaining: number;
  overlapCount: number;
  routeMatch: boolean;
  targetDistanceDays: number;
  technicianAvailable: boolean;
  afterHardDue: boolean;
  afterLatestSafe: boolean;
}) {
  const deadlineUrgencyScore = Math.max(
    0,
    50 - Math.max(0, input.daysRemaining) * 2,
  );
  const multiObligationScore = Math.min(30, input.overlapCount * 15);
  const routeZoneMatchScore = input.routeMatch ? 15 : 0;
  const preferredTargetMatchScore = Math.max(0, 10 - input.targetDistanceDays);
  const technicianAvailabilityScore = input.technicianAvailable ? 5 : 0;
  const riskPenalty = input.afterHardDue ? 100 : input.afterLatestSafe ? 30 : 0;
  return {
    score:
      deadlineUrgencyScore +
      multiObligationScore +
      routeZoneMatchScore +
      preferredTargetMatchScore +
      technicianAvailabilityScore -
      riskPenalty,
    parts: {
      deadlineUrgencyScore,
      multiObligationScore,
      routeZoneMatchScore,
      preferredTargetMatchScore,
      technicianAvailabilityScore,
      riskPenalty,
    },
  };
}

export function groupByRoute<
  T extends { routeZone: string; systemId: string; hardDueDate: string | null },
>(items: T[]) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    (groups[item.routeZone] ??= []).push(item);
    return groups;
  }, {});
}
