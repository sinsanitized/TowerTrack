import Link from "next/link";
import { recordServiceEventAction } from "@/app/actions/service-events";
import { ObligationIntelligenceCard } from "@/components/obligation-intelligence-card";
import { SubmitButton } from "@/components/submit-button";
import { buttonClass } from "@/lib/button-variants";
import { formatDate } from "@/lib/date";
import { completionHrefForObligation } from "@/lib/deadline-view";
import { plainEnumLabel } from "@/lib/labels";

type ObligationRecord = {
  id: string;
  obligationType?: string;
  earliestDueDate: Date | null;
  targetStartDate: Date | null;
  targetEndDate: Date | null;
  latestDueDate: Date | null;
  priority: string;
  status: string;
  reason: string;
  sourceCitation: string | null;
  triggerEvent: { id: string; eventType: string; eventDate: Date };
};

type ReportingObligationRecord = ObligationRecord & {
  obligationType: string;
  completedByEvent: { id: string; status: string; eventDate: Date } | null;
};

function RequirementList({
  label,
  title,
  category,
  items,
  today,
  emptyMessage,
  displayedType,
}: {
  label: string;
  title: string;
  category: "SAMPLE" | "INSPECTION" | "MAINTENANCE";
  items: ObligationRecord[];
  today: string;
  emptyMessage: string;
  displayedType?: string;
}) {
  return (
    <section className="panel p-5">
      <div className="label">{label}</div>
      <h2 className="mt-1 font-black">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((item) => (
            <ObligationIntelligenceCard
              key={item.id}
              today={today}
              obligation={{
                id: item.id,
                type:
                  displayedType ?? item.obligationType ?? "UNKNOWN_REQUIREMENT",
                category,
                earliest: item.earliestDueDate,
                targetStart: item.targetStartDate,
                targetEnd: item.targetEndDate,
                latest: item.latestDueDate,
                priority: item.priority,
                status: item.status,
                reason: item.reason,
                sourceCitation: item.sourceCitation,
                trigger: {
                  id: item.triggerEvent.id,
                  type: item.triggerEvent.eventType,
                  date: item.triggerEvent.eventDate,
                },
              }}
            />
          ))
        ) : (
          <p className="text-sm text-slate-500">{emptyMessage}</p>
        )}
      </div>
    </section>
  );
}

function isRecordableReport(type: string) {
  return (
    !type.includes("CORRECTIVE_ACTION") &&
    type !== "LEVEL_4_FULL_REMEDIATION" &&
    type !== "BIOLOGICAL_INDICATOR_RESIDUAL_MONITORING"
  );
}

function ReportingRequirement({
  systemId,
  item,
  today,
  focused,
}: {
  systemId: string;
  item: ReportingObligationRecord;
  today: string;
  focused: boolean;
}) {
  const completedLate = Boolean(
    item.completedByEvent?.eventDate &&
    item.latestDueDate &&
    item.completedByEvent.eventDate > item.latestDueDate,
  );
  const recordable = isRecordableReport(item.obligationType);

  return (
    <section
      id={`reporting-${item.id}`}
      className={`scroll-mt-24 rounded-xl border p-4 text-sm ${
        focused
          ? "border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <ObligationIntelligenceCard
        today={today}
        obligation={{
          id: item.id,
          type: item.obligationType,
          category: "REPORTING_ACTION",
          earliest: item.earliestDueDate,
          targetStart: item.targetStartDate,
          targetEnd: item.targetEndDate,
          latest: item.latestDueDate,
          priority: item.priority,
          status: item.status,
          reason: item.reason,
          sourceCitation: item.sourceCitation,
          trigger: {
            id: item.triggerEvent.id,
            type: item.triggerEvent.eventType,
            date: item.triggerEvent.eventDate,
          },
        }}
      />
      {recordable && item.status === "COMPLETED" ? (
        <p
          className={`mt-3 font-bold ${completedLate ? "text-amber-900" : "text-emerald-900"}`}
        >
          {completedLate ? "Completed late" : "Completed on time"}
          {item.completedByEvent?.eventDate
            ? ` · Submitted ${formatDate(item.completedByEvent.eventDate)}`
            : ""}
        </p>
      ) : recordable && focused ? (
        <form
          action={recordServiceEventAction}
          className="mt-3 rounded-xl border border-emerald-200 bg-white p-4"
        >
          <div className="mb-3 border-b border-slate-200 pb-3">
            <div className="label">Record actual submission</div>
            <p className="mt-1 text-sm text-slate-600">
              Enter the verified completion date, then save.
            </p>
          </div>
          {item.status === "MISSED" && (
            <p className="mb-2 font-bold text-red-900">
              Record this as a late historical submission. It will not repair
              the missed requirement.
            </p>
          )}
          <input type="hidden" name="systemId" value={systemId} />
          <input type="hidden" name="eventType" value="REPORT_SUBMITTED" />
          <label className="block">
            <span className="label">Actual submission date · Required</span>
            <input
              className="field mt-1"
              name="eventDate"
              type="date"
              max={today}
              required
            />
            <span className="mt-1 block text-xs font-bold text-slate-600">
              Use the date on the portal or agency confirmation—not today unless
              it was actually submitted today.
            </span>
          </label>
          <input type="hidden" name="reportType" value={item.obligationType} />
          <input type="hidden" name="reportingObligationId" value={item.id} />
          <input
            type="hidden"
            name="triggeringEventId"
            value={item.triggerEvent.id}
          />
          <input
            type="hidden"
            name="notes"
            value={`Completed ${plainEnumLabel(item.obligationType)}`}
          />
          <SubmitButton className="mt-2" pendingLabel="Saving submission…">
            {item.obligationType === "PORTAL_SAMPLE_DATE"
              ? "Record NYC portal submission"
              : "Record submission"}
          </SubmitButton>
        </form>
      ) : recordable ? (
        <Link
          className={buttonClass("primary", "mt-3")}
          href={completionHrefForObligation(systemId, {
            id: item.id,
            type: item.obligationType,
            category: "REPORTING_ACTION",
          })}
        >
          {item.obligationType === "PORTAL_SAMPLE_DATE"
            ? "Record NYC portal submission"
            : "Record submission"}
        </Link>
      ) : null}
    </section>
  );
}

export function TowerRequirementDetails({
  systemId,
  today,
  open,
  focusedReportingId,
  sampleObligations,
  maintenanceObligations,
  inspectionObligations,
  reportingObligations,
}: {
  systemId: string;
  today: string;
  open: boolean;
  focusedReportingId?: string;
  sampleObligations: ObligationRecord[];
  maintenanceObligations: ObligationRecord[];
  inspectionObligations: ObligationRecord[];
  reportingObligations: ReportingObligationRecord[];
}) {
  return (
    <details className="panel mb-6 scroll-mt-6 p-5" open={open}>
      <summary className="cursor-pointer text-base font-black text-emerald-900">
        Reporting and advanced requirement details
      </summary>
      <p className="mt-2 text-sm text-slate-600">
        Review source rules, record required submissions, or inspect detailed
        sampling requirements.
      </p>
      <div
        id="obligations"
        className="mt-5 grid scroll-mt-6 gap-4 xl:grid-cols-2"
      >
        <RequirementList
          label="Sampling requirements"
          title="Open Legionella sampling requirements"
          category="SAMPLE"
          items={sampleObligations}
          today={today}
          emptyMessage="No sample requirement created by a compliance record is open."
        />
        <RequirementList
          label="Cleaning requirements"
          title="Startup maintenance requirements"
          category="MAINTENANCE"
          items={maintenanceObligations}
          today={today}
          emptyMessage="No startup cleaning requirement is open."
        />
        <RequirementList
          label="Inspection requirements"
          title="Qualified-person inspection"
          category="INSPECTION"
          items={inspectionObligations}
          today={today}
          displayedType="QUARTERLY_COMPLIANCE_INSPECTION"
          emptyMessage="Record a completed inspection to establish the next 90-day requirement."
        />
        <section className="panel p-5">
          <div className="label">Reporting & action reminders</div>
          <h2 className="mt-1 font-black">DOH and portal deadlines</h2>
          <div className="mt-4 space-y-3">
            {reportingObligations.length ? (
              reportingObligations.map((item) => (
                <ReportingRequirement
                  key={item.id}
                  systemId={systemId}
                  item={item}
                  today={today}
                  focused={focusedReportingId === item.id}
                />
              ))
            ) : (
              <p className="text-sm text-slate-500">
                No reporting requirement created by a compliance record is open.
              </p>
            )}
          </div>
        </section>
      </div>
    </details>
  );
}
