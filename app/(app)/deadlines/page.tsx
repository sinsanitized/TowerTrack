import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DeadlineFilterControls } from "@/components/deadline-filter-controls";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { buttonClass } from "@/lib/button-variants";
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
  const towerCount = new Set(rows.map((row) => row.towerId)).size;
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
  return (
    <>
      <PageHeader
        eyebrow="Portfolio deadlines"
        title="All tower deadlines"
        description="See every deadline in date order. Working days exclude weekends, observed federal holidays, and the day after Thanksgiving; Veterans Day remains a working day."
      />
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
        className="panel mb-5 grid gap-5 p-4 lg:grid-cols-[auto_1fr] lg:items-end"
        aria-labelledby="deadline-overview-heading"
      >
        <div>
          <h2 id="deadline-overview-heading" className="section-heading">
            Deadline overview
          </h2>
          <p className="supporting-text mt-1">
            Choose a status to filter the register below.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold text-slate-700">
            <Link
              aria-current={period === "ALL" ? "page" : undefined}
              className={`flex items-center gap-2 rounded-xl border bg-white px-4 py-3 transition hover:border-emerald-600 hover:text-emerald-900 hover:shadow-sm ${period === "ALL" ? "border-emerald-700 ring-2 ring-emerald-100" : "border-slate-300"}`}
              href={deadlinePeriodHref("ALL")}
            >
              <CalendarRange size={18} className="text-emerald-800" />
              {rows.length} active requirement{rows.length === 1 ? "" : "s"}
              <span aria-hidden>→</span>
            </Link>
            <Link
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 transition hover:border-emerald-600 hover:text-emerald-900 hover:shadow-sm"
              href="/towers"
            >
              {towerCount} cooling tower{towerCount === 1 ? "" : "s"}{" "}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
        <div>
          <div className="label mb-2">Deadline status</div>
          <div className="flex flex-wrap gap-2 text-sm font-bold">
            {statusCounts.overdue > 0 && (
              <Link
                aria-current={period === "OVERDUE" ? "page" : undefined}
                className={`rounded-xl border bg-white px-4 py-3 text-red-800 transition hover:border-red-600 hover:bg-red-50 hover:shadow-sm ${period === "OVERDUE" ? "border-red-600 ring-2 ring-red-100" : "border-red-300"}`}
                href={deadlinePeriodHref("OVERDUE")}
              >
                {statusCounts.overdue} overdue <span aria-hidden>→</span>
              </Link>
            )}
            {statusCounts.thisWeek > 0 && (
              <Link
                aria-current={period === "THIS_WEEK" ? "page" : undefined}
                className={`rounded-xl border bg-white px-4 py-3 text-amber-900 transition hover:border-amber-600 hover:bg-amber-50 hover:shadow-sm ${period === "THIS_WEEK" ? "border-amber-600 ring-2 ring-amber-100" : "border-amber-300"}`}
                href={deadlinePeriodHref("THIS_WEEK")}
              >
                {statusCounts.thisWeek} due this week <span aria-hidden>→</span>
              </Link>
            )}
            {statusCounts.nextWeek > 0 && (
              <Link
                aria-current={period === "NEXT_WEEK" ? "page" : undefined}
                className={`rounded-xl border bg-white px-4 py-3 text-blue-800 transition hover:border-blue-600 hover:bg-blue-50 hover:shadow-sm ${period === "NEXT_WEEK" ? "border-blue-600 ring-2 ring-blue-100" : "border-blue-300"}`}
                href={deadlinePeriodHref("NEXT_WEEK")}
              >
                {statusCounts.nextWeek} due next week <span aria-hidden>→</span>
              </Link>
            )}
          </div>
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
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <h2 className="section-heading">Deadline register</h2>
              <p className="supporting-text mt-1">
                Earliest hard deadlines appear first.
              </p>
            </div>
            <div className="text-sm font-black text-slate-700">
              {rows.length} result{rows.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="overflow-x-auto" data-testid="deadline-table-scroll">
            <table
              className="deadline-table w-full table-fixed text-left text-xs xl:text-sm"
              aria-label="All cooling tower required work"
            >
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[25%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[16%]" />
                <col className="w-[13%]" />
              </colgroup>
              <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-3">Cooling tower</th>
                  <th className="px-3 py-3">Required work</th>
                  <th className="px-3 py-3">Target window</th>
                  <th className="px-3 py-3">Hard deadline</th>
                  <th className="px-3 py-3">Working days left</th>
                  <th className="px-3 py-3">Next step</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`align-top border-l-4 bg-white ${
                      row.status === "Overdue"
                        ? "urgency-red"
                        : row.status === "Due this week"
                          ? "urgency-amber"
                          : row.status === "Due next week"
                            ? "urgency-blue"
                            : row.status === "Review required"
                              ? "urgency-purple"
                              : "border-l-slate-300"
                    }`}
                  >
                    <td
                      className="break-words px-3 py-4"
                      data-label="Cooling tower"
                    >
                      <Link
                        className="font-black text-emerald-900 underline decoration-emerald-300 underline-offset-2"
                        href={`/systems/${row.towerId}`}
                      >
                        {row.systemName}
                      </Link>
                      <div className="mt-1 text-slate-600">{row.address}</div>
                    </td>
                    <td
                      className="break-words px-3 py-4 font-bold text-slate-900"
                      data-label="Required work"
                    >
                      {row.requiredAction}
                      <div className="mt-1 text-xs font-bold text-slate-500">
                        {row.executionLane}
                        {row.dependency ? ` · ${row.dependency}` : ""}
                      </div>
                      <div className="mt-2">
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
                      </div>
                      {row.responsibility !== "OUR_COMPANY" && (
                        <span
                          className={`mt-2 inline-flex rounded-full border px-2 py-1 text-sm font-bold ${row.responsibility == null ? "border-purple-300 bg-purple-50 text-purple-900" : "border-slate-200 bg-slate-100 text-slate-700"}`}
                        >
                          {row.responsibilityLabel}
                        </span>
                      )}
                    </td>
                    <td
                      data-label="Target window"
                      className="px-3 py-4 font-bold text-slate-800"
                    >
                      <span aria-label={row.targetWindowAccessible}>
                        {row.targetWindowDisplay}
                      </span>
                    </td>
                    <td
                      data-label="Hard deadline"
                      className={`px-3 py-4 font-black ${row.status === "Overdue" ? "text-red-800" : row.status === "Due this week" ? "text-amber-900" : row.status === "Due next week" ? "text-blue-800" : row.status === "Review required" ? "text-purple-800" : "text-slate-800"}`}
                    >
                      <span aria-label={row.hardDueDateAccessible}>
                        {row.hardDueDateDisplay}
                      </span>
                    </td>
                    <td
                      data-label="Working days left"
                      className={`px-3 py-4 text-lg font-black ${row.status === "Overdue" ? "text-red-800" : row.status === "Due this week" ? "text-amber-900" : row.status === "Due next week" ? "text-blue-800" : row.status === "Review required" ? "text-purple-800" : "text-slate-800"}`}
                      aria-label={row.workingDaysAccessible}
                    >
                      {row.workingDaysDisplay}
                    </td>
                    <td className="px-3 py-4" data-label="Next step">
                      <Link
                        aria-label={row.primaryActionAccessible}
                        className={buttonClass(
                          row.primaryActionLabel.startsWith("Record")
                            ? "primary"
                            : "secondary",
                          "w-full min-w-0 px-3 py-2 text-center leading-tight",
                        )}
                        href={
                          row.primaryActionHref.includes("#record-event") ||
                          row.primaryActionHref.includes(
                            "#service-responsibilities",
                          )
                            ? withReturnPath(
                                row.primaryActionHref,
                                deadlineReturnTo,
                              )
                            : row.primaryActionHref
                        }
                      >
                        {row.primaryActionLabel}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
