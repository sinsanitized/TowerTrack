import {
  addDays,
  asUtc,
  formatLongDate,
  formatWorkingDaysLeft,
  workingDaysRemaining,
} from "@/lib/date";
import {
  lowercaseWithJurisdictionAcronyms,
  plainEnumLabel,
  requiredActionLabel,
} from "@/lib/labels";
import {
  responsibilityForObligation,
  responsibilityFamilyForObligation,
  serviceResponsibilityLabel,
  type ResponsibilityFilter,
  type ServiceResponsibility,
} from "@/lib/service-responsibility";
import type {
  LegionellaSampleReportingStatus,
  PreviousLegionellaSummary,
} from "@/lib/legionella-summary";
import {
  eventEntryHref,
  isResampleObligation,
  type EventEntryIntentName,
} from "@/lib/event-entry-intent";

export type DeadlineCategory =
  "SAMPLE" | "INSPECTION" | "MAINTENANCE" | "REPORTING_ACTION";

export type DeadlineStatus =
  | "Overdue"
  | "Due this week"
  | "Due next week"
  | "Due later"
  | "Review required";
export type DeadlineExecutionState =
  "Completion not recorded" | "Waiting" | "Completed";

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
  previousLegionella: PreviousLegionellaSummary;
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
  previousLegionellaSampleDate: string | null;
  previousLegionellaSampleDisplay: string;
  previousLegionellaSampleAccessible: string;
  portalReportingStatus: LegionellaSampleReportingStatus;
  portalSubmittedDate: string | null;
  portalDisplay: string;
  portalAccessible: string;
  targetStartDate: string | null;
  targetEndDate: string | null;
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
  primaryActionLabel: string;
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

function previousSampleDateDisplay(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(asUtc(value));
}

function portalPresentation(summary: PreviousLegionellaSummary) {
  if (summary.portalReportingStatus === "NOT_APPLICABLE")
    return {
      display: "Not applicable",
      accessible: "NYC portal reporting does not apply to this cooling tower.",
    };
  if (summary.portalReportingStatus === "SUBMITTED")
    return {
      display: previousSampleDateDisplay(summary.portalSubmittedDate!),
      accessible: `Previous Legionella sample was submitted to the NYC portal on ${formatLongDate(summary.portalSubmittedDate)}.`,
    };
  if (summary.portalReportingStatus === "NOT_SUBMITTED")
    return {
      display: "Not submitted",
      accessible:
        "Previous Legionella sample has not been submitted to the NYC portal.",
    };
  if (summary.portalReportingStatus === "SUBMISSION_DATE_MISSING")
    return {
      display: "Submission date missing",
      accessible:
        "Previous Legionella sample is marked submitted, but its NYC portal submission date is missing.",
    };
  return { display: "Review", accessible: summary.explanation };
}

function actionLabel(obligation: DeadlineObligationInput): string {
  if (obligation.type === "SUMMERTIME_HYPERHALOGENATION_DUE")
    return "Perform summertime hyperhalogenation";
  if (obligation.type === "HYPERHALOGENATION_DECLARATION")
    return "Submit hyperhalogenation declaration";
  if (obligation.type.includes("CORRECTIVE_ACTION"))
    return "Complete required Legionella corrective action";
  if (obligation.type.includes("NOTIFICATION"))
    return `Submit ${lowercaseWithJurisdictionAcronyms(plainEnumLabel(obligation.type))}`;
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
  if (!obligation.latest) return { label: "Review required", color: "PURPLE" };
  const period = deadlinePeriodForDate(obligation.latest, today);
  if (period === "THIS_WEEK")
    return { label: "Due this week", color: "YELLOW" };
  if (period === "NEXT_WEEK") return { label: "Due next week", color: "BLUE" };
  return { label: "Due later", color: "GRAY" };
}

function targetWindowPresentation(
  start: string | null,
  end: string | null,
  currentYear: string,
) {
  if (start && end && start !== end)
    return {
      display: `${compactDate(start, currentYear)} – ${compactDate(end, currentYear)}`,
      accessible: `Recommended service window from ${formatLongDate(start)} through ${formatLongDate(end)}`,
    };
  if (start || end) {
    const date = start ?? end!;
    return {
      display: compactDate(date, currentYear),
      accessible: `Recommended service date ${formatLongDate(date)}`,
    };
  }
  return {
    display: "Not set",
    accessible: "No separate recommended service window",
  };
}

export function completionHrefForObligation(
  towerId: string,
  obligation: Pick<DeadlineObligationInput, "id" | "type" | "category">,
) {
  if (obligation.type === "ROUTINE_BACTERIOLOGICAL_SAMPLE")
    return eventEntryHref({
      type: "bacteriological",
      towerId,
      obligationId: obligation.id,
    });
  const recordType: EventEntryIntentName | null =
    obligation.category === "SAMPLE"
      ? isResampleObligation(obligation.type)
        ? "resample"
        : "sample"
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
    ? eventEntryHref({ type: recordType, towerId, obligationId: obligation.id })
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
  if (
    responsibility == null ||
    responsibility === "CUSTOMER" ||
    responsibility === "OTHER_VENDOR" ||
    responsibility === "NOT_TRACKED"
  )
    return { label: "Waiting", color: "PURPLE" };
  return { label: "Completion not recorded", color: "GRAY" };
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
    return {
      executionLane: "Laboratory work",
      dependency: "Waiting on laboratory",
    };
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
      primaryActionLabel: "Assign owner",
      primaryActionAccessible: `Assign service responsibility for ${towerName}`,
      primaryActionHref: `/systems/${towerId}/edit?focus=${responsibilityFamilyForObligation(obligation.type, obligation.category)}#service-responsibilities`,
    };
  if (obligation.category === "SAMPLE" && responsibility === "OTHER_VENDOR")
    return {
      primaryActionLabel: "Record sample",
      primaryActionAccessible: `Record externally completed ${lowercaseWithJurisdictionAcronyms(requiredAction)} for ${towerName}`,
      primaryActionHref: eventEntryHref({
        type: "external-legionella",
        towerId,
        obligationId: obligation.id,
      }),
    };
  if (obligation.category === "SAMPLE" && responsibility === "CUSTOMER")
    return {
      primaryActionLabel: "View details",
      primaryActionAccessible: `View customer-managed responsibility for ${towerName}`,
      primaryActionHref: `/systems/${towerId}?view=information`,
    };
  if (responsibility === "NOT_TRACKED")
    return {
      primaryActionLabel: "View details",
      primaryActionAccessible: `Review reference-only deadline for ${towerName}`,
      primaryActionHref: `/systems/${towerId}?view=obligations`,
    };
  if (obligation.type === "ROUTINE_BACTERIOLOGICAL_SAMPLE")
    return {
      primaryActionLabel: "Record sample",
      primaryActionAccessible: `Record owner-managed bacteriological sampling for ${towerName}`,
      primaryActionHref: completionHrefForObligation(towerId, obligation),
    };
  if (status === "Overdue")
    return {
      primaryActionLabel: "Review issue",
      primaryActionAccessible: `Open overdue ${lowercaseWithJurisdictionAcronyms(requiredAction)} for ${towerName}`,
      primaryActionHref: `/systems/${towerId}?view=obligations`,
    };
  if (!obligation.targetStart && !obligation.latest)
    return {
      primaryActionLabel: "Review details",
      primaryActionAccessible: `Review ${lowercaseWithJurisdictionAcronyms(requiredAction)} for ${towerName}`,
      primaryActionHref: `/systems/${towerId}?view=obligations`,
    };
  return {
    primaryActionLabel:
      obligation.category === "SAMPLE"
        ? isResampleObligation(obligation.type)
          ? "Record resample"
          : "Record sample"
        : obligation.category === "INSPECTION"
          ? "Record inspection"
          : obligation.category === "REPORTING_ACTION"
            ? "Record submission"
            : obligation.type.includes("CLEANING")
              ? "Record cleaning"
              : "Record completion",
    primaryActionAccessible: `Record ${lowercaseWithJurisdictionAcronyms(requiredAction)} for ${towerName}`,
    primaryActionHref: completionHrefForObligation(towerId, obligation),
  };
}

export function buildTowerDeadlineRows(
  towers: DeadlineTowerInput[],
  today: string,
): TowerDeadlineRow[] {
  const currentYear = today.slice(0, 4);
  const rows = towers.flatMap((tower) =>
    tower.openObligations.flatMap<TowerDeadlineRow>((obligation) => {
      const status = statusFor(obligation, today);
      const workingDaysLeft = obligation.latest
        ? workingDaysRemaining(obligation.latest, today)
        : null;
      const workingDaysText = obligation.latest
        ? formatWorkingDaysLeft(obligation.latest, today)
        : "Needs review";
      const targetWindow = targetWindowPresentation(
        obligation.targetStart,
        obligation.targetEnd,
        currentYear,
      );
      const requiredAction = actionLabel(obligation);
      const portal = portalPresentation(tower.previousLegionella);
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
      if (obligation.category === "SAMPLE" && responsibility === "CUSTOMER")
        return [];
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
        previousLegionellaSampleDate:
          tower.previousLegionella.sampleCollectedDate,
        previousLegionellaSampleDisplay: tower.previousLegionella
          .sampleCollectedDate
          ? previousSampleDateDisplay(
              tower.previousLegionella.sampleCollectedDate,
            )
          : tower.previousLegionella.explanation.startsWith("Multiple")
            ? "Review required"
            : "None recorded",
        previousLegionellaSampleAccessible: tower.previousLegionella
          .sampleCollectedDate
          ? `Previous qualifying Legionella sample was collected on ${formatLongDate(tower.previousLegionella.sampleCollectedDate)}.`
          : tower.previousLegionella.explanation,
        portalReportingStatus: tower.previousLegionella.portalReportingStatus,
        portalSubmittedDate: tower.previousLegionella.portalSubmittedDate,
        portalDisplay: portal.display,
        portalAccessible: portal.accessible,
        targetStartDate: obligation.targetStart,
        targetEndDate: obligation.targetEnd,
        targetWindowDisplay: targetWindow.display,
        targetWindowAccessible: targetWindow.accessible,
        hardDueDate: obligation.latest,
        hardDueDateDisplay: obligation.latest
          ? compactDate(obligation.latest, currentYear)
          : "Review",
        hardDueDateAccessible: obligation.latest
          ? formatLongDate(obligation.latest)
          : "No fixed compliance deadline; review required",
        workingDaysLeft,
        workingDaysDisplay: workingDaysText,
        workingDaysAccessible:
          workingDaysText === "Needs review"
            ? "Working days require review"
            : workingDaysText,
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
    return (
      (a.hardDueDate ?? "9999-12-31").localeCompare(
        b.hardDueDate ?? "9999-12-31",
      ) ||
      (a.workingDaysLeft ?? Number.MAX_SAFE_INTEGER) -
        (b.workingDaysLeft ?? Number.MAX_SAFE_INTEGER) ||
      a.systemName.localeCompare(b.systemName)
    );
  });
}
