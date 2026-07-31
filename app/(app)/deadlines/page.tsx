import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { DeadlineFilterControls } from "@/components/deadline-filter-controls";
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
    serviceResponsibilityValues.includes(requested.responsibility as never)
      ? (requested.responsibility as ResponsibilityFilter)
      : "OUR_COMPANY";
  const search = typeof requested.q === "string" ? requested.q.trim() : "";
  const towers = await complianceDashboardRows({
    organizationId: user.organizationId,
    today,
    includeMissed: true,
  });
  const rows = filterTowerDeadlineRows(
    buildTowerDeadlineRows(towers, today),
    today,
    {
      period,
      action,
      schedule,
      responsibility,
      search,
    },
  );
  const overdueCount = rows.filter((row) => row.status === "Overdue").length;
  const towerCount = new Set(rows.map((row) => row.towerId)).size;

  return (
    <>
      <PageHeader
        eyebrow="Portfolio deadlines"
        title="All Cooling Tower Deadlines"
        description="Find company work by due date and work type. Additional schedule and responsibility filters are available when needed."
      />
      <DeadlineFilterControls
        filters={{ period, action, schedule, responsibility, search }}
      />

      <div className="mb-5 flex flex-wrap gap-3 text-sm font-bold text-slate-700">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <CalendarRange size={18} className="text-emerald-800" />
          {rows.length} active obligation{rows.length === 1 ? "" : "s"}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          {towerCount} cooling tower{towerCount === 1 ? "" : "s"}
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900">
          {overdueCount} overdue
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="panel p-8 text-center">
          <h2 className="text-lg font-black">No active deadlines</h2>
          <p className="mt-2 text-slate-600">
            No cooling tower obligations match the selected filters.
          </p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto" data-testid="deadline-table-scroll">
            <table
              className="w-full table-fixed text-left text-xs xl:text-sm"
              aria-label="All cooling tower deadline obligations"
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
                    Target Date
                  </th>
                  <th className="hidden px-2 py-3 xl:table-cell">
                    Target Window
                  </th>
                  <th className="px-2 py-3">Hard Due Date</th>
                  <th className="px-2 py-3">Days Left</th>
                  <th className="px-2 py-3">Status</th>
                  <th className="px-2 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      row.status === "Overdue"
                        ? "bg-red-50/50 align-top"
                        : "align-top"
                    }
                  >
                    <td className="break-words px-2 py-3 sm:px-3">
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
                    <td className="break-words px-2 py-3 font-bold text-slate-900 sm:px-3">
                      {row.requiredAction}
                      {row.responsibility !== "OUR_COMPANY" && (
                        <span className="ml-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">
                          {row.responsibilityLabel}
                        </span>
                      )}
                      <details className="mt-2 xl:hidden">
                        <summary className="cursor-pointer text-xs text-emerald-800">
                          Target details
                        </summary>
                        <div className="mt-1 font-normal text-slate-600">
                          Target: {row.targetDateDisplay}
                          <br />
                          Window: {row.targetWindowDisplay}
                        </div>
                      </details>
                    </td>
                    <td className="hidden px-2 py-3 xl:table-cell">
                      <span aria-label={row.targetDateAccessible}>
                        {row.targetDateDisplay}
                      </span>
                    </td>
                    <td className="hidden px-2 py-3 xl:table-cell">
                      <span aria-label={row.targetWindowAccessible}>
                        {row.targetWindowDisplay}
                      </span>
                    </td>
                    <td className="px-2 py-3 font-bold text-slate-900">
                      <span aria-label={row.hardDueDateAccessible}>
                        {row.hardDueDateDisplay}
                      </span>
                    </td>
                    <td
                      aria-label={row.workingDaysAccessible}
                      className={`px-2 py-3 font-black ${row.status === "Overdue" ? "text-red-800" : row.status === "Due Soon" ? "text-amber-900" : "text-slate-800"}`}
                    >
                      {row.workingDaysDisplay}
                    </td>
                    <td className="px-1 py-3">
                      <StatusBadge color={row.statusColor} label={row.status} />
                    </td>
                    <td className="px-1 py-3">
                      <Link
                        aria-label={row.primaryActionAccessible}
                        className={buttonClass(
                          row.primaryActionLabel === "Record"
                            ? "primary"
                            : "secondary",
                          "min-h-9 px-1.5 py-1.5",
                        )}
                        href={row.primaryActionHref}
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
