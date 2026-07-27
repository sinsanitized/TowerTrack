"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Save } from "lucide-react";
import {
  correctServiceEventAction,
  voidServiceEventAction,
} from "@/app/actions";
import { ComplianceDate, ComplianceWindow } from "@/components/compliance-date";
import { LegionellaResultInput } from "@/components/legionella-result-input";
import {
  projectEventObligations,
  type RegulatoryEventType,
  type TowerRuleConfig,
} from "@/lib/obligation-engine";
import {
  SERVICE_EVENT_TYPES,
  type ServiceEventTypeValue,
} from "@/lib/service-events";
import { plainEnumLabel, requirementLabel } from "@/lib/labels";
import { formatOperationalDate } from "@/lib/date";

interface EditableEvent {
  id: string;
  eventType: ServiceEventTypeValue;
  eventDate: string;
  eventTimestamp: string;
  notes: string;
  cfuPerMl: string;
  residualOutcome: "RESTORED" | "NOT_RESTORED" | "UNKNOWN";
  reportType: string;
  reportingObligationId: string;
  sampleEventId: string;
  chemical: string;
  quantity: string;
  contactTime: string;
  ph: string;
  freeHalogenResidual: string;
  technician: string;
}

export function EventEditor({
  event,
  systemId,
  currentDate,
  ruleConfig,
  availableSamples,
}: {
  event: EditableEvent;
  systemId: string;
  currentDate: string;
  ruleConfig: TowerRuleConfig;
  availableSamples: Array<{ id: string; date: string }>;
}) {
  const [eventType, setEventType] = useState<ServiceEventTypeValue>(
    event.eventType,
  );
  const [eventDate, setEventDate] = useState(event.eventDate);
  const [cfuPerMl, setCfuPerMl] = useState(event.cfuPerMl);
  const [sampleEventId, setSampleEventId] = useState(event.sampleEventId);
  const isResult = [
    "LEGIONELLA_RESULT_RECEIVED",
    "WEEKLY_BIOLOGICAL_INDICATOR_RESULT",
  ].includes(eventType);
  const isHyper = eventType === "SUMMERTIME_HYPERHALOGENATION";
  const preview = useMemo(() => {
    if (!eventDate || (isResult && cfuPerMl === ""))
      return { projection: null, error: null };
    try {
      return {
        projection: projectEventObligations(
          {
            id: "correction-preview",
            type: eventType as RegulatoryEventType,
            date: eventDate,
            timestamp: null,
            cfuPerMl: isResult ? Number(cfuPerMl) : null,
            residualRestoredWithin3Days: null,
          },
          ruleConfig,
        ),
        error: null,
      };
    } catch (error) {
      return {
        projection: null,
        error:
          error instanceof Error
            ? error.message
            : "The correction impact could not be calculated.",
      };
    }
  }, [cfuPerMl, eventDate, eventType, isResult, ruleConfig]);
  const projected = preview.projection
    ? [
        ...preview.projection.sample,
        ...preview.projection.inspection,
        ...preview.projection.reporting,
        ...preview.projection.maintenance,
      ]
    : [];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
      <form action={correctServiceEventAction} className="panel p-6">
        <input type="hidden" name="eventId" value={event.id} />
        <div className="label">Editable event record</div>
        <h2 className="mt-1 text-xl font-black">Correct event details</h2>
        <p className="mt-2 text-sm text-slate-600">
          Saving creates an audited replacement and recalculates every open
          obligation. The original record remains visible.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="label">Event type</span>
            <select
              className="field mt-1"
              name="eventType"
              value={eventType}
              onChange={(value) =>
                setEventType(value.target.value as ServiceEventTypeValue)
              }
            >
              {SERVICE_EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {plainEnumLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Event date</span>
            <input
              className="field mt-1"
              name="eventDate"
              type="date"
              max={currentDate}
              required
              value={eventDate}
              onChange={(value) => setEventDate(value.target.value)}
            />
          </label>
          {eventType === "LEGIONELLA_RESULT_RECEIVED" && (
            <>
              <label>
                <span className="label">Sample tested</span>
                <select
                  className="field mt-1"
                  name="sampleEventId"
                  required
                  value={sampleEventId}
                  onChange={(value) => setSampleEventId(value.target.value)}
                >
                  {availableSamples.map((sample) => (
                    <option key={sample.id} value={sample.id}>
                      Collected {formatOperationalDate(sample.date)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {eventType === "LEGIONELLA_RESULT_RECEIVED" && (
            <LegionellaResultInput value={cfuPerMl} onChange={setCfuPerMl} />
          )}
          {eventType === "WEEKLY_BIOLOGICAL_INDICATOR_RESULT" && (
            <label>
              <span className="label">Result (CFU/mL)</span>
              <input
                className="field mt-1"
                name="cfuPerMl"
                type="number"
                min="0"
                step="any"
                required
                value={cfuPerMl}
                onChange={(value) => setCfuPerMl(value.target.value)}
              />
            </label>
          )}
          {eventType === "WEEKLY_BIOLOGICAL_INDICATOR_RESULT" && (
            <label>
              <span className="label">Residual outcome after 3 days</span>
              <select
                className="field mt-1"
                name="residualOutcome"
                defaultValue={event.residualOutcome}
              >
                <option value="UNKNOWN">Still monitoring / unknown</option>
                <option value="RESTORED">Restored for at least 24 hours</option>
                <option value="NOT_RESTORED">Not restored within 3 days</option>
              </select>
            </label>
          )}
          {eventType === "REPORT_SUBMITTED" && (
            <>
              <input
                type="hidden"
                name="reportingObligationId"
                value={event.reportingObligationId}
              />
              <label className="md:col-span-2">
                <span className="label">Reporting obligation submitted</span>
                <input
                  className="field mt-1"
                  name="reportType"
                  required
                  defaultValue={event.reportType}
                />
              </label>
            </>
          )}
          {isHyper && (
            <>
              <label>
                <span className="label">Chemical</span>
                <input
                  className="field mt-1"
                  name="chemical"
                  required
                  defaultValue={event.chemical}
                />
              </label>
              <label>
                <span className="label">Quantity</span>
                <input
                  className="field mt-1"
                  name="quantity"
                  required
                  defaultValue={event.quantity}
                />
              </label>
              <label>
                <span className="label">Contact time</span>
                <input
                  className="field mt-1"
                  name="contactTime"
                  required
                  defaultValue={event.contactTime}
                />
              </label>
              <label>
                <span className="label">pH</span>
                <input
                  className="field mt-1"
                  name="ph"
                  required
                  defaultValue={event.ph}
                />
              </label>
              <label>
                <span className="label">Free halogen residual</span>
                <input
                  className="field mt-1"
                  name="freeHalogenResidual"
                  required
                  defaultValue={event.freeHalogenResidual}
                />
              </label>
              <label>
                <span className="label">Technician</span>
                <input
                  className="field mt-1"
                  name="technician"
                  required
                  defaultValue={event.technician}
                />
              </label>
            </>
          )}
          <label className="md:col-span-2">
            <span className="label">Notes</span>
            <textarea
              className="field mt-1 min-h-28"
              name="notes"
              maxLength={2000}
              defaultValue={event.notes}
            />
          </label>
          <label className="md:col-span-2">
            <span className="label">Correction reason (required)</span>
            <textarea
              className="field mt-1 min-h-24"
              name="reason"
              minLength={8}
              required
              placeholder="What source record was checked and why is this correction needed?"
            />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="btn btn-primary">
            <Save size={17} /> Save corrected event
          </button>
          <Link className="btn" href={`/systems/${systemId}`}>
            Cancel
          </Link>
        </div>
      </form>

      <div className="space-y-6">
        <section className="panel p-5">
          <div className="label">Before saving</div>
          <h2 className="mt-1 text-xl font-black">Correction impact preview</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-1">
            <div>
              <dt className="label">Event type</dt>
              <dd className="font-black">
                {plainEnumLabel(event.eventType)} → {plainEnumLabel(eventType)}
              </dd>
            </div>
            <ComplianceDate value={eventDate} label="Corrected event date" />
          </dl>
          <div className="mt-4 rounded-lg bg-purple-50 p-3 text-sm font-bold text-purple-950">
            All open sample, inspection, reporting, and corrective projections
            will be rebuilt from the active event history. Completed work is
            preserved.
          </div>
          <div className="mt-4 space-y-3">
            {preview.error ? (
              <p
                className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-950"
                role="alert"
              >
                Preview unavailable: {preview.error}
              </p>
            ) : isResult && cfuPerMl === "" ? (
              <p className="text-sm font-bold text-slate-600">
                Enter the CFU/mL result to preview its obligations.
              </p>
            ) : projected.length ? (
              projected.map((item) => (
                <article
                  key={`${item.obligationType}-${item.latestDueDate}`}
                  className="rounded-lg border border-blue-200 bg-blue-50 p-3"
                >
                  <div className="font-black">
                    Generates {requirementLabel(item.obligationType)}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{item.reason}</p>
                  <div className="mt-3 grid gap-3">
                    <ComplianceWindow
                      start={item.targetStartDate ?? item.earliestDueDate}
                      end={item.targetEndDate ?? item.latestDueDate}
                    />
                    <ComplianceDate
                      value={item.latestDueDate}
                      label="Legal deadline"
                      deadline
                      empty={
                        item.priority === "EMERGENCY"
                          ? "Immediate / follow MPP"
                          : "No fixed deadline"
                      }
                    />
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm font-bold text-slate-600">
                No new dated obligation is predicted from this corrected event.
              </p>
            )}
          </div>
        </section>
        <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0" size={19} />
            <div>
              <h2 className="font-black">Remove an invalid event</h2>
              <p className="mt-1 text-sm">
                Removal voids the record without deleting its audit history and
                recalculates compliance.
              </p>
            </div>
          </div>
          <form action={voidServiceEventAction} className="mt-4 space-y-3">
            <input type="hidden" name="eventId" value={event.id} />
            <label className="block">
              <span className="label">Reason to void (required)</span>
              <textarea
                className="field mt-1 min-h-20"
                name="reason"
                minLength={8}
                required
              />
            </label>
            <button className="btn">Void event (audited)</button>
          </form>
        </section>
      </div>
    </div>
  );
}
