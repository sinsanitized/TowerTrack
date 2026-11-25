import type { Prisma } from "@prisma/client";
import {
  cancelCleaningJobAction,
  completeAddVisitAction,
  completeCleaningTowerAction,
  completeCleaningTowersAction,
} from "@/app/actions/scheduling";
import { CleaningJobEditForm } from "@/components/cleaning-job-form";
import { cleaningGapMessage } from "@/lib/cleaning-schedule";
import { dateOnly, formatDate, todayDateOnly } from "@/lib/date";
import { plainEnumLabel } from "@/lib/labels";

type CalendarCleaningJob = Prisma.CleaningJobGetPayload<{
  include: {
    building: true;
    towers: { include: { coolingTowerSystem: true } };
    addVisit: { include: { assignedTechnician: true } };
    cleaningVisit: { include: { assignedTechnician: true } };
  };
}>;

export function CalendarJobDetails({
  job,
  technicians,
}: {
  job: CalendarCleaningJob;
  technicians: { id: string; name: string }[];
}) {
  const addDate = dateOnly(job.addVisit.scheduledDate);
  const cleanDate = dateOnly(job.cleaningVisit.scheduledDate);
  const warning = cleaningGapMessage(addDate, cleanDate);
  const incompleteTowers = job.towers.filter(
    (tower) => !tower.completedByServiceEventId,
  );

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
          <div className="label">Cleaning</div>
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
          <form action={completeAddVisitAction} className="space-y-2">
            <input type="hidden" name="jobId" value={job.id} />
            <label className="block">
              <span className="label">Actual chemical addition date</span>
              <input
                className="input mt-1 w-full"
                type="date"
                name="completionDate"
                defaultValue={addDate}
                max={todayDateOnly()}
                required
              />
            </label>
            <button className="btn w-full">Record chemical addition</button>
            <p className="mt-1 text-xs text-slate-600">
              This completes only chemical addition. It does not complete
              cleaning or change compliance history.
            </p>
          </form>
        )}
      <div>
        <div className="label">Record completed cleaning by tower</div>
        {incompleteTowers.length > 1 && (
          <form
            action={completeCleaningTowersAction}
            className="mt-2 space-y-3 rounded-xl border border-slate-300 p-4"
          >
            <input type="hidden" name="jobId" value={job.id} />
            <fieldset>
              <legend className="font-black">Which towers were cleaned?</legend>
              <p className="mt-1 text-sm text-slate-600">
                Select only work that was actually completed.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {incompleteTowers.map((tower) => (
                  <label
                    key={tower.id}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-300 px-3 font-bold"
                  >
                    <input
                      className="size-5"
                      type="checkbox"
                      name="systemIds"
                      value={tower.coolingTowerSystemId}
                    />
                    {tower.systemNameSnapshot}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="label">Actual cleaning date</span>
              <input
                className="input mt-1 w-full"
                type="date"
                name="completionDate"
                defaultValue={cleanDate}
                max={todayDateOnly()}
                required
              />
            </label>
            <button className="btn btn-primary w-full">
              Record selected cleanings
            </button>
          </form>
        )}
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
            ) : incompleteTowers.length === 1 ? (
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
                    max={todayDateOnly()}
                    required
                  />
                </label>
                <button className="btn btn-primary">Record Cleaning</button>
              </form>
            ) : null,
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
