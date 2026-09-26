import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ComplianceDate } from "@/components/compliance-date";
import { StatusBadge } from "@/components/status-badge";
import { ClickableRow } from "@/components/clickable-row";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateOnly, formatDate } from "@/lib/date";
import { formatLegionellaResult, plainEnumLabel } from "@/lib/labels";
import { buttonClass } from "@/lib/button-variants";
import {
  matchesSampleQueueFilter,
  sampleQueueFilters,
  sampleQueueState,
  sortSampleQueue,
  type SampleQueueFilter,
  type SampleQueueState,
} from "@/lib/sample-queue";
import { serviceResponsibilityLabel } from "@/lib/service-responsibility";
import { withReturnPath } from "@/lib/workflow-context";
import { eventEntryHref } from "@/lib/event-entry-intent";

const filterLabels: Record<SampleQueueFilter, string> = {
  ACTION_NEEDED: "Action needed",
  WAITING: "Waiting / reference",
  COMPLETED: "Completed",
};

const statePresentation: Record<
  SampleQueueState,
  {
    color: "GREEN" | "YELLOW" | "PURPLE" | "GRAY";
    label: string;
    article: string;
  }
> = {
  RESPONSIBILITY_UNKNOWN: {
    color: "PURPLE",
    label: "Responsibility unknown",
    article: "border-l-purple-500 bg-purple-50/40",
  },
  ACTION_NEEDED: {
    color: "YELLOW",
    label: "Enter result",
    article: "border-l-amber-500 bg-amber-50/40",
  },
  WAITING_EXTERNAL: {
    color: "PURPLE",
    label: "Waiting on another party",
    article: "border-l-purple-400 bg-purple-50/30",
  },
  REFERENCE_ONLY: {
    color: "GRAY",
    label: "Reference only",
    article: "border-l-slate-300 bg-slate-50/60",
  },
  COMPLETED: {
    color: "GREEN",
    label: "Result entered",
    article: "border-l-emerald-500 bg-emerald-50/30",
  },
};

function requestedFilter(
  value: string | string[] | undefined,
): SampleQueueFilter {
  return typeof value === "string" &&
    sampleQueueFilters.includes(value as SampleQueueFilter)
    ? (value as SampleQueueFilter)
    : "ACTION_NEEDED";
}

export default async function SamplesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const filter = requestedFilter(query.status);
  const search =
    typeof query.q === "string" ? query.q.trim().toLowerCase() : "";
  const workflowNotice =
    typeof query.workflowNotice === "string" ? query.workflowNotice : null;
  const sampleReturnTo = `/samples?status=${filter}${search ? `&q=${encodeURIComponent(search)}` : ""}`;
  const samples = await db.serviceEvent.findMany({
    where: {
      eventType: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
      status: "ACTIVE",
      coolingTowerSystem: {
        legionellaResponsibility: { not: "CUSTOMER" },
        building: { customer: { organizationId: user.organizationId } },
      },
    },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    take: 250,
    include: {
      coolingTowerSystem: {
        include: { building: { include: { customer: true } } },
      },
      labResultsForSample: { orderBy: { receivedDate: "desc" }, take: 1 },
    },
  });
  const queue = sortSampleQueue(
    samples.map((sample) => ({
      ...sample,
      eventDateValue: sample.eventDate,
      eventDate: dateOnly(sample.eventDate),
      responsibility: sample.coolingTowerSystem.laboratoryResultResponsibility,
      resultEntered: sample.labResultsForSample.length > 0,
    })),
  );
  const counts = {
    ACTION_NEEDED: queue.filter((item) =>
      matchesSampleQueueFilter(item, "ACTION_NEEDED"),
    ).length,
    WAITING: queue.filter((item) => matchesSampleQueueFilter(item, "WAITING"))
      .length,
    COMPLETED: queue.filter((item) =>
      matchesSampleQueueFilter(item, "COMPLETED"),
    ).length,
  };
  const visibleSamples = queue.filter((item) => {
    if (!matchesSampleQueueFilter(item, filter)) return false;
    if (!search) return true;
    const tower = item.coolingTowerSystem;
    return [
      tower.systemName,
      tower.internalJobNumber,
      tower.building.buildingName,
      tower.building.customer.name,
    ].some((value) => value.toLowerCase().includes(search));
  });

  return (
    <>
      <PageHeader
        eyebrow="Sample follow-up"
        title="Samples"
        description="Resolve missing Legionella results first, then review completed sample records."
      />
      {workflowNotice && (
        <div
          className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950"
          role="status"
        >
          {workflowNotice} Continue with the next sample below.
        </div>
      )}
      <section
        className="mb-5 grid gap-3 sm:grid-cols-3"
        aria-label="Sample status summary"
      >
        {sampleQueueFilters.map((item) => {
          const selected = filter === item;
          const color =
            item === "ACTION_NEEDED"
              ? "border-amber-400 bg-amber-50 text-amber-950"
              : item === "WAITING"
                ? "border-purple-300 bg-purple-50 text-purple-950"
                : item === "COMPLETED"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                  : "border-slate-300 bg-white text-slate-800";
          return (
            <Link
              key={item}
              href={`/samples?status=${item}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
              aria-current={selected ? "page" : undefined}
              className={`rounded-xl border p-4 transition-colors ${color} ${selected ? "ring-2 ring-emerald-800 ring-offset-2" : "hover:border-emerald-500"}`}
            >
              <div className="text-sm font-black">{filterLabels[item]}</div>
              <div className="mt-1 text-2xl font-black">{counts[item]}</div>
            </Link>
          );
        })}
      </section>
      <form
        className="panel mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
        method="get"
      >
        <input type="hidden" name="status" value={filter} />
        <label className="grow">
          <span className="label">
            Find a customer, facility, tower, or job
          </span>
          <input
            className="field mt-1"
            type="search"
            name="q"
            defaultValue={typeof query.q === "string" ? query.q : ""}
            placeholder="Search samples"
          />
        </label>
        <button className={buttonClass("secondary", "min-h-11 justify-center")}>
          Search
        </button>
        {(search || filter !== "ACTION_NEEDED") && (
          <Link
            className={buttonClass("secondary", "min-h-11 justify-center")}
            href="/samples"
          >
            Reset
          </Link>
        )}
      </form>
      <div className="mb-4 rounded-xl border border-slate-300 bg-white p-4 text-slate-800">
        <div className="font-black">
          {filter === "ACTION_NEEDED"
            ? "Start with the oldest sample below. Enter its laboratory result or assign who is responsible."
            : filter === "WAITING"
              ? "No result entry is required. Follow up when another party is responsible; reference-only samples remain visible here."
              : "These samples already have results. Open a record only to review its details."}
        </div>
      </div>
      <div className="panel divide-y divide-slate-200 overflow-hidden">
        {visibleSamples.map((sample) => {
          const result = sample.labResultsForSample[0];
          const state = sampleQueueState(sample);
          const presentation = statePresentation[state];
          const responsibility =
            sample.coolingTowerSystem.laboratoryResultResponsibility;
          const statusLabel =
            state === "WAITING_EXTERNAL"
              ? responsibility === "CUSTOMER"
                ? "Waiting on customer"
                : "Waiting on vendor"
              : presentation.label;
          const primaryHref =
            state === "ACTION_NEEDED"
              ? withReturnPath(
                  eventEntryHref({
                    type: "result",
                    towerId: sample.coolingTowerSystemId,
                    sampleEventId: sample.id,
                  }),
                  sampleReturnTo,
                )
              : state === "RESPONSIBILITY_UNKNOWN"
                ? withReturnPath(
                    `/systems/${sample.coolingTowerSystemId}/edit?focus=laboratoryResultResponsibility#service-responsibilities`,
                    sampleReturnTo,
                  )
                : `/systems/${sample.coolingTowerSystemId}?view=history`;
          const primaryLabel =
            state === "ACTION_NEEDED"
              ? "Enter laboratory result"
              : state === "RESPONSIBILITY_UNKNOWN"
                ? "Assign responsibility"
                : state === "WAITING_EXTERNAL"
                  ? "View waiting details"
                  : state === "COMPLETED"
                    ? "View sample record"
                    : "Open tower";
          return (
            <ClickableRow
              as="article"
              key={sample.id}
              href={primaryHref}
              label={`${primaryLabel} for ${sample.coolingTowerSystem.systemName}`}
              className={`record-row grid gap-5 border-l-4 p-5 xl:grid-cols-[minmax(250px,1.15fr)_minmax(180px,.7fr)_minmax(230px,.9fr)_auto] xl:items-center ${presentation.color === "YELLOW" ? "urgency-amber" : presentation.color === "PURPLE" ? "urgency-purple" : presentation.color === "GREEN" ? "border-l-emerald-600" : "border-l-slate-300"}`}
            >
              <div className="identity-block">
                <div className="font-black">
                  {sample.coolingTowerSystem.systemName}
                </div>
                <div className="text-sm font-bold text-slate-700">
                  {sample.coolingTowerSystem.building.buildingName}
                </div>
                <div className="text-xs text-slate-600">
                  {sample.coolingTowerSystem.building.customer.name} ·{" "}
                  {sample.coolingTowerSystem.internalJobNumber}
                </div>
                <div className="mt-3">
                  <StatusBadge color={presentation.color} label={statusLabel} />
                </div>
              </div>
              <div className="date-block">
                <ComplianceDate
                  value={sample.eventDateValue}
                  label="Sample collected"
                  compact
                />
              </div>
              <div className="min-w-0">
                <div className="label">Laboratory result</div>
                <div className="mt-1 font-black">
                  {result
                    ? formatLegionellaResult(result.cfuPerMl)
                    : "No result entered"}
                </div>
                {result ? (
                  <div className="mt-1 text-xs text-slate-600">
                    {plainEnumLabel(result.level)} · Received{" "}
                    {formatDate(result.receivedDate)}
                  </div>
                ) : (
                  <div className="mt-1 text-xs font-bold text-slate-700">
                    {serviceResponsibilityLabel(responsibility)}
                  </div>
                )}
              </div>
              <Link
                className={buttonClass(
                  state === "ACTION_NEEDED" ? "primary" : "secondary",
                  "min-h-11 w-full justify-center text-center xl:w-auto",
                )}
                href={primaryHref}
              >
                {primaryLabel}
              </Link>
            </ClickableRow>
          );
        })}
        {!visibleSamples.length && (
          <div className="p-8 text-center">
            <h2 className="font-black">No samples match this view</h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose another status or clear the search.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
