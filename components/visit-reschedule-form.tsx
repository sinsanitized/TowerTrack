"use client";

import { useState } from "react";
import { rescheduleVisitAction } from "@/app/actions";
import { buttonClass } from "@/lib/button-variants";
import { ComplianceDate, ComplianceWindow } from "@/components/compliance-date";

export function VisitRescheduleForm({
  visitId,
  currentDate,
  earliestDate,
  latestDate,
}: {
  visitId: string;
  currentDate: string;
  earliestDate: string | null;
  latestDate: string | null;
}) {
  const [scheduledDate, setScheduledDate] = useState(currentDate);
  return (
    <form
      action={rescheduleVisitAction}
      className="mt-6 border-t border-slate-200 pt-5"
    >
      <input type="hidden" name="visitId" value={visitId} />
      <h3 className="font-black">Reschedule this generated visit</h3>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        The visit date may move only where every attached obligation remains
        legally satisfiable. Generated deadlines do not move.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ComplianceWindow
          start={earliestDate}
          end={latestDate}
          label="Dates when all selected obligations can be satisfied"
        />
        <ComplianceDate value={scheduledDate} label="Proposed visit date" />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label>
          <span className="label">New visit date</span>
          <input
            className="field mt-1"
            name="scheduledDate"
            type="date"
            required
            min={earliestDate ?? undefined}
            max={latestDate ?? undefined}
            value={scheduledDate}
            onChange={(event) => setScheduledDate(event.target.value)}
          />
        </label>
        <label>
          <span className="label">Reschedule reason</span>
          <input
            className="field mt-1"
            name="reason"
            required
            minLength={8}
            placeholder="Why the planned date changed"
          />
        </label>
      </div>
      <button className={buttonClass("primary", "mt-4")}>
        Confirm compliant reschedule
      </button>
    </form>
  );
}
