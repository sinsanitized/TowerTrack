import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SourceBadge } from "@/components/source-badge";
import { Why } from "@/components/why";
import { EventRecorder } from "@/components/event-recorder";
import { ComplianceDate, ComplianceWindow } from "@/components/compliance-date";
import { ObligationIntelligenceCard } from "@/components/obligation-intelligence-card";
import { ComplianceTimeline } from "@/components/compliance-timeline";
import { OperationPatternForm } from "@/components/operation-pattern-form";
import { CleaningPlanForm } from "@/components/cleaning-plan-form";
import {
  recordServiceEventAction,
  updateMonthlyTargetWindowAction,
  voidServiceEventAction,
} from "@/app/actions";
import { complianceDashboardRows, planningRows } from "@/lib/queries";
import { db } from "@/lib/db";
import {
  formatDate,
  addDays,
  dateOnly,
  isWeekend,
  nextWorkingDate,
  todayDateOnly,
} from "@/lib/date";
import {
  activityLabel,
  formatLegionellaResult,
  plainEnumLabel,
  requirementLabel,
} from "@/lib/labels";
import { seasonLabel, seasonalStatus } from "@/lib/season";
import { requireUser } from "@/lib/auth";
import { compileTowerRuleConfig } from "@/lib/rule-profile";

const cleaningTypes = new Set([
  "ROUTINE_CLEANING",
  "STARTUP_CLEANING",
  "CLEANING",
  "DISINFECTION",
  "CLEANING_AND_DISINFECTION",
  "CORRECTIVE_DISINFECTION",
  "FULL_REMEDIATION",
]);

const cleaningEventTypes = new Set([
  "CLEANING_COMPLETED",
  "STARTUP_CLEANING_DISINFECTION",
  "HIGH_LEGIONELLA_DISINFECTION",
  "FULL_REMEDIATION",
]);

export default async function SystemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser();
  const recordedEventId =
    typeof query.event === "string" ? query.event : undefined;
  const requestedSampleEventId =
    typeof query.labSample === "string" ? query.labSample : undefined;
  const initialEventType =
    query.record === "sample"
      ? ("ROUTINE_LEGIONELLA_SAMPLE_COLLECTED" as const)
      : undefined;
  const [system, row, dashboardRow, recordedEvent, technicians] =
    await Promise.all([
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
      planningRows({
        organizationId: user.organizationId,
        systemId: id,
      }).then((r) => r.find((x) => x.id === id)),
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
    ]);
  if (!system || !row || !dashboardRow) notFound();
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
  while (isWeekend(cleaningPlanEarliest))
    cleaningPlanEarliest = addDays(cleaningPlanEarliest, 1);
  const latestCleaningActivity = system.activities.find(
    (activity) =>
      activity.performedDate && cleaningTypes.has(activity.activityType),
  )?.performedDate;
  const latestCleaningEvent = system.serviceEvents
    .filter(
      (event) =>
        event.status === "ACTIVE" && cleaningEventTypes.has(event.eventType),
    )
    .map((event) => event.eventDate)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const latestCleaning = [latestCleaningActivity, latestCleaningEvent]
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0];
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
  const today = todayDateOnly();
  const nextRequired = [...dashboardRow.openObligations].sort(
    (a, b) =>
      (a.priority === "EMERGENCY" ? 0 : 1) -
        (b.priority === "EMERGENCY" ? 0 : 1) ||
      (a.latest ?? "0000-00-00").localeCompare(b.latest ?? "0000-00-00"),
  )[0];
  const warningCount = dashboardRow.openObligations.filter(
    (item) =>
      item.priority === "EMERGENCY" ||
      item.priority === "CRITICAL" ||
      item.priority === "WARNING" ||
      (item.latest != null && item.latest < today),
  ).length;
  const mostRecentActiveEvent = system.serviceEvents.find(
    (event) => event.status === "ACTIVE",
  );
  const timelineItems = nextRequired
    ? [
        nextRequired.trigger
          ? {
              id: `source-${nextRequired.trigger.id}`,
              label: plainEnumLabel(nextRequired.trigger.type),
              detail: "This recorded event generated the obligation.",
              date: nextRequired.trigger.date,
              state: "SOURCE" as const,
              href: `/systems/${id}/events/${nextRequired.trigger.id}`,
            }
          : null,
        {
          id: `window-${nextRequired.id}`,
          label: "Earliest valid date to collect this sample",
          detail: "Work may begin satisfying this obligation on this date.",
          date: nextRequired.earliest,
          state: "WINDOW" as const,
        },
        nextRequired.targetStart
          ? {
              id: `target-${nextRequired.id}`,
              label: "Preferred target begins",
              detail:
                "The internal scheduling target begins; this is not a separate legal deadline.",
              date: nextRequired.targetStart,
              state: "TARGET" as const,
            }
          : null,
        {
          id: `deadline-${nextRequired.id}`,
          label: "Legal deadline",
          detail:
            "Completion must be recorded by this date. Scheduling alone does not stop the clock.",
          date: nextRequired.latest,
          state: "DEADLINE" as const,
        },
      ].filter((item): item is NonNullable<typeof item> => item != null)
    : [];
  const ruleConfig = compileTowerRuleConfig(system.ruleProfile, {
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
          <div className="flex flex-wrap gap-2">
            <Link className="btn" href={`/systems/${id}/edit`}>
              Edit customer & tower
            </Link>
          </div>
        }
      />
      <nav
        className="panel mb-6 flex gap-1 overflow-x-auto p-2"
        aria-label="Tower workspace"
      >
        {[
          ["Overview", "#overview"],
          ["Obligations", "#obligations"],
          ["Events", "#record-event"],
          ["Samples", "#samples"],
          ["Compliance History", "#compliance-history"],
        ].map(([label, href]) => (
          <Link
            key={href}
            className="min-h-11 min-w-max rounded-lg px-4 py-3 text-sm font-black text-emerald-900 hover:bg-emerald-50"
            href={href}
          >
            {label}
          </Link>
        ))}
      </nav>
      {generated && (
        <section className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
          <div className="label">Event impact</div>
          <h2 className="mt-1 font-black">What changed</h2>
          <ul className="mt-3 grid gap-2 text-sm font-bold sm:grid-cols-2">
            <li>✓ Event recorded and regulatory history updated</li>
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
                  : "already satisfied by an existing completion event"}
              </li>
            ))}
            {!generatedObligations.length &&
              !satisfiedObligationTypes.length && (
                <li>✓ No new obligation was created by this event</li>
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
                {dashboardRow.visitOpportunity.obligations.length} obligation
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
                Submit this sample date to the NYC DOH portal
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
          generate its compliance obligations.
        </div>
      )}
      {detailsUpdated && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950">
          Customer, tower, jurisdiction, and rule settings updated. Compliance
          obligations were recalculated from the event history.
        </div>
      )}
      {typeof query.correctedEvent === "string" && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950">
          Event correction saved. The original record remains in the audit
          history and all compliance obligations were recalculated.
        </div>
      )}
      {query.voidedEvent === "1" && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-950">
          Event voided. The original record remains in the audit history, linked
          field activity was marked void when applicable, and every dependent
          obligation was recalculated from the remaining active events.
        </div>
      )}
      <section id="overview" className="panel mb-6 scroll-mt-6 p-5">
        <div className="label">Tower compliance dashboard</div>
        <div className="mt-3 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div>
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
          <div>
            <div className="label">Next required action</div>
            <div className="mt-2 font-black">
              {nextRequired
                ? plainEnumLabel(nextRequired.type)
                : "No open obligation"}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {nextRequired?.reason ??
                "Record the next verified event when work is completed."}
            </p>
          </div>
          <ComplianceDate
            value={nextRequired?.latest}
            label="Controlling legal deadline"
            deadline
            empty={
              nextRequired?.priority === "EMERGENCY"
                ? "Immediate / follow MPP"
                : "No legal deadline open"
            }
          />
          <div>
            <div className="label">Work intelligence</div>
            <div className="mt-2 font-black">
              {dashboardRow.openCount} open obligation
              {dashboardRow.openCount === 1 ? "" : "s"}
            </div>
            <p className="mt-1 text-sm font-bold text-slate-600">
              {warningCount} warning{warningCount === 1 ? "" : "s"} requiring
              attention
            </p>
            <p className="mt-2 text-sm font-black text-emerald-900">
              {dashboardRow.visitOpportunity?.obligations.length
                ? `Best visit can complete ${dashboardRow.visitOpportunity.obligations.length} obligation${dashboardRow.visitOpportunity.obligations.length === 1 ? "" : "s"}.`
                : "No safe field-service intersection is open."}
            </p>
          </div>
        </div>
      </section>
      <section className="mb-6" aria-labelledby="key-compliance-dates">
        <div className="mb-3">
          <div className="label">Recurring compliance snapshot</div>
          <h2 id="key-compliance-dates" className="mt-1 text-xl font-black">
            Key tower obligations
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
      <div className="mb-6">
        <EventRecorder
          key={initialSampleEventId ?? initialEventType ?? "default"}
          systemId={id}
          defaultDate={today}
          ruleConfig={ruleConfig}
          samplesAwaitingResults={samplesAwaitingResults}
          initialSampleEventId={initialSampleEventId}
          initialEventType={initialEventType}
        />
      </div>
      {system.labResults.length > 0 && (
        <section id="samples" className="panel mb-6 scroll-mt-6 p-5">
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
      {nextRequired && (
        <div className="mb-6">
          <ComplianceTimeline
            title={plainEnumLabel(nextRequired.type)}
            items={timelineItems}
          />
        </div>
      )}
      <div
        id="obligations"
        className="mb-6 grid scroll-mt-6 gap-4 xl:grid-cols-2"
      >
        <section className="panel p-5">
          <div className="label">Sampling obligations</div>
          <h2 className="mt-1 font-black">
            Open Legionella sampling obligations
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
                No event-generated sample obligation is open.
              </p>
            )}
          </div>
        </section>
        <section className="panel p-5">
          <div className="label">Cleaning obligations</div>
          <h2 className="mt-1 font-black">Startup maintenance requirements</h2>
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
                No startup cleaning obligation is open.
              </p>
            )}
          </div>
        </section>
        <section className="panel p-5">
          <div className="label">Inspection obligations</div>
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
                obligation.
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
                  {(item.obligationType.includes("NOTIFICATION") ||
                    item.obligationType.includes("DECLARATION") ||
                    item.obligationType === "PORTAL_SAMPLE_DATE") &&
                  recordedReportingObligationIds.has(item.id) ? (
                    <p className="mt-3 font-bold text-amber-900">
                      Late submission recorded. The missed deadline remains in
                      Compliance Issues.
                    </p>
                  ) : (
                    (item.obligationType.includes("NOTIFICATION") ||
                      item.obligationType.includes("DECLARATION") ||
                      item.obligationType === "PORTAL_SAMPLE_DATE") && (
                      <form action={recordServiceEventAction} className="mt-3">
                        {item.status === "MISSED" && (
                          <p className="mb-2 font-bold text-red-900">
                            Record this as a late historical submission. It will
                            not repair the missed obligation.
                          </p>
                        )}
                        <input type="hidden" name="systemId" value={id} />
                        <input
                          type="hidden"
                          name="eventType"
                          value="REPORT_SUBMITTED"
                        />
                        <input
                          className="field mt-1"
                          name="eventDate"
                          type="date"
                          max={today}
                          aria-label="Submission date"
                          defaultValue={today}
                          required
                        />
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
                        <button className="btn mt-2">
                          {item.obligationType === "PORTAL_SAMPLE_DATE"
                            ? "Record NYC portal submission"
                            : "Record submission"}
                        </button>
                      </form>
                    )
                  )}
                </section>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                No event-generated reporting reminder is open.
              </p>
            )}
          </div>
        </section>
      </div>
      <div className="mb-6 grid gap-4">
        <div id="cleaning-plan" className="panel scroll-mt-6 p-5">
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
                The annual cleaning obligation remains open until physical
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
        <div className="panel p-5">
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
        <div className="panel p-5">
          <h2 className="font-black">Recent records and priority</h2>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <ComplianceDate
              value={row.lastSample}
              label="Last Legionella test"
            />
            <ComplianceDate value={latestCleaning} label="Last cleaning" />
            <div>
              <div className="label">Most urgent open obligation</div>
              <div className="mt-1 font-black">
                {nextRequired
                  ? requirementLabel(nextRequired.type)
                  : "No open obligation"}
              </div>
              {nextRequired && (
                <div className="mt-2">
                  <ComplianceDate
                    value={nextRequired.latest}
                    label="Deadline"
                    deadline
                    operational
                    empty={
                      nextRequired.priority === "EMERGENCY"
                        ? "Immediate / follow MPP"
                        : "No fixed legal deadline"
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="panel p-5">
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
            seasonal={system.seasonal}
            seasonStartMonth={system.seasonStartMonth}
            seasonStartDay={system.seasonStartDay}
            seasonEndMonth={system.seasonEndMonth}
            seasonEndDay={system.seasonEndDay}
            currentLabel={seasonLabel(system)}
            currentStatus={seasonalStatus(system)}
          />
        </div>
        <div className="panel p-5">
          <h2 className="font-black">
            Recommended monthly sample collection dates
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            This operational target stays stable; the legal latest date still
            comes from the last qualifying sample.
          </p>
          <form
            action={updateMonthlyTargetWindowAction}
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto]"
          >
            <input type="hidden" name="systemId" value={id} />
            <label>
              <span className="label">Start day</span>
              <input
                className="field mt-1"
                name="startDay"
                type="number"
                min="1"
                max="28"
                required
                defaultValue={system.monthlyTargetStartDay}
              />
            </label>
            <label>
              <span className="label">End day</span>
              <input
                className="field mt-1"
                name="endDay"
                type="number"
                min="1"
                max="28"
                required
                defaultValue={system.monthlyTargetEndDay}
              />
            </label>
            <label>
              <span className="label">Reason</span>
              <input
                className="field mt-1"
                name="reason"
                minLength={8}
                required
                defaultValue="Update recommended monthly sample dates"
              />
            </label>
            <button className="btn btn-primary self-end">
              Save recommended dates
            </button>
          </form>
        </div>
      </div>
      <div className="mb-6 rounded-2xl bg-[#173f31] p-6 text-white">
        <div className="flex flex-col justify-between gap-4 sm:flex-row">
          <div>
            <StatusBadge color={row.status.color} label={row.status.label} />
            <h2 className="mt-4 text-2xl font-black">
              {nextRequired
                ? requirementLabel(nextRequired.type)
                : "No open obligation"}
            </h2>
            <p className="mt-2 text-white/70">
              Deadline{" "}
              {nextRequired?.latest
                ? formatDate(nextRequired.latest)
                : nextRequired?.priority === "EMERGENCY"
                  ? "Immediate / follow MPP"
                  : "No fixed deadline"}{" "}
              · Target{" "}
              {formatDate(
                nextRequired?.targetStart ?? nextRequired?.earliest ?? null,
              )}
            </p>
          </div>
          <div className="sm:text-right">
            <SourceBadge authority={row.authority} />
            <div className="mt-2 max-w-xs text-sm text-white/70">
              {system.ruleProfile.name}
            </div>
          </div>
        </div>
        <Why>{nextRequired?.reason ?? row.explanation}</Why>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="panel p-5">
          <h2 className="font-black">Jurisdiction & rules</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="label">Profile</dt>
              <dd className="font-bold">{system.ruleProfile.name}</dd>
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
        <section className="panel p-5">
          <h2 className="font-black">Legionella clock</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="label">Last qualifying sample</dt>
              <dd className="font-bold">{formatDate(row.lastSample)}</dd>
            </div>
            <div>
              <dt className="label">Internal target</dt>
              <dd className="font-bold">
                {formatDate(
                  dashboardRow.routineSample?.targetStart ??
                    dashboardRow.routineSample?.earliest ??
                    null,
                )}
                {dashboardRow.routineSample?.targetEnd &&
                  dashboardRow.routineSample.targetEnd !==
                    dashboardRow.routineSample.targetStart && (
                    <>
                      {" "}
                      through {formatDate(dashboardRow.routineSample.targetEnd)}
                    </>
                  )}
              </dd>
            </div>
            <div>
              <dt className="label">Monthly sample deadline</dt>
              <dd className="font-black">
                {formatDate(dashboardRow.routineSample?.latest)}
              </dd>
            </div>
          </dl>
        </section>
        <section className="panel p-5">
          <h2 className="font-black">Recent activity</h2>
          <div className="mt-4 space-y-3">
            {system.activities.map((a) => (
              <div key={a.id} className="border-b pb-3 text-sm">
                <div className="font-bold capitalize">
                  {activityLabel(a.activityType)}
                </div>
                <div className="text-slate-500">
                  {formatDate(a.performedDate || a.scheduledDate)} ·{" "}
                  {plainEnumLabel(a.status)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <span id="compliance-history" className="block scroll-mt-6" />
      <section id="regulatory-events" className="panel mt-6 scroll-mt-6 p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="label">Replayable history</div>
            <h2 className="mt-1 text-xl font-black">Regulatory events</h2>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <p className="text-sm text-slate-500">
              Edits create a replacement; removals preserve the audit trail.
              Both recalculate every projection.
            </p>
            {mostRecentActiveEvent && (
              <details className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-left text-sm text-amber-950">
                <summary className="cursor-pointer font-black">
                  Undo last event
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
                    value="Undo most recently recorded active event"
                  />
                  <button className="btn">Confirm undo last event</button>
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
                </Link>
                <div className="flex flex-wrap items-center gap-2 self-center text-sm font-black text-emerald-800">
                  {samplesAwaitingResultIds.has(event.id) && (
                    <Link
                      className="btn"
                      href={`/systems/${id}?labSample=${event.id}#record-event`}
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
