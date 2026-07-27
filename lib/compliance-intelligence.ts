import {
  actionableWorkingDaysRemaining,
  calendarDaysRemaining,
  complianceDateInfo,
  todayDateOnly,
} from "@/lib/date";
import { activitiesCanShareVisit } from "@/lib/activity-compatibility";

export type ComplianceColor =
  "GREEN" | "YELLOW" | "RED" | "BLUE" | "GRAY" | "PURPLE";

export type ComplianceUrgency =
  | "COMPLETED"
  | "SCHEDULED"
  | "OPEN"
  | "DUE_SOON"
  | "WARNING"
  | "CRITICAL"
  | "OVERDUE"
  | "EMERGENCY";

export interface ComplianceUrgencyResult {
  urgency: ComplianceUrgency;
  label: string;
  color: ComplianceColor;
  explanation: string;
  calendarDaysRemaining: number | null;
  workingDaysRemaining: number | null;
}

export function getUrgency(input: {
  today?: string;
  status: string;
  priority: string;
  latestDueDate: string | null;
  targetStartDate?: string | null;
}): ComplianceUrgencyResult {
  const today = input.today ?? todayDateOnly();
  if (input.status === "MISSED" || input.status === "OVERDUE")
    return {
      urgency: "OVERDUE",
      label: input.status === "MISSED" ? "Missed" : "Overdue",
      color: "RED",
      explanation:
        "The controlling deadline passed. Later work cannot repair this obligation.",
      calendarDaysRemaining: input.latestDueDate
        ? calendarDaysRemaining(input.latestDueDate, today)
        : null,
      workingDaysRemaining: input.latestDueDate
        ? complianceDateInfo(input.latestDueDate, today).workingDays
        : null,
    };
  if (input.status === "COMPLETED")
    return {
      urgency: "COMPLETED",
      label: "Completed on time",
      color: "GREEN",
      explanation: "The obligation has been completed.",
      calendarDaysRemaining: null,
      workingDaysRemaining: null,
    };
  const dateInfo = input.latestDueDate
    ? complianceDateInfo(input.latestDueDate, today)
    : null;
  if (dateInfo && dateInfo.calendarDays < 0)
    return {
      urgency: "OVERDUE",
      label: "Overdue",
      color: "RED",
      explanation: `The legal latest date passed ${Math.abs(dateInfo.calendarDays)} calendar day${dateInfo.calendarDays === -1 ? "" : "s"} ago.`,
      calendarDaysRemaining: dateInfo.calendarDays,
      workingDaysRemaining: dateInfo.workingDays,
    };
  if (input.priority === "EMERGENCY")
    return {
      urgency: "EMERGENCY",
      label: "Due now",
      color: "RED",
      explanation:
        "This obligation should not wait for a bundle opportunity unless it can be completed immediately.",
      calendarDaysRemaining: dateInfo?.calendarDays ?? null,
      workingDaysRemaining: dateInfo?.workingDays ?? null,
    };
  if (dateInfo?.calendarDays === 0)
    return {
      urgency: "CRITICAL",
      label: "Due today",
      color: "RED",
      explanation: "The legal deadline is today.",
      calendarDaysRemaining: 0,
      workingDaysRemaining: 0,
    };
  if (
    input.priority === "CRITICAL" ||
    (dateInfo != null && dateInfo.calendarDays <= 2)
  )
    return {
      urgency: "CRITICAL",
      label: "Due soon",
      color: "RED",
      explanation: "The obligation is inside its critical response period.",
      calendarDaysRemaining: dateInfo?.calendarDays ?? null,
      workingDaysRemaining: dateInfo?.workingDays ?? null,
    };
  if (
    input.priority === "WARNING" ||
    (dateInfo != null && dateInfo.calendarDays <= 7)
  )
    return {
      urgency: "WARNING",
      label: "Due soon",
      color: "YELLOW",
      explanation: "The legal deadline is approaching.",
      calendarDaysRemaining: dateInfo?.calendarDays ?? null,
      workingDaysRemaining: dateInfo?.workingDays ?? null,
    };
  if (input.status === "SCHEDULED")
    return {
      urgency: "SCHEDULED",
      label: "Scheduled — still open",
      color: "BLUE",
      explanation:
        "Work is scheduled, but the compliance clock remains open until completion is recorded.",
      calendarDaysRemaining: dateInfo?.calendarDays ?? null,
      workingDaysRemaining: dateInfo?.workingDays ?? null,
    };
  if (input.targetStartDate && input.targetStartDate <= today)
    return {
      urgency: "DUE_SOON",
      label: "Due soon",
      color: "YELLOW",
      explanation: "The preferred service window is open.",
      calendarDaysRemaining: dateInfo?.calendarDays ?? null,
      workingDaysRemaining: dateInfo?.workingDays ?? null,
    };
  return {
    urgency: "OPEN",
    label: "Upcoming",
    color: "GREEN",
    explanation: input.latestDueDate
      ? "The obligation is open and remains outside its warning period."
      : "The obligation is open without a fixed legal latest date.",
    calendarDaysRemaining: dateInfo?.calendarDays ?? null,
    workingDaysRemaining: dateInfo?.workingDays ?? null,
  };
}

export type ObligationCategory =
  "SAMPLE" | "INSPECTION" | "MAINTENANCE" | "REPORTING_ACTION";

export interface VisitOpportunityObligation {
  id: string;
  type: string;
  category: ObligationCategory;
  earliest: string | null;
  targetStart?: string | null;
  targetEnd?: string | null;
  latest: string | null;
  priority: string;
  status: string;
  reason: string;
}

export type AttentionBucket = "URGENT" | "READY_NOW" | "UPCOMING";

export interface UrgentAttentionPriority {
  rank: number;
  label: string;
}

export function getUrgentAttentionPriority(
  obligation: Pick<VisitOpportunityObligation, "latest" | "priority">,
  today = todayDateOnly(),
): UrgentAttentionPriority {
  if (obligation.latest != null && obligation.latest < today)
    return { rank: 9, label: "Overdue — compliance issue" };
  if (obligation.priority === "EMERGENCY")
    return { rank: 1, label: "Emergency — act immediately" };
  if (obligation.latest === today) return { rank: 2, label: "Due today" };
  const workingDays = obligation.latest
    ? actionableWorkingDaysRemaining(obligation.latest, today)
    : null;
  if (workingDays != null && workingDays <= 3)
    return {
      rank: 3,
      label: `Due in ${workingDays} working day${workingDays === 1 ? "" : "s"}`,
    };
  return { rank: 4, label: "Not in the urgent window" };
}

export function compareUrgentAttention(
  a: Pick<VisitOpportunityObligation, "latest" | "priority">,
  b: Pick<VisitOpportunityObligation, "latest" | "priority">,
  today = todayDateOnly(),
) {
  const rankDifference =
    getUrgentAttentionPriority(a, today).rank -
    getUrgentAttentionPriority(b, today).rank;
  if (rankDifference) return rankDifference;
  return (a.latest ?? "0000-00-00").localeCompare(b.latest ?? "0000-00-00");
}

/**
 * Groups open work for the operational home screen. The legal latest date
 * controls urgency; the internal target window controls when routine work is
 * ready to perform. A scheduled obligation stays in the queue until the work
 * is actually completed.
 */
export function getAttentionBucket(
  obligation: Pick<
    VisitOpportunityObligation,
    "latest" | "priority" | "targetStart" | "targetEnd"
  >,
  today = todayDateOnly(),
): AttentionBucket {
  if (obligation.latest != null && obligation.latest < today) return "UPCOMING";
  const workingDays = obligation.latest
    ? actionableWorkingDaysRemaining(obligation.latest, today)
    : null;
  if (
    obligation.priority === "EMERGENCY" ||
    (workingDays != null && workingDays <= 3)
  )
    return "URGENT";

  if (
    obligation.targetStart != null &&
    obligation.targetStart <= today &&
    (obligation.targetEnd == null || obligation.targetEnd >= today)
  )
    return "READY_NOW";

  return "UPCOMING";
}

const ON_SITE_ACTION_TYPES = new Set([
  "SUMMERTIME_HYPERHALOGENATION_DUE",
  "LEVEL_2_CORRECTIVE_ACTION",
  "LEVEL_3_CORRECTIVE_ACTION",
  "LEVEL_4_CORRECTIVE_ACTION",
  "LEVEL_4_FULL_REMEDIATION",
]);

export function isVisitEligibleObligation(
  obligation: Pick<VisitOpportunityObligation, "category" | "type">,
): boolean {
  return (
    obligation.category === "SAMPLE" ||
    obligation.category === "INSPECTION" ||
    obligation.category === "MAINTENANCE" ||
    ON_SITE_ACTION_TYPES.has(obligation.type)
  );
}

export function missedObligationConsequence(input: {
  category?: ObligationCategory;
  type: string;
  priority: string;
}): string {
  if (input.priority === "EMERGENCY")
    return "The emergency obligation remains open and the tower stays in the highest-priority work queue until completion is recorded.";
  if (input.category === "SAMPLE")
    return "The sampling obligation is marked missed. A later sample is stored as history but cannot repair this obligation.";
  if (input.category === "INSPECTION")
    return "The inspection obligation becomes overdue. Only a recorded completed inspection closes the obligation.";
  if (input.category === "MAINTENANCE")
    return "The required cleaning remains open. Record the completed cleaning separately; it does not reset the Legionella sampling clock.";
  if (
    isVisitEligibleObligation({
      category: input.category ?? "REPORTING_ACTION",
      type: input.type,
    })
  )
    return "The required field action is marked missed and moves to Compliance Issues; later work does not erase the missed deadline.";
  return "The reporting or follow-up obligation becomes a compliance issue and leaves the actionable priority queue.";
}

export interface CompletionPreviewActivity {
  id: string;
  activityType: string;
  systemName: string;
  qualifiesForRoutineLegionella: boolean;
  qualifiesForInspection: boolean;
  qualifiesForCleaning: boolean;
}

export interface CompletionPreviewObligation {
  id: string;
  type: string;
  category: ObligationCategory;
  systemName: string;
  earliest: string | null;
  latest: string | null;
}

export function activityTypeCoversObligation(
  activityType: string,
  obligation: Pick<CompletionPreviewObligation, "category" | "type">,
): boolean {
  if (obligation.category === "SAMPLE")
    return [
      "ROUTINE_LEGIONELLA_SAMPLE",
      "STARTUP_LEGIONELLA_SAMPLE",
      "POST_HYPERHALOGENATION_SAMPLE",
      "CORRECTIVE_RETEST",
      "EMERGENCY_SAMPLE",
    ].includes(activityType);
  if (obligation.category === "INSPECTION")
    return activityType === "COMPLIANCE_INSPECTION";
  if (obligation.category === "MAINTENANCE")
    return obligation.type === "STARTUP_CLEANING_DISINFECTION"
      ? ["STARTUP_CLEANING", "CLEANING_AND_DISINFECTION"].includes(activityType)
      : activityType === "ROUTINE_CLEANING";
  if (obligation.type === "SUMMERTIME_HYPERHALOGENATION_DUE")
    return activityType === "SUMMERTIME_HYPERHALOGENATION";
  if (obligation.type === "LEVEL_4_FULL_REMEDIATION")
    return activityType === "FULL_REMEDIATION";
  if (obligation.type.includes("CORRECTIVE_ACTION"))
    return ["CORRECTIVE_DISINFECTION", "FULL_REMEDIATION"].includes(
      activityType,
    );
  return false;
}

function activityCoversObligation(
  activity: CompletionPreviewActivity,
  obligation: CompletionPreviewObligation,
): boolean {
  if (activity.systemName !== obligation.systemName) return false;
  if (
    obligation.category === "SAMPLE" &&
    activity.qualifiesForRoutineLegionella
  )
    return true;
  if (obligation.category === "INSPECTION" && activity.qualifiesForInspection)
    return true;
  return activityTypeCoversObligation(activity.activityType, obligation);
}

export function previewVisitCompletion(input: {
  activities: CompletionPreviewActivity[];
  obligations: CompletionPreviewObligation[];
  performedDate: string;
}) {
  const satisfied = input.obligations.filter(
    (obligation) =>
      (!obligation.earliest || input.performedDate >= obligation.earliest) &&
      (!obligation.latest || input.performedDate <= obligation.latest) &&
      input.activities.some((activity) =>
        activityCoversObligation(activity, obligation),
      ),
  );
  const generated = new Set<string>();
  for (const activity of input.activities) {
    if (
      activity.qualifiesForRoutineLegionella ||
      activity.activityType === "ROUTINE_LEGIONELLA_SAMPLE"
    )
      generated.add("Next routine Legionella target and laboratory follow-up");
    if (activity.activityType === "STARTUP")
      generated.add("Startup Legionella sample window");
    if (activity.activityType === "SUMMERTIME_HYPERHALOGENATION")
      generated.add("Post-hyperhalogenation Legionella sample window");
  }
  return {
    satisfied,
    generated: [...generated],
    cleaningOnlyWarning: input.activities.some(
      (activity) =>
        activity.qualifiesForCleaning &&
        !activity.qualifiesForRoutineLegionella,
    ),
    explanation: satisfied.length
      ? `Recording completion on ${input.performedDate} can satisfy ${satisfied.length} open obligation${satisfied.length === 1 ? "" : "s"}. Final results are recalculated only after the visit is saved.`
      : `No currently open obligation is both covered by the selected activities and inside its legal window on ${input.performedDate}.`,
  };
}

export interface VisitOpportunity {
  start: string;
  end: string;
  controllingDeadline: string;
  obligations: VisitOpportunityObligation[];
  additionalObligationsCovered: number;
  explanation: string;
}

const SHAREABLE_SAMPLE_OBLIGATION_TYPES = new Set([
  "ROUTINE_OPERATING_SAMPLE",
  "STARTUP_SAMPLE",
  "POST_HYPERHALOGENATION_SAMPLE",
  "POST_DISINFECTION_RETEST",
]);

export function canShareSampleSatisfaction(
  left: VisitOpportunityObligation,
  right: VisitOpportunityObligation,
  today = todayDateOnly(),
) {
  if (left.category !== "SAMPLE" || right.category !== "SAMPLE") return false;
  if (
    !SHAREABLE_SAMPLE_OBLIGATION_TYPES.has(left.type) ||
    !SHAREABLE_SAMPLE_OBLIGATION_TYPES.has(right.type)
  )
    return false;
  if (
    [left.status, right.status].some((status) =>
      ["COMPLETED", "OVERDUE", "MISSED", "CANCELED", "SUPERSEDED"].includes(
        status,
      ),
    )
  )
    return false;
  if (
    !left.latest ||
    !right.latest ||
    left.latest < today ||
    right.latest < today
  )
    return false;
  const start = [left.earliest, right.earliest, today]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const end = [left.latest, right.latest].sort()[0];
  return Boolean(start && start <= end);
}

export function activityTypeForObligation(obligation: {
  type: string;
  category: ObligationCategory;
}): string | null {
  if (obligation.category === "INSPECTION") return "COMPLIANCE_INSPECTION";
  if (obligation.category === "MAINTENANCE")
    return obligation.type === "STARTUP_CLEANING_DISINFECTION"
      ? "STARTUP_CLEANING"
      : "ROUTINE_CLEANING";
  if (obligation.category === "SAMPLE") {
    if (obligation.type === "STARTUP_SAMPLE")
      return "STARTUP_LEGIONELLA_SAMPLE";
    if (obligation.type === "POST_HYPERHALOGENATION_SAMPLE")
      return "POST_HYPERHALOGENATION_SAMPLE";
    if (
      obligation.type === "EMERGENCY_SAMPLE" ||
      obligation.type === "BIOLOGICAL_INDICATOR_ESCALATION_SAMPLE"
    )
      return "EMERGENCY_SAMPLE";
    if (obligation.type.includes("RETEST")) return "CORRECTIVE_RETEST";
    return "ROUTINE_LEGIONELLA_SAMPLE";
  }
  if (obligation.type === "SUMMERTIME_HYPERHALOGENATION_DUE")
    return "SUMMERTIME_HYPERHALOGENATION";
  if (obligation.type === "LEVEL_4_FULL_REMEDIATION") return "FULL_REMEDIATION";
  if (obligation.type.includes("CORRECTIVE_ACTION"))
    return "CORRECTIVE_DISINFECTION";
  return null;
}

export function bestVisitOpportunity(
  obligations: VisitOpportunityObligation[],
  today = todayDateOnly(),
): VisitOpportunity | null {
  const candidates = obligations
    .filter(
      (item) =>
        isVisitEligibleObligation(item) &&
        !["COMPLETED", "OVERDUE", "MISSED", "CANCELED", "SUPERSEDED"].includes(
          item.status,
        ) &&
        item.priority !== "EMERGENCY" &&
        item.latest != null &&
        item.latest >= today,
    )
    .map((item) => ({
      item,
      start: [item.targetStart, item.earliest, today]
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) as string,
      end: item.latest as string,
    }))
    .filter((item) => item.start <= item.end);
  if (!candidates.length) return null;

  const opportunities = candidates.map((candidate) => {
    const overlapping = candidates
      .filter(
        (item) => item.start <= candidate.start && item.end >= candidate.start,
      )
      .sort((a, b) => a.end.localeCompare(b.end));
    const covered = [candidate];
    for (const item of overlapping) {
      if (item.item.id === candidate.item.id) continue;
      const itemActivity = activityTypeForObligation(item.item);
      if (
        itemActivity &&
        covered.every((selected) => {
          if (
            item.item.category === "SAMPLE" &&
            selected.item.category === "SAMPLE"
          )
            return canShareSampleSatisfaction(item.item, selected.item, today);
          const selectedActivity = activityTypeForObligation(selected.item);
          return (
            selectedActivity == null ||
            activitiesCanShareVisit(itemActivity, selectedActivity)
          );
        })
      )
        covered.push(item);
    }
    const start = covered
      .map((item) => item.start)
      .sort()
      .at(-1) as string;
    const end = covered.map((item) => item.end).sort()[0];
    return {
      start,
      end,
      obligations: covered.map((item) => item.item),
    };
  });
  const best = opportunities.sort(
    (a, b) =>
      b.obligations.length - a.obligations.length ||
      a.end.localeCompare(b.end) ||
      a.start.localeCompare(b.start),
  )[0];
  return {
    ...best,
    controllingDeadline: best.end,
    additionalObligationsCovered: Math.max(0, best.obligations.length - 1),
    explanation:
      best.obligations.length > 1
        ? `One visit from ${best.start} through ${best.end} can complete ${best.obligations.length} overlapping obligations. The earliest legal deadline controls the recommendation.`
        : `The best current service window is ${best.start} through ${best.end}. No other on-site obligation overlaps yet.`,
  };
}

export type ComplianceHealth = "GOOD" | "ATTENTION" | "AT_RISK" | "CRITICAL";

export function inactiveComplianceStatus(operatingStatus: string) {
  if (
    !["FULLY_SHUT_DOWN", "SEASONALLY_INACTIVE", "DECOMMISSIONED"].includes(
      operatingStatus,
    )
  )
    return null;
  return {
    health: "GOOD" as ComplianceHealth,
    label: "Inactive",
    color: "GRAY" as ComplianceColor,
    reason:
      "The tower is fully shut down, so routine operating clocks are paused. Historical events and reporting records remain available.",
    controllingObligationId: null,
  };
}

export function complianceBaselineReview(input: {
  isNyc: boolean;
  operatingStatus: string;
  hasSamplingAnchor: boolean;
}) {
  if (
    !input.isNyc ||
    input.hasSamplingAnchor ||
    ["FULLY_SHUT_DOWN", "SEASONALLY_INACTIVE", "DECOMMISSIONED"].includes(
      input.operatingStatus,
    )
  )
    return null;
  return {
    health: "ATTENTION" as ComplianceHealth,
    label: "Baseline required",
    color: "PURPLE" as ComplianceColor,
    reason:
      "Record startup or the last qualifying Legionella sample to establish the operating sampling clock. Cleaning alone does not establish it.",
    controllingObligationId: null,
  };
}

export function getComplianceStatus(
  obligations: VisitOpportunityObligation[],
  today = todayDateOnly(),
) {
  const evaluated = obligations.map((item) => ({
    item,
    urgency: getUrgency({
      today,
      status: item.status,
      priority: item.priority,
      latestDueDate: item.latest,
      targetStartDate: item.targetStart,
    }),
  }));
  const order: ComplianceUrgency[] = [
    "OVERDUE",
    "EMERGENCY",
    "CRITICAL",
    "WARNING",
    "DUE_SOON",
    "SCHEDULED",
    "OPEN",
    "COMPLETED",
  ];
  const controlling = evaluated.sort(
    (a, b) =>
      order.indexOf(a.urgency.urgency) - order.indexOf(b.urgency.urgency) ||
      calendarDaysRemaining(a.item.latest ?? "9999-12-31", today) -
        calendarDaysRemaining(b.item.latest ?? "9999-12-31", today),
  )[0];
  if (!controlling)
    return {
      health: "GOOD" as ComplianceHealth,
      label: "Good",
      color: "GREEN" as ComplianceColor,
      reason: "No compliance obligations are currently open.",
      controllingObligationId: null,
    };
  const health: ComplianceHealth = ["EMERGENCY", "OVERDUE"].includes(
    controlling.urgency.urgency,
  )
    ? "CRITICAL"
    : controlling.urgency.urgency === "CRITICAL"
      ? "AT_RISK"
      : ["WARNING", "DUE_SOON"].includes(controlling.urgency.urgency)
        ? "ATTENTION"
        : "GOOD";
  const display = {
    GOOD: { label: "Good", color: "GREEN" as const },
    ATTENTION: { label: "Attention", color: "YELLOW" as const },
    AT_RISK: { label: "At risk", color: "RED" as const },
    CRITICAL: { label: "Critical", color: "RED" as const },
  }[health];
  return {
    health,
    ...display,
    reason: `${controlling.urgency.label}: ${controlling.item.reason}`,
    controllingObligationId: controlling.item.id,
  };
}
