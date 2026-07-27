import { addDays, diffDays } from "@/lib/date";
import {
  NYC_CHAPTER_8_RULES as RULES,
  NYC_CHAPTER_8_RULESET_VERSION,
  correctiveAction,
} from "@/lib/rules";

export type RegulatoryEventType =
  | "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED"
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
  operating: boolean;
  monthlyTargetStartDay: number;
  monthlyTargetEndDay: number;
  routineSampleMaxGapDays?: number | null;
  routineSampleTargetIntervalDays?: number | null;
  sampleDateReportDays?: number | null;
  inspectionIntervalDays?: number | null;
  hyperSampleMinimumDays?: number | null;
  hyperSampleMaximumDays?: number | null;
  routineSampleEnabled?: boolean;
  sampleDateReportingEnabled?: boolean;
  inspectionEnabled?: boolean;
  hyperhalogenationEnabled?: boolean;
  sourceCitations?: {
    routineSample?: string | null;
    sampleDateReporting?: string | null;
    inspection?: string | null;
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
    reason: `Operating systems require Legionella culture sampling with no more than ${maximumGap} days between collection events.${config.routineSampleTargetIntervalDays ? ` The internal service target is day ${config.routineSampleTargetIntervalDays}.` : " The fixed monthly target does not move with planned work."}`,
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

export function projectEventObligations(
  event: RegulatoryEventInput,
  config: TowerRuleConfig,
): EventProjection {
  const projection = emptyProjection();
  if (!config.isNyc) return projection;

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
          "PORTAL_SAMPLE_DATE",
          config.sampleDateReportDays ?? RULES.sampleDateReportDays,
          `Report the Legionella sample test date through the NYC cooling tower portal within ${config.sampleDateReportDays ?? RULES.sampleDateReportDays} days.`,
          "WARNING",
          config.sourceCitations?.sampleDateReporting ?? NYC_CITATION,
        ),
      );
  }

  if (event.type === "STARTUP") {
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

  if (event.type === "SHUTDOWN") {
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
    config.hyperhalogenationEnabled !== false
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
        `Collect a Legionella culture sample ${minimumDays}–${maximumDays} days after summertime hyperhalogenation.`,
        "CRITICAL",
        config.sourceCitations?.hyperhalogenation ?? NYC_CITATION,
      ),
    );
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
    event.type === "HIGH_LEGIONELLA_DISINFECTION" ||
    event.type === "FULL_REMEDIATION"
  ) {
    projection.sample.push(
      windowObligation(
        event,
        "POST_DISINFECTION_RETEST",
        RULES.retestMinimumDays,
        RULES.retestMaximumDays,
        `Collect the Legionella retest ${RULES.retestMinimumDays}–${RULES.retestMaximumDays} calendar days after ${event.type === "FULL_REMEDIATION" ? "full remediation" : "corrective disinfection"}. Weekend dates remain part of the legal window.`,
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
      reason: `A qualified person must complete the next compliance inspection within ${inspectionInterval} days. The inspection does not itself create a separate Legionella sample.`,
      ruleSetVersion: NYC_CHAPTER_8_RULESET_VERSION,
      sourceCitation: config.sourceCitations?.inspection ?? NYC_CITATION,
    });
  }

  if (EMERGENCY_TYPES.has(event.type)) {
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
      sourceCitation: NYC_CITATION,
    });
  }

  if (event.type === "WEEKLY_BIOLOGICAL_INDICATOR_RESULT") {
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

  if (event.type === "LEGIONELLA_RESULT_RECEIVED") {
    if (event.cfuPerMl == null || event.cfuPerMl < 0)
      throw new Error("A non-negative CFU/mL result is required.");
    const response = correctiveAction(event.cfuPerMl, event.cfuPerMl > 0);
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
      const actionText =
        level === "LEVEL_2"
          ? "Increase or change biocide and review the treatment program within 24 hours."
          : level === "LEVEL_3"
            ? "Increase or change biocide within 24 hours and inspect/evaluate whether cleaning and further disinfection are needed."
            : "Increase biocide within 24 hours and perform full remediation within 48 hours.";
      projection.reporting.push(
        reportingObligation(
          event,
          `${level}_CORRECTIVE_ACTION`,
          1,
          `${actionText} The result workflow records a date only; the exact hourly deadline requires human compliance review.`,
          "EMERGENCY",
        ),
      );
      projection.sample.push(
        windowObligation(
          event,
          `LEGIONELLA_${level}_RETEST`,
          RULES.retestMinimumDays,
          RULES.retestMaximumDays,
          `${level.replace("_", " ")} requires corrective action and a retest 3–7 days after receipt. Continue the retest chain until Level 1 is reached.`,
          "CRITICAL",
        ),
      );
    }
    if (level === "LEVEL_4") {
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
  }

  if (config.ruleSetVersion)
    for (const obligation of [
      ...projection.sample,
      ...projection.inspection,
      ...projection.reporting,
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
