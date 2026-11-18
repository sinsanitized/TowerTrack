import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  CleaningJobEditForm,
  CleaningJobForm,
} from "@/components/cleaning-job-form";
import { requireUser } from "@/lib/auth";
import {
  calendarGridBounds,
  cleaningGapMessage,
} from "@/lib/cleaning-schedule";
import {
  addDays,
  asUtc,
  dateOnly,
  formatDate,
  todayDateOnly,
} from "@/lib/date";
import { db } from "@/lib/db";
import { plainEnumLabel } from "@/lib/labels";
import {
  cancelCleaningJobAction,
  completeAddVisitAction,
  completeCleaningTowerAction,
} from "@/app/actions/scheduling";

type CalendarCleaningJob = Prisma.CleaningJobGetPayload<{
  include: {
    building: true;
    towers: { include: { coolingTowerSystem: true } };
    addVisit: { include: { assignedTechnician: true } };
    cleaningVisit: { include: { assignedTechnician: true } };
  };
}>;

function monthTitle(month: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(asUtc(`${month}-01`));
}

function moveMonth(month: string, amount: number) {
  const value = asUtc(`${month}-01`);
  value.setUTCMonth(value.getUTCMonth() + amount);
  return dateOnly(value).slice(0, 7);
}

function visitPhaseLabel(phase: string) {
  return phase === "ADD" ? "CHEMICAL ADDITION" : phase;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayDateOnly();
  const requestedMonth =
    typeof params.month === "string" ? params.month : today.slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(requestedMonth)
    ? requestedMonth
    : today.slice(0, 7);
  const bounds = calendarGridBounds(month);
  const buildingFilter =
    typeof params.building === "string" ? params.building : "";
  const statusFilter = typeof params.status === "string" ? params.status : "";
  const technicianFilter =
    typeof params.technician === "string" ? params.technician : "";
  const typeFilter = typeof params.type === "string" ? params.type : "";
  const [buildings, technicians, visits, selectedJob] = await Promise.all([
    db.building.findMany({
      where: {
        active: true,
        deletedAt: null,
        customer: { organizationId: user.organizationId },
      },
      include: {
        systems: {
          where: { active: true, deletedAt: null },
          orderBy: { systemName: "asc" },
        },
      },
      orderBy: { buildingName: "asc" },
    }),
    db.user.findMany({
      where: {
        organizationId: user.organizationId,
        active: true,
        role: { in: ["TECHNICIAN", "OPERATIONS_MANAGER"] },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.visit.findMany({
      where: {
        scheduledDate: {
          gte: asUtc(bounds.start),
          lt: asUtc(bounds.endExclusive),
        },
        deletedAt: null,
        building: { customer: { organizationId: user.organizationId } },
        ...(buildingFilter ? { buildingId: buildingFilter } : {}),
        ...(technicianFilter ? { assignedTechnicianId: technicianFilter } : {}),
        ...(statusFilter ? { status: statusFilter as never } : {}),
      },
      include: {
        building: true,
        assignedTechnician: { select: { name: true } },
        activities: {
          include: { coolingTowerSystem: { select: { systemName: true } } },
        },
        addForCleaningJob: { include: { towers: true } },
        cleanForCleaningJob: { include: { towers: true } },
      },
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
    }),
    typeof params.job === "string"
      ? db.cleaningJob.findFirst({
          where: {
            id: params.job,
            building: { customer: { organizationId: user.organizationId } },
          },
          include: {
            building: true,
            towers: { include: { coolingTowerSystem: true } },
            addVisit: { include: { assignedTechnician: true } },
            cleaningVisit: { include: { assignedTechnician: true } },
          },
        })
      : null,
  ]);

  const filteredVisits = visits.filter((visit) => {
    const phase = visit.addForCleaningJob
      ? "ADD"
      : visit.cleanForCleaningJob
        ? "CLEAN"
        : "OTHER";
    return !typeFilter || phase === typeFilter;
  });
  const visitsByDate = new Map<string, typeof filteredVisits>();
  for (const visit of filteredVisits) {
    const key = dateOnly(visit.scheduledDate);
    visitsByDate.set(key, [...(visitsByDate.get(key) ?? []), visit]);
  }
  const days: string[] = [];
  for (let day = bounds.start; day < bounds.endExclusive; day = addDays(day, 1))
    days.push(day);
  const showNew = params.new === "1";
  const initialDate =
    typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : today;

  return (
    <>
      <PageHeader
        eyebrow="Planning"
        title="Calendar"
        description="Plan cleaning visits. Work counts only after it is recorded as completed."
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            className="btn"
            href={`/calendar?month=${moveMonth(month, -1)}`}
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </Link>
          <Link className="btn" href="/calendar">
            Today
          </Link>
          <Link
            className="btn"
            href={`/calendar?month=${moveMonth(month, 1)}`}
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </Link>
          <h2 className="ml-2 text-xl font-black sm:text-2xl">
            {monthTitle(month)}
          </h2>
        </div>
        <Link
          className="btn btn-primary"
          href={`/calendar?month=${month}&new=1&date=${today}`}
        >
          <Plus size={18} /> Schedule cleaning
        </Link>
      </div>

      <details className="panel mb-5 overflow-hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 p-4 font-black text-sky-900">
          <span>Filter calendar</span>
          <span className="text-sm font-bold text-slate-600">
            {[
              typeFilter,
              buildingFilter,
              statusFilter,
              technicianFilter,
            ].filter(Boolean).length || "No"}{" "}
            active
          </span>
        </summary>
        <form className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <input type="hidden" name="month" value={month} />
          <select
            className="input"
            name="type"
            defaultValue={typeFilter}
            aria-label="Filter by visit type"
          >
            <option value="">All visit types</option>
            <option value="ADD">Chemical addition</option>
            <option value="CLEAN">Cleaning</option>
            <option value="OTHER">Other scheduled work</option>
          </select>
          <select
            className="input"
            name="building"
            defaultValue={buildingFilter}
            aria-label="Filter by building"
          >
            <option value="">All buildings</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.buildingName}
              </option>
            ))}
          </select>
          <select
            className="input"
            name="status"
            defaultValue={statusFilter}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="PLANNED">Planned</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="MISSED">Missed</option>
          </select>
          <select
            className="input"
            name="technician"
            defaultValue={technicianFilter}
            aria-label="Filter by technician"
          >
            <option value="">All technicians</option>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button className="btn flex-1">Apply</button>
            {(typeFilter ||
              buildingFilter ||
              statusFilter ||
              technicianFilter) && (
              <Link className="btn flex-1" href={`/calendar?month=${month}`}>
                Clear
              </Link>
            )}
          </div>
        </form>
      </details>

      <div className="hidden grid-cols-7 border-x border-t border-slate-300 bg-slate-100 text-center text-xs font-black uppercase tracking-wide text-slate-600 md:grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => (
          <div
            key={name}
            className="border-r border-slate-300 p-2 last:border-r-0"
          >
            {name}
          </div>
        ))}
      </div>
      <section
        className="hidden gap-3 md:grid md:grid-cols-7 md:gap-0 md:border-l md:border-t md:border-slate-300"
        aria-label={`${monthTitle(month)} schedule`}
      >
        {days.map((day) => {
          const dayVisits = visitsByDate.get(day) ?? [];
          const inMonth = day.startsWith(month);
          return (
            <div
              key={day}
              className={`min-h-28 rounded-xl border border-slate-300 p-2 md:min-h-36 md:rounded-none md:border-l-0 md:border-t-0 ${inMonth ? "bg-white" : "bg-slate-100 text-slate-500"} ${day === today ? "ring-2 ring-inset ring-sky-500" : ""}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={`grid size-8 place-items-center rounded-full text-sm font-black ${day === today ? "bg-sky-600 text-white" : ""}`}
                >
                  {Number(day.slice(-2))}
                </span>
                <Link
                  href={`/calendar?month=${month}&new=1&date=${day}`}
                  className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-sky-100 hover:text-sky-900"
                  aria-label={`Schedule cleaning on ${formatDate(day)}`}
                >
                  <Plus size={16} />
                </Link>
              </div>
              <div className="space-y-1.5">
                {dayVisits.slice(0, 3).map((visit) => {
                  const job =
                    visit.addForCleaningJob ?? visit.cleanForCleaningJob;
                  const phase = visit.addForCleaningJob
                    ? "ADD"
                    : visit.cleanForCleaningJob
                      ? "CLEAN"
                      : plainEnumLabel(
                          visit.activities[0]?.activityType ?? "OTHER",
                        );
                  const towerNames =
                    job?.towers.map((tower) => tower.systemNameSnapshot) ??
                    visit.activities.map(
                      (activity) => activity.coolingTowerSystem.systemName,
                    );
                  const href = job
                    ? `/calendar?month=${month}&job=${job.id}`
                    : `/visits/${visit.id}`;
                  return (
                    <Link
                      key={visit.id}
                      href={href}
                      className={`block rounded-lg border-l-4 p-2 text-xs shadow-sm ${phase === "ADD" ? "border-violet-500 bg-violet-50 text-violet-950" : phase === "CLEAN" ? "border-sky-600 bg-sky-50 text-sky-950" : "border-slate-500 bg-slate-50 text-slate-950"}`}
                    >
                      <div className="font-black">
                        {visitPhaseLabel(phase)} · {visit.building.buildingName}
                      </div>
                      <div className="mt-0.5 truncate">
                        {visit.building.streetAddress}
                      </div>
                      <div className="mt-0.5 truncate font-bold">
                        {job?.scopeMode === "ALL_TOWERS"
                          ? "All towers"
                          : towerNames.join(", ")}
                      </div>
                    </Link>
                  );
                })}
                {dayVisits.length > 3 && (
                  <Link
                    className="block rounded-lg bg-slate-100 p-2 text-center text-xs font-black"
                    href={`/calendar?month=${month}&day=${day}`}
                  >
                    +{dayVisits.length - 3} more
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section
        className="space-y-3 md:hidden"
        aria-label={`${monthTitle(month)} agenda`}
      >
        {days
          .filter(
            (day) =>
              day.startsWith(month) && (visitsByDate.get(day)?.length ?? 0) > 0,
          )
          .map((day) => (
            <article key={day} className="panel overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 p-3">
                <h3 className="font-black">{formatDate(day)}</h3>
                <Link
                  className="btn min-h-10"
                  href={`/calendar?month=${month}&new=1&date=${day}`}
                >
                  Schedule work
                </Link>
              </div>
              <div className="divide-y divide-slate-200">
                {visitsByDate.get(day)!.map((visit) => {
                  const job =
                    visit.addForCleaningJob ?? visit.cleanForCleaningJob;
                  const phase = visit.addForCleaningJob
                    ? "ADD"
                    : visit.cleanForCleaningJob
                      ? "CLEAN"
                      : plainEnumLabel(
                          visit.activities[0]?.activityType ?? "OTHER",
                        );
                  return (
                    <Link
                      key={visit.id}
                      href={
                        job
                          ? `/calendar?month=${month}&job=${job.id}`
                          : `/visits/${visit.id}`
                      }
                      className="block p-3"
                    >
                      <div className="font-black">
                        {visitPhaseLabel(phase)} · {visit.building.buildingName}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {visit.building.streetAddress}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </article>
          ))}
        {days.every(
          (day) =>
            !day.startsWith(month) ||
            (visitsByDate.get(day)?.length ?? 0) === 0,
        ) && (
          <div className="panel p-6 text-center">
            <CalendarEmptyState month={month} today={today} />
          </div>
        )}
      </section>

      {typeof params.day === "string" && visitsByDate.has(params.day) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-3 sm:p-6">
          <div className="mx-auto max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="label">Full day schedule</div>
                <h2 className="text-2xl font-black">
                  {formatDate(params.day)}
                </h2>
              </div>
              <Link
                className="btn"
                href={`/calendar?month=${month}`}
                aria-label="Close day schedule"
              >
                <X size={18} />
              </Link>
            </div>
            <div className="space-y-3">
              {visitsByDate.get(params.day)!.map((visit) => {
                const job =
                  visit.addForCleaningJob ?? visit.cleanForCleaningJob;
                const phase = visit.addForCleaningJob
                  ? "ADD"
                  : visit.cleanForCleaningJob
                    ? "CLEAN"
                    : plainEnumLabel(
                        visit.activities[0]?.activityType ?? "OTHER",
                      );
                return (
                  <Link
                    key={visit.id}
                    href={
                      job
                        ? `/calendar?month=${month}&job=${job.id}`
                        : `/visits/${visit.id}`
                    }
                    className="block rounded-xl border border-slate-300 p-4 hover:border-sky-500"
                  >
                    <div className="font-black">
                      {visitPhaseLabel(phase)} · {visit.building.buildingName}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {visit.building.streetAddress}
                    </div>
                    <div className="mt-2 text-sm font-bold">
                      Status: {plainEnumLabel(visit.status)}
                      {visit.assignedTechnician
                        ? ` · ${visit.assignedTechnician.name}`
                        : " · Unassigned"}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {(showNew || selectedJob) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-3 sm:p-6">
          <div className="mx-auto max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="label">
                  {showNew ? "New linked job" : "Linked cleaning job"}
                </div>
                <h2 className="mt-1 text-2xl font-black">
                  {showNew
                    ? "Schedule cleaning"
                    : selectedJob?.building.buildingName}
                </h2>
              </div>
              <Link
                href={`/calendar?month=${month}`}
                className="btn"
                aria-label="Close"
              >
                <X size={18} />
              </Link>
            </div>
            {showNew ? (
              <CleaningJobForm
                buildings={buildings.map((building) => ({
                  id: building.id,
                  name: building.buildingName,
                  address: `${building.streetAddress}, ${building.city}, ${building.state}`,
                  towers: building.systems.map((tower) => ({
                    id: tower.id,
                    name: tower.systemName,
                  })),
                }))}
                technicians={technicians}
                initialDate={initialDate}
                initialBuildingId={
                  typeof params.buildingId === "string"
                    ? params.buildingId
                    : undefined
                }
                initialTowerId={
                  typeof params.towerId === "string"
                    ? params.towerId
                    : undefined
                }
              />
            ) : (
              selectedJob && (
                <JobDetails job={selectedJob} technicians={technicians} />
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}

function CalendarEmptyState({
  month,
  today,
}: {
  month: string;
  today: string;
}) {
  return (
    <>
      <div className="font-black">
        No visits scheduled for {monthTitle(month)}
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Choose Schedule cleaning to add linked chemical addition and cleaning
        visits.
      </p>
      <Link
        className="btn btn-primary mt-4"
        href={`/calendar?month=${month}&new=1&date=${today}`}
      >
        Schedule cleaning
      </Link>
    </>
  );
}

function JobDetails({
  job,
  technicians,
}: {
  job: CalendarCleaningJob;
  technicians: { id: string; name: string }[];
}) {
  const addDate = dateOnly(job.addVisit.scheduledDate);
  const cleanDate = dateOnly(job.cleaningVisit.scheduledDate);
  const warning = cleaningGapMessage(addDate, cleanDate);
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 p-4">
        <div className="font-black">
          {job.building.streetAddress}, {job.building.city},{" "}
          {job.building.state}
        </div>
        <div className="mt-2 text-sm text-slate-600">
          {job.scopeMode === "ALL_TOWERS"
            ? "All towers saved with this job"
            : "Selected towers"}
          : {job.towers.map((tower) => tower.systemNameSnapshot).join(", ")}
        </div>
      </div>
      {job.cleaningVisit.status === "PLANNED" &&
        job.addVisit.status !== "COMPLETED" && (
          <div className="rounded-xl border border-amber-400 bg-amber-50 p-3 font-bold text-amber-950">
            Cleaning is still planned, but chemical addition is not complete.
            Confirm chemical circulation before cleaning.
          </div>
        )}
      {warning && (
        <div className="rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm font-bold text-amber-950">
          Review timing: {warning}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border-l-4 border-violet-500 bg-violet-50 p-4">
          <div className="label">Chemical addition</div>
          <div className="text-lg font-black">{formatDate(addDate)}</div>
          <div className="mt-1 text-sm font-bold">
            Status: {plainEnumLabel(job.addVisit.status)}
          </div>
        </div>
        <div className="rounded-xl border-l-4 border-sky-600 bg-sky-50 p-4">
          <div className="label">CLEAN</div>
          <div className="text-lg font-black">{formatDate(cleanDate)}</div>
          <div className="mt-1 text-sm font-bold">
            Status: {plainEnumLabel(job.cleaningVisit.status)}
          </div>
        </div>
      </div>
      {job.notes && (
        <div>
          <div className="label">Notes</div>
          <p className="mt-1 whitespace-pre-wrap">{job.notes}</p>
        </div>
      )}
      <details className="rounded-xl border border-slate-300 p-4">
        <summary className="cursor-pointer font-black">Edit schedule</summary>
        <div className="mt-4">
          <CleaningJobEditForm
            jobId={job.id}
            initialAddDate={addDate}
            initialCleaningDate={cleanDate}
            initialTechnicianId={job.addVisit.assignedTechnicianId ?? undefined}
            initialNotes={job.notes ?? undefined}
            technicians={technicians}
          />
        </div>
      </details>
      {job.addVisit.status !== "COMPLETED" &&
        job.addVisit.status !== "CANCELLED" && (
          <form action={completeAddVisitAction}>
            <input type="hidden" name="jobId" value={job.id} />
            <button className="btn w-full">Mark Add visit complete</button>
            <p className="mt-1 text-xs text-slate-600">
              This completes only Add. It does not complete Cleaning or change
              compliance history.
            </p>
          </form>
        )}
      <div>
        <div className="label">Record actual Cleaning by tower</div>
        <div className="mt-2 grid gap-2">
          {job.towers.map((tower) =>
            tower.completedByServiceEventId ? (
              <div
                key={tower.id}
                className="flex min-h-11 items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-3 font-bold text-emerald-950"
              >
                <span>{tower.systemNameSnapshot}</span>
                <span>Cleaning recorded ✓</span>
              </div>
            ) : (
              <form
                key={tower.id}
                action={completeCleaningTowerAction}
                className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-300 p-3"
              >
                <input type="hidden" name="jobId" value={job.id} />
                <input
                  type="hidden"
                  name="systemId"
                  value={tower.coolingTowerSystemId}
                />
                <label className="min-w-44 grow">
                  <span className="text-sm font-black">
                    {tower.systemNameSnapshot}
                  </span>
                  <input
                    className="input mt-1 w-full"
                    type="date"
                    name="completionDate"
                    defaultValue={cleanDate}
                    required
                  />
                </label>
                <button className="btn btn-primary">Record Cleaning</button>
              </form>
            ),
          )}
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Record only towers actually completed. Unfinished towers remain
          outstanding. Retrying a saved tower will not create a duplicate
          cleaning record.
        </p>
      </div>
      <details className="rounded-xl border border-red-300 p-4">
        <summary className="cursor-pointer font-black text-red-800">
          Cancel visit
        </summary>
        <form action={cancelCleaningJobAction} className="mt-3 space-y-3">
          <input type="hidden" name="jobId" value={job.id} />
          <label className="label">What should be cancelled?</label>
          <select className="input w-full" name="cancel" required>
            <option value="BOTH">Cancel chemical addition and cleaning</option>
            <option value="ADD_ONLY">
              Cancel chemical addition; keep cleaning
            </option>
            <option value="CLEAN_ONLY">
              Keep chemical addition; cancel cleaning
            </option>
          </select>
          <textarea
            className="input min-h-20 w-full"
            name="reason"
            minLength={8}
            required
            placeholder="Reason for cancellation"
          />
          <button className="btn border-red-400 text-red-800">
            Confirm cancellation choice
          </button>
        </form>
      </details>
    </div>
  );
}
