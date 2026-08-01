import {
  addDays,
  asUtc,
  formatLongDate,
  workingDaysRemaining,
} from "@/lib/date";
import { plainEnumLabel, requiredActionLabel } from "@/lib/labels";
import {
  responsibilityForObligation,
  responsibilityFamilyForObligation,
  serviceResponsibilityLabel,
  type ResponsibilityFilter,
  type ServiceResponsibility,
} from "@/lib/service-responsibility";

export type DeadlineCategory =
  "SAMPLE" | "INSPECTION" | "MAINTENANCE" | "REPORTING_ACTION";

export type DeadlineStatus =
  "Overdue" | "Due This Week" | "Due Next Week" | "Later" | "Review Required";
export type DeadlineExecutionState =
  "Unscheduled" | "Scheduled—still open" | "Waiting" | "Completed";

export const deadlinePeriodValues = [
  "ALL",
  "OVERDUE",
  "THIS_WEEK",
  "NEXT_WEEK",
  "LATER",
] as const;
export type DeadlinePeriod = (typeof deadlinePeriodValues)[number];

export const deadlineActionValues = [
  "ALL",
  "SAMPLE",
  "INSPECTION",
  "MAINTENANCE",
  "REPORTING_ACTION",
] as const;
export type DeadlineActionFilter = (typeof deadlineActionValues)[number];

export const deadlineScheduleValues = [
  "ALL",
  "SEASONAL",
  "YEAR_ROUND",
  "NOT_SET",
] as const;
export type DeadlineScheduleFilter = (typeof deadlineScheduleValues)[number];

export type OperatingSchedule = "SEASONAL" | "YEAR_ROUND" | null;

export type DeadlineObligationInput = {
  id: string;
  type: string;
  category: DeadlineCategory;
  earliest: string | null;
  targetStart: string | null;
  targetEnd: string | null;
  latest: string | null;
  priority: string;
  status: string;
  reason: string;
};

export type DeadlineTowerInput = {
  id: string;
  building: string;
  customer: string;
  systemName: string;
  address: string;
  tonnage: number | null;
  operatingSchedule: OperatingSchedule;
  ruleConfiguration: "NYC_AND_NYS" | "NYS_ONLY" | "CUSTOM";
  legionellaResponsibility: ServiceResponsibility | null;
  laboratoryResultResponsibility?: ServiceResponsibility | null;
  bacteriologicalResponsibility?: ServiceResponsibility | null;
  inspectionResponsibility?: ServiceResponsibility | null;
  cleaningResponsibility?: ServiceResponsibility | null;
  waterTreatmentResponsibility?: ServiceResponsibility | null;
  regulatoryReportingResponsibility?: ServiceResponsibility | null;
  certificationResponsibility?: ServiceResponsibility | null;
  openObligations: DeadlineObligationInput[];
};

export type TowerDeadlineRow = {
  id: string;
  towerId: string;
  building: string;
  customer: string;
  systemName: string;
  address: string;
  tonnage: number | null;
  tonnageDisplay: string;
  operatingSchedule: OperatingSchedule;
  operatingScheduleDisplay: string;
  ruleConfiguration: DeadlineTowerInput["ruleConfiguration"];
  responsibility: ServiceResponsibility | null;
  responsibilityLabel: string;
  category: DeadlineCategory;
  requiredAction: string;
  targetDate: string | null;
  targetDateDisplay: string;
  targetDateAccessible: string;
  targetWindowStart: string | null;
  targetWindowEnd: string | null;
  targetWindowDisplay: string;
  targetWindowAccessible: string;
  hardDueDate: string | null;
  hardDueDateDisplay: string;
  hardDueDateAccessible: string;
  workingDaysLeft: number | null;
  workingDaysDisplay: string;
  workingDaysAccessible: string;
  status: DeadlineStatus;
  statusColor: "RED" | "YELLOW" | "BLUE" | "GRAY" | "PURPLE";
  executionState: DeadlineExecutionState;
  executionStateColor: "BLUE" | "PURPLE" | "GREEN" | "GRAY";
  executionLane:
    | "Field work"
    | "Laboratory work"
    | "Office reporting"
    | "Customer/vendor follow-up";
  dependency: string | null;
  primaryActionLabel:
    | "Complete obligation"
    | "Enter result"
    | "Submit report"
    | "Review issue"
    | "View tower";
  primaryActionAccessible: string;
  primaryActionHref: string;
};

export function deadlinePeriodBounds(today: string) {
  const weekday = asUtc(today).getUTCDay();
  const daysUntilSunday = (7 - weekday) % 7;
  const thisWeekEnd = addDays(today, daysUntilSunday);
  const nextWeekStart = addDays(thisWeekEnd, 1);
  const nextWeekEnd = addDays(nextWeekStart, 6);
  return {
    thisWeekEnd,
    nextWeekStart,
    nextWeekEnd,
  };
}

export function deadlinePeriodForDate(
  dueDate: string | null,
  today: string,
): Exclude<DeadlinePeriod, "ALL"> {
  if (!dueDate) return "LATER";
  if (dueDate < today) return "OVERDUE";
  const bounds = deadlinePeriodBounds(today);
  if (dueDate <= bounds.thisWeekEnd) return "THIS_WEEK";
  if (dueDate <= bounds.nextWeekEnd) return "NEXT_WEEK";
  return "LATER";
}

export function filterTowerDeadlineRows(
  rows: TowerDeadlineRow[],
  today: string,
  filters: {
    period?: DeadlinePeriod;
    action?: DeadlineActionFilter;
    schedule?: DeadlineScheduleFilter;
    responsibility?: ResponsibilityFilter;
    search?: string;
  },
) {
  const period = filters.period ?? "ALL";
  const action = filters.action ?? "ALL";
  const schedule = filters.schedule ?? "ALL";
  const responsibility = filters.responsibility ?? "OUR_COMPANY";
  const search = filters.search?.trim().toLocaleLowerCase() ?? "";
  return rows.filter(
    (row) =>
      (period === "ALL" ||
        deadlinePeriodForDate(row.hardDueDate, today) === period) &&
      (action === "ALL" || row.category === action) &&
      (responsibility === "ALL" ||
        (responsibility === "UNCONFIRMED" && row.responsibility == null) ||
        row.responsibility === responsibility ||
        (responsibility === "OUR_COMPANY" && row.responsibility == null)) &&
      (schedule === "ALL" ||
        (schedule === "NOT_SET"
          ? row.operatingSchedule == null
          : row.operatingSchedule === schedule)) &&
      (!search ||
        [
          row.systemName,
          row.building,
          row.customer,
          row.address,
          row.requiredAction,
        ].some((value) => value.toLocaleLowerCase().includes(search))),
  );
}

export function formatCoolingTowerTonnage(tonnage: number | null) {
  if (tonnage == null || !Number.isFinite(tonnage) || tonnage <= 0)
    return "Tonnage not recorded";
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(tonnage)} tons`;
}

export function operatingScheduleLabel(schedule: OperatingSchedule) {
  if (schedule === "SEASONAL") return "Seasonal";
  if (schedule === "YEAR_ROUND") return "Year-round";
  return "Schedule not set";
}

function compactDate(value: string, currentYear: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(value.slice(0, 4) === currentYear ? {} : { year: "numeric" as const }),
    timeZone: "UTC",
  }).format(asUtc(value));
}

function compactRange(
  start: string | null,
  end: string | null,
  currentYear: string,
) {
  if (!start && !end) return "Review";
  if (!start || !end) return compactDate(start ?? end!, currentYear);
  if (start === end) return compactDate(start, currentYear);
  const startParts = start.split("-");
  const endParts = end.split("-");
  const sameMonth =
    startParts[0] === endParts[0] && startParts[1] === endParts[1];
  const startText = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(startParts[0] === currentYear ? {} : { year: "numeric" as const }),
    timeZone: "UTC",
  }).format(asUtc(start));
  if (sameMonth) return `${startText}–${Number(endParts[2])}`;
  const endText = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(endParts[0] === currentYear ? {} : { year: "numeric" as const }),
    timeZone: "UTC",
  }).format(asUtc(end));
  return `${startText}–${endText}`;
}

function fullRange(start: string | null, end: string | null) {
  if (!start && !end) return "No configured target window; review required";
  if (!start || !end) return formatLongDate(start ?? end);
  if (start === end) return formatLongDate(start);
  return `${formatLongDate(start)} through ${formatLongDate(end)}`;
}

function actionLabel(obligation: DeadlineObligationInput): string {
  if (obligation.type === "SUMMERTIME_HYPERHALOGENATION_DUE")
    return "Perform summertime hyperhalogenation";
  if (obligation.type === "HYPERHALOGENATION_DECLARATION")
    return "Submit hyperhalogenation declaration";
  if (obligation.type.includes("CORRECTIVE_ACTION"))
    return "Complete required Legionella corrective action";
  if (obligation.type.includes("NOTIFICATION"))
    return `Submit ${plainEnumLabel(obligation.type).toLowerCase()}`;
  if (obligation.type === "BIOLOGICAL_INDICATOR_RESIDUAL_MONITORING")
    return "Monitor disinfectant residual three times daily";
  if (obligation.type === "LEVEL_4_FULL_REMEDIATION")
    return "Complete full Legionella remediation";
  if (obligation.category === "SAMPLE")
    return requiredActionLabel(obligation.type);
  return requiredActionLabel(obligation.type);
}

function statusFor(
  obligation: DeadlineObligationInput,
  today: string,
): { label: DeadlineStatus; color: TowerDeadlineRow["statusColor"] } {
  if (
    obligation.status === "MISSED" ||
    obligation.status === "OVERDUE" ||
    (obligation.latest != null && obligation.latest < today)
  )
    return { label: "Overdue", color: "RED" };
  if (!obligation.latest) return { label: "Review Required", color: "PURPLE" };
  const period = deadlinePeriodForDate(obligation.latest, today);
  if (period === "THIS_WEEK")
    return { label: "Due This Week", color: "YELLOW" };
  if (period === "NEXT_WEEK") return { label: "Due Next Week", color: "BLUE" };
  return { label: "Later", color: "GRAY" };
}

function conciseWorkingDays(value: number | null) {
  if (value == null)
    return { display: "Review", accessible: "Working days require review" };
  if (value === 0)
    return {
      display: "Today",
      accessible: "Due today; zero working days left",
    };
  if (value > 0)
    return {
      display: `${value} day${value === 1 ? "" : "s"}`,
      accessible: `${value} working day${value === 1 ? "" : "s"} left`,
    };
  const overdue = Math.abs(value);
  return {
    display: `${overdue} overdue`,
    accessible: `${overdue} working day${overdue === 1 ? "" : "s"} overdue`,
  };
}

export function completionHrefForObligation(
  towerId: string,
  obligation: Pick<DeadlineObligationInput, "id" | "type" | "category">,
) {
  if (obligation.type === "ROUTINE_BACTERIOLOGICAL_SAMPLE")
    return `/systems/${towerId}?record=bacteriological#record-event`;
  const recordType =
    obligation.category === "SAMPLE"
      ? "sample"
      : obligation.category === "INSPECTION"
        ? "inspection"
        : obligation.type === "SUMMERTIME_HYPERHALOGENATION_DUE"
          ? "hyperhalogenation"
          : obligation.type === "STARTUP_CLEANING_DISINFECTION"
            ? "startup-cleaning"
            : obligation.type === "ANNUAL_CLEANING"
              ? "cleaning"
              : obligation.type === "LEVEL_4_FULL_REMEDIATION"
                ? "remediation"
                : obligation.type.includes("CORRECTIVE_ACTION")
                  ? "disinfection"
                  : obligation.type ===
                      "BIOLOGICAL_INDICATOR_RESIDUAL_MONITORING"
                    ? "biological"
                    : null;
  return recordType
    ? `/systems/${towerId}?record=${recordType}#record-event`
    : `/systems/${towerId}?view=obligations#reporting-${obligation.id}`;
}

export function executionStateFor(
  obligation: Pick<DeadlineObligationInput, "status">,
  responsibility: ServiceResponsibility | null,
): {
  label: DeadlineExecutionState;
  color: TowerDeadlineRow["executionStateColor"];
} {
  if (obligation.status === "COMPLETED")
    return { label: "Completed", color: "GREEN" };
  if (obligation.status === "SCHEDULED")
    return { label: "Scheduled—still open", color: "BLUE" };
  if (
    responsibility == null ||
    responsibility === "CUSTOMER" ||
    responsibility === "OTHER_VENDOR" ||
    responsibility === "NOT_TRACKED"
  )
    return { label: "Waiting", color: "PURPLE" };
  return { label: "Unscheduled", color: "GRAY" };
}

function executionDetails(
  obligation: Pick<DeadlineObligationInput, "type" | "category">,
  responsibility: ServiceResponsibility | null,
): Pick<TowerDeadlineRow, "executionLane" | "dependency"> {
  if (responsibility == null)
    return {
      executionLane: "Customer/vendor follow-up",
      dependency: "Waiting on responsibility review",
    };
  if (responsibility === "CUSTOMER")
    return {
      executionLane: "Customer/vendor follow-up",
      dependency: "Waiting on customer",
    };
  if (responsibility === "OTHER_VENDOR")
    return {
      executionLane: "Customer/vendor follow-up",
      dependency: "Waiting on vendor",
    };
  if (obligation.type.includes("LAB_RESULT"))
    return { executionLane: "Laboratory work", dependency: "Waiting on lab" };
  if (obligation.category === "REPORTING_ACTION")
    return { executionLane: "Office reporting", dependency: null };
  return { executionLane: "Field work", dependency: null };
}

function primaryAction(
  towerId: string,
  towerName: string,
  obligation: DeadlineObligationInput,
  requiredAction: string,
  status: DeadlineStatus,
  responsibility: ServiceResponsibility | null,
): Pick<
  TowerDeadlineRow,
  "primaryActionLabel" | "primaryActionAccessible" | "primaryActionHref"
> {
  if (responsibility == null)
    return {
      primaryActionLabel: "Review issue",
      primaryActionAccessible: `Confirm service responsibility for ${towerName}`,
      primaryActionHref: `/systems/${towerId}?view=obligations`,
    };
  if (
    obligation.category === "SAMPLE" &&
    (responsibility === "CUSTOMER" || responsibility === "OTHER_VENDOR")
  )
    return {
      primaryActionLabel: "Complete obligation",
      primaryActionAccessible: `Record externally completed ${requiredAction.toLowerCase()} for ${towerName}`,
      primaryActionHref: `/systems/${towerId}?record=external-legionella#record-event`,
    };
  if (responsibility === "NOT_TRACKED")
    return {
      primaryActionLabel: "View tower",
      primaryActionAccessible: `Review reference-only deadline for ${towerName}`,
      primaryActionHref: `/systems/${towerId}?view=obligations`,
    };
  if (obligation.type === "ROUTINE_BACTERIOLOGICAL_SAMPLE")
    return {
      primaryActionLabel: "Complete obligation",
      primaryActionAccessible: `Record owner-managed bacteriological sampling for ${towerName}`,
      primaryActionHref: completionHrefForObligation(towerId, obligation),
    };
  if (status === "Overdue")
    return {
      primaryActionLabel: "Review issue",
      primaryActionAccessible: `Open overdue ${requiredAction.toLowerCase()} for ${towerName}`,
      primaryActionHref: `/systems/${towerId}?view=obligations`,
    };
  if (!obligation.targetStart && !obligation.latest)
    return {
      primaryActionLabel: "Review issue",
      primaryActionAccessible: `Review ${requiredAction.toLowerCase()} for ${towerName}`,
      primaryActionHref: `/systems/${towerId}?view=obligations`,
    };
  return {
    primaryActionLabel:
      obligation.category === "REPORTING_ACTION" &&
      !obligation.type.includes("CORRECTIVE_ACTION") &&
      obligation.type !== "LEVEL_4_FULL_REMEDIATION" &&
      obligation.type !== "BIOLOGICAL_INDICATOR_RESIDUAL_MONITORING"
        ? "Submit report"
        : "Complete obligation",
    primaryActionAccessible: `Record ${requiredAction.toLowerCase()} for ${towerName}`,
    primaryActionHref: completionHrefForObligation(towerId, obligation),
  };
}

export function buildTowerDeadlineRows(
  towers: DeadlineTowerInput[],
  today: string,
): TowerDeadlineRow[] {
  const currentYear = today.slice(0, 4);
  const rows = towers.flatMap((tower) =>
    tower.openObligations.map((obligation) => {
      const status = statusFor(obligation, today);
      const workingDaysLeft = obligation.latest
        ? workingDaysRemaining(obligation.latest, today)
        : null;
      const days = conciseWorkingDays(workingDaysLeft);
      const targetWindowStart = obligation.targetStart ?? obligation.earliest;
      const targetWindowEnd = obligation.targetEnd ?? obligation.latest;
      const requiredAction = actionLabel(obligation);
      const responsibilityFamily = responsibilityFamilyForObligation(
        obligation.type,
        obligation.category,
      );
      const configuredResponsibility = tower[responsibilityFamily];
      const responsibility =
        configuredResponsibility === undefined
          ? responsibilityForObligation(
              obligation.type,
              tower.legionellaResponsibility,
            )
          : configuredResponsibility;
      const action = primaryAction(
        tower.id,
        tower.systemName,
        obligation,
        requiredAction,
        status.label,
        responsibility,
      );
      const executionState = executionStateFor(obligation, responsibility);
      const execution = executionDetails(obligation, responsibility);
      return {
        id: obligation.id,
        towerId: tower.id,
        building: tower.building,
        customer: tower.customer,
        systemName: tower.systemName,
        address: tower.address,
        tonnage: tower.tonnage,
        tonnageDisplay: formatCoolingTowerTonnage(tower.tonnage),
        operatingSchedule: tower.operatingSchedule,
        operatingScheduleDisplay: operatingScheduleLabel(
          tower.operatingSchedule,
        ),
        ruleConfiguration: tower.ruleConfiguration,
        responsibility,
        responsibilityLabel: serviceResponsibilityLabel(responsibility),
        category: obligation.category,
        requiredAction,
        targetDate: obligation.targetStart,
        targetDateDisplay: obligation.targetStart
          ? compactDate(obligation.targetStart, currentYear)
          : "—",
        targetDateAccessible: obligation.targetStart
          ? formatLongDate(obligation.targetStart)
          : "No separate operational target date",
        targetWindowStart,
        targetWindowEnd,
        targetWindowDisplay: compactRange(
          targetWindowStart,
          targetWindowEnd,
          currentYear,
        ),
        targetWindowAccessible: fullRange(targetWindowStart, targetWindowEnd),
        hardDueDate: obligation.latest,
        hardDueDateDisplay: obligation.latest
          ? compactDate(obligation.latest, currentYear)
          : "Review",
        hardDueDateAccessible: obligation.latest
          ? formatLongDate(obligation.latest)
          : "No fixed hard due date; review required",
        workingDaysLeft,
        workingDaysDisplay: days.display,
        workingDaysAccessible: days.accessible,
        status: status.label,
        statusColor: status.color,
        executionState: executionState.label,
        executionStateColor: executionState.color,
        ...execution,
        ...action,
      } satisfies TowerDeadlineRow;
    }),
  );
  return rows.sort((a, b) => {
    const overdueOrder =
      Number(a.status !== "Overdue") - Number(b.status !== "Overdue");
    if (overdueOrder) return overdueOrder;
    const aMissingTarget = a.targetDate == null;
    const bMissingTarget = b.targetDate == null;
    if (aMissingTarget !== bMissingTarget) return aMissingTarget ? 1 : -1;
    return (
      (a.targetDate ?? a.hardDueDate ?? "9999-12-31").localeCompare(
        b.targetDate ?? b.hardDueDate ?? "9999-12-31",
      ) ||
      (a.hardDueDate ?? "9999-12-31").localeCompare(
        b.hardDueDate ?? "9999-12-31",
      ) ||
      (a.workingDaysLeft ?? Number.MAX_SAFE_INTEGER) -
        (b.workingDaysLeft ?? Number.MAX_SAFE_INTEGER) ||
      a.systemName.localeCompare(b.systemName)
    );
  });
}
