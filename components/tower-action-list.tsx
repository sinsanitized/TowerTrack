import Link from "next/link";
import { Layers3 } from "lucide-react";
import { ComplianceDate, ComplianceWindow } from "@/components/compliance-date";
import { StatusBadge } from "@/components/status-badge";
import { getUrgency } from "@/lib/compliance-intelligence";
import { formatWorkingDaysLeft } from "@/lib/date";
import { requiredActionLabel, requirementLabel } from "@/lib/labels";
import { isOwnerManagedObligation } from "@/lib/event-workflow";
import { buttonClass } from "@/lib/button-variants";
import {
  isLegionellaObligation,
  serviceResponsibilityLabel,
  type ServiceResponsibility,
} from "@/lib/service-responsibility";

export type TowerActionItem = {
  id: string;
  type: string;
  category: "SAMPLE" | "INSPECTION" | "MAINTENANCE" | "REPORTING_ACTION";
  earliest: string | null;
  targetStart: string | null;
  targetEnd: string | null;
  latest: string | null;
  priority: string;
  status: string;
  reason: string;
};

function recordQuery(item: TowerActionItem) {
  if (item.type === "SUMMERTIME_HYPERHALOGENATION_DUE")
    return "hyperhalogenation";
  if (item.category === "SAMPLE") return "sample";
  return "event";
}

export function TowerActionList({
  systemId,
  today,
  items,
  combinedObligationIds = new Set<string>(),
  emptyMessage = "No active obligation needs attention.",
  canConfirmOwnerManaged = false,
  legionellaResponsibility,
}: {
  systemId: string;
  today: string;
  items: TowerActionItem[];
  combinedObligationIds?: ReadonlySet<string>;
  emptyMessage?: string;
  canConfirmOwnerManaged?: boolean;
  legionellaResponsibility: ServiceResponsibility | null;
}) {
  if (!items.length)
    return <p className="text-sm font-bold text-slate-600">{emptyMessage}</p>;

  return (
    <div className="divide-y divide-slate-200">
      {items.map((item) => {
        const urgency = getUrgency({
          today,
          status: item.status,
          priority: item.priority,
          latestDueDate: item.latest,
          targetStartDate: item.targetStart,
        });
        const ownerManaged = isOwnerManagedObligation(item.type);
        const legionella = isLegionellaObligation(item.type);
        const externallyManaged =
          legionella && legionellaResponsibility !== "OUR_COMPANY";
        return (
          <article key={item.id} className="py-5 first:pt-0 last:pb-0">
            <div className="grid gap-4 xl:grid-cols-[minmax(250px,1.2fr)_minmax(210px,.8fr)_minmax(180px,.65fr)_auto] xl:items-center">
              <div>
                <div className="label">Required action</div>
                <h3 className="mt-1 text-lg font-black">
                  {requiredActionLabel(item.type)}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Satisfies: {requirementLabel(item.type)}
                </p>
                {ownerManaged && (
                  <p className="mt-2 inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black text-blue-900">
                    Owner managed · external responsibility
                  </p>
                )}
                {externallyManaged && (
                  <p className="mt-2 inline-flex rounded-full bg-purple-100 px-2.5 py-1 text-xs font-black text-purple-900">
                    {serviceResponsibilityLabel(legionellaResponsibility)}
                  </p>
                )}
                {combinedObligationIds.has(item.id) && (
                  <p className="mt-2 flex items-center gap-2 text-sm font-black text-emerald-900">
                    <Layers3 size={17} /> Can share a visit with another open
                    obligation
                  </p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <ComplianceDate
                  value={item.targetStart}
                  label="Target date"
                  operational
                  empty="No separate target"
                />
                <ComplianceWindow
                  start={item.targetStart ?? item.earliest}
                  end={item.targetEnd ?? item.latest}
                  label={
                    item.targetStart || item.targetEnd
                      ? "Target window"
                      : "Valid completion window"
                  }
                  operational
                />
              </div>
              <div>
                <ComplianceDate
                  value={item.latest}
                  label="Hard due date"
                  deadline
                  operational
                  empty={item.priority === "EMERGENCY" ? "Immediate" : "Open"}
                />
                <p className="mt-2 text-sm font-black text-slate-800">
                  {item.latest
                    ? formatWorkingDaysLeft(item.latest, today)
                    : "No fixed working-day count"}
                </p>
                <div className="mt-2">
                  <StatusBadge color={urgency.color} label={urgency.label} />
                </div>
              </div>
              {externallyManaged ? (
                canConfirmOwnerManaged &&
                (legionellaResponsibility === "CUSTOMER" ||
                  legionellaResponsibility === "OTHER_VENDOR") ? (
                  <Link
                    className={buttonClass(
                      "secondary",
                      "min-h-11 justify-center",
                    )}
                    href={`/systems/${systemId}?record=external-legionella#record-event`}
                  >
                    Record external information
                  </Link>
                ) : (
                  <div className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-center text-sm font-black text-purple-900">
                    {legionellaResponsibility === "NOT_TRACKED"
                      ? "Not tracked in TowerTrack"
                      : legionellaResponsibility
                        ? "No technician action"
                        : "Review required"}
                  </div>
                )
              ) : ownerManaged ? (
                canConfirmOwnerManaged ? (
                  <Link
                    className={buttonClass(
                      "secondary",
                      "min-h-11 justify-center",
                    )}
                    href={`/systems/${systemId}?record=bacteriological#record-event`}
                  >
                    Confirm external completion
                  </Link>
                ) : (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-center text-sm font-black text-blue-900">
                    No technician action
                  </div>
                )
              ) : (
                <Link
                  className={buttonClass("primary", "min-h-11 justify-center")}
                  href={`/systems/${systemId}?record=${recordQuery(item)}#record-event`}
                >
                  Record completion
                </Link>
              )}
            </div>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-bold text-emerald-800">
                Why this is required
              </summary>
              <p className="mt-2 text-slate-600">{item.reason}</p>
            </details>
          </article>
        );
      })}
    </div>
  );
}
