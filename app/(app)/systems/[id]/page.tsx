import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { EventRecorderDrawer } from "@/components/event-recorder-drawer";
import { NextActionCallout } from "@/components/next-action-callout";
import { TowerActionList } from "@/components/tower-action-list";
import { ComplianceDate, ComplianceWindow } from "@/components/compliance-date";
import { ObligationIntelligenceCard } from "@/components/obligation-intelligence-card";
import { ComplianceTimeline } from "@/components/compliance-timeline";
import { OperationPatternForm } from "@/components/operation-pattern-form";
import { CleaningPlanForm } from "@/components/cleaning-plan-form";
import { MonthlyTargetWindowForm } from "@/components/monthly-target-window-form";
import {
  recordServiceEventAction,
  voidServiceEventAction,
} from "@/app/actions";
import { complianceDashboardRows } from "@/lib/queries";
import { db } from "@/lib/db";
import {
  formatDate,
  addDays,
  dateOnly,
  isWorkingDay,
  nextWorkingDate,
  todayDateOnly,
  workingDaysRemaining,
} from "@/lib/date";
import {
  formatLegionellaResult,
  plainEnumLabel,
  requiredActionLabel,
} from "@/lib/labels";
import { seasonLabel, seasonalStatus } from "@/lib/season";
import { requireUser } from "@/lib/auth";
import {
  compileTowerRuleConfig,
  composeTowerRuleProfiles,
} from "@/lib/rule-profile";
import {
  canViewTowerSettings,
  resolveTowerDetailView,
  selectNextTowerActions,
  selectOverviewObligations,
  sortTowerObligations,
} from "@/lib/tower-details";
import { towerRuleConfigurationLabel } from "@/lib/tower-rule-configuration";
import { buttonClass } from "@/lib/button-variants";
import { completionHrefForObligation } from "@/lib/deadline-view";
import { SubmitButton } from "@/components/submit-button";
import {
  responsibilityFamilyForObligation,
  responsibilityForServiceObligation,
  serviceResponsibilityFamilies,
  serviceResponsibilityLabel,
} from "@/lib/service-responsibility";
import {
  eventEntryHref,
  eventTypeForEntryIntent,
  isResampleObligation,
  parseEventEntryIntent,
} from "@/lib/event-entry-intent";

export default async function SystemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const entryIntent = parseEventEntryIntent(id, query);
  const returnTo =
    typeof query.returnTo === "string" &&
    query.returnTo.startsWith("/") &&
    !query.returnTo.startsWith("//")
      ? query.returnTo
      : undefined;
  const user = await requireUser();
  const canViewSettings = canViewTowerSettings(user.role);
  const canConfirmOwnerManaged = ["ADMIN", "OPERATIONS_MANAGER"].includes(
    user.role,
  );
  const recordedEventId =
    typeof query.event === "string" ? query.event : undefined;
  const requestedView =
    typeof query.view === "string"
      ? query.view
      : recordedEventId || query.correctedEvent || query.voidedEvent
        ? "obligations"
        : "overview";
  const view = resolveTowerDetailView(requestedView, user.role);
  const requestedSampleEventId =
    entryIntent?.sampleEventId ??
    (typeof query.labSample === "string" ? query.labSample : undefined);
  const externalLegionellaRequested =
    entryIntent?.type === "external-legionella";
  const initialEventType = entryIntent
    ? entryIntent.type === "result"
      ? ("LEGIONELLA_RESULT_RECEIVED" as const)
      : eventTypeForEntryIntent(entryIntent.type)
    : undefined;
  const roleAllowedInitialEventType =
    initialEventType === "BACTERIOLOGICAL_SAMPLE_COLLECTED" &&
    !canConfirmOwnerManaged
      ? undefined
      : initialEventType;
  const [
    system,
    dashboardRow,
    recordedEvent,
    technicians,
    profileAudit,
    availableRuleProfiles,
  ] = await Promise.all([
    db.coolingTowerSystem.findFirst({
      where: {
        id,
        building: { customer: { organizationId: user.organizationId } },
      },
      include: {
        building: { include: { customer: true } },
        jurisdiction: true,
        ruleProfile: { include: { rules: true } },
        pendingRegulation: true,
        activities: {
          orderBy: { scheduledDate: "desc" },
          take: 25,
          include: { visit: true },
        },
        serviceEvents: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            eventType: true,
            eventDate: true,
            createdAt: true,
            details: true,
            performedByResponsibility: true,
            externalProviderName: true,
            externalSource: true,
            correctedFromEventId: true,
            labResultsForSample: { select: { id: true }, take: 1 },
          },
        },
        sampleObligations: {
          where: {
            status: { in: ["PENDING", "SCHEDULED", "OVERDUE", "MISSED"] },
          },
          orderBy: [{ latestDueDate: "asc" }, { createdAt: "asc" }],
          include: {
            triggerEvent: {
              select: { id: true, eventType: true, eventDate: true },
            },
          },
        },
        inspectionObligations: {
          where: {
            status: { in: ["PENDING", "SCHEDULED", "OVERDUE", "MISSED"] },
          },
          orderBy: [{ latestDueDate: "asc" }, { createdAt: "asc" }],
          include: {
            triggerEvent: {
              select: { id: true, eventType: true, eventDate: true },
            },
          },
        },
        reportingObligations: {
          where: {
            status: { in: ["PENDING", "SCHEDULED", "OVERDUE", "MISSED"] },
          },
          orderBy: [{ latestDueDate: "asc" }, { createdAt: "asc" }],
          include: {
            triggerEvent: {
              select: { id: true, eventType: true, eventDate: true },
            },
          },
        },
        maintenanceObligations: {
          where: {
            status: { in: ["PENDING", "SCHEDULED", "OVERDUE", "MISSED"] },
          },
          orderBy: [{ latestDueDate: "asc" }, { createdAt: "asc" }],
          include: {
            triggerEvent: {
              select: { id: true, eventType: true, eventDate: true },
            },
          },
        },
        labResults: {
          orderBy: [{ receivedDate: "desc" }, { createdAt: "desc" }],
          take: 10,
          include: {
            sampleEvent: { select: { eventDate: true } },
          },
        },
        complianceStatus: true,
      },
    }),
    complianceDashboardRows({
      organizationId: user.organizationId,
      systemId: id,
    }).then((r) => r.find((x) => x.id === id)),
    recordedEventId
      ? db.serviceEvent.findFirst({
          where: {
            id: recordedEventId,
            coolingTowerSystem: {
              id,
              building: { customer: { organizationId: user.organizationId } },
            },
          },
        })
      : Promise.resolve(null),
    ["ADMIN", "OPERATIONS_MANAGER", "SCHEDULER"].includes(user.role)
      ? db.user.findMany({
          where: {
            organizationId: user.organizationId,
            role: "TECHNICIAN",
            active: true,
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    db.auditLog.findFirst({
      where: {
        entityType: "CoolingTowerSystem",
        entityId: id,
        action: { in: ["CREATED", "UPDATED"] },
      },
      orderBy: { changedAt: "desc" },
      include: { changedBy: { select: { name: true } } },
    }),
    db.ruleProfile.findMany({
      where: {
        active: true,
        OR: [
          {
            jurisdictionMode: {
              in: ["NYC_CHAPTER_8_2026_PLUS_NYS_PART_4", "NYS_PART_4_ONLY"],
            },
          },
          { organizationId: user.organizationId },
        ],
      },
      include: { rules: true },
    }),
  ]);
  if (!system || !dashboardRow) notFound();
  const selectedSampleObligation = entryIntent?.obligationId
    ? system.sampleObligations.find(
        (item) => item.id === entryIntent.obligationId,
      )
    : undefined;
  const selectedInspectionObligation = entryIntent?.obligationId
    ? system.inspectionObligations.find(
        (item) => item.id === entryIntent.obligationId,
      )
    : undefined;
  const selectedMaintenanceObligation = entryIntent?.obligationId
    ? system.maintenanceObligations.find(
        (item) => item.id === entryIntent.obligationId,
      )
    : undefined;
  const selectedReportingObligation = entryIntent?.obligationId
    ? system.reportingObligations.find(
        (item) => item.id === entryIntent.obligationId,
      )
    : undefined;
  const selectedObligation =
    selectedSampleObligation ??
    selectedInspectionObligation ??
    selectedMaintenanceObligation ??
    selectedReportingObligation;
  const selectedObligationType = selectedSampleObligation
    ? selectedSampleObligation.obligationType
    : selectedInspectionObligation
      ? "QUARTERLY_COMPLIANCE_INSPECTION"
      : selectedMaintenanceObligation
        ? selectedMaintenanceObligation.obligationType
        : selectedReportingObligation?.obligationType;
  const invalidIntentContext = Boolean(
    entryIntent?.obligationId && !selectedObligation,
  );
  const resampleContextMismatch = Boolean(
    entryIntent?.type === "resample" &&
    selectedSampleObligation &&
    !isResampleObligation(selectedSampleObligation.obligationType),
  );
  const allowedInitialEventType =
    invalidIntentContext ||
    resampleContextMismatch ||
    (roleAllowedInitialEventType === "BACTERIOLOGICAL_SAMPLE_COLLECTED" &&
      system.bacteriologicalResponsibility === "CUSTOMER")
      ? undefined
      : externalLegionellaRequested &&
          canConfirmOwnerManaged &&
          system.legionellaResponsibility === "OTHER_VENDOR"
        ? roleAllowedInitialEventType
        : roleAllowedInitialEventType ===
              "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED" &&
            system.legionellaResponsibility !== "OUR_COMPANY"
          ? undefined
          : roleAllowedInitialEventType;
  const selectedTriggerEvent = selectedObligation?.triggerEvent;
  const selectedTriggerRecord = selectedTriggerEvent
    ? system.serviceEvents.find((event) => event.id === selectedTriggerEvent.id)
    : undefined;
  const selectedTriggerDetails = selectedTriggerRecord?.details as {
    sampleEventId?: unknown;
  } | null;
  const triggeringSampleId =
    typeof selectedTriggerDetails?.sampleEventId === "string"
      ? selectedTriggerDetails.sampleEventId
      : selectedTriggerEvent?.eventType ===
          "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED"
        ? selectedTriggerEvent.id
        : undefined;
  const activeCleaningPlan = system.activities.find((activity) => {
    const details = activity.details as { planType?: unknown } | null;
    return (
      activity.activityType === "ROUTINE_CLEANING" &&
      activity.status === "PLANNED" &&
      ["PLANNED", "CONFIRMED", "IN_PROGRESS"].includes(activity.visit.status) &&
      details?.planType === "TWO_DAY_ANNUAL_CLEANING"
    );
  });
  const cleaningPlanDetails = activeCleaningPlan?.details as {
    chemicalAddDate?: string;
    cleaningDate?: string;
  } | null;
  const cleaningObligation = dashboardRow.openObligations.find(
    (item) => item.type === "ANNUAL_CLEANING",
  );
  let cleaningPlanEarliest = [todayDateOnly(), cleaningObligation?.earliest]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)!;
  while (!isWorkingDay(cleaningPlanEarliest))
    cleaningPlanEarliest = addDays(cleaningPlanEarliest, 1);
  const latestMonthlySample = system.serviceEvents
    .filter(
      (event) =>
        event.status === "ACTIVE" &&
        event.eventType === "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
    )
    .map((event) => event.eventDate)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const samplesAwaitingResults = system.serviceEvents
    .filter(
      (event) =>
        event.status === "ACTIVE" &&
        event.eventType === "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED" &&
        event.labResultsForSample.length === 0,
    )
    .map((event) => ({ id: event.id, date: dateOnly(event.eventDate) }));
  const samplesAwaitingResultIds = new Set(
    samplesAwaitingResults.map(({ id: sampleId }) => sampleId),
  );
  const recordedReportingObligationIds = new Set(
    system.serviceEvents
      .filter(
        (event) =>
          event.status === "ACTIVE" && event.eventType === "REPORT_SUBMITTED",
      )
      .map((event) => {
        const details = event.details as {
          reportingObligationId?: unknown;
        } | null;
        return typeof details?.reportingObligationId === "string"
          ? details.reportingObligationId
          : null;
      })
      .filter((value): value is string => Boolean(value)),
  );
  const initialSampleEventId =
    requestedSampleEventId &&
    samplesAwaitingResultIds.has(requestedSampleEventId)
      ? requestedSampleEventId
      : undefined;
  const invalidResultContext = Boolean(
    entryIntent?.type === "result" &&
    requestedSampleEventId &&
    !initialSampleEventId,
  );
  const latestQuarterlyInspection = system.serviceEvents
    .filter(
      (event) =>
        event.status === "ACTIVE" &&
        event.eventType === "QUARTERLY_INSPECTION_COMPLETED",
    )
    .map((event) => event.eventDate)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const generated = query.event
    ? {
        sample: Number(query.sample || 0),
        inspection: Number(query.inspection || 0),
        reporting: Number(query.reporting || 0),
        maintenance: Number(query.maintenance || 0),
      }
    : null;
  const satisfiedObligationTypes =
    typeof query.satisfied === "string" && query.satisfied
      ? query.satisfied.split(",").filter(Boolean)
      : [];
  const generatedObligations = recordedEventId
    ? [
        ...system.sampleObligations.map((item) => ({
          id: item.id,
          type: item.obligationType,
          triggerEventId: item.triggerEventId,
        })),
        ...system.inspectionObligations.map((item) => ({
          id: item.id,
          type: "QUARTERLY_COMPLIANCE_INSPECTION",
          triggerEventId: item.triggerEventId,
        })),
        ...system.reportingObligations.map((item) => ({
          id: item.id,
          type: item.obligationType,
          triggerEventId: item.triggerEventId,
        })),
        ...system.maintenanceObligations.map((item) => ({
          id: item.id,
          type: item.obligationType,
          triggerEventId: item.triggerEventId,
        })),
      ].filter((item) => item.triggerEventId === recordedEventId)
    : [];
  const newlyCreated = query.created === "1";
  const detailsUpdated = query.updated === "1";
  const responsibilitiesUpdated = query.responsibility === "1";
  const operationPatternUpdated = query.operationPattern === "1";
  const targetWindowUpdated = query.targetWindow === "1";
  const rulesUpdated = query.rulesChanged === "1";
  const today = todayDateOnly();
  const trackedOpenObligations = dashboardRow.openObligations.filter(
    (item) =>
      !(
        item.category === "SAMPLE" &&
        responsibilityForServiceObligation(item.type, item.category, system) ===
          "CUSTOMER"
      ),
  );
  const nextActionSelection = selectNextTowerActions(
    trackedOpenObligations,
    today,
  );
  const nextRequired = nextActionSelection.items[0];
  const nextActionItems = nextActionSelection.items.map((item) => {
    const deadlineReviewRequired =
      nextActionSelection.state === "REVIEW_REQUIRED";
    const responsibility = responsibilityForServiceObligation(
      item.type,
      item.category,
      system,
    );
    const actionLabel = deadlineReviewRequired
      ? "Review missing information"
      : responsibility == null
        ? "Assign responsibility"
        : responsibility === "CUSTOMER" || responsibility === "OTHER_VENDOR"
          ? item.category === "SAMPLE"
            ? isResampleObligation(item.type)
              ? "Record external resample"
              : "Record external sample"
            : "Review responsibility"
          : responsibility === "NOT_TRACKED"
            ? "Review requirement"
            : item.category === "REPORTING_ACTION"
              ? item.type.includes("CORRECTIVE_ACTION")
                ? "Record disinfection"
                : item.type === "LEVEL_4_FULL_REMEDIATION"
                  ? "Record remediation"
                  : item.type === "BIOLOGICAL_INDICATOR_RESIDUAL_MONITORING"
                    ? "Record result"
                    : "Record submission"
              : item.category === "SAMPLE"
                ? isResampleObligation(item.type)
                  ? "Record resample"
                  : "Record sample"
                : item.category === "INSPECTION"
                  ? "Record inspection"
                  : item.type.includes("CLEANING")
                    ? "Record cleaning"
                    : "Record completion";
    const actionHref = deadlineReviewRequired
      ? `/systems/${id}?view=obligations#obligations`
      : responsibility == null
        ? `/systems/${id}/edit?focus=${responsibilityFamilyForObligation(item.type, item.category)}#service-responsibilities`
        : (responsibility === "CUSTOMER" ||
              responsibility === "OTHER_VENDOR") &&
            item.category === "SAMPLE"
          ? eventEntryHref({
              type: "external-legionella",
              towerId: id,
              obligationId: item.id,
            })
          : responsibility === "OUR_COMPANY"
            ? completionHrefForObligation(id, item)
            : `/systems/${id}?view=obligations#obligations`;
    return {
      id: item.id,
      requiredAction: requiredActionLabel(item.type),
      hardDueDate: item.latest,
      workingDaysLeft: item.latest
        ? workingDaysRemaining(item.latest, today)
        : null,
      targetDate: item.targetStart,
      obligationReason: item.reason,
      actionLabel,
      actionHref,
    };
  });
  const warningCount = trackedOpenObligations.filter(
    (item) =>
      item.priority === "EMERGENCY" ||
      item.priority === "CRITICAL" ||
      item.priority === "WARNING" ||
      (item.latest != null && item.latest < today),
  ).length;
  const orderedOpenObligations = sortTowerObligations(
    trackedOpenObligations,
    today,
  );
  const overviewObligations = selectOverviewObligations(
    trackedOpenObligations,
    today,
  );
  const combinedObligationIds = new Set(
    dashboardRow.visitOpportunity?.obligations.map(
      ({ id: itemId }) => itemId,
    ) ?? [],
  );
  const mostRecentActiveEvent = system.serviceEvents.find(
    (event) => event.status === "ACTIVE",
  );
  const recentActiveEvents = system.serviceEvents
    .filter((event) => event.status === "ACTIVE")
    .sort(
      (a, b) =>
        dateOnly(b.eventDate).localeCompare(dateOnly(a.eventDate)) ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    )
    .slice(0, 3);
  const responsibilityExceptions = serviceResponsibilityFamilies.filter(
    ([key]) => system[key] !== "OUR_COMPANY",
  );
  const timelineItems = nextRequired
    ? [
        nextRequired.trigger
          ? {
              id: `source-${nextRequired.trigger.id}`,
              label: plainEnumLabel(nextRequired.trigger.type),
              detail: "This compliance record created the requirement.",
              date: nextRequired.trigger.date,
              state: "SOURCE" as const,
              href: `/systems/${id}/events/${nextRequired.trigger.id}`,
            }
          : null,
        {
          id: `window-${nextRequired.id}`,
          label: "Earliest valid date to collect this sample",
          detail: "Work may begin satisfying this requirement on this date.",
          date: nextRequired.earliest,
          state: "WINDOW" as const,
        },
        nextRequired.targetStart
          ? {
              id: `target-${nextRequired.id}`,
              label: "Preferred target begins",
              detail:
                "The recommended service window begins; this is not a separate compliance deadline.",
              date: nextRequired.targetStart,
              state: "TARGET" as const,
            }
          : null,
        {
          id: `deadline-${nextRequired.id}`,
          label: "Compliance deadline",
          detail:
            "Completion must be recorded by this date. Scheduling alone does not stop the clock.",
          date: nextRequired.latest,
          state: "DEADLINE" as const,
        },
      ].filter((item): item is NonNullable<typeof item> => item != null)
    : [];
  const composedRuleProfile = composeTowerRuleProfiles(
    system.ruleConfiguration,
    system.ruleConfiguration === "CUSTOM"
      ? [system.ruleProfile]
      : availableRuleProfiles,
    system.ruleProfileId,
  );
  const ruleConfig = compileTowerRuleConfig(composedRuleProfile, {
    operating: !["FULLY_SHUT_DOWN", "SEASONALLY_INACTIVE"].includes(
      system.operatingStatus,
    ),
    monthlyTargetStartDay: system.monthlyTargetStartDay,
    monthlyTargetEndDay: system.monthlyTargetEndDay,
  });
  const recordedPortalFollowUp =
    recordedEvent?.eventType === "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED"
      ? system.reportingObligations.find(
          (item) =>
            item.obligationType === "PORTAL_SAMPLE_DATE" &&
            item.triggerEventId === recordedEvent.id,
        )
      : null;
  return (
    <>
      <PageHeader
        eyebrow={system.building.customer.name}
        title={`${system.building.buildingName} — ${system.systemName}`}
        description={`${system.building.streetAddress}, ${system.building.city}, ${system.building.state} · ${system.internalJobNumber}`}
        actions={
          <>
            <Link
              className={buttonClass("secondary")}
              href={returnTo ?? "/towers"}
            >
              {returnTo?.startsWith("/samples")
                ? "Back to Samples"
                : returnTo?.startsWith("/deadlines")
                  ? "Back to Deadlines"
                  : "Back to Towers"}
            </Link>
            <EventRecorderDrawer
              key={
                recordedEventId ??
                (typeof query.correctedEvent === "string"
                  ? query.correctedEvent
                  : undefined) ??
                (typeof query.voidedEvent === "string"
                  ? query.voidedEvent
                  : undefined) ??
                (entryIntent
                  ? `${entryIntent.type}:${entryIntent.obligationId ?? entryIntent.sampleEventId ?? "new"}`
                  : undefined) ??
                "event-recorder"
              }
              systemId={id}
              defaultDate={today}
              ruleConfig={ruleConfig}
              samplesAwaitingResults={samplesAwaitingResults}
              initialSampleEventId={initialSampleEventId}
              initialEventType={allowedInitialEventType}
              initialOpen={Boolean(
                !invalidResultContext &&
                (allowedInitialEventType || initialSampleEventId),
              )}
              canConfirmOwnerManaged={canConfirmOwnerManaged}
              legionellaResponsibility={system.legionellaResponsibility}
              bacteriologicalResponsibility={
                system.bacteriologicalResponsibility
              }
              legionellaVendorName={system.legionellaVendorName}
              returnTo={returnTo}
              intentContext={
                selectedObligation
                  ? {
                      intentType: entryIntent?.type,
                      obligationId: selectedObligation.id,
                      obligationType: selectedObligationType!,
                      triggerEventId: selectedTriggerEvent?.id,
                      triggeringSampleId,
                      earliest: selectedObligation.earliestDueDate
                        ? dateOnly(selectedObligation.earliestDueDate)
                        : null,
                      targetStart: selectedObligation.targetStartDate
                        ? dateOnly(selectedObligation.targetStartDate)
                        : null,
                      targetEnd: selectedObligation.targetEndDate
                        ? dateOnly(selectedObligation.targetEndDate)
                        : null,
                      latest: selectedObligation.latestDueDate
                        ? dateOnly(selectedObligation.latestDueDate)
                        : null,
                    }
                  : undefined
              }
              openSampleObligations={system.sampleObligations.map((item) => ({
                id: item.id,
                type: item.obligationType,
                earliest: item.earliestDueDate
                  ? dateOnly(item.earliestDueDate)
                  : null,
                latest: item.latestDueDate
                  ? dateOnly(item.latestDueDate)
                  : null,
                status: item.status,
                sourceCitation: item.sourceCitation,
              }))}
            />
          </>
        }
      />
      {(invalidIntentContext ||
        resampleContextMismatch ||
        invalidResultContext) && (
        <div className="mb-5 rounded-xl border border-purple-300 bg-purple-50 p-4 text-purple-950">
          <div className="font-black">This action is no longer available</div>
          <p className="mt-1 text-sm">
            The referenced requirement was completed, removed, or does not match
            this workflow. Review the tower&apos;s current required work before
            recording work.
          </p>
        </div>
      )}
      {view === "obligations" &&
        system.legionellaResponsibility === "NOT_TRACKED" && (
          <div className="mb-5 rounded-xl border border-purple-300 bg-purple-50 p-4 font-bold text-purple-900">
            Legionella compliance is not tracked in TowerTrack for this tower.
            This does not mean no legal requirement applies.
          </div>
        )}
      {view === "obligations" && !system.legionellaResponsibility && (
        <div className="mb-5 rounded-xl border border-purple-300 bg-purple-50 p-4 font-bold text-purple-900">
          Legionella responsibility must be confirmed.
          {canViewSettings && (
            <Link className="ml-2 underline" href={`/systems/${id}/edit`}>
              Configure service responsibility
            </Link>
          )}
        </div>
      )}
      <nav
        className="panel mb-6 flex gap-1 overflow-x-auto p-2"
        aria-label="Tower workspace"
      >
        {[
          ["Overview", "overview"],
          ["Required work", "obligations"],
          ["Records", "history"],
          ["Tower Information", "information"],
          ...(canViewSettings ? [["Settings", "settings"]] : []),
        ].map(([label, tab]) => (
          <Link
            key={tab}
            className={`min-h-11 min-w-max rounded-lg px-4 py-3 text-sm font-black ${
              view === tab
                ? "bg-emerald-800 text-white"
                : "text-emerald-900 hover:bg-emerald-50"
            }`}
            href={`/systems/${id}?view=${tab}`}
            aria-current={view === tab ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="mb-6 border-l-4 border-emerald-700 pl-4">
        <h2 className="text-lg font-black">
          {view === "overview"
            ? "Tower overview"
            : view === "obligations"
              ? "Required work"
              : view === "history"
                ? "Compliance records"
                : view === "information"
                  ? "Tower information"
                  : "Tower settings"}
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          {view === "overview"
            ? "See what needs attention now, the next upcoming work, and the latest compliance dates."
            : view === "obligations"
              ? "Review unfinished work, dependencies, deadlines, and visit planning."
              : view === "history"
                ? "Review completed samples, results, inspections, cleaning, submissions, corrections, and audit history."
                : view === "information"
                  ? "Review the facility, equipment, identifiers, and service responsibilities."
                  : "Manage operating patterns, recommended service dates, jurisdiction, and compliance rules."}
        </p>
      </div>
      {generated && (
        <section className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
          <div className="label">Compliance dates recalculated</div>
          <h2 className="mt-1 font-black">Compliance updated</h2>
          <ul className="mt-3 grid gap-2 text-sm font-bold sm:grid-cols-2">
            <li>✓ Compliance record saved and history updated</li>
            <li>
              ✓ Compliance recalculated to {dashboardRow.complianceHealth.label}
            </li>
            {generatedObligations.map((item) => (
              <li key={item.id}>✓ {plainEnumLabel(item.type)} generated</li>
            ))}
            {satisfiedObligationTypes.map((type, index) => (
              <li key={`${type}-${index}`}>
                ✓ {plainEnumLabel(type)}{" "}
                {recordedEvent?.eventType ===
                "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED"
                  ? "completed by this collection"
                  : "already satisfied by an existing completion record"}
              </li>
            ))}
            {!generatedObligations.length &&
              !satisfiedObligationTypes.length && (
                <li>✓ No new requirement was created by this record</li>
              )}
            {recordedEvent &&
              ["CLEANING_COMPLETED", "STARTUP_CLEANING_DISINFECTION"].includes(
                recordedEvent.eventType,
              ) && (
                <li>
                  ✓ Cleaning is tracked separately; no Legionella sample clock
                  was reset
                </li>
              )}
            <li>
              ✓ Current projection: {generated.sample} sampling,{" "}
              {generated.inspection} inspection, {generated.maintenance}{" "}
              maintenance, {generated.reporting} reporting
            </li>
            {dashboardRow.visitOpportunity && (
              <li>
                ✓ Best future visit covers{" "}
                {dashboardRow.visitOpportunity.obligations.length} requirement
                {dashboardRow.visitOpportunity.obligations.length === 1
                  ? ""
                  : "s"}
              </li>
            )}
          </ul>
          {recordedEvent && (
            <div className="mt-3 border-t border-emerald-200 pt-3 text-sm">
              <span className="font-black">
                {plainEnumLabel(recordedEvent.eventType)}
              </span>{" "}
              · <ComplianceDate value={recordedEvent.eventDate} />
            </div>
          )}
          {recordedPortalFollowUp && (
            <div className="mt-4 rounded-lg border border-blue-300 bg-blue-50 p-4 text-blue-950">
              <div className="label">Required next step</div>
              <h3 className="mt-1 font-black">
                Submit this sample date to the NYC Health Department portal
              </h3>
              <p className="mt-1 text-sm">
                The Legionella sample is recorded, but its portal submission is
                a separate audited requirement.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <ComplianceDate
                  value={recordedPortalFollowUp.latestDueDate}
                  label="Portal deadline"
                  deadline
                  compact
                  operational
                />
                <Link
                  className="btn btn-primary"
                  href={`#reporting-${recordedPortalFollowUp.id}`}
                >
                  Record NYC portal submission
                </Link>
              </div>
            </div>
          )}
        </section>
      )}
      {newlyCreated && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950">
          Cooling tower created. Record the first verified real-world event to
          calculate its compliance requirements.
        </div>
      )}
      {detailsUpdated && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950">
          Customer, address, and tower equipment saved. Compliance requirements
          were recalculated from the compliance record history.
        </div>
      )}
      {responsibilitiesUpdated && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950">
          Service responsibilities saved. Action queues now reflect who handles
          each service.
        </div>
      )}
      {operationPatternUpdated && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950">
          Operating schedule saved. This planning change did not record a
          startup or shutdown event.
        </div>
      )}
      {targetWindowUpdated && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950">
          Recommended monthly sample dates saved. The compliance deadline was
          not changed.
        </div>
      )}
      {rulesUpdated && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950">
          Compliance rules saved. Open requirements and deadlines were
          recalculated from the tower&apos;s valid record history.
        </div>
      )}
      {typeof query.correctedEvent === "string" && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950">
          Compliance record corrected. The original record remains in audit
          history, and all compliance requirements were recalculated. Review
          “Next Action Required” below for any remaining work.
        </div>
      )}
      {query.voidedEvent === "1" && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-950">
          Compliance record marked invalid. It remains in audit history, and
          every dependent requirement was recalculated from the remaining valid
          records. Review “Next Action Required” below for any remaining work.
        </div>
      )}
      {view === "overview" && (
        <NextActionCallout
          selection={nextActionSelection}
          items={nextActionItems}
        />
      )}
      <section
        id="overview"
        className={`${view === "overview" ? "panel mb-6" : "hidden"} scroll-mt-6 p-5`}
      >
        <div className="label">What needs attention</div>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div
            className={`rounded-xl border p-4 ${
              dashboardRow.complianceHealth.color === "RED"
                ? "border-red-300 bg-red-50"
                : dashboardRow.complianceHealth.color === "YELLOW"
                  ? "border-amber-300 bg-amber-50"
                  : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <div className="label">Current compliance status</div>
            <div className="mt-2">
              <StatusBadge
                color={dashboardRow.complianceHealth.color}
                label={dashboardRow.complianceHealth.label}
              />
            </div>
            <p className="mt-2 text-sm font-bold text-slate-700">
              {dashboardRow.complianceHealth.reason}
            </p>
          </div>
          <div
            className={`rounded-xl border p-4 ${
              responsibilityExceptions.length
                ? "border-purple-300 bg-purple-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="label">Work and dependencies</div>
            <div className="mt-2 font-black">
              {dashboardRow.openCount} open requirement
              {dashboardRow.openCount === 1 ? "" : "s"} · {warningCount} urgent
            </div>
            <p className="mt-2 text-sm text-slate-700">
              {responsibilityExceptions.length
                ? `${responsibilityExceptions.length} service ${responsibilityExceptions.length === 1 ? "area needs" : "areas need"} external or responsibility review.`
                : "All configured service areas are our responsibility."}
            </p>
            <p className="mt-2 text-xs font-bold text-slate-600">
              {plainEnumLabel(system.operatingStatus)} ·{" "}
              {seasonalStatus(system)}
            </p>
          </div>
        </div>
      </section>
      {view === "overview" && (
        <section className="panel mb-6 p-5" aria-labelledby="next-actions">
          <div className="label">Daily work</div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="next-actions" className="mt-1 text-xl font-black">
                Next required actions
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                All urgent items are shown first, followed by the next three
                upcoming requirements.
              </p>
            </div>
            <Link className="btn" href={`/systems/${id}?view=obligations`}>
              View all requirements
            </Link>
          </div>
          <div className="mt-5">
            <TowerActionList
              systemId={id}
              today={today}
              items={overviewObligations}
              combinedObligationIds={combinedObligationIds}
              canConfirmOwnerManaged={canConfirmOwnerManaged}
              legionellaResponsibility={system.legionellaResponsibility}
              responsibilities={system}
            />
          </div>
        </section>
      )}
      <section
        className={view === "overview" ? "mb-6" : "hidden"}
        aria-labelledby="key-compliance-dates"
      >
        <div className="mb-3">
          <div className="label">Latest dates and recurring work</div>
          <h2 id="key-compliance-dates" className="mt-1 text-xl font-black">
            Compliance snapshot
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="panel p-4">
            <div className="label">Last monthly Legionella test</div>
            <div className="mt-3">
              <ComplianceDate
                value={latestMonthlySample}
                label="Last completed"
                operational
                empty="Not recorded"
              />
            </div>
            {dashboardRow.routineSample && (
              <div className="mt-3 border-t border-slate-200 pt-3">
                <ComplianceDate
                  value={dashboardRow.routineSample.latest}
                  label="Next deadline"
                  deadline
                  compact
                  operational
                />
              </div>
            )}
          </article>
          <article className="panel p-4">
            <div className="label">Quarterly inspection</div>
            <div className="mt-3">
              <ComplianceDate
                value={latestQuarterlyInspection}
                label="Last completed"
                operational
                empty="Not recorded"
              />
            </div>
            <div className="mt-3 border-t border-slate-200 pt-3">
              <ComplianceDate
                value={dashboardRow.nextInspection?.latest}
                label="Next deadline"
                deadline
                compact
                operational
                empty="Not generated yet"
              />
            </div>
          </article>
          <article className="panel p-4">
            <div className="label">Cleanings this year</div>
            {dashboardRow.cleaning.applicable ? (
              <>
                <div className="mt-2 text-2xl font-black">
                  {dashboardRow.cleaning.completed} of{" "}
                  {dashboardRow.cleaning.required}
                </div>
                <p className="mt-1 text-sm font-bold text-slate-600">
                  {dashboardRow.cleaning.remaining === 0
                    ? "Annual requirement met"
                    : `${dashboardRow.cleaning.remaining} still required in ${dashboardRow.cleaning.year}`}
                </p>
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <ComplianceDate
                    value={dashboardRow.cleaning.lastCompletedDate}
                    label="Last cleaning"
                    operational
                    empty="Not recorded"
                  />
                </div>
              </>
            ) : (
              <div className="mt-2 font-black">Not configured</div>
            )}
          </article>
          <article className="panel p-4">
            <div className="label">Summertime hyperhalogenation</div>
            {!dashboardRow.summertimeHyperhalogenation.applicable ? (
              <div className="mt-2 font-black">Not configured</div>
            ) : dashboardRow.summertimeHyperhalogenation.completedDate ? (
              <div className="mt-3">
                <ComplianceDate
                  value={dashboardRow.summertimeHyperhalogenation.completedDate}
                  label={`${dashboardRow.cleaning.year} completed`}
                  operational
                />
              </div>
            ) : dashboardRow.summertimeHyperhalogenation.due ? (
              <div className="mt-3 space-y-3">
                <ComplianceWindow
                  start={
                    dashboardRow.summertimeHyperhalogenation.due.targetStart
                  }
                  end={dashboardRow.summertimeHyperhalogenation.due.targetEnd}
                  label="Dates to complete the annual summertime hyperhalogenation"
                  compact
                  operational
                />
                <ComplianceDate
                  value={dashboardRow.summertimeHyperhalogenation.due.latest}
                  label="Deadline"
                  deadline
                  compact
                  operational
                />
                <p className="text-xs font-bold text-slate-600">
                  Completion creates a post-hyperhalogenation Legionella sample
                  window.
                </p>
              </div>
            ) : (
              <div className="mt-2 font-black">
                No open summertime requirement
              </div>
            )}
          </article>
        </div>
      </section>
      {system.labResults.length > 0 && (
        <section
          id="samples"
          className={`${view === "history" ? "panel mb-6" : "hidden"} scroll-mt-6 p-5`}
        >
          <div className="label">Legionella result history</div>
          <h2 className="mt-1 text-xl font-black">Recent Legionella results</h2>
          <p className="mt-1 text-sm text-slate-600">
            Result receipt is recorded as a calendar date. Exact 24- or 48-hour
            response timing requires human compliance review because no receipt
            time is collected.
          </p>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {system.labResults.slice(0, 4).map((result) => {
              const actionOpen = system.reportingObligations.some(
                (obligation) =>
                  obligation.triggerEventId === result.sourceEventId &&
                  (obligation.obligationType.includes("CORRECTIVE_ACTION") ||
                    obligation.obligationType === "LEVEL_4_FULL_REMEDIATION"),
              );
              const deadline =
                result.remediationDueAt ?? result.correctiveActionDueAt;
              const overdue = Boolean(
                actionOpen && deadline && deadline.getTime() < Date.now(),
              );
              return (
                <article
                  key={result.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black">
                        {plainEnumLabel(result.level)} ·{" "}
                        {formatLegionellaResult(result.cfuPerMl)}
                      </div>
                      <div className="mt-1 text-xs font-bold text-slate-600">
                        Sample collected{" "}
                        {formatDate(result.sampleEvent.eventDate)}
                        {" · "}Result received {formatDate(result.receivedDate)}
                      </div>
                    </div>
                    <StatusBadge
                      color={
                        result.chainClosed
                          ? "GREEN"
                          : overdue
                            ? "RED"
                            : actionOpen
                              ? "YELLOW"
                              : "GREEN"
                      }
                      label={
                        result.chainClosed
                          ? "Retest chain closed"
                          : overdue
                            ? "Exact deadline overdue"
                            : actionOpen
                              ? "Corrective action open"
                              : "No corrective action open"
                      }
                    />
                  </div>
                  {result.correctiveActionDueAt && (
                    <p className="mt-3 text-sm">
                      <b>Biocide/corrective response due:</b>{" "}
                      {formatDate(result.correctiveActionDueAt)}
                    </p>
                  )}
                  {result.remediationDueAt && (
                    <p className="mt-2 text-sm">
                      <b>Full remediation due:</b>{" "}
                      {formatDate(result.remediationDueAt)}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
      {view === "obligations" && (
        <section className="panel mb-6 p-5">
          <div className="label">Active compliance work</div>
          <h2 className="mt-1 text-xl font-black">All required work</h2>
          <p className="mt-1 text-sm text-slate-600">
            Urgent items appear first. Dates show the operational target,
            allowable window, hard deadline, and working time remaining.
          </p>
          <div className="mt-5">
            <TowerActionList
              systemId={id}
              today={today}
              items={orderedOpenObligations}
              canConfirmOwnerManaged={canConfirmOwnerManaged}
              legionellaResponsibility={system.legionellaResponsibility}
              responsibilities={system}
              combinedObligationIds={combinedObligationIds}
              emptyMessage="No required work is currently recorded for this tower."
            />
          </div>
        </section>
      )}
      {nextRequired && (
        <div className={view === "obligations" ? "mb-6" : "hidden"}>
          <ComplianceTimeline
            title={plainEnumLabel(nextRequired.type)}
            items={timelineItems}
          />
        </div>
      )}
      <details
        className={`${view === "obligations" ? "panel mb-6 p-5" : "hidden"} scroll-mt-6`}
        open={Boolean(
          recordedEventId ||
          query.correctedEvent ||
          query.voidedEvent ||
          system.reportingObligations.length,
        )}
      >
        <summary className="cursor-pointer text-base font-black text-emerald-900">
          Reporting and advanced requirement details
        </summary>
        <p className="mt-2 text-sm text-slate-600">
          Review source rules, record required submissions, or inspect detailed
          sampling requirements.
        </p>
        <div
          id="obligations"
          className="mt-5 grid scroll-mt-6 gap-4 xl:grid-cols-2"
        >
          <section className="panel p-5">
            <div className="label">Sampling requirements</div>
            <h2 className="mt-1 font-black">
              Open Legionella sampling requirements
            </h2>
            <div className="mt-4 space-y-3">
              {system.sampleObligations.length ? (
                system.sampleObligations.map((item) => (
                  <ObligationIntelligenceCard
                    key={item.id}
                    today={today}
                    obligation={{
                      id: item.id,
                      type: item.obligationType,
                      category: "SAMPLE",
                      earliest: item.earliestDueDate,
                      targetStart: item.targetStartDate,
                      targetEnd: item.targetEndDate,
                      latest: item.latestDueDate,
                      priority: item.priority,
                      status: item.status,
                      reason: item.reason,
                      sourceCitation: item.sourceCitation,
                      trigger: {
                        id: item.triggerEvent.id,
                        type: item.triggerEvent.eventType,
                        date: item.triggerEvent.eventDate,
                      },
                    }}
                  />
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No sample requirement created by a compliance record is open.
                </p>
              )}
            </div>
          </section>
          <section className="panel p-5">
            <div className="label">Cleaning requirements</div>
            <h2 className="mt-1 font-black">
              Startup maintenance requirements
            </h2>
            <div className="mt-4 space-y-3">
              {system.maintenanceObligations.length ? (
                system.maintenanceObligations.map((item) => (
                  <ObligationIntelligenceCard
                    key={item.id}
                    today={today}
                    obligation={{
                      id: item.id,
                      type: item.obligationType,
                      category: "MAINTENANCE",
                      earliest: item.earliestDueDate,
                      targetStart: item.targetStartDate,
                      targetEnd: item.targetEndDate,
                      latest: item.latestDueDate,
                      priority: item.priority,
                      status: item.status,
                      reason: item.reason,
                      sourceCitation: item.sourceCitation,
                      trigger: {
                        id: item.triggerEvent.id,
                        type: item.triggerEvent.eventType,
                        date: item.triggerEvent.eventDate,
                      },
                    }}
                  />
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No startup cleaning requirement is open.
                </p>
              )}
            </div>
          </section>
          <section className="panel p-5">
            <div className="label">Inspection requirements</div>
            <h2 className="mt-1 font-black">Qualified-person inspection</h2>
            <div className="mt-4 space-y-3">
              {system.inspectionObligations.length ? (
                system.inspectionObligations.map((item) => (
                  <ObligationIntelligenceCard
                    key={item.id}
                    today={today}
                    obligation={{
                      id: item.id,
                      type: "QUARTERLY_COMPLIANCE_INSPECTION",
                      category: "INSPECTION",
                      earliest: item.earliestDueDate,
                      targetStart: item.targetStartDate,
                      targetEnd: item.targetEndDate,
                      latest: item.latestDueDate,
                      priority: item.priority,
                      status: item.status,
                      reason: item.reason,
                      sourceCitation: item.sourceCitation,
                      trigger: {
                        id: item.triggerEvent.id,
                        type: item.triggerEvent.eventType,
                        date: item.triggerEvent.eventDate,
                      },
                    }}
                  />
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  Record a completed inspection to establish the next 90-day
                  requirement.
                </p>
              )}
            </div>
          </section>
          <section className="panel p-5">
            <div className="label">Reporting & action reminders</div>
            <h2 className="mt-1 font-black">DOH and portal deadlines</h2>
            <div className="mt-4 space-y-3">
              {system.reportingObligations.length ? (
                system.reportingObligations.map((item) => (
                  <section
                    key={item.id}
                    id={`reporting-${item.id}`}
                    className="scroll-mt-6 rounded-lg bg-blue-50 p-3 text-sm"
                  >
                    <ObligationIntelligenceCard
                      today={today}
                      obligation={{
                        id: item.id,
                        type: item.obligationType,
                        category: "REPORTING_ACTION",
                        earliest: item.earliestDueDate,
                        targetStart: item.targetStartDate,
                        targetEnd: item.targetEndDate,
                        latest: item.latestDueDate,
                        priority: item.priority,
                        status: item.status,
                        reason: item.reason,
                        sourceCitation: item.sourceCitation,
                        trigger: {
                          id: item.triggerEvent.id,
                          type: item.triggerEvent.eventType,
                          date: item.triggerEvent.eventDate,
                        },
                      }}
                    />
                    {!item.obligationType.includes("CORRECTIVE_ACTION") &&
                    item.obligationType !== "LEVEL_4_FULL_REMEDIATION" &&
                    item.obligationType !==
                      "BIOLOGICAL_INDICATOR_RESIDUAL_MONITORING" &&
                    recordedReportingObligationIds.has(item.id) ? (
                      <p className="mt-3 font-bold text-amber-900">
                        Late submission recorded. The missed deadline remains in
                        Compliance Issues.
                      </p>
                    ) : (
                      !item.obligationType.includes("CORRECTIVE_ACTION") &&
                      item.obligationType !== "LEVEL_4_FULL_REMEDIATION" &&
                      item.obligationType !==
                        "BIOLOGICAL_INDICATOR_RESIDUAL_MONITORING" && (
                        <form
                          action={recordServiceEventAction}
                          className="mt-3"
                        >
                          {item.status === "MISSED" && (
                            <p className="mb-2 font-bold text-red-900">
                              Record this as a late historical submission. It
                              will not repair the missed requirement.
                            </p>
                          )}
                          <input type="hidden" name="systemId" value={id} />
                          <input
                            type="hidden"
                            name="eventType"
                            value="REPORT_SUBMITTED"
                          />
                          <label className="block">
                            <span className="label">
                              Actual submission date · Required
                            </span>
                            <input
                              className="field mt-1"
                              name="eventDate"
                              type="date"
                              max={today}
                              required
                            />
                            <span className="mt-1 block text-xs font-bold text-slate-600">
                              Use the date on the portal or agency
                              confirmation—not today unless it was actually
                              submitted today.
                            </span>
                          </label>
                          <input
                            type="hidden"
                            name="reportType"
                            value={item.obligationType}
                          />
                          <input
                            type="hidden"
                            name="reportingObligationId"
                            value={item.id}
                          />
                          <input
                            type="hidden"
                            name="notes"
                            value={`Completed ${plainEnumLabel(item.obligationType)}`}
                          />
                          <SubmitButton
                            className="mt-2"
                            pendingLabel="Saving submission…"
                          >
                            {item.obligationType === "PORTAL_SAMPLE_DATE"
                              ? "Record NYC portal submission"
                              : "Record submission"}
                          </SubmitButton>
                        </form>
                      )
                    )}
                  </section>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No reporting requirement created by a compliance record is
                  open.
                </p>
              )}
            </div>
          </section>
        </div>
      </details>
      <div className="mb-6 grid gap-4">
        <div
          id="cleaning-plan"
          className={`${view === "obligations" ? "panel" : "hidden"} scroll-mt-6 p-5`}
        >
          <div className="label">Annual cleaning coordination</div>
          <h2 className="mt-1 font-black">Two-day cleaning plan</h2>
          <p className="mt-1 text-sm text-slate-600">
            Coordinate chemical addition and the following physical cleaning.
            The plan remains separate from compliance completion.
          </p>
          {!dashboardRow.cleaning.applicable ? (
            <p className="mt-4 text-sm font-bold text-slate-600">
              The NYC twice-yearly cleaning requirement is not enabled for this
              tower.
            </p>
          ) : activeCleaningPlan ? (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
              <div className="font-black">Active cleaning plan</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <ComplianceDate
                  value={cleaningPlanDetails?.chemicalAddDate}
                  label="Day 1 · Chemical addition"
                  operational
                />
                <ComplianceDate
                  value={
                    cleaningPlanDetails?.cleaningDate ??
                    activeCleaningPlan.scheduledDate
                  }
                  label="Day 2 · Physical cleaning"
                  operational
                />
              </div>
              <p className="mt-3 text-sm font-bold">
                The annual cleaning requirement remains open until physical
                cleaning is recorded as completed.
              </p>
              <Link
                className="btn mt-3"
                href={`/visits/${activeCleaningPlan.visitId}`}
              >
                Open cleaning plan
              </Link>
            </div>
          ) : cleaningObligation &&
            cleaningObligation.latest &&
            nextWorkingDate(cleaningPlanEarliest) <=
              cleaningObligation.latest &&
            ["ADMIN", "OPERATIONS_MANAGER", "SCHEDULER"].includes(user.role) ? (
            <CleaningPlanForm
              systemId={system.id}
              earliestDate={cleaningPlanEarliest}
              latestDate={cleaningObligation.latest}
              technicians={technicians}
            />
          ) : (
            <p className="mt-4 text-sm font-bold text-slate-600">
              {dashboardRow.cleaning.remaining === 0
                ? "Both required cleanings are recorded for this calendar year."
                : "No valid two-working-day planning window is currently available."}
            </p>
          )}
        </div>
        {view === "information" && (
          <section className="panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="label">Service responsibility</div>
                <h2 className="mt-1 font-black">Who handles each service</h2>
              </div>
              {canViewSettings && (
                <Link
                  className="btn"
                  href={`/systems/${id}?view=settings#service-responsibilities`}
                >
                  Change in Settings
                </Link>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              These assignments control which work appears as our action and
              which work is shown as an external dependency.
            </p>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              {serviceResponsibilityFamilies.map(([key, label]) => {
                const responsibility = system[key];
                const external = responsibility !== "OUR_COMPANY";
                return (
                  <div
                    key={key}
                    className={`rounded-lg border p-3 ${
                      external
                        ? "border-purple-200 bg-purple-50"
                        : "border-emerald-200 bg-emerald-50"
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-600">
                      {label}
                    </div>
                    <div className="mt-1 font-black">
                      {serviceResponsibilityLabel(responsibility)}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        {view === "information" && (
          <div className="panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="label">Facility and identifiers</div>
                <h2 className="mt-1 font-black">Tower location</h2>
              </div>
              {canViewSettings && (
                <Link
                  className="btn"
                  href={`/systems/${id}/edit?returnTo=${encodeURIComponent(`/systems/${id}?view=information`)}`}
                >
                  Edit customer and tower information
                </Link>
              )}
            </div>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <dt className="label">Customer</dt>
                <dd className="font-bold">{system.building.customer.name}</dd>
              </div>
              <div>
                <dt className="label">Facility</dt>
                <dd className="font-bold">{system.building.buildingName}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="label">Address</dt>
                <dd className="font-bold">
                  {system.building.streetAddress}, {system.building.city},{" "}
                  {system.building.state}
                </dd>
              </div>
              <div>
                <dt className="label">Internal job number</dt>
                <dd className="font-bold">{system.internalJobNumber}</dd>
              </div>
              <div>
                <dt className="label">Registration number</dt>
                <dd className="font-bold">
                  {system.registrationNumber || "Not recorded"}
                </dd>
              </div>
              <div>
                <dt className="label">NYC cooling tower system ID</dt>
                <dd className="font-bold">
                  {system.NYCSystemId || "Not recorded"}
                </dd>
              </div>
              <div>
                <dt className="label">NYS cooling tower system ID</dt>
                <dd className="font-bold">
                  {system.NYSSystemId || "Not recorded"}
                </dd>
              </div>
            </dl>
          </div>
        )}
        <div className={view === "information" ? "panel p-5" : "hidden"}>
          <div className="label">Cooling tower information</div>
          <h2 className="mt-1 font-black">Equipment details</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-5">
            <div>
              <dt className="label">Manufacturer</dt>
              <dd className="font-bold">
                {system.manufacturer || "Not recorded"}
              </dd>
            </div>
            <div>
              <dt className="label">Model</dt>
              <dd className="font-bold">
                {system.modelNumber || "Not recorded"}
              </dd>
            </div>
            <div>
              <dt className="label">Serial number</dt>
              <dd className="font-bold">
                {system.serialNumber || "Not recorded"}
              </dd>
            </div>
            <div>
              <dt className="label">Tower location</dt>
              <dd className="font-bold">
                {system.towerLocation || "Not recorded"}
              </dd>
            </div>
            <div>
              <dt className="label">Tonnage</dt>
              <dd className="font-bold">
                {system.tonnage ? `${system.tonnage} tons` : "Not recorded"}
              </dd>
            </div>
          </dl>
        </div>
        {view === "settings" && (
          <section
            id="service-responsibilities"
            className="panel scroll-mt-6 p-5"
          >
            <div className="label">1. Service responsibilities</div>
            <h2 className="mt-1 font-black">Who performs each service</h2>
            <p className="mt-1 text-sm text-slate-600">
              These assignments determine which work appears in our queues and
              which work remains an external dependency. Saved separately.
            </p>
            <Link
              className="btn btn-primary mt-4"
              href={`/systems/${id}/edit?section=responsibilities&returnTo=${encodeURIComponent(`/systems/${id}?view=settings`)}`}
            >
              Edit service responsibilities
            </Link>
          </section>
        )}
        <div className={view === "settings" ? "panel p-5" : "hidden"}>
          <div className="label">2. Operating schedule</div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-black">Tower operation pattern</h2>
              <p className="mt-1 text-sm font-bold text-slate-700">
                {seasonLabel(system)} · {seasonalStatus(system)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Choose whether this tower operates continuously or during a
                recurring season. This guides planning; actual startup and
                shutdown remain separate audited events.
              </p>
            </div>
          </div>
          <OperationPatternForm
            systemId={id}
            seasonal={system.operationPeriodType === "SEASONAL"}
            seasonStartMonth={system.seasonStartMonth}
            seasonStartDay={system.seasonStartDay}
            seasonEndMonth={system.seasonEndMonth}
            seasonEndDay={system.seasonEndDay}
            currentLabel={seasonLabel(system)}
            currentStatus={seasonalStatus(system)}
          />
        </div>
        <div className={view === "settings" ? "panel p-5" : "hidden"}>
          <div className="label">3. Recommended service dates</div>
          <h2 className="font-black">
            Recommended monthly sample collection dates
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            This recommended service date stays stable; the compliance deadline
            still comes from the last qualifying sample.
          </p>
          <MonthlyTargetWindowForm
            systemId={id}
            startDay={system.monthlyTargetStartDay}
            endDay={system.monthlyTargetEndDay}
          />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className={view === "settings" ? "panel p-5" : "hidden"}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="label">4. Jurisdiction and compliance rules</div>
              <h2 className="mt-1 font-black">Current rule assignment</h2>
            </div>
            <Link
              className="btn"
              href={`/systems/${id}/edit?section=rules&returnTo=${encodeURIComponent(`/systems/${id}?view=settings`)}`}
            >
              Change compliance rules
            </Link>
          </div>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="label">Profile</dt>
              <dd className="font-bold">{system.ruleProfile.name}</dd>
            </div>
            <div>
              <dt className="label">Compliance rules</dt>
              <dd className="font-bold">
                {towerRuleConfigurationLabel(system.ruleConfiguration)}
              </dd>
            </div>
            <div>
              <dt className="label">Profile version</dt>
              <dd className="break-all font-mono text-xs">
                {dashboardRow.profileVersion}
              </dd>
            </div>
            <div>
              <dt className="label">Effective date</dt>
              <dd className="font-bold">
                {formatDate(dashboardRow.profileEffectiveDate)}
              </dd>
            </div>
            <div>
              <dt className="label">Profile review</dt>
              <dd className="font-bold">
                {dashboardRow.profileJurisdiction === "CUSTOM"
                  ? "Review local requirements and enabled policy rules"
                  : "Assigned profile active"}
              </dd>
            </div>
            <div>
              <dt className="label">Assigned / last changed by</dt>
              <dd className="font-bold">
                {profileAudit
                  ? `${profileAudit.changedBy.name} · ${formatDate(profileAudit.changedAt)}`
                  : "Historical assignment — audit detail unavailable"}
              </dd>
            </div>
            <div>
              <dt className="label">Jurisdiction</dt>
              <dd>
                {[
                  system.jurisdiction.city,
                  system.jurisdiction.county,
                  system.jurisdiction.state,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </dd>
            </div>
            <div>
              <dt className="label">Operating status</dt>
              <dd className="capitalize">
                {system.operatingStatus.replaceAll("_", " ").toLowerCase()}
              </dd>
            </div>
            {system.pendingRegulation && (
              <div>
                <dt className="label">Pending regulation</dt>
                <dd className="font-bold text-purple-800">
                  {system.pendingRegulation.expectedRuleName} ·{" "}
                  {plainEnumLabel(system.pendingRegulation.status)}
                </dd>
              </div>
            )}
          </dl>
        </section>
        <section
          className={view === "overview" ? "panel p-5 lg:col-span-3" : "hidden"}
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="label">Latest completed records</div>
              <h2 className="mt-1 font-black">Recent activity</h2>
            </div>
            <Link className="btn" href={`/systems/${id}?view=history`}>
              View full history
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {recentActiveEvents.map((event) => (
              <Link
                key={event.id}
                href={`/systems/${id}/events/${event.id}`}
                className="block border-b pb-3 text-sm last:border-0"
              >
                <div className="font-bold">
                  {plainEnumLabel(event.eventType)}
                </div>
                <div className="text-slate-500">
                  <time dateTime={dateOnly(event.eventDate)}>
                    {formatDate(event.eventDate)}
                  </time>{" "}
                  · {plainEnumLabel(event.status)}
                </div>
              </Link>
            ))}
            {!recentActiveEvents.length && (
              <p className="text-sm text-slate-500">No events recorded yet.</p>
            )}
          </div>
        </section>
      </div>
      <span id="compliance-history" className="block scroll-mt-6" />
      <section
        id="regulatory-events"
        className={`${view === "history" ? "panel mt-6" : "hidden"} scroll-mt-6 p-5`}
      >
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="label">Audit history</div>
            <h2 className="mt-1 text-xl font-black">Compliance records</h2>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <p className="text-sm text-slate-500">
              Edits create a replacement; removals preserve the audit trail.
              Both recalculate every projection.
            </p>
            {mostRecentActiveEvent && (
              <details className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-left text-sm text-amber-950">
                <summary className="cursor-pointer font-black">
                  Mark {plainEnumLabel(mostRecentActiveEvent.eventType)} from{" "}
                  {formatDate(mostRecentActiveEvent.eventDate)} invalid
                </summary>
                <p className="mt-2 max-w-sm">
                  This voids {plainEnumLabel(mostRecentActiveEvent.eventType)}
                  from {formatDate(mostRecentActiveEvent.eventDate)} and
                  recalculates every dependent date. The audit record remains.
                </p>
                <form action={voidServiceEventAction} className="mt-3">
                  <input
                    type="hidden"
                    name="eventId"
                    value={mostRecentActiveEvent.id}
                  />
                  <input
                    type="hidden"
                    name="reason"
                    value="Void most recently recorded active compliance record"
                  />
                  <label className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-white p-3 font-bold">
                    <input
                      className="mt-1"
                      type="checkbox"
                      name="confirmVoid"
                      value="yes"
                      required
                    />
                    <span>
                      I understand this preserves the audit record and
                      recalculates dependent requirements and deadlines.
                    </span>
                  </label>
                  <SubmitButton
                    variant="destructive"
                    pendingLabel="Marking record invalid…"
                  >
                    Mark this record invalid
                  </SubmitButton>
                </form>
              </details>
            )}
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {system.serviceEvents.length ? (
            system.serviceEvents.map((event) => (
              <article
                key={event.id}
                className="group grid gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-emerald-700 hover:shadow-sm lg:grid-cols-[1fr_auto]"
              >
                <Link href={`/systems/${id}/events/${event.id}`}>
                  <StatusBadge
                    color={event.status === "ACTIVE" ? "GREEN" : "GRAY"}
                    label={plainEnumLabel(event.status)}
                  />
                  <div className="mt-2 font-black">
                    {plainEnumLabel(event.eventType)}
                  </div>
                  <div className="text-sm text-slate-500">
                    {formatDate(event.eventDate)}
                    {event.correctedFromEventId
                      ? " · corrected replacement"
                      : ""}
                  </div>
                  {event.performedByResponsibility !== "OUR_COMPANY" && (
                    <div className="mt-1 text-xs font-bold text-purple-800">
                      {serviceResponsibilityLabel(
                        event.performedByResponsibility,
                      )}
                      {event.externalProviderName
                        ? ` — ${event.externalProviderName}`
                        : ""}
                    </div>
                  )}
                </Link>
                <div className="flex flex-wrap items-center gap-2 self-center text-sm font-black text-emerald-800">
                  {samplesAwaitingResultIds.has(event.id) && (
                    <Link
                      className="btn"
                      href={eventEntryHref({
                        type: "result",
                        towerId: id,
                        sampleEventId: event.id,
                        returnTo: `/systems/${id}?view=history#regulatory-events`,
                      })}
                    >
                      Record lab result
                    </Link>
                  )}
                  <Link
                    className="group-hover:underline"
                    href={`/systems/${id}/events/${event.id}`}
                  >
                    {event.status === "ACTIVE"
                      ? "View or edit event →"
                      : "View audit record →"}
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-500">
              No regulatory events have been recorded yet.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
