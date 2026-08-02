import Link from "next/link";
import {
  AlertTriangle,
  CalendarRange,
  Clock3,
  SearchCheck,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { DeadlineFilterControls } from "@/components/deadline-filter-controls";
import { requireUser } from "@/lib/auth";
import { buttonClass } from "@/lib/button-variants";
import {
  buildTowerDeadlineRows,
  deadlinePeriodForDate,
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
  const overdueCount = allRows.filter((row) => row.status === "Overdue").length;
  const dueThisWeekCount = allRows.filter(
    (row) => deadlinePeriodForDate(row.hardDueDate, today) === "THIS_WEEK",
  ).length;
  const dueNextWeekCount = allRows.filter(
    (row) => deadlinePeriodForDate(row.hardDueDate, today) === "NEXT_WEEK",
  ).length;
  const unconfirmedCount = allRows.filter(
    (row) => row.responsibility == null,
  ).length;
  const towerCount = new Set(rows.map((row) => row.towerId)).size;
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

  return (
    <>
      <PageHeader
        eyebrow="Portfolio deadlines"
        title="All tower deadlines"
        description="Find company work by due date and work type. Additional schedule and responsibility filters are available when needed."
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
        className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Deadline summary"
        aria-live="polite"
      >
        <Link
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-950"
          href="/deadlines?period=OVERDUE"
        >
          <AlertTriangle className="mb-2" size={19} />
          <div className="text-2xl font-black">{overdueCount}</div>
          <div className="text-sm font-bold">Overdue</div>
        </Link>
        <Link
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"
          href="/deadlines?period=THIS_WEEK"
        >
          <Clock3 className="mb-2" size={19} />
          <div className="text-2xl font-black">{dueThisWeekCount}</div>
          <div className="text-sm font-bold">Due this week</div>
        </Link>
        <Link
          className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950"
          href="/deadlines?period=NEXT_WEEK"
        >
          <CalendarRange className="mb-2" size={19} />
          <div className="text-2xl font-black">{dueNextWeekCount}</div>
          <div className="text-sm font-bold">Due next week</div>
        </Link>
        <Link
          className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-purple-950"
          href="/deadlines?responsibility=UNCONFIRMED"
        >
          <SearchCheck className="mb-2" size={19} />
          <div className="text-2xl font-black">{unconfirmedCount}</div>
          <div className="text-sm font-bold">Responsibility not assigned</div>
        </Link>
      </section>

      <div
        className="mb-5 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700"
        aria-label="Work state key"
      >
        <span className="mr-1 uppercase tracking-wide text-slate-500">
          Work state
        </span>
        <StatusBadge color="GRAY" label="Unscheduled" />
        <StatusBadge color="BLUE" label="Scheduled (not completed)" />
        <StatusBadge color="PURPLE" label="Waiting" />
        <StatusBadge color="GREEN" label="Completed" />
        <span className="font-normal text-slate-500">
          Completed work leaves this active-deadline list and remains in
          Compliance History.
        </span>
      </div>

      <div className="mb-5 flex flex-wrap gap-3 text-sm font-bold text-slate-700">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <CalendarRange size={18} className="text-emerald-800" />
          {rows.length} active requirement{rows.length === 1 ? "" : "s"}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          {towerCount} cooling tower{towerCount === 1 ? "" : "s"}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="panel p-8 text-center">
          <h2 className="text-lg font-black">No active deadlines</h2>
          <p className="mt-2 text-slate-600">
            No cooling tower requirements match the selected filters.
          </p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto" data-testid="deadline-table-scroll">
            <table
              className="deadline-table w-full table-fixed text-left text-xs xl:text-sm"
              aria-label="All cooling tower requirements"
            >
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[21%]" />
                <col className="hidden w-[10%] xl:table-column" />
                <col className="hidden w-[12%] xl:table-column" />
                <col className="w-[10%]" />
                <col className="w-[8%]" />
                <col className="w-[10%]" />
                <col className="w-[7%]" />
              </colgroup>
              <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-2 py-3 sm:px-3">Cooling Tower</th>
                  <th className="px-2 py-3 sm:px-3">Required Action</th>
                  <th className="hidden px-2 py-3 xl:table-cell">
                    Recommended Service Date
                  </th>
                  <th className="hidden px-2 py-3 xl:table-cell">
                    Recommended Service Window
                  </th>
                  <th className="px-2 py-3">Compliance Deadline</th>
                  <th className="px-2 py-3">Days Left</th>
                  <th className="px-2 py-3">Status</th>
                  <th className="px-2 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`align-top border-l-4 ${
                      row.status === "Overdue"
                        ? "border-l-red-500 bg-red-50/60"
                        : row.status === "Due this week"
                          ? "border-l-amber-500 bg-amber-50/50"
                          : row.status === "Due next week"
                            ? "border-l-blue-500 bg-blue-50/40"
                            : row.status === "Review required"
                              ? "border-l-purple-500 bg-purple-50/40"
                              : "border-l-slate-200 bg-white"
                    }`}
                  >
                    <td
                      className="break-words px-2 py-3 sm:px-3"
                      data-label="Cooling tower"
                    >
                      <Link
                        className="font-black text-emerald-900 underline decoration-emerald-300 underline-offset-2"
                        href={`/systems/${row.towerId}`}
                      >
                        {row.systemName}
                      </Link>
                      <div className="mt-1 text-slate-600">{row.address}</div>
                      <div className="mt-1 font-bold text-slate-700">
                        {row.tonnageDisplay} · {row.operatingScheduleDisplay}
                      </div>
                    </td>
                    <td
                      className="break-words px-2 py-3 font-bold text-slate-900 sm:px-3"
                      data-label="Required action"
                    >
                      {row.requiredAction}
                      <div className="mt-1 text-xs font-bold text-slate-500">
                        {row.executionLane}
                        {row.dependency ? ` · ${row.dependency}` : ""}
                      </div>
                      {row.responsibility !== "OUR_COMPANY" && (
                        <span
                          className={`ml-2 inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${row.responsibility == null ? "border-purple-300 bg-purple-50 text-purple-900" : "border-slate-200 bg-slate-100 text-slate-700"}`}
                        >
                          {row.responsibilityLabel}
                        </span>
                      )}
                      <details className="mt-2 xl:hidden">
                        <summary className="cursor-pointer text-xs text-emerald-800">
                          Recommended service dates
                        </summary>
                        <div className="mt-1 font-normal text-slate-600">
                          Target: {row.targetDateDisplay}
                          <br />
                          Window: {row.targetWindowDisplay}
                        </div>
                      </details>
                    </td>
                    <td
                      className="hidden px-2 py-3 xl:table-cell"
                      data-mobile-secondary
                    >
                      <span aria-label={row.targetDateAccessible}>
                        {row.targetDateDisplay}
                      </span>
                    </td>
                    <td
                      className="hidden px-2 py-3 xl:table-cell"
                      data-mobile-secondary
                    >
                      <span aria-label={row.targetWindowAccessible}>
                        {row.targetWindowDisplay}
                      </span>
                    </td>
                    <td
                      data-label="Compliance deadline"
                      className={`px-2 py-3 font-black ${row.status === "Overdue" ? "text-red-800" : row.status === "Due this week" ? "text-amber-900" : row.status === "Due next week" ? "text-blue-800" : row.status === "Review required" ? "text-purple-800" : "text-slate-800"}`}
                    >
                      <span aria-label={row.hardDueDateAccessible}>
                        {row.hardDueDateDisplay}
                      </span>
                    </td>
                    <td
                      data-label="Days left"
                      aria-label={row.workingDaysAccessible}
                      className={`px-2 py-3 font-black ${row.status === "Overdue" ? "text-red-800" : row.status === "Due this week" ? "text-amber-900" : row.status === "Due next week" ? "text-blue-800" : row.status === "Review required" ? "text-purple-800" : "text-slate-800"}`}
                    >
                      {row.workingDaysDisplay}
                    </td>
                    <td className="min-w-0 px-1 py-3" data-label="Status">
                      <StatusBadge color={row.statusColor} label={row.status} />
                      <div className="mt-1">
                        <StatusBadge
                          color={row.executionStateColor}
                          label={row.executionState}
                          compact
                        />
                      </div>
                    </td>
                    <td className="px-1 py-3" data-label="Next step">
                      <Link
                        aria-label={row.primaryActionAccessible}
                        className={buttonClass(
                          row.primaryActionLabel.startsWith("Record")
                            ? "primary"
                            : "secondary",
                          "min-h-9 w-full min-w-0 whitespace-normal break-words px-1.5 py-1.5 text-center leading-tight",
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
