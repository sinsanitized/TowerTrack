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
import { recordServiceEventAction } from "@/app/actions";
import { complianceDashboardRows } from "@/lib/queries";
import { db } from "@/lib/db";
import {
  formatDate,
  dateOnly,
  todayDateOnly,
  workingDaysRemaining,
} from "@/lib/date";
import {
  formatLegionellaResult,
  plainEnumLabel,
  requiredActionLabel,
} from "@/lib/labels";
import { seasonalStatus } from "@/lib/season";
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
import { buttonClass } from "@/lib/button-variants";
import { completionHrefForObligation } from "@/lib/deadline-view";
import { SubmitButton } from "@/components/submit-button";
import {
  responsibilityFamilyForObligation,
  responsibilityForServiceObligation,
  serviceResponsibilityFamilies,
} from "@/lib/service-responsibility";
import {
  eventEntryHref,
  eventTypeForEntryIntent,
  isResampleObligation,
  parseEventEntryIntent,
} from "@/lib/event-entry-intent";
import { TowerWorkspaceNavigation } from "./components/tower-workspace-navigation";
import { TowerInformation } from "./components/tower-information";
import { TowerSettings } from "./components/tower-settings";
import {
  RecentTowerActivity,
  TowerComplianceRecords,
} from "./components/tower-records";
import { ComplianceUpdateSummary } from "./components/compliance-update-summary";

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
  const focusedReportingId =
    typeof query.report === "string" ? query.report : undefined;
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
            "Completion must be recorded by this date. A proposed or expected date does not stop the clock.",
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
      <TowerWorkspaceNavigation
        systemId={id}
        view={view}
        canViewSettings={canViewSettings}
      />
      {generated && (
        <ComplianceUpdateSummary
          generated={generated}
          complianceHealthLabel={dashboardRow.complianceHealth.label}
          generatedObligations={generatedObligations}
          satisfiedObligationTypes={satisfiedObligationTypes}
          recordedEvent={recordedEvent}
          visitOpportunityCount={
            dashboardRow.visitOpportunity?.obligations.length ?? null
          }
          portalFollowUp={recordedPortalFollowUp ?? null}
        />
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
          Operating schedule saved. This setting did not record a startup or
          shutdown event.
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
          focusedReportingId,
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
                    className={`scroll-mt-24 rounded-xl border p-4 text-sm ${
                      focusedReportingId === item.id
                        ? "border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100"
                        : "border-slate-200 bg-slate-50"
                    }`}
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
                        "BIOLOGICAL_INDICATOR_RESIDUAL_MONITORING" &&
                      (focusedReportingId === item.id ? (
                        <form
                          action={recordServiceEventAction}
                          className="mt-3 rounded-xl border border-emerald-200 bg-white p-4"
                        >
                          <div className="mb-3 border-b border-slate-200 pb-3">
                            <div className="label">
                              Record actual submission
                            </div>
                            <p className="mt-1 text-sm text-slate-600">
                              Enter the verified completion date, then save.
                            </p>
                          </div>
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
                      ) : (
                        <Link
                          className={buttonClass("primary", "mt-3")}
                          href={completionHrefForObligation(id, {
                            id: item.id,
                            type: item.obligationType,
                            category: "REPORTING_ACTION",
                          })}
                        >
                          {item.obligationType === "PORTAL_SAMPLE_DATE"
                            ? "Record NYC portal submission"
                            : "Record submission"}
                        </Link>
                      ))
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
          <div className="label">Annual cleaning</div>
          <h2 className="mt-1 font-black">Record completed cleaning</h2>
          <p className="mt-1 text-sm text-slate-600">
            Enter the date the physical cleaning actually happened. Only a
            completed-work date fulfills the requirement.
          </p>
          {!dashboardRow.cleaning.applicable ? (
            <p className="mt-4 text-sm font-bold text-slate-600">
              The NYC twice-yearly cleaning requirement is not enabled for this
              tower.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {activeCleaningPlan && (
                <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-slate-800">
                  <div className="font-black">Legacy planning reference</div>
                  <p className="mt-1 text-sm">
                    These dates were saved by the retired scheduling workflow.
                    They do not fulfill the cleaning requirement.
                  </p>
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
                </div>
              )}
              {cleaningObligation ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                  <div className="font-black">
                    Cleaning still needs a completion date
                  </div>
                  <p className="mt-1 text-sm">
                    Record the actual date after the work is finished.
                    TowerTrack will validate it and recalculate the requirement.
                  </p>
                  <Link
                    className={buttonClass("primary", "mt-3")}
                    href={completionHrefForObligation(id, cleaningObligation)}
                  >
                    Record actual cleaning date
                  </Link>
                </div>
              ) : (
                <p className="text-sm font-bold text-slate-600">
                  Both required cleanings are recorded for this calendar year.
                </p>
              )}
            </div>
          )}
        </div>
        {view === "information" && (
          <TowerInformation
            systemId={id}
            system={system}
            canViewSettings={canViewSettings}
          />
        )}
      </div>
      {view === "settings" && (
        <TowerSettings
          systemId={id}
          system={system}
          profileVersion={dashboardRow.profileVersion}
          profileEffectiveDate={dashboardRow.profileEffectiveDate}
          profileJurisdiction={dashboardRow.profileJurisdiction}
          profileAudit={profileAudit}
        />
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        {view === "overview" && (
          <RecentTowerActivity systemId={id} events={recentActiveEvents} />
        )}
      </div>
      {view === "history" && (
        <TowerComplianceRecords
          systemId={id}
          events={system.serviceEvents}
          mostRecentActiveEvent={mostRecentActiveEvent}
          samplesAwaitingResultIds={samplesAwaitingResultIds}
        />
      )}
    </>
  );
}
