"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Beaker,
  ClipboardCheck,
  BrushCleaning,
  Droplets,
  FlaskConical,
  Play,
  Power,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { recordServiceEventAction } from "@/app/actions";
import {
  previewEventImpact,
  type OpenSampleObligationForImpact,
  type RegulatoryEventType,
  type TowerRuleConfig,
} from "@/lib/obligation-engine";
import { ComplianceDate, ComplianceWindow } from "@/components/compliance-date";
import { LegionellaResultInput } from "@/components/legionella-result-input";
import { plainEnumLabel, requirementLabel } from "@/lib/labels";
import { formatOperationalDate } from "@/lib/date";
import { eventDefinitionsForLocation } from "@/lib/event-workflow";
import { buttonClass } from "@/lib/button-variants";
import {
  canRecordExternalLegionella,
  serviceResponsibilityLabel,
  type ServiceResponsibility,
} from "@/lib/service-responsibility";

const eventIcons = {
  ROUTINE_LEGIONELLA_SAMPLE_COLLECTED: FlaskConical,
  BACTERIOLOGICAL_SAMPLE_COLLECTED: FlaskConical,
  LEGIONELLA_RESULT_RECEIVED: Beaker,
  QUARTERLY_INSPECTION_COMPLETED: ClipboardCheck,
  CLEANING_COMPLETED: BrushCleaning,
  STARTUP: Play,
  SHUTDOWN: Power,
  SUMMERTIME_HYPERHALOGENATION: Sparkles,
  HIGH_LEGIONELLA_DISINFECTION: Droplets,
  POWER_FAILURE: AlertTriangle,
  WEEKLY_BIOLOGICAL_INDICATOR_RESULT: ShieldAlert,
} as const;

const primaryEvents = eventDefinitionsForLocation("PRIMARY");
const moreEvents = eventDefinitionsForLocation("MORE");
const officeEvents = eventDefinitionsForLocation("OFFICE_ONLY");

const emergencyTypes = [
  ["Power failure", "POWER_FAILURE"],
  ["Biocide feed loss", "BIOCIDE_LOSS"],
  ["Conductivity control failure", "CONDUCTIVITY_CONTROL_FAILURE"],
  ["DOH-directed sample", "DOH_DIRECTED_SAMPLE"],
  ["Other DOH condition", "OTHER_DOH_CONDITION"],
  ["Manual possible-risk event", "MANUAL_RISK_EVENT"],
] as const;

export function EventRecorder({
  systemId,
  defaultDate,
  ruleConfig,
  samplesAwaitingResults,
  initialSampleEventId,
  initialEventType,
  canConfirmOwnerManaged = false,
  openSampleObligations = [],
  legionellaResponsibility,
  legionellaVendorName,
  onCancel,
}: {
  systemId: string;
  defaultDate: string;
  ruleConfig: TowerRuleConfig;
  samplesAwaitingResults: Array<{ id: string; date: string }>;
  initialSampleEventId?: string;
  initialEventType?: RegulatoryEventType;
  canConfirmOwnerManaged?: boolean;
  openSampleObligations?: OpenSampleObligationForImpact[];
  legionellaResponsibility: ServiceResponsibility | null;
  legionellaVendorName?: string | null;
  onCancel?: () => void;
}) {
  const responseTimings = ruleConfig.responseTimings;
  const [ready, setReady] = useState(false);
  const [eventSelected, setEventSelected] = useState(
    Boolean(initialSampleEventId || initialEventType),
  );
  const [eventType, setEventType] = useState<string>(
    initialSampleEventId
      ? "LEGIONELLA_RESULT_RECEIVED"
      : (initialEventType ?? "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED"),
  );
  const [eventDate, setEventDate] = useState(defaultDate);
  const [cfuPerMl, setCfuPerMl] = useState("");
  const [sampleEventId, setSampleEventId] = useState(
    initialSampleEventId ?? samplesAwaitingResults[0]?.id ?? "",
  );
  useEffect(() => setReady(true), []);
  const isResult = [
    "LEGIONELLA_RESULT_RECEIVED",
    "WEEKLY_BIOLOGICAL_INDICATOR_RESULT",
  ].includes(eventType);
  const isEmergency = emergencyTypes.some(([, value]) => value === eventType);
  const isHyper = eventType === "SUMMERTIME_HYPERHALOGENATION";
  const isCleaning = [
    "CLEANING_COMPLETED",
    "STARTUP_CLEANING_DISINFECTION",
  ].includes(eventType);
  const isRemediation = [
    "HIGH_LEGIONELLA_DISINFECTION",
    "FULL_REMEDIATION",
  ].includes(eventType);
  const externalLegionella = canRecordExternalLegionella(
    legionellaResponsibility,
  );
  const preview = useMemo(() => {
    if (!eventDate || (isResult && cfuPerMl === ""))
      return { impact: null, error: null };
    try {
      return {
        impact: previewEventImpact({
          proposedEvent: {
            id: "preview",
            type: eventType as RegulatoryEventType,
            date: eventDate,
            timestamp: null,
            cfuPerMl: isResult ? Number(cfuPerMl) : null,
            residualRestoredWithin3Days: null,
          },
          ruleConfig,
          openSampleObligations,
          performedByResponsibility:
            externalLegionella &&
            [
              "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
              "LEGIONELLA_RESULT_RECEIVED",
            ].includes(eventType)
              ? (legionellaResponsibility ?? undefined)
              : "OUR_COMPANY",
        }),
        error: null,
      };
    } catch (error) {
      return {
        impact: null,
        error:
          error instanceof Error
            ? error.message
            : "The compliance impact could not be calculated.",
      };
    }
  }, [
    cfuPerMl,
    eventDate,
    eventType,
    isResult,
    openSampleObligations,
    ruleConfig,
    externalLegionella,
    legionellaResponsibility,
  ]);
  const projectedObligations = preview.impact ? preview.impact.generated : [];
  const visiblePrimaryEvents = primaryEvents.filter(
    ({ type }) =>
      ![
        "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
        "LEGIONELLA_RESULT_RECEIVED",
      ].includes(type) || legionellaResponsibility === "OUR_COMPANY",
  );
  const selectEvent = (value: string) => {
    if (
      value === "LEGIONELLA_RESULT_RECEIVED" &&
      !samplesAwaitingResults.length
    )
      return;
    setEventType(value);
    setEventSelected(true);
  };
  return (
    <div id="record-event" className="scroll-mt-6">
      <section className="panel p-5">
        <div>
          <div className="label">Quick event entry</div>
          <h2 className="mt-1 text-xl font-black">Record what happened</h2>
          <p className="mt-1 text-sm text-slate-600">
            TowerTrack will show the sample, inspection, and reporting
            obligations created by the event. Date-only values stay date-only.
          </p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {visiblePrimaryEvents.map(({ label, type: value }) => {
            const Icon = eventIcons[value as keyof typeof eventIcons];
            return (
              <button
                key={value}
                type="button"
                onClick={() => selectEvent(value)}
                disabled={
                  !ready ||
                  (value === "LEGIONELLA_RESULT_RECEIVED" &&
                    !samplesAwaitingResults.length)
                }
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-bold ${
                  !ready ||
                  (value === "LEGIONELLA_RESULT_RECEIVED" &&
                    !samplesAwaitingResults.length)
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                    : eventSelected && eventType === value
                      ? "border-emerald-800 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <Icon size={17} /> {label}
              </button>
            );
          })}
        </div>
        <details className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <summary
            className={buttonClass(
              "secondary",
              "w-full cursor-pointer text-sm",
            )}
          >
            More event types
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {moreEvents.map(({ label, type: value }) => {
              const Icon = eventIcons[value as keyof typeof eventIcons];
              return (
                <button
                  key={value}
                  type="button"
                  disabled={!ready}
                  onClick={() => selectEvent(value)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-bold ${
                    !ready
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      : eventSelected && eventType === value
                        ? "border-emerald-800 bg-emerald-50 text-emerald-900"
                        : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <Icon size={17} /> {label}
                </button>
              );
            })}
          </div>
          {canConfirmOwnerManaged && (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="label">Office confirmation</div>
              <p className="mt-1 text-sm text-slate-600">
                These obligations belong to the cooling-tower owner or an
                external provider and are not assigned to technicians.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {officeEvents.map(({ label, type: value }) => {
                  const Icon = eventIcons[value as keyof typeof eventIcons];
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={!ready}
                      onClick={() => selectEvent(value)}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-bold text-slate-700"
                    >
                      <Icon size={17} /> {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {canConfirmOwnerManaged && externalLegionella && (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="label">
                Record External Legionella Information
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {serviceResponsibilityLabel(legionellaResponsibility)}. These
                records are attributed externally, not to our technicians.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className={buttonClass("secondary")}
                  type="button"
                  onClick={() =>
                    selectEvent("ROUTINE_LEGIONELLA_SAMPLE_COLLECTED")
                  }
                >
                  Record external sample date
                </button>
                <button
                  className={buttonClass("secondary")}
                  type="button"
                  disabled={!samplesAwaitingResults.length}
                  onClick={() => selectEvent("LEGIONELLA_RESULT_RECEIVED")}
                >
                  Record external result
                </button>
              </div>
            </div>
          )}
        </details>
        {!samplesAwaitingResults.length && (
          <p className="mt-3 text-sm font-bold text-slate-600">
            Add a Legionella sample before adding a laboratory result. Every
            result must be linked to the sample that produced it.
          </p>
        )}
      </section>
      {eventSelected && (
        <form
          action={recordServiceEventAction}
          className="panel mt-4 grid gap-4 p-5 lg:grid-cols-4"
        >
          <div className="border-b border-slate-200 pb-4 lg:col-span-4">
            <div className="label">Event details</div>
            <h3 className="mt-1 text-xl font-black">
              Record {plainEnumLabel(eventType)}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Enter the verified field information and save. TowerTrack will
              validate and recalculate compliance automatically.
            </p>
          </div>
          <input type="hidden" name="systemId" value={systemId} />
          <input type="hidden" name="eventType" value={eventType} />
          <input
            type="hidden"
            name="performedByResponsibility"
            value={
              externalLegionella &&
              [
                "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
                "LEGIONELLA_RESULT_RECEIVED",
              ].includes(eventType)
                ? legionellaResponsibility!
                : "OUR_COMPANY"
            }
          />
          {externalLegionella &&
            [
              "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
              "LEGIONELLA_RESULT_RECEIVED",
            ].includes(eventType) && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 lg:col-span-4">
                <div className="font-black">Externally completed</div>
                <div className="mt-1 text-sm text-slate-600">
                  Performed by{" "}
                  {legionellaResponsibility === "CUSTOMER"
                    ? "customer"
                    : "another vendor"}
                  ; date supplied to our office.
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="label">Provider name (optional)</span>
                    <input
                      className="field mt-1"
                      name="externalProviderName"
                      defaultValue={legionellaVendorName ?? ""}
                    />
                  </label>
                  <label>
                    <span className="label">Source or document (optional)</span>
                    <input
                      className="field mt-1"
                      name="externalSource"
                      placeholder="Lab report, email, chain of custody"
                    />
                  </label>
                </div>
              </div>
            )}
          <label className={isHyper ? "lg:col-span-4 lg:max-w-sm" : ""}>
            <span className="label">
              {isHyper ? "Date Performed" : "Event date"}
            </span>
            <input
              className="field mt-1"
              name="eventDate"
              type="date"
              max={defaultDate}
              required
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
            />
          </label>
          {isHyper && (
            <p className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-950 lg:col-span-4">
              Record the date the summertime hyperhalogenation was completed.
              Treatment details are maintained on the separate service form.
            </p>
          )}
          {eventType === "BACTERIOLOGICAL_SAMPLE_COLLECTED" && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 lg:col-span-4">
              <div className="font-black">
                Owner-managed cooling-tower culture
              </div>
              <p className="mt-1">
                Confirm a documented heterotrophic bacterial culture performed
                by the owner or external provider. This is not potable-water
                testing and does not satisfy a Legionella culture obligation.
              </p>
            </div>
          )}
          {isEmergency && (
            <label>
              <span className="label">Emergency trigger</span>
              <select
                className="field mt-1"
                value={eventType}
                onChange={(event) => setEventType(event.target.value)}
              >
                {emergencyTypes.map(([label, value]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
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
                onChange={(event) => setCfuPerMl(event.target.value)}
              />
            </label>
          )}
          {eventType === "LEGIONELLA_RESULT_RECEIVED" && (
            <>
              <label>
                <span className="label">Sample tested</span>
                <select
                  className="field mt-1"
                  name="sampleEventId"
                  required
                  value={sampleEventId}
                  onChange={(event) => setSampleEventId(event.target.value)}
                >
                  {samplesAwaitingResults.map((sample) => (
                    <option key={sample.id} value={sample.id}>
                      Collected {formatOperationalDate(sample.date)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {eventType === "WEEKLY_BIOLOGICAL_INDICATOR_RESULT" && (
            <label className="lg:col-span-2">
              <span className="label">Residual outcome after 3 days</span>
              <select
                className="field mt-1"
                name="residualOutcome"
                defaultValue="UNKNOWN"
              >
                <option value="UNKNOWN">
                  Still monitoring / not yet known
                </option>
                <option value="RESTORED">Restored for at least 24 hours</option>
                <option value="NOT_RESTORED">Not restored within 3 days</option>
              </select>
            </label>
          )}
          {isRemediation && (
            <label>
              <span className="label">Response type</span>
              <select
                className="field mt-1"
                value={eventType}
                onChange={(event) => setEventType(event.target.value)}
              >
                <option value="HIGH_LEGIONELLA_DISINFECTION">
                  Corrective disinfection — adjust or change biocide
                </option>
                <option value="FULL_REMEDIATION">
                  Full remediation — drain, clean and flush
                </option>
              </select>
            </label>
          )}
          {isRemediation && (
            <div
              className={`rounded-xl border p-4 text-sm lg:col-span-3 ${
                eventType === "FULL_REMEDIATION"
                  ? "border-red-200 bg-red-50 text-red-950"
                  : "border-amber-200 bg-amber-50 text-amber-950"
              }`}
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 shrink-0" size={19} />
                {eventType === "FULL_REMEDIATION" ? (
                  <div>
                    <h3 className="font-black">
                      Full remediation — complete physical tower treatment
                    </h3>
                    <p className="mt-1">
                      Use when the tower was hyperhalogenated, drained,
                      physically cleaned, and flushed. This is the Level 4
                      response or may be required by a specific NYC DOH order.
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 font-bold">
                      <li>
                        Increase biocide within{" "}
                        {responseTimings?.correctiveActionHours} hours and
                        complete full remediation within{" "}
                        {responseTimings?.level4RemediationHours} hours.
                      </li>
                      <li>
                        Notify NYC DOH within{" "}
                        {responseTimings?.level4NotificationHours} hours for a
                        Level 4 result.
                      </li>
                      <li>
                        Collect the Legionella retest on day{" "}
                        {responseTimings?.retestMinimumDays}–
                        {responseTimings?.retestMaximumDays}.
                      </li>
                    </ul>
                  </div>
                ) : (
                  <div>
                    <h3 className="font-black">
                      Corrective disinfection — chemical treatment response
                    </h3>
                    <p className="mt-1">
                      Use when the response was to increase the biocide
                      concentration or change biocide. This is generally the
                      Level 2 or Level 3 response; Level 3 also requires
                      evaluating whether cleaning and further disinfection are
                      needed.
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 font-bold">
                      <li>
                        Complete the biocide response within{" "}
                        {responseTimings?.correctiveActionHours} hours.
                      </li>
                      <li>
                        Do not select this if the tower was also
                        hyperhalogenated, drained, physically cleaned, and
                        flushed.
                      </li>
                      <li>
                        Collect the Legionella retest on day{" "}
                        {responseTimings?.retestMinimumDays}–
                        {responseTimings?.retestMaximumDays}.
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
          {isCleaning && (
            <label>
              <span className="label">Cleaning type</span>
              <select
                className="field mt-1"
                value={eventType}
                onChange={(event) => setEventType(event.target.value)}
              >
                <option value="CLEANING_COMPLETED">Routine cleaning</option>
                <option value="STARTUP_CLEANING_DISINFECTION">
                  Startup cleaning and disinfection
                </option>
              </select>
            </label>
          )}
          {!isHyper && (
            <details className="rounded-lg border border-slate-200 p-3 lg:col-span-4">
              <summary className="cursor-pointer text-sm font-black text-emerald-800">
                Add notes (optional)
              </summary>
              <label className="mt-3 block">
                <span className="label">Notes</span>
                <input
                  className="field mt-1"
                  name="notes"
                  placeholder="Condition, source record, or field context"
                />
              </label>
            </details>
          )}
          {preview.error && (
            <p
              className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-950 lg:col-span-4"
              role="alert"
            >
              Preview unavailable: {preview.error}
            </p>
          )}
          <section
            className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950 lg:col-span-4"
            aria-live="polite"
          >
            <div className="label">Before saving</div>
            <h3 className="mt-1 font-black">Expected Compliance Impact</h3>
            <div className="mt-3">
              {preview.error ? (
                <p className="text-sm font-bold">
                  Correct the validation issue above before saving.
                </p>
              ) : !eventDate ? (
                <p className="text-sm font-bold">
                  Select an event date to preview the compliance impact.
                </p>
              ) : isResult && cfuPerMl === "" ? (
                <p className="text-sm font-bold">
                  Compliance impact cannot be calculated until the CFU/mL result
                  is entered.
                </p>
              ) : preview.impact ? (
                <div className="space-y-3">
                  {preview.impact.messages.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-sm font-bold">
                      {preview.impact.messages.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  )}
                  {projectedObligations.length > 0 && (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {projectedObligations.map((obligation) => (
                        <article
                          key={`${obligation.obligationType}-${obligation.latestDueDate}`}
                          className="rounded-lg border border-blue-200 bg-white p-3"
                        >
                          <div className="font-black">
                            Generates{" "}
                            {requirementLabel(obligation.obligationType)}
                          </div>
                          <p className="mt-1 text-sm text-slate-600">
                            {obligation.reason}
                          </p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <ComplianceWindow
                              start={
                                obligation.targetStartDate ??
                                obligation.earliestDueDate
                              }
                              end={
                                obligation.targetEndDate ??
                                obligation.latestDueDate
                              }
                            />
                            <ComplianceDate
                              value={obligation.latestDueDate}
                              label="Legal deadline"
                              deadline
                              empty={
                                obligation.priority === "EMERGENCY"
                                  ? "Immediate / follow MPP"
                                  : "No fixed deadline"
                              }
                            />
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm font-bold">
                  No new dated obligation is predicted from this event. Saving
                  it still updates the audit history and recalculates
                  compliance.
                </p>
              )}
              <p className="mt-3 text-xs font-bold text-blue-800">
                This is a preview from the tower&apos;s current rule profile.
                Final obligations are generated only after the event is saved.
              </p>
            </div>
          </section>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end lg:col-span-4">
            {onCancel && (
              <button
                className={buttonClass(
                  "secondary",
                  "min-h-11 w-full sm:w-auto",
                )}
                type="button"
                onClick={onCancel}
              >
                Cancel
              </button>
            )}
            <button
              className={buttonClass("primary", "min-h-11 w-full lg:w-auto")}
              type="submit"
              disabled={Boolean(preview.error)}
            >
              Save Event
            </button>
          </div>
        </form>
      )}
      {eventType === "STARTUP_CLEANING_DISINFECTION" ||
      eventType === "CLEANING_COMPLETED" ? (
        <p className="mt-3 text-sm font-bold text-slate-600">
          Cleaning is tracked as its own activity. It does not reset a sample
          clock and does not replace the startup date.
        </p>
      ) : null}
    </div>
  );
}
