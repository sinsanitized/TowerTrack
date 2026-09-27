"use client";

import { useState } from "react";
import { updateMonthlyTargetWindowAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

function ordinal(day: number) {
  const remainder = day % 100;
  if (remainder >= 11 && remainder <= 13) return `${day}th`;
  return `${day}${day % 10 === 1 ? "st" : day % 10 === 2 ? "nd" : day % 10 === 3 ? "rd" : "th"}`;
}

export function MonthlyTargetWindowForm({
  systemId,
  startDay,
  endDay,
}: {
  systemId: string;
  startDay: number;
  endDay: number;
}) {
  const [firstDay, setFirstDay] = useState(startDay);
  const [lastDay, setLastDay] = useState(endDay);
  const validWindow = firstDay >= 1 && lastDay <= 28 && firstDay <= lastDay;

  return (
    <form action={updateMonthlyTargetWindowAction} className="mt-4 grid gap-4">
      <input type="hidden" name="systemId" value={systemId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">First preferred day of each month</span>
          <input
            className="field mt-1"
            name="startDay"
            type="number"
            min="1"
            max="28"
            required
            value={firstDay}
            onChange={(event) => setFirstDay(Number(event.target.value))}
          />
        </label>
        <label>
          <span className="label">Last preferred day of each month</span>
          <input
            className="field mt-1"
            name="endDay"
            type="number"
            min="1"
            max="28"
            required
            value={lastDay}
            onChange={(event) => setLastDay(Number(event.target.value))}
          />
        </label>
      </div>
      <div
        className={`rounded-xl border p-3 text-sm font-bold ${validWindow ? "border-blue-200 bg-blue-50 text-blue-950" : "border-red-300 bg-red-50 text-red-900"}`}
        role="status"
      >
        {validWindow
          ? `Preview: aim to collect the monthly sample from the ${ordinal(firstDay)} through the ${ordinal(lastDay)}.`
          : "The first preferred day must be on or before the last preferred day. Use days 1 through 28."}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label>
          <span className="label">
            Why are you changing these dates? · Required
          </span>
          <input
            className="field mt-1"
            name="reason"
            minLength={8}
            required
            placeholder="Example: Align collection dates with the service route"
          />
        </label>
        <SubmitButton
          className="self-end"
          pendingLabel="Saving recommended dates…"
          disabled={!validWindow}
        >
          Save recommended dates
        </SubmitButton>
      </div>
    </form>
  );
}
