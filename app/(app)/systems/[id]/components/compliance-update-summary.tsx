import Link from "next/link";
import type { ServiceEventType } from "@prisma/client";
import { ComplianceDate } from "@/components/compliance-date";
import { plainEnumLabel } from "@/lib/labels";

type ProjectionCounts = {
  sample: number;
  inspection: number;
  reporting: number;
  maintenance: number;
};

export function ComplianceUpdateSummary({
  generated,
  complianceHealthLabel,
  generatedObligations,
  satisfiedObligationTypes,
  recordedEvent,
  visitOpportunityCount,
  portalFollowUp,
}: {
  generated: ProjectionCounts;
  complianceHealthLabel: string;
  generatedObligations: Array<{ id: string; type: string }>;
  satisfiedObligationTypes: string[];
  recordedEvent: { eventType: ServiceEventType; eventDate: Date } | null;
  visitOpportunityCount: number | null;
  portalFollowUp: { id: string; latestDueDate: Date | null } | null;
}) {
  return (
    <section className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
      <div className="label">Compliance dates recalculated</div>
      <h2 className="mt-1 font-black">Compliance updated</h2>
      <ul className="mt-3 grid gap-2 text-sm font-bold sm:grid-cols-2">
        <li>✓ Compliance record saved and history updated</li>
        <li>✓ Compliance recalculated to {complianceHealthLabel}</li>
        {generatedObligations.map((item) => (
          <li key={item.id}>✓ {plainEnumLabel(item.type)} generated</li>
        ))}
        {satisfiedObligationTypes.map((type, index) => (
          <li key={`${type}-${index}`}>
            ✓ {plainEnumLabel(type)}{" "}
            {recordedEvent?.eventType === "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED"
              ? "completed by this collection"
              : "already satisfied by an existing completion record"}
          </li>
        ))}
        {!generatedObligations.length && !satisfiedObligationTypes.length && (
          <li>✓ No new requirement was created by this record</li>
        )}
        {recordedEvent &&
          ["CLEANING_COMPLETED", "STARTUP_CLEANING_DISINFECTION"].includes(
            recordedEvent.eventType,
          ) && (
            <li>
              ✓ Cleaning is tracked separately; no Legionella sample clock was
              reset
            </li>
          )}
        <li>
          ✓ Current projection: {generated.sample} sampling,{" "}
          {generated.inspection} inspection, {generated.maintenance}{" "}
          maintenance, {generated.reporting} reporting
        </li>
        {visitOpportunityCount != null && (
          <li>
            ✓ One completion date can cover {visitOpportunityCount} requirement
            {visitOpportunityCount === 1 ? "" : "s"}
          </li>
        )}
      </ul>
      {recordedEvent && (
        <div className="mt-3 border-t border-emerald-200 pt-3 text-sm">
          <span className="font-black">
            {plainEnumLabel(recordedEvent.eventType)}
          </span>{" "}
          · <ComplianceDate value={recordedEvent.eventDate} />
        </div>
      )}
      {portalFollowUp && (
        <div className="mt-4 rounded-lg border border-blue-300 bg-blue-50 p-4 text-blue-950">
          <div className="label">Required next step</div>
          <h3 className="mt-1 font-black">
            Submit this sample date to the NYC Health Department portal
          </h3>
          <p className="mt-1 text-sm">
            The Legionella sample is recorded, but its portal submission is a
            separate audited requirement.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <ComplianceDate
              value={portalFollowUp.latestDueDate}
              label="Portal deadline"
              deadline
              compact
              operational
            />
            <Link
              className="btn btn-primary"
              href={`?view=obligations&report=${encodeURIComponent(portalFollowUp.id)}#reporting-${portalFollowUp.id}`}
            >
              Record NYC portal submission
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
