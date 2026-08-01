"use client";

import Link from "next/link";
import { useRef } from "react";
import { SlidersHorizontal } from "lucide-react";
import { buttonClass } from "@/lib/button-variants";
import type {
  DeadlineActionFilter,
  DeadlinePeriod,
  DeadlineScheduleFilter,
} from "@/lib/deadline-view";
import type { ResponsibilityFilter } from "@/lib/service-responsibility";

type Filters = {
  period: DeadlinePeriod;
  action: DeadlineActionFilter;
  schedule: DeadlineScheduleFilter;
  responsibility: ResponsibilityFilter;
  search: string;
};

function href(filters: Filters) {
  const query = new URLSearchParams();
  if (filters.period !== "ALL") query.set("period", filters.period);
  if (filters.action !== "ALL") query.set("action", filters.action);
  if (filters.schedule !== "ALL") query.set("schedule", filters.schedule);
  if (filters.responsibility !== "OUR_COMPANY")
    query.set("responsibility", filters.responsibility);
  if (filters.search) query.set("q", filters.search);
  return query.size ? `/deadlines?${query}` : "/deadlines";
}

function chip(selected: boolean) {
  return buttonClass(
    "secondary",
    selected ? "border-emerald-700 bg-emerald-50 text-emerald-950" : "",
  );
}

export function DeadlineFilterControls({ filters }: { filters: Filters }) {
  const moreFilters = useRef<HTMLDetailsElement>(null);
  const activeSecondary = [
    filters.schedule === "SEASONAL"
      ? "Seasonal"
      : filters.schedule === "YEAR_ROUND"
        ? "Year-round"
        : filters.schedule === "NOT_SET"
          ? "Schedule not set"
          : null,
    filters.responsibility === "CUSTOMER"
      ? "Customer managed"
      : filters.responsibility === "OTHER_VENDOR"
        ? "Other vendor"
        : filters.responsibility === "NOT_TRACKED"
          ? "Not tracked"
          : filters.responsibility === "UNCONFIRMED"
            ? "Responsibility required"
            : filters.responsibility === "ALL"
              ? "All responsibilities"
              : null,
  ].filter(Boolean) as string[];

  return (
    <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <form action="/deadlines" className="flex min-w-0 flex-1 gap-2">
          {filters.period !== "ALL" && (
            <input type="hidden" name="period" value={filters.period} />
          )}
          {filters.action !== "ALL" && (
            <input type="hidden" name="action" value={filters.action} />
          )}
          {filters.schedule !== "ALL" && (
            <input type="hidden" name="schedule" value={filters.schedule} />
          )}
          {filters.responsibility !== "OUR_COMPANY" && (
            <input
              type="hidden"
              name="responsibility"
              value={filters.responsibility}
            />
          )}
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search deadlines</span>
            <input
              className="field"
              type="search"
              name="q"
              defaultValue={filters.search}
              placeholder="Search tower, address, or action"
            />
          </label>
          <button className={buttonClass("secondary")} type="submit">
            Search
          </button>
        </form>
        <details
          ref={moreFilters}
          className="relative"
          onKeyDown={(event) => {
            if (event.key === "Escape" && moreFilters.current?.open) {
              moreFilters.current.open = false;
              moreFilters.current.querySelector("summary")?.focus();
            }
          }}
        >
          <summary
            className={buttonClass(
              "secondary",
              "cursor-pointer whitespace-nowrap",
            )}
            aria-label="More deadline filters"
            role="button"
          >
            <SlidersHorizontal size={17} /> More Filters
            {activeSecondary.length > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-950">
                {activeSecondary.length}
              </span>
            )}
          </summary>
          <div className="mt-2 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-lg sm:absolute sm:right-0 sm:z-20 sm:w-[34rem]">
            <div>
              <div className="label mb-2">Operating Schedule</div>
              <nav
                className="flex flex-wrap gap-2"
                aria-label="Filter deadlines by operating schedule"
              >
                {[
                  ["ALL", "All schedules"],
                  ["SEASONAL", "Seasonal"],
                  ["YEAR_ROUND", "Year-round"],
                  ["NOT_SET", "Schedule not set"],
                ].map(([value, label]) => (
                  <Link
                    key={value}
                    aria-current={
                      filters.schedule === value ? "page" : undefined
                    }
                    className={chip(filters.schedule === value)}
                    href={href({
                      ...filters,
                      schedule: value as DeadlineScheduleFilter,
                    })}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
            <div>
              <div className="label mb-2">Responsibility</div>
              <nav
                className="flex flex-wrap gap-2"
                aria-label="Filter deadlines by responsibility"
              >
                {[
                  ["OUR_COMPANY", "Our company"],
                  ["CUSTOMER", "Customer"],
                  ["OTHER_VENDOR", "Other vendor"],
                  ["NOT_TRACKED", "Not tracked"],
                  ["UNCONFIRMED", "Responsibility required"],
                  ["ALL", "All responsibilities"],
                ].map(([value, label]) => (
                  <Link
                    key={value}
                    aria-current={
                      filters.responsibility === value ? "page" : undefined
                    }
                    className={chip(filters.responsibility === value)}
                    href={href({
                      ...filters,
                      responsibility: value as ResponsibilityFilter,
                    })}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
              <div
                className="text-sm font-bold text-slate-600"
                aria-live="polite"
              >
                {activeSecondary.length
                  ? activeSecondary.join(" · ")
                  : "No additional filters active"}
              </div>
              <Link
                className={buttonClass("ghost")}
                href={href({
                  ...filters,
                  schedule: "ALL",
                  responsibility: "OUR_COMPANY",
                })}
              >
                Reset More Filters
              </Link>
            </div>
          </div>
        </details>
        {activeSecondary.length > 0 && (
          <div className="self-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-950">
            {activeSecondary.join(" · ")}
          </div>
        )}
      </div>
      <div className="mt-4 grid gap-3">
        <div>
          <div className="label mb-2">Due Date</div>
          <nav
            className="flex flex-wrap gap-2"
            aria-label="Filter deadlines by due date"
          >
            {[
              ["ALL", "All"],
              ["OVERDUE", "Overdue"],
              ["THIS_WEEK", "Due this week"],
              ["NEXT_WEEK", "Due next week"],
              ["LATER", "Later"],
            ].map(([value, label]) => (
              <Link
                key={value}
                aria-current={filters.period === value ? "page" : undefined}
                className={chip(filters.period === value)}
                href={href({ ...filters, period: value as DeadlinePeriod })}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div>
          <div className="label mb-2">Work Type</div>
          <nav
            className="flex flex-wrap gap-2"
            aria-label="Filter deadlines by work type"
          >
            {[
              ["ALL", "All work"],
              ["SAMPLE", "Samples"],
              ["INSPECTION", "Inspections"],
              ["MAINTENANCE", "Cleaning & treatment"],
              ["REPORTING_ACTION", "Reporting & certification"],
            ].map(([value, label]) => (
              <Link
                key={value}
                aria-current={filters.action === value ? "page" : undefined}
                className={chip(filters.action === value)}
                href={href({
                  ...filters,
                  action: value as DeadlineActionFilter,
                })}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}
