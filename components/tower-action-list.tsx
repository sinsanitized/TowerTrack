import Link from "next/link";
import { Layers3 } from "lucide-react";
import { ComplianceDate, ComplianceWindow } from "@/components/compliance-date";
import { StatusBadge } from "@/components/status-badge";
import { ClickableRow } from "@/components/clickable-row";
import { getUrgency } from "@/lib/compliance-intelligence";
import { requiredActionLabel, requirementLabel } from "@/lib/labels";
import { isOwnerManagedObligation } from "@/lib/event-workflow";
import { buttonClass } from "@/lib/button-variants";
import { completionHrefForObligation } from "@/lib/deadline-view";
import { eventEntryHref, isResampleObligation } from "@/lib/event-entry-intent";
import {
  isLegionellaObligation,
  responsibilityForServiceObligation,
  serviceResponsibilityLabel,
  type ServiceResponsibility,
  type TowerServiceResponsibilities,
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

export function TowerActionList({
  systemId,
  today,
  items,
  combinedObligationIds = new Set<string>(),
  emptyMessage = "No active requirement needs attention.",
  canConfirmOwnerManaged = false,
  legionellaResponsibility,
  responsibilities,
}: {
  systemId: string;
  today: string;
  items: TowerActionItem[];
  combinedObligationIds?: ReadonlySet<string>;
  emptyMessage?: string;
  canConfirmOwnerManaged?: boolean;
  legionellaResponsibility: ServiceResponsibility | null;
  responsibilities: TowerServiceResponsibilities;
}) {
  if (!items.length)
    return <p className="text-sm font-bold text-slate-600">{emptyMessage}</p>;

  return (
    <div>
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
        const responsibility = responsibilityForServiceObligation(
          item.type,
          item.category,
          responsibilities,
        );
        const externallyManaged = responsibility !== "OUR_COMPANY";
        const rowHref = externallyManaged
          ? legionella &&
            canConfirmOwnerManaged &&
            legionellaResponsibility === "OTHER_VENDOR"
            ? eventEntryHref({
                type: "external-legionella",
                towerId: systemId,
                obligationId: item.id,
              })
            : null
          : ownerManaged
            ? canConfirmOwnerManaged
              ? eventEntryHref({
                  type: "bacteriological",
                  towerId: systemId,
                  obligationId: item.id,
                })
              : null
            : completionHrefForObligation(systemId, item);
        return (
          <ClickableRow
            as="article"
            key={item.id}
            href={rowHref}
            label={`Open ${requiredActionLabel(item.type)}`}
            className={`record-row border-l-4 px-4 py-4 sm:px-5 ${urgency.color === "RED" ? "urgency-red" : urgency.color === "YELLOW" ? "urgency-amber" : urgency.color === "BLUE" ? "urgency-blue" : "border-l-slate-300"}`}
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_minmax(190px,.65fr)_auto] lg:items-center">
              <div>
                <h3 className="font-black leading-snug">
                  {requiredActionLabel(item.type)}
                </h3>
                {ownerManaged && (
                  <p className="mt-2 inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black text-blue-900">
                    Owner managed · external responsibility
                  </p>
                )}
                {externallyManaged && (
                  <p className="mt-2 inline-flex rounded-full bg-purple-100 px-2.5 py-1 text-xs font-black text-purple-900">
                    {serviceResponsibilityLabel(responsibility)}
                  </p>
                )}
                {combinedObligationIds.has(item.id) && (
                  <p className="mt-2 flex items-center gap-2 text-sm font-black text-emerald-900">
                    <Layers3 size={17} /> Can be completed with another open
                    requirement on the same valid date
                  </p>
                )}
              </div>
              <div className="date-block">
                <ComplianceDate
                  value={item.latest}
                  label="Compliance deadline"
                  deadline
                  operational
                  empty={item.priority === "EMERGENCY" ? "Immediate" : "Open"}
                />
                <div className="mt-2">
                  <StatusBadge color={urgency.color} label={urgency.label} />
                </div>
              </div>
              {externallyManaged ? (
                legionella &&
                canConfirmOwnerManaged &&
                legionellaResponsibility === "OTHER_VENDOR" ? (
                  <Link
                    className={buttonClass(
                      "secondary",
                      "min-h-11 w-full justify-center text-center xl:w-auto",
                    )}
                    href={eventEntryHref({
                      type: "external-legionella",
                      towerId: systemId,
                      obligationId: item.id,
                    })}
                  >
                    Record external sample
                  </Link>
                ) : (
                  <div className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-center text-sm font-black text-purple-900">
                    {responsibility === "NOT_TRACKED"
                      ? "Not tracked in TowerTrack"
                      : responsibility === "CUSTOMER"
                        ? "Waiting on customer"
                        : responsibility === "OTHER_VENDOR"
                          ? "Waiting on vendor"
                          : "Waiting on responsibility review"}
                  </div>
                )
              ) : ownerManaged ? (
                canConfirmOwnerManaged ? (
                  <Link
                    className={buttonClass(
                      "secondary",
                      "min-h-11 w-full justify-center text-center xl:w-auto",
                    )}
                    href={eventEntryHref({
                      type: "bacteriological",
                      towerId: systemId,
                      obligationId: item.id,
                    })}
                  >
                    Record bacteriological sample
                  </Link>
                ) : (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-center text-sm font-black text-blue-900">
                    No technician action
                  </div>
                )
              ) : (
                <Link
                  className={buttonClass(
                    "primary",
                    "min-h-11 w-full justify-center text-center xl:w-auto",
                  )}
                  href={completionHrefForObligation(systemId, item)}
                >
                  {item.category === "REPORTING_ACTION"
                    ? "Record submission"
                    : item.category === "SAMPLE"
                      ? isResampleObligation(item.type)
                        ? "Record resample"
                        : "Record sample"
                      : item.category === "INSPECTION"
                        ? "Record inspection"
                        : item.type.includes("CLEANING")
                          ? "Record cleaning"
                          : "Record completion"}
                </Link>
              )}
            </div>
            <details className="detail-disclosure mt-3">
              <summary>Dates and requirement details</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <ComplianceDate
                  value={item.targetStart}
                  label="Recommended service date"
                  operational
                  empty="No separate recommended date"
                />
                <ComplianceWindow
                  start={item.targetStart ?? item.earliest}
                  end={item.targetEnd ?? item.latest}
                  label={
                    item.targetStart || item.targetEnd
                      ? "Recommended service window"
                      : "Valid completion window"
                  }
                  operational
                />
              </div>
              <p className="mt-3 text-sm font-bold">
                Requirement: {requirementLabel(item.type)}
              </p>
              <p className="mt-1 text-slate-600">{item.reason}</p>
            </details>
          </ClickableRow>
        );
      })}
    </div>
  );
}
