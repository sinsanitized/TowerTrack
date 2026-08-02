"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Info, Sparkles } from "lucide-react";
import { completeVisitAction } from "@/app/actions";
import { ComplianceDate } from "@/components/compliance-date";
import { SourceBadge } from "@/components/source-badge";
import {
  previewVisitCompletion,
  type CompletionPreviewActivity,
  type CompletionPreviewObligation,
} from "@/lib/compliance-intelligence";
import { activityLabel, plainEnumLabel } from "@/lib/labels";
import { SubmitButton } from "@/components/submit-button";

type Activity = CompletionPreviewActivity & {
  sourceAuthority: string;
  status: string;
  schedulingWarning?: string | null;
};

export function VisitCompletionForm({
  visitId,
  scheduledDate,
  currentDate,
  completed,
  locked,
  completionLabel = "Complete visit",
  activities,
  obligations,
}: {
  visitId: string;
  scheduledDate: string;
  currentDate: string;
  completed: boolean;
  locked: boolean;
  completionLabel?: string;
  activities: Activity[];
  obligations: CompletionPreviewObligation[];
}) {
  const readOnly = completed || locked;
  const [performedDate, setPerformedDate] = useState(scheduledDate);
  const [selected, setSelected] = useState(
    () =>
      new Set(
        activities
          .filter((item) => item.status !== "CANCELLED")
          .map((item) => item.id),
      ),
  );
  const preview = useMemo(
    () =>
      previewVisitCompletion({
        performedDate,
        activities: activities.filter((activity) => selected.has(activity.id)),
        obligations,
      }),
    [activities, obligations, performedDate, selected],
  );
  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  return (
    <form action={completeVisitAction} className="mt-5">
      <input type="hidden" name="visitId" value={visitId} />
      <div className="space-y-3">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4"
          >
            <input
              name={`activity_${activity.id}`}
              type="checkbox"
              checked={selected.has(activity.id)}
              onChange={(event) => toggle(activity.id, event.target.checked)}
              disabled={readOnly}
              aria-label={`Complete ${activityLabel(activity.activityType)}`}
              className="mt-1 size-5 accent-emerald-800"
            />
            <div className="flex-1">
              <div className="font-black">
                {activityLabel(activity.activityType)}
              </div>
              <div className="text-sm text-slate-500">
                {activity.systemName}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <SourceBadge authority={activity.sourceAuthority} />
                {activity.qualifiesForRoutineLegionella && (
                  <span className="rounded bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800">
                    Records Legionella sample
                  </span>
                )}
                {activity.qualifiesForInspection && (
                  <span className="rounded bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-800">
                    Satisfies inspection
                  </span>
                )}
                {activity.qualifiesForCleaning && (
                  <span className="rounded bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-900">
                    Records cleaning separately
                  </span>
                )}
              </div>
              {activity.schedulingWarning && (
                <div
                  role="alert"
                  className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950"
                >
                  {activity.schedulingWarning}
                </div>
              )}
              {!readOnly &&
                selected.has(activity.id) &&
                activity.activityType === "SUMMERTIME_HYPERHALOGENATION" && (
                  <fieldset className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
                    <legend className="label sm:col-span-2">
                      Required hyperhalogenation record
                    </legend>
                    {[
                      ["chemical", "Chemical and concentration"],
                      ["quantity", "Quantity applied"],
                      ["contactTime", "Contact time"],
                      ["ph", "pH"],
                      ["freeHalogenResidual", "Free halogen residual readings"],
                    ].map(([name, label]) => (
                      <label
                        key={name}
                        className={
                          name === "freeHalogenResidual"
                            ? "sm:col-span-2"
                            : undefined
                        }
                      >
                        <span className="text-xs font-bold text-slate-600">
                          {label}
                        </span>
                        <input
                          className="field mt-1"
                          name={`activity_${activity.id}_${name}`}
                          required
                        />
                      </label>
                    ))}
                  </fieldset>
                )}
            </div>
          </div>
        ))}
      </div>
      {!readOnly && (
        <div className="mt-6 border-t pt-5">
          <label className="block">
            <span className="label">Work completion date · Required</span>
            <input
              className="field mt-1 max-w-xs"
              name="performedDate"
              type="date"
              max={currentDate}
              required
              value={performedDate}
              onChange={(event) => setPerformedDate(event.target.value)}
            />
          </label>
          <section className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
            <div className="flex items-center gap-2">
              <Sparkles size={18} />
              <h3 className="font-black">Completion impact preview</h3>
            </div>
            <div className="mt-3">
              <ComplianceDate value={performedDate} label="If completed on" />
            </div>
            <p className="mt-3 text-sm font-bold">{preview.explanation}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {preview.satisfied.map((obligation) => (
                <li key={obligation.id} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 shrink-0" size={16} />
                  <span>
                    Satisfies <b>{plainEnumLabel(obligation.type)}</b> for{" "}
                    {obligation.systemName}
                  </span>
                </li>
              ))}
              {preview.generated.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 shrink-0" size={16} />
                  <span>Generates {item.toLowerCase()}</span>
                </li>
              ))}
              {preview.cleaningOnlyWarning && (
                <li className="flex items-start gap-2 text-amber-950">
                  <Info className="mt-0.5 shrink-0" size={16} />
                  <span>
                    Cleaning is recorded separately and does not satisfy a
                    Legionella sample.
                  </span>
                </li>
              )}
            </ul>
          </section>
          <SubmitButton
            className="mt-4"
            pendingLabel="Saving completed work…"
            disabled={!selected.size}
          >
            {completionLabel}
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
