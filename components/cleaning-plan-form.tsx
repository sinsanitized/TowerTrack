"use client";

import { useState } from "react";
import { createAnnualCleaningPlanAction } from "@/app/actions";
import { formatOperationalDate, nextWorkingDate } from "@/lib/date";
import { SubmitButton } from "@/components/submit-button";

export function CleaningPlanForm({
  systemId,
  earliestDate,
  latestDate,
  technicians,
}: {
  systemId: string;
  earliestDate: string;
  latestDate: string;
  technicians: Array<{ id: string; name: string }>;
}) {
  const [chemicalAddDate, setChemicalAddDate] = useState(earliestDate);
  const [cleaningDate, setCleaningDate] = useState(
    nextWorkingDate(earliestDate),
  );

  return (
    <form action={createAnnualCleaningPlanAction} className="mt-4 space-y-4">
      <input type="hidden" name="systemId" value={systemId} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <span className="label">Day 1 · Chemical addition</span>
          <input
            className="field mt-2"
            type="date"
            name="chemicalAddDate"
            min={earliestDate}
            max={latestDate}
            value={chemicalAddDate}
            required
            onChange={(event) => {
              const value = event.target.value;
              setChemicalAddDate(value);
              if (value) setCleaningDate(nextWorkingDate(value));
            }}
          />
          <span className="mt-2 block text-sm font-bold text-blue-950">
            {formatOperationalDate(chemicalAddDate)}
          </span>
        </label>
        <label className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <span className="label">Day 2 · Physical cleaning</span>
          <input
            className="field mt-2"
            type="date"
            name="cleaningDate"
            min={nextWorkingDate(chemicalAddDate)}
            max={latestDate}
            value={cleaningDate}
            required
            onChange={(event) => setCleaningDate(event.target.value)}
          />
          <span className="mt-2 block text-sm font-bold text-amber-950">
            {formatOperationalDate(cleaningDate)}
          </span>
        </label>
      </div>
      <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">
        The cleaning day defaults to the next Monday–Friday working date.
        Planning these dates does not satisfy the annual cleaning requirement;
        completion must still be recorded after the physical cleaning.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">Technician</span>
          <select className="field mt-1" name="technicianId">
            <option value="">Unassigned</option>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Plan notes</span>
          <input
            className="field mt-1"
            name="notes"
            maxLength={1000}
            placeholder="Access, chemical, or coordination details"
          />
        </label>
      </div>
      <label className="block">
        <span className="label">
          Why is this plan being created? · Required
        </span>
        <input
          className="field mt-1"
          name="reason"
          aria-label="Reason for planning"
          required
          minLength={8}
          maxLength={2000}
          placeholder="Example: Scheduled the next required annual cleaning"
        />
      </label>
      <SubmitButton pendingLabel="Creating cleaning plan…">
        Create two-day cleaning plan
      </SubmitButton>
    </form>
  );
}
