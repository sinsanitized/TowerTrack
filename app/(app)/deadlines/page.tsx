import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DeadlineFilterControls } from "@/components/deadline-filter-controls";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import {
  buildTowerDeadlineRows,
  deadlineActionValues,
  deadlinePeriodValues,
  deadlineScheduleValues,
  filterTowerDeadlineRows,
  type DeadlineActionFilter,
  type DeadlinePeriod,
  type DeadlineScheduleFilter,
} from "@/lib/deadline-view";
import { todayDateOnly } from "@/lib/date";
import { withReturnPath } from "@/lib/workflow-context";
import { complianceDashboardRows } from "@/lib/queries";
import {
  serviceResponsibilityValues,
  type ResponsibilityFilter,
} from "@/lib/service-responsibility";

export default async function DeadlinesPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    action?: string;
    schedule?: string;
    responsibility?: string;
    q?: string;
    page?: string;
    workflowNotice?: string;
  }>;
}) {
  const user = await requireUser();
  const today = todayDateOnly();
  const requested = await searchParams;
  const period = deadlinePeriodValues.includes(
    requested.period as DeadlinePeriod,
  )
    ? (requested.period as DeadlinePeriod)
    : "ALL";
  const action = deadlineActionValues.includes(
    requested.action as DeadlineActionFilter,
  )
    ? (requested.action as DeadlineActionFilter)
    : "ALL";
  const schedule = deadlineScheduleValues.includes(
    requested.schedule as DeadlineScheduleFilter,
  )
    ? (requested.schedule as DeadlineScheduleFilter)
    : "ALL";
  const responsibility: ResponsibilityFilter =
    requested.responsibility === "ALL" ||
    requested.responsibility === "UNCONFIRMED" ||
    serviceResponsibilityValues.includes(requested.responsibility as never)
      ? (requested.responsibility as ResponsibilityFilter)
      : "OUR_COMPANY";
  const search = typeof requested.q === "string" ? requested.q.trim() : "";
  const workflowNotice =
    typeof requested.workflowNotice === "string"
      ? requested.workflowNotice
      : null;
  const towers = await complianceDashboardRows({
    organizationId: user.organizationId,
    today,
    includeMissed: true,
  });
  const allRows = buildTowerDeadlineRows(towers, today);
  const rows = filterTowerDeadlineRows(allRows, today, {
    period,
    action,
    schedule,
    responsibility,
    search,
  });
  const towerGroups = Array.from(
    rows.reduce((groups, row) => {
      const group = groups.get(row.towerId);
      if (group) group.push(row);
      else groups.set(row.towerId, [row]);
      return groups;
    }, new Map<string, typeof rows>()),
  ).map(([towerId, deadlines]) => ({ towerId, deadlines }));
  const pageSize = 10;
  const requestedPage = Number.parseInt(requested.page ?? "1", 10);
  const pageCount = Math.max(1, Math.ceil(towerGroups.length / pageSize));
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), pageCount)
    : 1;
  const visibleTowerGroups = towerGroups.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const towerCount = towerGroups.length;
  const statusCounts = {
    overdue: rows.filter((row) => row.status === "Overdue").length,
    thisWeek: rows.filter((row) => row.status === "Due this week").length,
    nextWeek: rows.filter((row) => row.status === "Due next week").length,
  };
  const returnQuery = new URLSearchParams();
  if (period !== "ALL") returnQuery.set("period", period);
  if (action !== "ALL") returnQuery.set("action", action);
  if (schedule !== "ALL") returnQuery.set("schedule", schedule);
  if (responsibility !== "OUR_COMPANY")
    returnQuery.set("responsibility", responsibility);
  if (search) returnQuery.set("q", search);
  const deadlineReturnTo = returnQuery.size
    ? `/deadlines?${returnQuery}`
    : "/deadlines";
  const deadlinePeriodHref = (nextPeriod: DeadlinePeriod) => {
    const query = new URLSearchParams(returnQuery);
    if (nextPeriod === "ALL") query.delete("period");
    else query.set("period", nextPeriod);
    return query.size ? `/deadlines?${query}` : "/deadlines";
  };
  const pageHref = (nextPage: number) => {
    const query = new URLSearchParams(returnQuery);
    if (nextPage > 1) query.set("page", String(nextPage));
    return query.size ? `/deadlines?${query}` : "/deadlines";
  };
  const urgencySections = [
    {
      key: "Overdue",
      label: "Overdue",
      help: "These deadlines have passed and need attention.",
      color: "red",
    },
    {
      key: "Due this week",
      label: "Due this week",
      help: "Complete these before the end of this week.",
      color: "amber",
    },
    {
      key: "Due next week",
      label: "Due next week",
      help: "Prepare these after the current week's work.",
      color: "blue",
    },
    {
      key: "Review required",
      label: "Needs review",
      help: "A date or responsibility needs confirmation.",
      color: "purple",
    },
    {
      key: "Due later",
      label: "Upcoming",
      help: "Later deadlines, shown in date order.",
      color: "slate",
    },
  ] as const;
  return (
    <>
      <PageHeader
        eyebrow="Portfolio deadlines"
        title="All tower deadlines"
        description="Every deadline in date order, with working days remaining."
      />
      <details className="detail-disclosure mb-5">
        <summary>How working days are calculated</summary>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Working days exclude weekends, observed federal holidays, and the day
          after Thanksgiving. Veterans Day remains a working day.
        </p>
      </details>
      {workflowNotice && (
        <div
          className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950"
          role="status"
        >
          {workflowNotice} Continue with the remaining deadlines below.
        </div>
      )}
      <DeadlineFilterControls
        filters={{ period, action, schedule, responsibility, search }}
      />

      <section
        className="panel mb-4 flex flex-wrap items-center justify-between gap-3 p-3"
        aria-labelledby="deadline-overview-heading"
      >
        <div>
          <h2 id="deadline-overview-heading" className="section-heading">
            At a glance
          </h2>
          <p className="supporting-text mt-1">
            {rows.length} requirement{rows.length === 1 ? "" : "s"} across{" "}
            {towerCount} cooling tower{towerCount === 1 ? "" : "s"}.
          </p>
        </div>
        <div
          className="flex flex-wrap gap-2 text-sm font-bold"
          aria-label="Deadline status filters"
        >
          {statusCounts.overdue > 0 && (
            <Link
              aria-current={period === "OVERDUE" ? "page" : undefined}
              className={`rounded-lg border bg-white px-3 py-2 text-red-800 transition hover:border-red-600 hover:bg-red-50 ${period === "OVERDUE" ? "border-red-600 ring-2 ring-red-100" : "border-red-300"}`}
              href={deadlinePeriodHref("OVERDUE")}
            >
              {statusCounts.overdue} overdue <span aria-hidden>→</span>
            </Link>
          )}
          {statusCounts.thisWeek > 0 && (
            <Link
              aria-current={period === "THIS_WEEK" ? "page" : undefined}
              className={`rounded-lg border bg-white px-3 py-2 text-amber-900 transition hover:border-amber-600 hover:bg-amber-50 ${period === "THIS_WEEK" ? "border-amber-600 ring-2 ring-amber-100" : "border-amber-300"}`}
              href={deadlinePeriodHref("THIS_WEEK")}
            >
              {statusCounts.thisWeek} due this week <span aria-hidden>→</span>
            </Link>
          )}
          {statusCounts.nextWeek > 0 && (
            <Link
              aria-current={period === "NEXT_WEEK" ? "page" : undefined}
              className={`rounded-lg border bg-white px-3 py-2 text-blue-800 transition hover:border-blue-600 hover:bg-blue-50 ${period === "NEXT_WEEK" ? "border-blue-600 ring-2 ring-blue-100" : "border-blue-300"}`}
              href={deadlinePeriodHref("NEXT_WEEK")}
            >
              {statusCounts.nextWeek} due next week <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </section>

      {rows.length === 0 ? (
        <div className="panel p-8 text-center">
          <h2 className="text-lg font-black">No active deadlines</h2>
          <p className="mt-2 text-slate-600">
            No cooling tower requirements match the selected filters.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <h2 className="section-heading">Deadline register</h2>
              <p className="supporting-text mt-1">
                Towers are grouped by their most urgent deadline. Select a tower
                to see all of its required work.
              </p>
            </div>
            <div className="text-sm font-black text-slate-700">
              Showing towers {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, towerGroups.length)} of{" "}
              {towerGroups.length}
            </div>
          </div>
          {urgencySections.map((section) => {
            const groups = visibleTowerGroups.filter(
              ({ deadlines }) => deadlines[0]?.status === section.key,
            );
            if (groups.length === 0) return null;
            return (
              <details
                key={section.key}
                className={`panel overflow-hidden border-l-4 urgency-${section.color}`}
                open={section.key === "Overdue" || period !== "ALL"}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 bg-slate-50 px-4 py-3 marker:hidden">
                  <span>
                    <span className="font-black text-slate-950">
                      {section.label} · {groups.length} tower
                      {groups.length === 1 ? "" : "s"}
                    </span>
                    <span className="mt-0.5 block text-sm text-slate-600">
                      {section.help}
                    </span>
                  </span>
                  <ChevronRight
                    className="shrink-0 text-slate-500"
                    aria-hidden
                  />
                </summary>
                <div className="divide-y divide-slate-200 border-t border-slate-200">
                  {groups.map(({ towerId, deadlines }) => {
                    const nearest = deadlines[0];
                    return (
                      <details key={towerId} className="bg-white">
                        <summary className="grid cursor-pointer list-none gap-2 px-4 py-3 marker:hidden hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5">
                          <span className="min-w-0">
                            <span className="block font-black text-slate-950">
                              {nearest.systemName}
                            </span>
                            <span className="block truncate text-sm text-slate-600">
                              {nearest.address}
                            </span>
                          </span>
                          <span className="text-sm font-bold text-slate-700">
                            {deadlines.length} requirement
                            {deadlines.length === 1 ? "" : "s"}
                          </span>
                          <span className="sm:text-right">
                            <span className="block text-sm font-black text-slate-950">
                              {nearest.workingDaysDisplay}
                            </span>
                            <span className="block text-xs font-bold text-slate-500">
                              Hard deadline {nearest.hardDueDateDisplay}
                            </span>
                          </span>
                        </summary>
                        <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-3">
                          <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                            {deadlines.map((row) => {
                              const primaryHref =
                                row.primaryActionHref.includes(
                                  "#record-event",
                                ) ||
                                row.primaryActionHref.includes(
                                  "#service-responsibilities",
                                )
                                  ? withReturnPath(
                                      row.primaryActionHref,
                                      deadlineReturnTo,
                                    )
                                  : row.primaryActionHref;
                              return (
                                <Link
                                  key={row.id}
                                  href={primaryHref}
                                  aria-label={row.primaryActionAccessible}
                                  className="grid gap-3 p-3 transition hover:bg-slate-50 sm:grid-cols-[minmax(14rem,1.5fr)_minmax(10rem,1fr)_minmax(8rem,.8fr)_auto] sm:items-center"
                                >
                                  <span>
                                    <span className="block font-bold text-slate-950">
                                      {row.requiredAction}
                                    </span>
                                    <span className="mt-1 block text-xs font-bold text-slate-500">
                                      {row.executionLane}
                                      {row.dependency
                                        ? ` · ${row.dependency}`
                                        : ""}
                                    </span>
                                  </span>
                                  <span className="text-sm text-slate-700">
                                    <span className="label block">
                                      Target window
                                    </span>
                                    <span
                                      aria-label={row.targetWindowAccessible}
                                    >
                                      {row.targetWindowDisplay}
                                    </span>
                                  </span>
                                  <span className="text-sm text-slate-700">
                                    <span className="label block">
                                      Hard deadline
                                    </span>
                                    <span
                                      aria-label={row.hardDueDateAccessible}
                                    >
                                      {row.hardDueDateDisplay}
                                    </span>
                                  </span>
                                  <span className="flex items-center justify-between gap-3 sm:justify-end">
                                    <StatusBadge
                                      compact
                                      color={
                                        row.status === "Overdue"
                                          ? "RED"
                                          : row.status === "Due this week"
                                            ? "YELLOW"
                                            : row.status === "Due next week"
                                              ? "BLUE"
                                              : row.status === "Review required"
                                                ? "PURPLE"
                                                : "GREEN"
                                      }
                                      label={row.status}
                                    />
                                    <ChevronRight size={18} aria-hidden />
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                          <Link
                            className="mt-3 inline-flex items-center gap-1 text-sm font-black text-emerald-900 underline decoration-emerald-300 underline-offset-2"
                            href={`/systems/${towerId}`}
                          >
                            Open {nearest.systemName} <span aria-hidden>→</span>
                          </Link>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </details>
            );
          })}
          {pageCount > 1 && (
            <nav
              className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-4"
              aria-label="Deadline register pages"
            >
              {page > 1 ? (
                <Link className="btn" href={pageHref(page - 1)}>
                  ← Previous towers
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm font-bold text-slate-700">
                Page {page} of {pageCount}
              </span>
              {page < pageCount ? (
                <Link className="btn" href={pageHref(page + 1)}>
                  Next towers →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>
      )}
    </>
  );
}
