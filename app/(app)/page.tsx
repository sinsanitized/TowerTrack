import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Layers3,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ComplianceDate, ComplianceWindow } from "@/components/compliance-date";
import { StatusBadge } from "@/components/status-badge";
import { ClickableRow } from "@/components/clickable-row";
import { getUrgency } from "@/lib/compliance-intelligence";
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
import { requirementLabel, requiredActionLabel } from "@/lib/labels";
import { requireUser } from "@/lib/auth";
import { asUtc, todayDateOnly } from "@/lib/date";
import { withReturnPath } from "@/lib/workflow-context";
import { isResampleObligation } from "@/lib/event-entry-intent";

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
  const urgency = getUrgency({
    today,
    status: obligation.status,
    priority: obligation.priority,
    latestDueDate: obligation.latest,
    targetStartDate: obligation.targetStart,
  });
  const responsibility = operationalResponsibility(row, obligation);
  const executionLabel =
    obligation.status === "SCHEDULED"
      ? "Scheduled (not completed)"
      : responsibility == null
        ? "Waiting on review"
        : responsibility === "CUSTOMER"
          ? "Waiting on customer"
          : responsibility === "OTHER_VENDOR"
            ? "Waiting on vendor"
            : responsibility === "NOT_TRACKED"
              ? "Reference only"
              : "Unscheduled";
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
      className={`record-row border-l-4 p-4 sm:p-5 ${
        tone === "next"
          ? "urgency-blue"
          : tone === "immediate"
            ? "urgency-red"
            : "urgency-amber"
      }`}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(260px,1.15fr)_minmax(220px,.9fr)_minmax(210px,.8fr)_auto] lg:items-center">
        <div className="min-w-0">
          <h3 className="text-lg font-black leading-snug">
            {requiredActionLabel(obligation.type)}
          </h3>
          <details className="detail-disclosure mt-3">
            <summary>Why this is required</summary>
            <p className="mt-2 text-slate-600">{obligation.reason}</p>
            <p className="mt-2 text-xs font-black uppercase tracking-wide text-slate-500">
              {row.profileSourceLabel}
            </p>
          </details>
          {row.visitOpportunity?.obligations.some(
            (item) => item.id === obligation.id,
          ) &&
            row.visitOpportunity.obligations.length > 1 && (
              <details className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                <summary className="cursor-pointer font-black">
                  Optional: complete{" "}
                  {row.visitOpportunity.obligations.length - 1} other
                  requirement
                  {row.visitOpportunity.obligations.length === 2 ? "" : "s"}
                </summary>
                <p className="mt-2 font-bold">
                  This is a route-saving suggestion, not another required task.
                  One visit can complete all listed field work from{" "}
                  {row.visitOpportunity.start} through{" "}
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
        <div className="identity-block">
          <Link
            className="font-black text-emerald-900 underline decoration-emerald-300 underline-offset-2"
            href={`/systems/${row.id}`}
          >
            {row.systemName}
          </Link>
          <div className="mt-1 font-bold text-slate-800">{row.building}</div>
          <div className="mt-1 text-sm text-slate-600">{row.address}</div>
        </div>
        <div className="date-block">
          <ComplianceDate
            value={obligation.latest}
            label="Deadline"
            deadline
            operational
            empty={obligation.priority === "EMERGENCY" ? "Immediate" : "Open"}
          />
          <div className="mt-2">
            <StatusBadge color={urgency.color} label={urgency.label} />
          </div>
          {executionLabel === "Unscheduled" ? (
            <p className="mt-2 text-sm font-bold text-slate-600">Unscheduled</p>
          ) : (
            <div className="mt-2">
              <StatusBadge
                color={
                  obligation.status === "SCHEDULED"
                    ? "BLUE"
                    : executionLabel.startsWith("Waiting") ||
                        executionLabel === "Reference only"
                      ? "PURPLE"
                      : "GRAY"
                }
                label={executionLabel}
              />
            </div>
          )}
        </div>
        <Link
          className={buttonClass(
            "primary",
            "min-h-11 w-full justify-center whitespace-normal text-center lg:w-auto",
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
  const thisWeekIds = new Set(
    thisWeekItems.map(({ obligation }) => obligation.id),
  );
  const nextWeekItems = actionable
    .filter(
      ({ obligation }) =>
        !immediateIds.has(obligation.id) &&
        deadlinePeriodForDate(obligation.latest, today) === "NEXT_WEEK",
    )
    .sort(actionDeadlineSort);
  const visibleActionIds = new Set([
    ...immediateIds,
    ...thisWeekIds,
    ...nextWeekItems.map(({ obligation }) => obligation.id),
  ]);
  const combinedRows = rows.filter(
    (row) =>
      (row.visitOpportunity?.obligations.length ?? 0) > 1 &&
      row.visitOpportunity!.obligations.every(
        (item) => !visibleActionIds.has(item.id),
      ),
  );
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
  const actionPreviewLimit = 8;

  return (
    <>
      <PageHeader
        eyebrow="Daily operations"
        title="Action Center"
        description="Start here. Complete the first item under Act now. If there are none, work down this page from top to bottom—TowerTrack will guide each step."
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

      {(issueCount > 0 || immediateItems.length > 0) && (
        <section className="section-panel mb-7 border-red-200">
          <div className="border-b border-red-200 bg-red-50 p-5">
            <h2 className="mt-1 text-xl font-black text-red-950">
              Immediate attention
            </h2>
            <p className="mt-1 text-sm font-bold text-red-800">
              Urgent work and unresolved failures
            </p>
          </div>
          {immediateItems.length > 0 && (
            <div className="border-b border-red-200 bg-red-50/70 px-5 py-3">
              <h3 className="font-black text-red-950">Act now</h3>
              <p className="text-sm text-red-800">
                Emergency work that can still be completed immediately.
              </p>
            </div>
          )}
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
        className="section-panel mb-7 border-amber-200"
        data-testid="this-week-section"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <CalendarCheck className="mt-1 text-amber-800" size={20} />
            <div>
              <h2 className="mt-1 text-xl font-black">Due this week</h2>
              <p className="mt-1 text-sm font-bold text-amber-900">
                Work requiring action now
              </p>
              <p className="mt-1 text-sm text-slate-700">
                Today through {compactWeekDate(periodBounds.thisWeekEnd)}
              </p>
            </div>
          </div>
          <Link
            className="text-sm font-black text-amber-900"
            href="/deadlines?period=THIS_WEEK"
          >
            View all due this week →
          </Link>
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
          <p className="p-5 text-sm font-bold text-slate-600">
            Nothing else is due before the end of this week.
          </p>
        )}
        {thisWeekItems.length > actionPreviewLimit && (
          <div className="border-t border-amber-200 bg-amber-50/50 p-4 text-center">
            <Link
              className="font-black text-amber-900 underline underline-offset-4"
              href="/deadlines?period=THIS_WEEK"
            >
              Showing {actionPreviewLimit} of {thisWeekItems.length} · View all
              due this week →
            </Link>
          </div>
        )}
      </section>

      <section
        className="section-panel mb-7 border-blue-200"
        data-testid="next-week-section"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-200 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <CalendarCheck className="mt-1 text-blue-700" size={20} />
            <div>
              <h2 className="mt-1 text-xl font-black">Next week</h2>
              <p className="mt-1 text-sm font-bold text-blue-800">
                Near-term planning
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {compactWeekDate(periodBounds.nextWeekStart)} through{" "}
                {compactWeekDate(periodBounds.nextWeekEnd)}
              </p>
            </div>
          </div>
          <Link
            className="text-sm font-black text-blue-800"
            href="/deadlines?period=NEXT_WEEK"
          >
            View all due next week →
          </Link>
        </div>
        {nextWeekItems.length ? (
          nextWeekItems
            .slice(0, actionPreviewLimit)
            .map(({ row, obligation }) => (
              <ActionRow
                key={obligation.id}
                row={row}
                obligation={obligation}
                today={today}
                tone="next"
              />
            ))
        ) : (
          <p className="p-5 text-sm font-bold text-blue-900">
            Nothing is currently due next week.
          </p>
        )}
        {nextWeekItems.length > actionPreviewLimit && (
          <div className="border-t border-blue-200 bg-blue-50/50 p-4 text-center">
            <Link
              className="font-black text-blue-800 underline underline-offset-4"
              href="/deadlines?period=NEXT_WEEK"
            >
              Showing {actionPreviewLimit} of {nextWeekItems.length} · View all
              due next week →
            </Link>
          </div>
        )}
      </section>

      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Layers3 className="mt-1" size={20} />
            <div>
              <h2 className="mt-1 text-xl font-black">
                Combine work into one visit
              </h2>
              <p className="mt-1 text-sm font-bold text-emerald-800">
                Route and requirement planning
              </p>
            </div>
          </div>
          <Link
            className="text-sm font-black text-emerald-800"
            href="/work/visit-opportunities"
          >
            View all recommendations →
          </Link>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {combinedRows.length ? (
            combinedRows.map((row) => {
              const opportunity = row.visitOpportunity!;
              return (
                <article
                  key={row.id}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
                >
                  <div className="font-black">{row.systemName}</div>
                  <div className="text-sm text-emerald-950">{row.building}</div>
                  <h3 className="mt-3 text-lg font-black">
                    One visit can satisfy {opportunity.obligations.length}{" "}
                    requirements
                  </h3>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {opportunity.obligations.map((item) => (
                      <li key={item.id}>{requirementLabel(item.type)}</li>
                    ))}
                  </ul>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <ComplianceWindow
                      start={opportunity.start}
                      end={opportunity.end}
                      label="Recommended combined service dates"
                      compact
                    />
                    <ComplianceDate
                      value={opportunity.controllingDeadline}
                      label="Deadline"
                      deadline
                      operational
                    />
                  </div>
                  <Link
                    className="btn btn-primary mt-4 min-h-11"
                    href={`/systems/${row.id}#record-event`}
                  >
                    Open tower
                  </Link>
                </article>
              );
            })
          ) : (
            <p className="text-sm font-bold text-slate-600">
              No later requirements currently share valid completion dates.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
