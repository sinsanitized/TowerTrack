import Link from "next/link";
import { AlertTriangle, CalendarCheck, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ComplianceDate } from "@/components/compliance-date";
import { ClickableRow } from "@/components/clickable-row";
import {
  deadlinePeriodBounds,
  deadlinePeriodForDate,
  completionHrefForObligation,
} from "@/lib/deadline-view";
import {
  responsibilityFamilyForObligation,
  responsibilityForServiceObligation,
} from "@/lib/service-responsibility";
import { buttonClass } from "@/lib/button-variants";
import { complianceDashboardRows } from "@/lib/queries";
import { requiredActionLabel } from "@/lib/labels";
import { requireUser } from "@/lib/auth";
import {
  asUtc,
  complianceDateInfo,
  formatComplianceDate,
  formatWorkingDaysLeft,
  todayDateOnly,
} from "@/lib/date";
import { withReturnPath } from "@/lib/workflow-context";
import { isResampleObligation } from "@/lib/event-entry-intent";
import { db } from "@/lib/db";
import { dateOnly } from "@/lib/date";

type DashboardRows = Awaited<ReturnType<typeof complianceDashboardRows>>;
type DashboardRow = DashboardRows[number];
type DashboardObligation = DashboardRow["openObligations"][number];

function operationalResponsibility(
  row: DashboardRow,
  obligation: DashboardObligation,
) {
  return responsibilityForServiceObligation(
    obligation.type,
    obligation.category,
    row,
  );
}

function ActionRow({
  row,
  obligation,
  today,
  tone = "default",
}: {
  row: DashboardRow;
  obligation: DashboardObligation;
  today: string;
  tone?: "default" | "next" | "immediate";
}) {
  const responsibility = operationalResponsibility(row, obligation);
  const deadlineInfo = obligation.latest
    ? complianceDateInfo(obligation.latest, today)
    : null;
  const primaryHref =
    responsibility == null
      ? withReturnPath(
          `/systems/${row.id}/edit?focus=${responsibilityFamilyForObligation(obligation.type, obligation.category)}#service-responsibilities`,
          "/",
        )
      : obligation.status === "OVERDUE"
        ? `/systems/${row.id}?view=obligations`
        : withReturnPath(completionHrefForObligation(row.id, obligation), "/");
  const primaryLabel =
    responsibility == null
      ? "Assign responsibility"
      : obligation.status === "OVERDUE"
        ? "Review issue"
        : obligation.category === "REPORTING_ACTION" &&
            !obligation.type.includes("CORRECTIVE_ACTION") &&
            obligation.type !== "LEVEL_4_FULL_REMEDIATION" &&
            obligation.type !== "BIOLOGICAL_INDICATOR_RESIDUAL_MONITORING"
          ? "Record submission"
          : obligation.category === "SAMPLE"
            ? isResampleObligation(obligation.type)
              ? "Record resample"
              : "Record sample"
            : obligation.category === "INSPECTION"
              ? "Record inspection"
              : obligation.type.includes("CLEANING")
                ? "Record cleaning"
                : "Record completion";
  return (
    <ClickableRow
      as="article"
      href={primaryHref}
      label={`${primaryLabel}: ${requiredActionLabel(obligation.type)} for ${row.systemName}`}
      className={`record-row border-l-4 p-3 sm:p-4 ${
        tone === "next"
          ? "urgency-blue"
          : tone === "immediate"
            ? "urgency-red"
            : "urgency-cyan"
      }`}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(300px,1fr)_minmax(180px,.45fr)_auto] lg:items-center">
        <div className="min-w-0">
          <h3 className="text-lg font-black leading-snug">
            {requiredActionLabel(obligation.type)}
          </h3>
          <p className="mt-1 font-bold text-slate-800">
            {row.systemName} · {row.building}
          </p>
          <p className="mt-1 text-sm text-slate-600">{row.address}</p>
          <details className="detail-disclosure mt-2">
            <summary>Why this is required</summary>
            <p className="mt-2 text-slate-600">{obligation.reason}</p>
          </details>
          {row.visitOpportunity?.obligations.some(
            (item) => item.id === obligation.id,
          ) &&
            row.visitOpportunity.obligations.length > 1 && (
              <details className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-950">
                <summary className="cursor-pointer font-black">
                  Optional: complete{" "}
                  {row.visitOpportunity.obligations.length - 1} other
                  requirement
                  {row.visitOpportunity.obligations.length === 2 ? "" : "s"}
                </summary>
                <p className="mt-2 font-bold">
                  This is a work-saving suggestion, not another required task.
                  Work completed on one valid date can satisfy every listed
                  requirement from {row.visitOpportunity.start} through{" "}
                  {row.visitOpportunity.end}.
                </p>
                <ul className="mt-2 list-disc pl-5">
                  {row.visitOpportunity.obligations
                    .filter((item) => item.id !== obligation.id)
                    .map((item) => (
                      <li key={item.id}>{requiredActionLabel(item.type)}</li>
                    ))}
                </ul>
              </details>
            )}
        </div>
        <div className="date-block !p-3">
          <ComplianceDate
            value={obligation.latest}
            label="Deadline"
            deadline
            compact
            operational
            showWeekendLabel={false}
            empty={obligation.priority === "EMERGENCY" ? "Immediate" : "Open"}
          />
          {obligation.latest && (
            <p className="mt-1 text-sm font-black text-emerald-900">
              {formatWorkingDaysLeft(obligation.latest, today)}
            </p>
          )}
          {deadlineInfo?.weekendRisk && (
            <details className="detail-disclosure mt-1 text-sm">
              <summary>Weekend deadline</summary>
              <p className="mt-1">
                Last normal workday:{" "}
                {formatComplianceDate(deadlineInfo.weekendRisk.lastWorkingDay)}.
                The compliance deadline does not move.
              </p>
            </details>
          )}
        </div>
        <Link
          className={buttonClass(
            "primary",
            "min-h-11 w-full justify-center whitespace-normal text-center lg:self-center lg:w-auto",
          )}
          href={primaryHref}
        >
          {primaryLabel}
        </Link>
      </div>
    </ClickableRow>
  );
}

function compactWeekDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(asUtc(value));
}

function actionDeadlineSort(
  a: { obligation: DashboardObligation },
  b: { obligation: DashboardObligation },
) {
  return (a.obligation.latest ?? "9999-12-31").localeCompare(
    b.obligation.latest ?? "9999-12-31",
  );
}

export default async function ActionCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ workflowNotice?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const workflowNotice =
    typeof query.workflowNotice === "string" ? query.workflowNotice : null;
  const today = todayDateOnly();
  const rows = await complianceDashboardRows({
    organizationId: user.organizationId,
    today,
  });
  const visitIssues = await db.cleaningJob.findMany({
    where: {
      building: { customer: { organizationId: user.organizationId } },
      OR: [
        {
          addVisit: {
            scheduledDate: { lt: asUtc(today) },
            status: { in: ["PLANNED", "CONFIRMED", "IN_PROGRESS"] },
          },
        },
        {
          cleaningVisit: {
            scheduledDate: { lte: asUtc(today) },
            status: { in: ["PLANNED", "CONFIRMED", "IN_PROGRESS"] },
          },
          addVisit: { status: { not: "COMPLETED" } },
        },
      ],
    },
    include: {
      building: true,
      addVisit: true,
      cleaningVisit: true,
      towers: true,
    },
    orderBy: { cleaningVisit: { scheduledDate: "asc" } },
    take: 12,
  });
  const actionable = rows.flatMap((row) =>
    row.openObligations
      .filter(
        (obligation) =>
          ["OUR_COMPANY", null].includes(
            operationalResponsibility(row, obligation),
          ) &&
          ![
            "MISSED",
            "OVERDUE",
            "COMPLETED",
            "CANCELED",
            "SUPERSEDED",
          ].includes(obligation.status),
      )
      .map((obligation) => ({ row, obligation })),
  );
  const immediateItems = actionable
    .filter(({ obligation }) => obligation.priority === "EMERGENCY")
    .sort(actionDeadlineSort);
  const immediateIds = new Set(
    immediateItems.map(({ obligation }) => obligation.id),
  );
  const thisWeekItems = actionable
    .filter(
      ({ obligation }) =>
        !immediateIds.has(obligation.id) &&
        deadlinePeriodForDate(obligation.latest, today) === "THIS_WEEK",
    )
    .sort(actionDeadlineSort);
  const issueCount = rows.reduce(
    (count, row) =>
      count +
      row.openObligations.filter(
        (obligation) =>
          ["OUR_COMPANY", null].includes(
            operationalResponsibility(row, obligation),
          ) && ["MISSED", "OVERDUE"].includes(obligation.status),
      ).length,
    0,
  );
  const periodBounds = deadlinePeriodBounds(today);
  const actionPreviewLimit = 5;

  return (
    <>
      <PageHeader
        eyebrow="Daily work"
        title="Today"
        description="Start with the first item. TowerTrack puts the most urgent work first."
      />
      {workflowNotice && (
        <div
          className="mb-7 flex items-start gap-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 text-emerald-950"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 shrink-0" size={22} aria-hidden />
          <div>
            <div className="font-black">Record saved successfully</div>
            <p className="mt-1 text-sm font-bold">{workflowNotice}</p>
          </div>
        </div>
      )}

      {visitIssues.length > 0 && (
        <section className="section-panel mb-7 border-amber-300">
          <div className="border-b border-amber-300 bg-amber-50 p-5">
            <h2 className="text-xl font-black text-amber-950">
              Scheduled visits needing attention
            </h2>
            <p className="mt-1 text-sm font-bold text-amber-900">
              Review overdue visits and cleaning plans that are not ready.
            </p>
          </div>
          {visitIssues.map((job) => (
            <Link
              key={job.id}
              href={`/calendar?month=${dateOnly(job.cleaningVisit.scheduledDate).slice(0, 7)}&job=${job.id}`}
              className="record-row block border-l-4 border-amber-500 p-4 hover:bg-amber-50"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-black">
                    {job.building.buildingName} · {job.towers.length} tower
                    {job.towers.length === 1 ? "" : "s"}
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    Chemical addition{" "}
                    {formatComplianceDate(job.addVisit.scheduledDate)} (
                    {job.addVisit.status.replaceAll("_", " ")}) → Cleaning{" "}
                    {formatComplianceDate(job.cleaningVisit.scheduledDate)}
                  </div>
                </div>
                <span className="btn">Review schedule</span>
              </div>
            </Link>
          ))}
        </section>
      )}

      {(issueCount > 0 || immediateItems.length > 0) && (
        <section className="section-panel mb-7 border-red-200">
          <div className="border-b border-red-200 bg-red-50 p-5">
            <h2 className="mt-1 text-xl font-black text-red-950">Act now</h2>
            <p className="mt-1 text-sm font-bold text-red-800">
              Urgent work and unresolved compliance issues
            </p>
          </div>
          {immediateItems.map(({ row, obligation }) => (
            <ActionRow
              key={obligation.id}
              row={row}
              obligation={obligation}
              today={today}
              tone="immediate"
            />
          ))}
          {issueCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-red-200 bg-red-50/40 p-5 text-red-950">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 shrink-0" size={20} />
                <div>
                  <h3 className="font-black">
                    Compliance failures requiring review · {issueCount}{" "}
                    unresolved compliance{" "}
                    {issueCount === 1 ? "issue" : "issues"}
                  </h3>
                  <p className="mt-1 text-sm">
                    Review missed or overdue company responsibilities.
                  </p>
                </div>
              </div>
              <Link
                className="btn min-h-11 border-red-300 bg-white"
                href="/work/overdue-towers"
              >
                Review compliance issues
              </Link>
            </div>
          )}
        </section>
      )}

      <section
        className="section-panel action-center-due-week mb-7"
        data-testid="this-week-section"
      >
        <div className="action-center-due-week-header flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <div className="flex items-start gap-3">
            <CalendarCheck
              className="action-center-due-week-accent mt-1"
              size={20}
            />
            <div>
              <h2 className="mt-1 text-xl font-black">This week</h2>
              <p className="action-center-due-week-accent mt-1 text-sm font-bold">
                Work requiring action now
              </p>
              <p className="mt-1 text-sm text-slate-700">
                Today through {compactWeekDate(periodBounds.thisWeekEnd)}
              </p>
            </div>
          </div>
          {thisWeekItems.length > 0 && (
            <Link
              className="action-center-due-week-accent text-sm font-black"
              href="/deadlines?period=THIS_WEEK"
            >
              View all due this week →
            </Link>
          )}
        </div>
        {thisWeekItems.length ? (
          thisWeekItems
            .slice(0, actionPreviewLimit)
            .map(({ row, obligation }) => (
              <ActionRow
                key={obligation.id}
                row={row}
                obligation={obligation}
                today={today}
              />
            ))
        ) : (
          <div className="flex items-center gap-3 p-5 text-emerald-900">
            <CheckCircle2 size={22} aria-hidden />
            <div>
              <p className="font-black">You’re caught up</p>
              <p className="text-sm">No work is due this week.</p>
            </div>
          </div>
        )}
        {thisWeekItems.length > actionPreviewLimit && (
          <div className="action-center-due-week-footer border-t p-4 text-center">
            <Link
              className="action-center-due-week-accent font-black underline underline-offset-4"
              href="/deadlines?period=THIS_WEEK"
            >
              Showing {actionPreviewLimit} of {thisWeekItems.length} · View all
              due this week →
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
