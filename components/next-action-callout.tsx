import Link from "next/link";
import { AlertTriangle, CalendarClock, CircleCheck, Info } from "lucide-react";
import { ComplianceDate } from "@/components/compliance-date";
import { buttonClass } from "@/lib/button-variants";
import type {
  NextTowerActionSelection,
  NextTowerActionState,
} from "@/lib/tower-details";

export type NextActionCalloutItem = {
  id: string;
  requiredAction: string;
  hardDueDate: string | null;
  workingDaysLeft: number | null;
  targetDate: string | null;
  obligationReason: string;
  actionLabel: string;
  actionHref: string;
};

const presentation: Record<
  Exclude<NextTowerActionState, "NONE">,
  { label: string; className: string; Icon: typeof AlertTriangle }
> = {
  OVERDUE: {
    label: "Overdue",
    className: "border-red-400 bg-red-50 text-red-950",
    Icon: AlertTriangle,
  },
  DUE_SOON: {
    label: "Due Soon",
    className: "border-amber-400 bg-amber-50 text-amber-950",
    Icon: CalendarClock,
  },
  REVIEW_REQUIRED: {
    label: "Review Required",
    className: "border-purple-400 bg-purple-50 text-purple-950",
    Icon: AlertTriangle,
  },
  UPCOMING_TARGET: {
    label: "Upcoming",
    className: "border-blue-200 bg-blue-50 text-blue-950",
    Icon: Info,
  },
  UPCOMING_DEADLINE: {
    label: "Upcoming",
    className: "border-blue-200 bg-blue-50 text-blue-950",
    Icon: Info,
  },
};

function workingDaysText(value: number | null) {
  if (value == null) return "Working days cannot be calculated";
  if (value === 0) return "Due today · 0 working days left";
  if (value < 0) {
    const overdue = Math.abs(value);
    return `Overdue by ${overdue} working day${overdue === 1 ? "" : "s"}`;
  }
  return `${value} working day${value === 1 ? "" : "s"} left`;
}

export function NextActionCallout({
  selection,
  items,
}: {
  selection: NextTowerActionSelection<unknown>;
  items: NextActionCalloutItem[];
}) {
  if (selection.state === "NONE")
    return (
      <section className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-800">
        <div className="flex items-start gap-3">
          <CircleCheck
            className="mt-0.5 shrink-0 text-emerald-700"
            aria-hidden
          />
          <div>
            <div className="label">Next Action Required</div>
            <h2 className="mt-1 text-xl font-black">
              No immediate action required
            </h2>
            <p className="mt-1 text-sm">{selection.reason}</p>
          </div>
        </div>
      </section>
    );

  const state = presentation[selection.state];
  const multiple = items.length > 1;
  const upcoming = !selection.immediate;
  return (
    <section
      className={`mb-6 rounded-xl border-2 p-5 ${state.className}`}
      aria-labelledby="next-action-required"
      data-testid="next-action-callout"
    >
      <div className="flex items-start gap-3">
        <state.Icon className="mt-0.5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="label">Next Action Required</div>
          <div className="mt-1 text-sm font-black uppercase tracking-wide">
            {state.label}
          </div>
          <h2 id="next-action-required" className="mt-1 text-xl font-black">
            {upcoming
              ? "No immediate action required"
              : multiple
                ? "Multiple actions required"
                : items[0]?.requiredAction}
          </h2>
          <p className="mt-1 text-sm font-bold">Reason: {selection.reason}</p>
          {upcoming && items[0] && (
            <p className="mt-2 text-sm">
              Next upcoming obligation:{" "}
              <strong>{items[0].requiredAction}</strong>
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="grid gap-3 rounded-lg border border-current/20 bg-white/80 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div>
              {(multiple || upcoming) && (
                <h3 className="font-black">{item.requiredAction}</h3>
              )}
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <span>
                  <strong>Hard due:</strong>{" "}
                  <ComplianceDate
                    value={item.hardDueDate}
                    compact
                    empty="Not calculated"
                  />
                </span>
                {upcoming && item.targetDate && (
                  <span>
                    <strong>Target date:</strong>{" "}
                    <ComplianceDate value={item.targetDate} compact />
                  </span>
                )}
                <strong>{workingDaysText(item.workingDaysLeft)}</strong>
              </div>
              <p className="mt-2 text-sm text-slate-700">
                {item.obligationReason}
              </p>
            </div>
            <Link
              className={buttonClass(
                "primary",
                "min-h-11 w-full justify-center sm:w-auto",
              )}
              href={item.actionHref}
            >
              {item.actionLabel}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
