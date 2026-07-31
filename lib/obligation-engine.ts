import { addDays, diffDays } from "@/lib/date";
import {
  NYC_CHAPTER_8_RULES as RULES,
  NYC_CHAPTER_8_RULESET_VERSION,
  correctiveAction,
} from "@/lib/rules";

export type RegulatoryEventType =
  | "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED"
  | "BACTERIOLOGICAL_SAMPLE_COLLECTED"
  | "LEGIONELLA_RESULT_RECEIVED"
  | "QUARTERLY_INSPECTION_COMPLETED"
  | "STARTUP"
  | "SHUTDOWN"
  | "STARTUP_CLEANING_DISINFECTION"
  | "SUMMERTIME_HYPERHALOGENATION"
  | "HIGH_LEGIONELLA_DISINFECTION"
  | "FULL_REMEDIATION"
  | "POWER_FAILURE"
  | "BIOCIDE_LOSS"
  | "CONDUCTIVITY_CONTROL_FAILURE"
  | "DOH_DIRECTED_SAMPLE"
  | "OTHER_DOH_CONDITION"
  | "MANUAL_RISK_EVENT"
  | "WEEKLY_BIOLOGICAL_INDICATOR_RESULT"
  | "CLEANING_COMPLETED"
  | "REPORT_SUBMITTED";

export type ProjectionPriority =
  "ROUTINE" | "WARNING" | "CRITICAL" | "EMERGENCY";

export interface RegulatoryEventInput {
  id: string;
  type: RegulatoryEventType;
  date: string;
  timestamp?: string | null;
  cfuPerMl?: number | null;
  residualRestoredWithin3Days?: boolean | null;
  reportType?: string | null;
  reportingObligationId?: string | null;
}

export interface TowerRuleConfig {
  isNyc: boolean;
  includesNys?: boolean;
  profileKind?: "NYC" | "NYS" | "CUSTOM";
  operating: boolean;
  monthlyTargetStartDay: number;
  monthlyTargetEndDay: number;
  routineSampleMaxGapDays?: number | null;
  routineSampleTargetIntervalDays?: number | null;
  sampleDateReportDays?: number | null;
  inspectionIntervalDays?: number | null;
  bacteriologicalSampleIntervalDays?: number | null;
  registryReportingIntervalDays?: number | null;
  hyperSampleMinimumDays?: number | null;
  hyperSampleMaximumDays?: number | null;
  routineSampleEnabled?: boolean;
  sampleDateReportingEnabled?: boolean;
  inspectionEnabled?: boolean;
  bacteriologicalSampleEnabled?: boolean;
  annualCertificationEnabled?: boolean;
  registryReportingEnabled?: boolean;
  hyperhalogenationEnabled?: boolean;
  sourceCitations?: {
    routineSample?: string | null;
    sampleDateReporting?: string | null;
    inspection?: string | null;
    bacteriologicalSample?: string | null;
    annualCertification?: string | null;
    registryReporting?: string | null;
    hyperhalogenation?: string | null;
  };
  responseTimings?: {
    correctiveActionHours: number;
    level4RemediationHours: number;
    level4NotificationHours: number;
    retestMinimumDays: number;
    retestMaximumDays: number;
  };
  ruleSetVersion?: string;
  customRules?: Array<{
    requirementType: string;
    ruleName: string;
    sourceAuthority: string;
    sourceCitation: string;
    triggerEventType: RegulatoryEventType;
    frequencyDays: number | null;
    minimumDaysAfterTrigger: number | null;
    maximumDaysAfterTrigger: number | null;
  }>;
}

export interface ProjectedObligation {
  triggerEventId: string;
  obligationType: string;
  earliestDueDate: string | null;
  targetStartDate: string | null;
  targetEndDate: string | null;
  latestDueDate: string | null;
  priority: ProjectionPriority;
  reason: string;
  ruleSetVersion: string;
  sourceCitation: string;
}

export interface EventProjection {
  sample: ProjectedObligation[];
  inspection: ProjectedObligation[];
  reporting: ProjectedObligation[];
  maintenance: ProjectedObligation[];
  labResult?: {
    cfuPerMl: number;
    level: "LEVEL_1" | "LEVEL_2" | "LEVEL_3" | "LEVEL_4";
    receivedAt: string;
    correctiveActionDueAt: string | null;
    remediationDueAt: string | null;
    chainClosed: boolean;
  };
}

export function annualCleaningProgress(cleaningDates: string[], year: number) {
  const dates = [...new Set(cleaningDates)]
    .filter((date) => date.startsWith(`${year}-`))
    .sort();
  const required = RULES.cleaningsPerCalendarYear;
  return {
    year,
    required,
    completed: dates.length,
    remaining: Math.max(0, required - dates.length),
    lastCompletedDate: dates.at(-1) ?? null,
  };
}

export function annualCleaningObligationId(
  systemId: string,
  year: number,
  completed: number,
) {
  return `annual-cleaning:${systemId}:${year}:${completed + 1}`;
}

export function nextAnnualCleaningObligation(input: {
  systemId: string;
  year: number;
  completed: number;
  ruleSetVersion?: string;
  sourceCitation?: string;
}): ProjectedObligation | null {
  if (input.completed >= RULES.cleaningsPerCalendarYear) return null;
  return {
    triggerEventId: `calendar-year:${input.systemId}:${input.year}`,
    obligationType: "ANNUAL_CLEANING",
    earliestDueDate: `${input.year}-01-01`,
    targetStartDate: null,
    targetEndDate: null,
    latestDueDate: `${input.year}-12-31`,
    priority: "ROUTINE",
    reason:
      `NYC requires at least ${RULES.cleaningsPerCalendarYear} cleanings per calendar year, including startup cleaning. ` +
      "Cleaning remains a separate activity: record startup separately for its 3–14 day sample window, or combine another cleaning with an already-open Legionella sample.",
    ruleSetVersion: input.ruleSetVersion ?? NYC_CHAPTER_8_RULESET_VERSION,
    sourceCitation: input.sourceCitation ?? "24 RCNY §8-04",
  };
}

const NYC_CITATION = "NYC Chapter 8 (effective May 8, 2026)";
const emptyProjection = (): EventProjection => ({
  sample: [],
  inspection: [],
  reporting: [],
  maintenance: [],
});

function monthDay(year: number, month: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function stableMonthlyTargetWindow(input: {
  lastSample: string;
  legalLatest: string;
  preferredStartDay: number;
  preferredEndDay: number;
}) {
  const due = new Date(`${input.legalLatest}T12:00:00Z`);
  let year = due.getUTCFullYear();
  let month = due.getUTCMonth() + 1;
  let start = monthDay(year, month, input.preferredStartDay);
  let end = monthDay(year, month, input.preferredEndDay);
  if (start > input.legalLatest) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    const previousStart = monthDay(year, month, input.preferredStartDay);
    const previousEnd = monthDay(year, month, input.preferredEndDay);
    if (previousEnd > input.lastSample) {
      start = previousStart;
      end = previousEnd;
    } else {
      start = addDays(input.legalLatest, -6);
      end = addDays(input.legalLatest, -2);
    }
  }
  const earliest = addDays(input.lastSample, 1);
  start = start < earliest ? earliest : start;
  end = end < start ? start : end;
  end = end > input.legalLatest ? input.legalLatest : end;
  return { start, end };
}

function routineSample(
  event: RegulatoryEventInput,
  config: TowerRuleConfig,
): ProjectedObligation {
  const maximumGap =
    config.routineSampleMaxGapDays ?? RULES.routineSampleMaxGapDays;
  const latest = addDays(event.date, maximumGap);
  const target = stableMonthlyTargetWindow({
    lastSample: event.date,
    legalLatest: latest,
    preferredStartDay: config.monthlyTargetStartDay,
    preferredEndDay: config.monthlyTargetEndDay,
  });
  const intervalTarget = config.routineSampleTargetIntervalDays
    ? addDays(event.date, config.routineSampleTargetIntervalDays)
    : null;
  return {
    triggerEventId: event.id,
    obligationType: "ROUTINE_OPERATING_SAMPLE",
    earliestDueDate: addDays(event.date, 1),
    targetStartDate: intervalTarget ?? target.start,
    targetEndDate: intervalTarget ?? target.end,
    latestDueDate: latest,
    priority: "ROUTINE",
    reason: `${config.profileKind === "CUSTOM" ? "Company or customer operational requirement: " : ""}Operating systems require Legionella culture sampling with no more than ${maximumGap} days between collection events.${config.routineSampleTargetIntervalDays ? ` The internal service target is day ${config.routineSampleTargetIntervalDays}.` : " The fixed monthly target does not move with planned work."}`,
    ruleSetVersion: NYC_CHAPTER_8_RULESET_VERSION,
    sourceCitation: config.sourceCitations?.routineSample ?? NYC_CITATION,
  };
}

function windowObligation(
  event: RegulatoryEventInput,
  type: string,
  minimumDays: number,
  maximumDays: number,
  reason: string,
  priority: ProjectionPriority = "CRITICAL",
  sourceCitation = NYC_CITATION,
): ProjectedObligation {
  const start = addDays(event.date, minimumDays);
  const end = addDays(event.date, maximumDays);
  return {
    triggerEventId: event.id,
    obligationType: type,
    earliestDueDate: start,
    targetStartDate: start,
    targetEndDate: end,
    latestDueDate: end,
    priority,
    reason,
    ruleSetVersion: NYC_CHAPTER_8_RULESET_VERSION,
    sourceCitation,
  };
}

function reportingObligation(
  event: RegulatoryEventInput,
  type: string,
  days: number,
  reason: string,
  priority: ProjectionPriority,
  sourceCitation = NYC_CITATION,
): ProjectedObligation {
  const due = addDays(event.date, days);
  return {
    triggerEventId: event.id,
    obligationType: type,
    earliestDueDate: event.date,
    targetStartDate: event.date,
    targetEndDate: due,
    latestDueDate: due,
    priority,
    reason,
    ruleSetVersion: NYC_CHAPTER_8_RULESET_VERSION,
    sourceCitation,
  };
}

const EMERGENCY_TYPES = new Set<RegulatoryEventType>([
  "POWER_FAILURE",
  "BIOCIDE_LOSS",
  "CONDUCTIVITY_CONTROL_FAILURE",
  "DOH_DIRECTED_SAMPLE",
  "OTHER_DOH_CONDITION",
  "MANUAL_RISK_EVENT",
]);

function customRuleReason(
  rule: NonNullable<TowerRuleConfig["customRules"]>[number],
) {
  const source =
    rule.sourceAuthority === "CONTRACT_REQUIREMENT"
      ? "Customer requirement"
      : rule.sourceAuthority === "COMPANY_POLICY"
        ? "Company policy"
        : "Operational requirement";
  return `${source}: ${rule.ruleName}`;
}

function addCustomRuleObligation(
  projection: EventProjection,
  event: RegulatoryEventInput,
  rule: NonNullable<TowerRuleConfig["customRules"]>[number],
  ruleSetVersion: string,
) {
  const minimum = rule.minimumDaysAfterTrigger ?? rule.frequencyDays ?? 0;
  const maximum = rule.maximumDaysAfterTrigger ?? rule.frequencyDays;
  const obligation: ProjectedObligation = {
    triggerEventId: event.id,
    obligationType: rule.requirementType,
    earliestDueDate: addDays(event.date, minimum),
    targetStartDate: addDays(event.date, minimum),
    targetEndDate: maximum == null ? null : addDays(event.date, maximum),
    latestDueDate: maximum == null ? null : addDays(event.date, maximum),
    priority: maximum == null ? "WARNING" : "ROUTINE",
    reason: customRuleReason(rule),
    ruleSetVersion,
    sourceCitation: rule.sourceCitation,
  };
  if (rule.requirementType.includes("SAMPLE"))
    projection.sample.push(obligation);
  else if (rule.requirementType.includes("INSPECTION"))
    projection.inspection.push(obligation);
  else if (
    rule.requirementType.includes("CERTIFICATION") ||
    rule.requirementType.includes("REPORT") ||
    rule.requirementType.includes("SUBMISSION")
  )
    projection.reporting.push(obligation);
  else projection.maintenance.push(obligation);
}

export function projectEventObligations(
  event: RegulatoryEventInput,
  config: TowerRuleConfig,
): EventProjection {
  const projection = emptyProjection();
  const profileKind = config.profileKind ?? (config.isNyc ? "NYC" : "CUSTOM");
  const isNys = profileKind === "NYS";

  if (
    event.type === "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED" &&
    config.operating &&
    config.routineSampleEnabled !== false
  ) {
    projection.sample.push(routineSample(event, config));
    if (config.sampleDateReportingEnabled !== false)
      projection.reporting.push(
        reportingObligation(
          event,
          isNys ? "NYS_LEGIONELLA_RESULT_REPORTING" : "PORTAL_SAMPLE_DATE",
          config.sampleDateReportDays ?? RULES.sampleDateReportDays,
          isNys
            ? `Report the Legionella sampling and analysis information in the New York State registry within ${config.sampleDateReportDays ?? 90} days while the tower is in use.`
            : `Report the Legionella sample test date through the NYC cooling tower portal within ${config.sampleDateReportDays ?? RULES.sampleDateReportDays} days.`,
          "WARNING",
          config.sourceCitations?.sampleDateReporting ?? NYC_CITATION,
        ),
      );
    if (config.includesNys && config.registryReportingEnabled)
      projection.reporting.push(
        reportingObligation(
          event,
          "NYS_LEGIONELLA_RESULT_REPORTING",
          config.registryReportingIntervalDays ?? 90,
          `Report the Legionella sampling and analysis information in the New York State registry within ${config.registryReportingIntervalDays ?? 90} days while the tower is in use.`,
          "WARNING",
          config.sourceCitations?.registryReporting ?? "10 NYCRR §4-1.3",
        ),
      );
  }

  if (
    event.type === "BACTERIOLOGICAL_SAMPLE_COLLECTED" &&
    config.operating &&
    config.bacteriologicalSampleEnabled
  ) {
    const interval = config.bacteriologicalSampleIntervalDays ?? 30;
    const due = addDays(event.date, interval);
    projection.sample.push({
      triggerEventId: event.id,
      obligationType: "ROUTINE_BACTERIOLOGICAL_SAMPLE",
      earliestDueDate: addDays(event.date, 1),
      targetStartDate: addDays(due, -5),
      targetEndDate: due,
      latestDueDate: due,
      priority: "ROUTINE",
      reason: `While the tower is in use, collect the next bacteriological culture sample within ${interval} days. This is separate from Legionella culture sampling.`,
      ruleSetVersion: config.ruleSetVersion ?? NYC_CHAPTER_8_RULESET_VERSION,
      sourceCitation:
        config.sourceCitations?.bacteriologicalSample ??
        "10 NYCRR §4-1.4(b)(1)",
    });
    if (config.includesNys && config.registryReportingEnabled)
      projection.reporting.push(
        reportingObligation(
          event,
          "NYS_BACTERIOLOGICAL_RESULT_REPORTING",
          config.registryReportingIntervalDays ?? 90,
          "Report the bacteriological sample, result, and any required remediation in the New York State registry while the tower is in use.",
          "WARNING",
          config.sourceCitations?.registryReporting ?? "10 NYCRR §4-1.3",
        ),
      );
  }

  if (event.type === "STARTUP" && profileKind !== "CUSTOM") {
    if (config.includesNys && config.bacteriologicalSampleEnabled) {
      const interval = config.bacteriologicalSampleIntervalDays ?? 30;
      const due = addDays(event.date, interval);
      projection.sample.push({
        triggerEventId: event.id,
        obligationType: "ROUTINE_BACTERIOLOGICAL_SAMPLE",
        earliestDueDate: event.date,
        targetStartDate: addDays(due, -5),
        targetEndDate: due,
        latestDueDate: due,
        priority: "ROUTINE",
        reason: `Owner-managed cooling-tower bacteriological culture is required at intervals not exceeding ${interval} days while the tower is in use. This is a separate heterotrophic bacterial analysis and does not replace Legionella culture sampling.`,
        ruleSetVersion: config.ruleSetVersion ?? NYC_CHAPTER_8_RULESET_VERSION,
        sourceCitation:
          config.sourceCitations?.bacteriologicalSample ??
          "10 NYCRR §4-1.4(b)(1)",
      });
    }
    if (isNys) {
      projection.sample.push(
        windowObligation(
          event,
          "STARTUP_SAMPLE",
          0,
          14,
          "Collect a Legionella culture sample within 14 days after seasonal startup. Startup cleaning is tracked separately and is required before startup when stagnant water remained for more than five days.",
          "CRITICAL",
          "10 NYCRR §4-1.4(b)(2), (c)(2)",
        ),
      );
      if (config.registryReportingEnabled)
        projection.reporting.push(
          reportingObligation(
            event,
            "NYS_REGISTRY_UPDATE",
            config.registryReportingIntervalDays ?? 90,
            "Report the seasonal startup date in the New York State cooling tower registry while the tower is in use.",
            "WARNING",
            config.sourceCitations?.registryReporting ?? "10 NYCRR §4-1.3",
          ),
        );
    } else {
      projection.maintenance.push({
        triggerEventId: event.id,
        obligationType: "STARTUP_CLEANING_DISINFECTION",
        earliestDueDate: addDays(event.date, -15),
        targetStartDate: addDays(event.date, -15),
        targetEndDate: event.date,
        latestDueDate: event.date,
        priority: "CRITICAL",
        reason:
          `Before startup on ${event.date}, the tower must be cleaned and disinfected during the preceding 15-day window (${addDays(event.date, -15)} through ${event.date}). ` +
          "A cleaning recorded after startup cannot retroactively satisfy this requirement.",
        ruleSetVersion: config.ruleSetVersion ?? NYC_CHAPTER_8_RULESET_VERSION,
        sourceCitation: "24 RCNY §8-06(b)",
      });
      projection.sample.push(
        windowObligation(
          event,
          "STARTUP_SAMPLE",
          RULES.startupSampleMinimumDays,
          RULES.startupSampleMaximumDays,
          `Startup on ${event.date} creates a Legionella culture sample window from day 3 through day 14. Startup cleaning is tracked separately and does not set this window.`,
        ),
      );
      projection.reporting.push(
        reportingObligation(
          event,
          "STARTUP_DOH_NOTIFICATION",
          RULES.startupReportDays,
          "Report the startup to NYC DOH within 5 days.",
          "CRITICAL",
        ),
      );
    }
    if (!isNys && config.includesNys && config.registryReportingEnabled)
      projection.reporting.push(
        reportingObligation(
          event,
          "NYS_REGISTRY_UPDATE",
          config.registryReportingIntervalDays ?? 90,
          "Report the seasonal startup date in the New York State cooling tower registry while the tower is in use.",
          "WARNING",
          config.sourceCitations?.registryReporting ?? "10 NYCRR §4-1.3",
        ),
      );
  }

  if (event.type === "SHUTDOWN" && config.isNyc) {
    projection.reporting.push(
      reportingObligation(
        event,
        "SHUTDOWN_DOH_NOTIFICATION",
        RULES.startupReportDays,
        "Report the shutdown to NYC DOH within 5 days.",
        "CRITICAL",
      ),
    );
  }

  if (
    event.type === "SUMMERTIME_HYPERHALOGENATION" &&
    (config.hyperhalogenationEnabled ?? config.isNyc)
  ) {
    const minimumDays =
      config.hyperSampleMinimumDays ?? RULES.hyperSampleMinimumDays;
    const maximumDays =
      config.hyperSampleMaximumDays ?? RULES.hyperSampleMaximumDays;
    projection.sample.push(
      windowObligation(
        event,
        "POST_HYPERHALOGENATION_SAMPLE",
        minimumDays,
        maximumDays,
        `${profileKind === "CUSTOM" ? "Company or customer policy: c" : "C"}ollect a Legionella culture sample ${minimumDays}–${maximumDays} days after summertime hyperhalogenation.`,
        "CRITICAL",
        config.sourceCitations?.hyperhalogenation ?? NYC_CITATION,
      ),
    );
    if (config.isNyc)
      projection.reporting.push(
        reportingObligation(
          event,
          "HYPERHALOGENATION_DECLARATION",
          RULES.hyperDeclarationDays,
          "Submit the summertime hyperhalogenation declaration within 30 days of completion.",
          "WARNING",
          config.sourceCitations?.hyperhalogenation ?? NYC_CITATION,
        ),
      );
  }

  if (
    profileKind !== "CUSTOM" &&
    (event.type === "HIGH_LEGIONELLA_DISINFECTION" ||
      event.type === "FULL_REMEDIATION")
  ) {
    const retestMinimum = isNys ? 3 : RULES.retestMinimumDays;
    const retestMaximum = isNys ? 7 : RULES.retestMaximumDays;
    projection.sample.push(
      windowObligation(
        event,
        "POST_DISINFECTION_RETEST",
        retestMinimum,
        retestMaximum,
        `Collect the Legionella retest ${retestMinimum}–${retestMaximum} calendar days after ${event.type === "FULL_REMEDIATION" ? "full remediation" : "corrective disinfection"}. Weekend dates remain part of the legal window.`,
        "CRITICAL",
        config.isNyc && config.includesNys
          ? `${NYC_CITATION} | 10 NYCRR Appendix 4-A`
          : isNys
            ? "10 NYCRR Appendix 4-A"
            : NYC_CITATION,
      ),
    );
  }

  if (
    event.type === "QUARTERLY_INSPECTION_COMPLETED" &&
    config.inspectionEnabled !== false
  ) {
    const inspectionInterval =
      config.inspectionIntervalDays ?? RULES.inspectionIntervalDays;
    const due = addDays(event.date, inspectionInterval);
    projection.inspection.push({
      triggerEventId: event.id,
      obligationType: "QUARTERLY_COMPLIANCE_INSPECTION",
      earliestDueDate: addDays(event.date, 1),
      targetStartDate: addDays(due, -14),
      targetEndDate: due,
      latestDueDate: due,
      priority: "ROUTINE",
      reason: `${profileKind === "CUSTOM" ? "Company or customer operational requirement: " : ""}A qualified person must complete the next compliance inspection within ${inspectionInterval} days. The inspection does not itself create a separate Legionella sample.`,
      ruleSetVersion: config.ruleSetVersion ?? NYC_CHAPTER_8_RULESET_VERSION,
      sourceCitation:
        config.sourceCitations?.inspection ??
        (isNys ? "10 NYCRR §4-1.8" : NYC_CITATION),
    });
  }

  if (EMERGENCY_TYPES.has(event.type) && profileKind !== "CUSTOM") {
    projection.sample.push({
      triggerEventId: event.id,
      obligationType: "EMERGENCY_SAMPLE",
      earliestDueDate: event.date,
      targetStartDate: event.date,
      targetEndDate: null,
      latestDueDate: null,
      priority: "EMERGENCY",
      reason:
        "This risk event requires additional emergency Legionella sampling. Schedule immediately; no precise legal window is invented unless the MPP supplies one.",
      ruleSetVersion: NYC_CHAPTER_8_RULESET_VERSION,
      sourceCitation: isNys ? "10 NYCRR §4-1.4(b)(3)" : NYC_CITATION,
    });
  }

  if (event.type === "WEEKLY_BIOLOGICAL_INDICATOR_RESULT") {
    if (!config.isNyc) return projection;
    const value = event.cfuPerMl ?? 0;
    if (
      value >= RULES.biologicalIndicatorThresholdCfuMl &&
      event.residualRestoredWithin3Days == null
    ) {
      projection.reporting.push(
        reportingObligation(
          event,
          "BIOLOGICAL_INDICATOR_RESIDUAL_MONITORING",
          RULES.biologicalIndicatorEscalationDays,
          "Monitor disinfectant residual three times per day until target residual is maintained for at least 24 hours. If that is not achieved within 3 days, record the outcome to generate Legionella sampling.",
          "CRITICAL",
        ),
      );
    }
    if (
      value >= RULES.biologicalIndicatorThresholdCfuMl &&
      event.residualRestoredWithin3Days === false
    ) {
      const triggerDate = addDays(
        event.date,
        RULES.biologicalIndicatorEscalationDays,
      );
      projection.sample.push({
        triggerEventId: event.id,
        obligationType: "BIOLOGICAL_INDICATOR_ESCALATION_SAMPLE",
        earliestDueDate: triggerDate,
        targetStartDate: triggerDate,
        targetEndDate: null,
        latestDueDate: null,
        priority: "EMERGENCY",
        reason:
          "The weekly biological indicator was at least 10,000 CFU/mL and target disinfectant residual was not restored for 24 hours within 3 days; collect a Legionella sample.",
        ruleSetVersion: NYC_CHAPTER_8_RULESET_VERSION,
        sourceCitation: NYC_CITATION,
      });
    }
  }

  if (event.type === "LEGIONELLA_RESULT_RECEIVED" && profileKind !== "CUSTOM") {
    if (event.cfuPerMl == null || event.cfuPerMl < 0)
      throw new Error("A non-negative CFU/mL result is required.");
    const response = isNys
      ? {
          level:
            event.cfuPerMl < 20
              ? "LEVEL_1"
              : event.cfuPerMl < 1000
                ? "LEVEL_2"
                : "LEVEL_4",
        }
      : correctiveAction(event.cfuPerMl, event.cfuPerMl > 0);
    const level = response.level.startsWith("LEVEL_1")
      ? "LEVEL_1"
      : response.level;
    const receivedAt = event.date;
    projection.labResult = {
      cfuPerMl: event.cfuPerMl,
      level: level as "LEVEL_1" | "LEVEL_2" | "LEVEL_3" | "LEVEL_4",
      receivedAt,
      correctiveActionDueAt: null,
      remediationDueAt: null,
      chainClosed: level === "LEVEL_1",
    };
    if (level !== "LEVEL_1") {
      const actionText = isNys
        ? level === "LEVEL_2"
          ? "Review the treatment program and immediately perform online disinfection."
          : "Review the treatment program and immediately perform online decontamination."
        : level === "LEVEL_2"
          ? "Increase or change biocide and review the treatment program within 24 hours."
          : level === "LEVEL_3"
            ? "Increase or change biocide within 24 hours and inspect/evaluate whether cleaning and further disinfection are needed."
            : "Increase biocide within 24 hours and perform full remediation within 48 hours.";
      projection.reporting.push(
        reportingObligation(
          event,
          `${level}_CORRECTIVE_ACTION`,
          isNys ? 0 : 1,
          `${actionText} The result workflow records a date only; the exact hourly deadline requires human compliance review.`,
          "EMERGENCY",
        ),
      );
      projection.sample.push(
        windowObligation(
          event,
          `LEGIONELLA_${level}_RETEST`,
          isNys ? 3 : RULES.retestMinimumDays,
          isNys ? 7 : RULES.retestMaximumDays,
          `${level.replace("_", " ")} requires corrective action and a retest 3–7 days after receipt. Continue the retest chain until the applicable action level is cleared.`,
          "CRITICAL",
          isNys ? "10 NYCRR Appendix 4-A" : NYC_CITATION,
        ),
      );
    }
    if (level === "LEVEL_4" && config.isNyc) {
      projection.reporting.push(
        reportingObligation(
          event,
          "LEVEL_4_FULL_REMEDIATION",
          2,
          "Complete hyperhalogenation, draining, cleaning, and flushing within 48 hours. The result workflow records a date only; the exact hourly deadline requires human compliance review.",
          "EMERGENCY",
        ),
      );
      projection.reporting.push(
        reportingObligation(
          event,
          "LEVEL_4_DOH_NOTIFICATION",
          1,
          "Notify NYC DOH within 24 hours of receiving a Level 4 result.",
          "EMERGENCY",
        ),
      );
    }
    if (isNys && event.cfuPerMl > 1000)
      projection.reporting.push(
        reportingObligation(
          event,
          "NYS_LOCAL_HEALTH_DEPARTMENT_NOTIFICATION",
          1,
          "Notify the local health department within 24 hours after receiving a Legionella result exceeding 1,000 CFU/mL. The date-only workflow requires review of the exact hourly deadline.",
          "EMERGENCY",
          "10 NYCRR §4-1.6",
        ),
      );
  }

  if (profileKind === "CUSTOM")
    for (const rule of config.customRules ?? [])
      if (rule.triggerEventType === event.type)
        addCustomRuleObligation(
          projection,
          event,
          rule,
          config.ruleSetVersion ?? NYC_CHAPTER_8_RULESET_VERSION,
        );

  if (config.ruleSetVersion)
    for (const obligation of [
      ...projection.sample,
      ...projection.inspection,
      ...projection.reporting,
      ...projection.maintenance,
    ])
      obligation.ruleSetVersion = config.ruleSetVersion;
  return projection;
}

export function annualSummertimeHyperhalogenationObligation(
  triggerEventId: string,
  year: number,
  ruleSetVersion = NYC_CHAPTER_8_RULESET_VERSION,
): ProjectedObligation {
  const start = `${year}-${RULES.summertimeStart}`;
  const end = `${year}-${RULES.summertimeEnd}`;
  return {
    triggerEventId,
    obligationType: "SUMMERTIME_HYPERHALOGENATION_DUE",
    earliestDueDate: start,
    targetStartDate: start,
    targetEndDate: end,
    latestDueDate: end,
    priority: "WARNING",
    reason:
      "Complete annual summertime hyperhalogenation between July 1 and August 31 unless records establish that the system is fully shut down and completely drained for that entire period.",
    ruleSetVersion,
    sourceCitation: "24 RCNY §8-04(f)",
  };
}

export function annualNysCertificationObligation(
  triggerEventId: string,
  year: number,
  ruleSetVersion: string,
  sourceCitation = "10 NYCRR §4-1.8(b)",
): ProjectedObligation {
  return {
    triggerEventId,
    obligationType: "NYS_ANNUAL_CERTIFICATION",
    earliestDueDate: `${year}-01-01`,
    targetStartDate: `${year}-10-01`,
    targetEndDate: `${year}-11-01`,
    latestDueDate: `${year}-11-01`,
    priority: "WARNING",
    reason:
      "Submit the annual New York State cooling tower certification by November 1. Certification submission is tracked separately from inspection and field work.",
    ruleSetVersion,
    sourceCitation,
  };
}

export function obligationPriorityForDate(input: {
  today: string;
  latestDueDate: string | null;
  current: ProjectionPriority;
}) {
  if (input.current === "EMERGENCY" && !input.latestDueDate) return "EMERGENCY";
  if (!input.latestDueDate) return input.current;
  const remaining = diffDays(input.today, input.latestDueDate);
  if (remaining < 0) return "EMERGENCY";
  if (remaining <= 2) return "CRITICAL";
  if (remaining <= 6) return "WARNING";
  return input.current;
}

export function canSampleSatisfyObligation(
  collectionDate: string,
  obligation: Pick<ProjectedObligation, "earliestDueDate" | "latestDueDate">,
) {
  if (obligation.earliestDueDate && collectionDate < obligation.earliestDueDate)
    return false;
  if (obligation.latestDueDate && collectionDate > obligation.latestDueDate)
    return false;
  return true;
}

export type OpenSampleObligationForImpact = {
  id: string;
  type: string;
  earliest: string | null;
  latest: string | null;
  status: string;
  sourceCitation?: string | null;
};

export function sampleObligationsCoveredByEvent(
  event: Pick<RegulatoryEventInput, "type" | "date">,
  obligations: readonly OpenSampleObligationForImpact[],
) {
  const sampleKind =
    event.type === "BACTERIOLOGICAL_SAMPLE_COLLECTED"
      ? "BACTERIOLOGICAL"
      : event.type === "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED"
        ? "LEGIONELLA"
        : null;
  if (!sampleKind) return [];
  return obligations.filter((obligation) => {
    const bacteriological =
      obligation.type === "ROUTINE_BACTERIOLOGICAL_SAMPLE";
    if ((sampleKind === "BACTERIOLOGICAL") !== bacteriological) return false;
    return canSampleSatisfyObligation(event.date, {
      earliestDueDate: obligation.earliest,
      latestDueDate: obligation.latest,
    });
  });
}

export function previewEventImpact(input: {
  proposedEvent: RegulatoryEventInput;
  ruleConfig: TowerRuleConfig;
  openSampleObligations: readonly OpenSampleObligationForImpact[];
  performedByResponsibility?:
    "OUR_COMPANY" | "CUSTOMER" | "OTHER_VENDOR" | "NOT_TRACKED";
}) {
  const projection = projectEventObligations(
    input.proposedEvent,
    input.ruleConfig,
  );
  const covered = sampleObligationsCoveredByEvent(
    input.proposedEvent,
    input.openSampleObligations,
  );
  const satisfied = covered.filter((item) => item.status !== "MISSED");
  const missedUnchanged = covered.filter((item) => item.status === "MISSED");
  const messages: string[] = [];
  if (input.performedByResponsibility === "CUSTOMER")
    messages.push(
      `This external ${input.proposedEvent.type === "LEGIONELLA_RESULT_RECEIVED" ? "result" : "sample"} will be recorded for reference. Legionella remains customer managed.`,
    );
  if (input.performedByResponsibility === "OTHER_VENDOR")
    messages.push(
      `This ${input.proposedEvent.type === "LEGIONELLA_RESULT_RECEIVED" ? "result" : "sample"} will be recorded as work performed by another vendor, not by our company.`,
    );

  if (input.proposedEvent.type === "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED") {
    if (satisfied.length)
      messages.push(
        "This sample will satisfy the open routine Legionella requirement.",
      );
    if (input.ruleConfig.isNyc && input.ruleConfig.includesNys)
      messages.push(
        "This one Legionella sample also counts toward the compatible New York State 90-day Legionella requirement; no duplicate sample is created.",
      );
  }
  if (input.proposedEvent.type === "BACTERIOLOGICAL_SAMPLE_COLLECTED")
    messages.push(
      "This confirms the separate owner-managed cooling-tower bacteriological culture; it does not satisfy a Legionella requirement.",
    );
  if (missedUnchanged.length)
    messages.push(
      `This event will not restore ${missedUnchanged.length === 1 ? "the missed obligation" : `${missedUnchanged.length} missed obligations`}.`,
    );

  const generated = [
    ...projection.sample,
    ...projection.inspection,
    ...projection.reporting,
    ...projection.maintenance,
  ];
  if (!messages.length && !generated.length)
    messages.push(
      "This event does not affect any current compliance deadline.",
    );

  return { projection, generated, satisfied, missedUnchanged, messages };
}

export function windowsOverlap(
  left: Pick<ProjectedObligation, "earliestDueDate" | "latestDueDate">,
  right: Pick<ProjectedObligation, "earliestDueDate" | "latestDueDate">,
) {
  const start = [left.earliestDueDate, right.earliestDueDate]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const ends = [left.latestDueDate, right.latestDueDate].filter(
    (value): value is string => Boolean(value),
  );
  const end = ends.sort()[0];
  return !start || !end || start <= end;
}
