import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { VisitCompletionForm } from "@/components/visit-completion-form";
import { VisitRescheduleForm } from "@/components/visit-reschedule-form";
import { ComplianceDate } from "@/components/compliance-date";
import { cancelVisitAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/lib/db";
import { dateOnly, formatDate, todayDateOnly } from "@/lib/date";
import { requirementLabel } from "@/lib/labels";
import { requireUser } from "@/lib/auth";
import {
  activityTypeCoversObligation,
  getUrgency,
} from "@/lib/compliance-intelligence";
import {
  annualCleaningProgress,
  nextAnnualCleaningObligation,
} from "@/lib/obligation-engine";
export default async function VisitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    completed?: string;
    cancelled?: string;
    rescheduled?: string;
    planned?: string;
  }>;
}) {
  const { id } = await params;
  const { completed, cancelled, rescheduled, planned } = await searchParams;
  const user = await requireUser();
  const visit = await db.visit.findFirst({
    where: {
      id,
      building: { customer: { organizationId: user.organizationId } },
    },
    include: {
      building: true,
      assignedTechnician: true,
      activities: {
        include: {
          coolingTowerSystem: {
            include: {
              ruleProfile: true,
              sampleObligations: {
                where: { status: { in: ["PENDING", "SCHEDULED", "OVERDUE"] } },
              },
              inspectionObligations: {
                where: { status: { in: ["PENDING", "SCHEDULED", "OVERDUE"] } },
              },
              reportingObligations: {
                where: { status: { in: ["PENDING", "SCHEDULED", "OVERDUE"] } },
              },
              maintenanceObligations: {
                where: { status: { in: ["PENDING", "SCHEDULED", "OVERDUE"] } },
              },
              serviceEvents: {
                where: {
                  status: "ACTIVE",
                  eventType: {
                    in: [
                      "CLEANING_COMPLETED",
                      "STARTUP_CLEANING_DISINFECTION",
                      "FULL_REMEDIATION",
                    ],
                  },
                },
                select: { eventDate: true },
              },
            },
          },
        },
      },
    },
  });
  if (!visit) notFound();
  const cleaningPlanActivity = visit.activities.find((activity) => {
    const details = activity.details as { planType?: unknown } | null;
    return details?.planType === "TWO_DAY_ANNUAL_CLEANING";
  });
  const cleaningPlanDetails = cleaningPlanActivity?.details as {
    chemicalAddDate?: string;
    cleaningDate?: string;
  } | null;
  const isCleaningPlan = Boolean(cleaningPlanActivity);
  const systems = [
    ...new Map(
      visit.activities.map((activity) => [
        activity.coolingTowerSystemId,
        activity.coolingTowerSystem,
      ]),
    ).values(),
  ];
  const activities = visit.activities.map((activity) => ({
    id: activity.id,
    activityType: activity.activityType,
    systemName: activity.coolingTowerSystem.systemName,
    sourceAuthority: activity.sourceAuthority,
    status: activity.status,
    qualifiesForRoutineLegionella: activity.qualifiesForRoutineLegionella,
    qualifiesForInspection: activity.qualifiesForInspection,
    qualifiesForCleaning: activity.qualifiesForCleaning,
    systemId: activity.coolingTowerSystemId,
    obligationIds: (() => {
      const details = activity.details as { obligationIds?: unknown } | null;
      return Array.isArray(details?.obligationIds)
        ? details.obligationIds.filter(
            (item): item is string => typeof item === "string",
          )
        : [];
    })(),
    schedulingWarning: (() => {
      const details = activity.details as {
        schedulingWarning?: unknown;
      } | null;
      return typeof details?.schedulingWarning === "string"
        ? details.schedulingWarning
        : null;
    })(),
  }));
  const visitYear = Number(dateOnly(visit.scheduledDate).slice(0, 4));
  const obligations = systems.flatMap((system) => {
    const cleaningProgress = annualCleaningProgress(
      system.serviceEvents.map((event) => dateOnly(event.eventDate)),
      visitYear,
    );
    const cleaning =
      system.ruleProfile.jurisdictionMode ===
      "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4"
        ? nextAnnualCleaningObligation({
            systemId: system.id,
            year: visitYear,
            completed: cleaningProgress.completed,
          })
        : null;
    const cleaningId = `annual-cleaning:${system.id}:${visitYear}:${cleaningProgress.completed + 1}`;
    return [
      ...system.sampleObligations.map((item) => ({
        id: item.id,
        type: item.obligationType,
        category: "SAMPLE" as const,
        systemName: system.systemName,
        systemId: system.id,
        earliest: item.earliestDueDate ? dateOnly(item.earliestDueDate) : null,
        latest: item.latestDueDate ? dateOnly(item.latestDueDate) : null,
        status: item.status,
        priority: item.priority,
        reason: item.reason,
      })),
      ...system.inspectionObligations.map((item) => ({
        id: item.id,
        type: "QUARTERLY_COMPLIANCE_INSPECTION",
        category: "INSPECTION" as const,
        systemName: system.systemName,
        systemId: system.id,
        earliest: item.earliestDueDate ? dateOnly(item.earliestDueDate) : null,
        latest: item.latestDueDate ? dateOnly(item.latestDueDate) : null,
        status: item.status,
        priority: item.priority,
        reason: item.reason,
      })),
      ...system.reportingObligations.map((item) => ({
        id: item.id,
        type: item.obligationType,
        category: "REPORTING_ACTION" as const,
        systemName: system.systemName,
        systemId: system.id,
        earliest: item.earliestDueDate ? dateOnly(item.earliestDueDate) : null,
        latest: item.latestDueDate ? dateOnly(item.latestDueDate) : null,
        status: item.status,
        priority: item.priority,
        reason: item.reason,
      })),
      ...system.maintenanceObligations.map((item) => ({
        id: item.id,
        type: item.obligationType,
        category: "MAINTENANCE" as const,
        systemName: system.systemName,
        systemId: system.id,
        earliest: item.earliestDueDate ? dateOnly(item.earliestDueDate) : null,
        latest: item.latestDueDate ? dateOnly(item.latestDueDate) : null,
        status: item.status,
        priority: item.priority,
        reason: item.reason,
      })),
      ...(cleaning
        ? [
            {
              id: cleaningId,
              type: cleaning.obligationType,
              category: "MAINTENANCE" as const,
              systemName: system.systemName,
              systemId: system.id,
              earliest: cleaning.earliestDueDate,
              latest: cleaning.latestDueDate,
              status: activities.some((activity) =>
                activity.obligationIds.includes(cleaningId),
              )
                ? ("SCHEDULED" as const)
                : ("PENDING" as const),
              priority: cleaning.priority,
              reason: cleaning.reason,
            },
          ]
        : []),
    ];
  });
  const linkedIds = new Set(activities.flatMap((item) => item.obligationIds));
  const rescheduleObligations = linkedIds.size
    ? obligations.filter((item) => linkedIds.has(item.id))
    : obligations.filter((obligation) =>
        activities.some(
          (activity) =>
            activity.systemId === obligation.systemId &&
            activityTypeCoversObligation(activity.activityType, obligation),
        ),
      );
  const rescheduleEarliest =
    rescheduleObligations
      .map((item) => item.earliest)
      .filter((item): item is string => Boolean(item))
      .sort()
      .at(-1) ?? null;
  const rescheduleLatest =
    rescheduleObligations
      .map((item) => item.latest)
      .filter((item): item is string => Boolean(item))
      .sort()[0] ?? null;
  return (
    <>
      <PageHeader
        eyebrow={
          isCleaningPlan ? "Annual cleaning coordination" : "Field visit"
        }
        title={visit.building.buildingName}
        description={`${isCleaningPlan ? "Two-day cleaning plan" : formatDate(visit.scheduledDate)} · ${visit.building.streetAddress} · ${visit.assignedTechnician?.name || "Unassigned"}`}
      />
      {!["COMPLETED", "CANCELLED"].includes(visit.status) && !planned && (
        <div className="mb-5 rounded-xl border border-blue-300 bg-blue-50 p-4 text-blue-950">
          <b>Scheduled — requirements are still open</b>
          <div className="mt-1 text-sm">
            This visit coordinates the work. Compliance dates change only after
            completed work is recorded below.
          </div>
        </div>
      )}
      {planned && isCleaningPlan && (
        <div className="mb-5 rounded-xl border border-blue-300 bg-blue-50 p-4 text-blue-950">
          <b>Two-day cleaning plan created</b>
          <div className="mt-1 text-sm">
            Planning does not satisfy the annual requirement. Record physical
            cleaning after it is completed.
          </div>
        </div>
      )}
      {completed && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900">
          <CheckCircle2 />
          <div>
            <b>Visit completed</b>
            <div className="text-sm">
              Completed activities were recorded and compliance was
              recalculated. Every requirement still open is listed below.
            </div>
          </div>
        </div>
      )}
      {cancelled && (
        <div className="mb-5 rounded-xl border border-slate-300 bg-slate-50 p-4 text-slate-900">
          <b>Visit canceled</b>
          <div className="text-sm">
            Its requirements are open again and have been returned to the work
            queue.
          </div>
        </div>
      )}
      {rescheduled && (
        <div className="mb-5 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950">
          <b>Visit rescheduled</b>
          <div className="text-sm">
            The planned activities were rechecked against their generated
            windows and the change was recorded in the audit history.
          </div>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="panel p-5">
          <h2 className="text-xl font-black">
            {isCleaningPlan
              ? "Cleaning plan and completion"
              : "Activities for this trip"}
          </h2>
          {isCleaningPlan && (
            <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <ComplianceDate
                value={cleaningPlanDetails?.chemicalAddDate}
                label="Day 1 · Chemical addition"
                operational
              />
              <ComplianceDate
                value={cleaningPlanDetails?.cleaningDate ?? visit.scheduledDate}
                label="Day 2 · Physical cleaning"
                operational
              />
              <p className="text-sm font-bold text-slate-700 sm:col-span-2">
                These dates coordinate the work only. The annual obligation
                closes only when physical cleaning is recorded below.
              </p>
            </div>
          )}
          <VisitCompletionForm
            visitId={visit.id}
            scheduledDate={dateOnly(visit.scheduledDate)}
            currentDate={todayDateOnly()}
            completed={visit.status === "COMPLETED"}
            locked={visit.status === "CANCELLED"}
            completionLabel={
              isCleaningPlan ? "Record physical cleaning completed" : undefined
            }
            activities={activities}
            obligations={obligations}
          />
          {!isCleaningPlan &&
            ["DRAFT", "PLANNED", "CONFIRMED"].includes(visit.status) &&
            ["ADMIN", "OPERATIONS_MANAGER", "SCHEDULER"].includes(user.role) &&
            rescheduleObligations.length > 0 && (
              <VisitRescheduleForm
                visitId={visit.id}
                currentDate={dateOnly(visit.scheduledDate)}
                earliestDate={rescheduleEarliest}
                latestDate={rescheduleLatest}
              />
            )}
          {!["COMPLETED", "CANCELLED"].includes(visit.status) &&
            ["ADMIN", "OPERATIONS_MANAGER", "SCHEDULER"].includes(
              user.role,
            ) && (
              <form
                action={cancelVisitAction}
                className="mt-6 border-t border-slate-200 pt-5"
              >
                <input type="hidden" name="visitId" value={visit.id} />
                <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950">
                  Canceling returns {rescheduleObligations.length} requirement
                  {rescheduleObligations.length === 1 ? "" : "s"} to the work
                  queue. Their compliance deadlines do not move.
                </div>
                <label className="block max-w-xl">
                  <span className="label">Cancellation reason · Required</span>
                  <input
                    className="field mt-1"
                    name="reason"
                    required
                    minLength={8}
                    placeholder="Why this visit will not be completed"
                  />
                </label>
                <label className="mt-3 flex items-start gap-2 text-sm font-bold">
                  <input
                    className="mt-1"
                    type="checkbox"
                    name="confirmCancel"
                    value="yes"
                    required
                  />
                  <span>
                    I understand the planned work will become open and
                    unscheduled again.
                  </span>
                </label>
                <SubmitButton
                  variant="destructive"
                  className="mt-3"
                  pendingLabel="Canceling visit…"
                >
                  Cancel visit and return work to queue
                </SubmitButton>
              </form>
            )}
        </section>
        <aside className="space-y-5">
          <div className="panel p-5">
            <h2 className="font-black">What remains open</h2>
            {systems.map((system) => (
              <div key={system.id} className="mt-4 border-t pt-4">
                <div className="font-bold">{system.systemName}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {system.ruleProfile.name}
                </div>
                <div className="mt-3 space-y-2">
                  {obligations
                    .filter((item) => item.systemName === system.systemName)
                    .map((obligation) => {
                      const urgency = getUrgency({
                        today: todayDateOnly(),
                        status: obligation.status,
                        priority: obligation.priority,
                        latestDueDate: obligation.latest,
                        targetStartDate: obligation.earliest,
                      });
                      return (
                        <div
                          key={obligation.id}
                          className="rounded-lg bg-slate-50 p-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <b>{requirementLabel(obligation.type)}</b>
                            <StatusBadge
                              color={urgency.color}
                              label={urgency.label}
                            />
                          </div>
                          <div className="mt-1 text-slate-600">
                            {obligation.latest
                              ? `Due ${formatDate(obligation.latest)}`
                              : obligation.reason}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
            <b>Cleaning alone does not satisfy sampling.</b>
            <p className="mt-1">
              Leave Legionella checked only when a sample was actually
              collected.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
