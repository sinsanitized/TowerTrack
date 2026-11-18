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
import { complianceDashboardRows } from "@/lib/queries";
import {
  serviceResponsibilityValues,
  type ResponsibilityFilter,
} from "@/lib/service-responsibility";
import { withReturnPath } from "@/lib/workflow-context";

function deadlineColor(status: string) {
  if (status === "Overdue") return "RED" as const;
  if (status === "Due this week") return "YELLOW" as const;
  if (status === "Due next week") return "BLUE" as const;
  if (status === "Review required") return "PURPLE" as const;
  return "GREEN" as const;
}

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
  const rows = filterTowerDeadlineRows(
    buildTowerDeadlineRows(towers, today),
    today,
    { period, action, schedule, responsibility, search },
  );
  const towerCount = new Set(rows.map((row) => row.towerId)).size;
  const pageSize = 25;
  const requestedPage = Number.parseInt(requested.page ?? "1", 10);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), pageCount)
    : 1;
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const query = new URLSearchParams();
  if (period !== "ALL") query.set("period", period);
  if (action !== "ALL") query.set("action", action);
  if (schedule !== "ALL") query.set("schedule", schedule);
  if (responsibility !== "OUR_COMPANY")
    query.set("responsibility", responsibility);
  if (search) query.set("q", search);
  const returnTo = query.size ? `/deadlines?${query}` : "/deadlines";
  const pageHref = (nextPage: number) => {
    const next = new URLSearchParams(query);
    if (nextPage > 1) next.set("page", String(nextPage));
    return next.size ? `/deadlines?${next}` : "/deadlines";
  };
  const filtersActive =
    period !== "ALL" ||
    action !== "ALL" ||
    schedule !== "ALL" ||
    responsibility !== "OUR_COMPANY" ||
    Boolean(search);

  return (
    <>
      <PageHeader
        eyebrow="Portfolio deadlines"
        title="Deadline register"
        description="Address, tower, required work, and compliance deadline."
      />
      {workflowNotice && (
        <div
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950"
          role="status"
        >
          {workflowNotice}
        </div>
      )}

      <details className="panel mb-4" open={filtersActive}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-black text-sky-900">
          <span>Filter deadlines</span>
          <span className="text-sm font-bold text-slate-600">
            {filtersActive ? "Filters applied" : "Optional"}
          </span>
        </summary>
        <div className="border-t border-slate-200 p-4">
          <DeadlineFilterControls
            filters={{ period, action, schedule, responsibility, search }}
          />
        </div>
      </details>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-700">
          {rows.length} deadline{rows.length === 1 ? "" : "s"} · {towerCount}{" "}
          tower{towerCount === 1 ? "" : "s"}
        </p>
        {pageCount > 1 && (
          <p className="text-sm text-slate-600">
            Showing {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, rows.length)}
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <section className="panel p-8 text-center">
          <h2 className="text-lg font-black">No matching deadlines</h2>
          <p className="mt-2 text-slate-600">
            Change or clear the filters to see other tower deadlines.
          </p>
        </section>
      ) : (
        <section className="panel overflow-hidden" aria-label="Deadlines">
          <div className="hidden grid-cols-[minmax(13rem,1.4fr)_minmax(6rem,.6fr)_minmax(13rem,1.2fr)_minmax(11rem,1fr)_minmax(8rem,.7fr)_2rem] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-600 md:grid">
            <span>Address</span>
            <span>Tower</span>
            <span>Required work</span>
            <span>Deadline</span>
            <span>Action</span>
            <span className="sr-only">Open</span>
          </div>
          <div className="divide-y divide-slate-200">
            {visibleRows.map((row) => {
              const href =
                row.primaryActionHref.includes("#record-event") ||
                row.primaryActionHref.includes("#service-responsibilities")
                  ? withReturnPath(row.primaryActionHref, returnTo)
                  : row.primaryActionHref;
              return (
                <Link
                  key={row.id}
                  href={href}
                  aria-label={row.primaryActionAccessible}
                  className="grid gap-2 px-4 py-3 transition hover:bg-sky-50 md:grid-cols-[minmax(13rem,1.4fr)_minmax(6rem,.6fr)_minmax(13rem,1.2fr)_minmax(11rem,1fr)_minmax(8rem,.7fr)_2rem] md:items-center md:gap-4"
                >
                  <span className="min-w-0">
                    <span className="label md:hidden">Address</span>
                    <span className="block font-bold text-slate-950">
                      {row.address}
                    </span>
                  </span>
                  <span>
                    <span className="label md:hidden">Tower</span>
                    <span className="block font-black text-slate-950">
                      {row.systemName}
                    </span>
                  </span>
                  <span>
                    <span className="label md:hidden">Required work</span>
                    <span className="block font-bold text-slate-900">
                      {row.requiredAction}
                    </span>
                  </span>
                  <span>
                    <span className="label md:hidden">Deadline</span>
                    <span className="block font-black text-slate-950">
                      {row.hardDueDateDisplay}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
                      <StatusBadge
                        compact
                        color={deadlineColor(row.status)}
                        label={row.status}
                      />
                      <span>{row.workingDaysDisplay}</span>
                    </span>
                  </span>
                  <span>
                    <span className="label md:hidden">Action</span>
                    <span className="block font-black text-sky-800">
                      {row.primaryActionLabel}
                    </span>
                  </span>
                  <ChevronRight
                    className="hidden text-slate-500 md:block"
                    size={18}
                    aria-hidden
                  />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {pageCount > 1 && (
        <nav
          className="mt-4 flex items-center justify-between gap-3"
          aria-label="Deadline register pages"
        >
          {page > 1 ? (
            <Link className="btn" href={pageHref(page - 1)}>
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm font-bold text-slate-700">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link className="btn" href={pageHref(page + 1)}>
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
