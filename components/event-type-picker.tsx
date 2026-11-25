"use client";

import {
  AlertTriangle,
  Beaker,
  BrushCleaning,
  ClipboardCheck,
  Droplets,
  FlaskConical,
  Play,
  Power,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { buttonClass } from "@/lib/button-variants";
import { eventDefinitionsForLocation } from "@/lib/event-workflow";
import {
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

function EventChoice({
  label,
  value,
  disabled,
  selected,
  autofocus,
  compact = false,
  onSelect,
}: {
  label: string;
  value: string;
  disabled: boolean;
  selected: boolean;
  autofocus?: boolean;
  compact?: boolean;
  onSelect: (value: string) => void;
}) {
  const Icon = eventIcons[value as keyof typeof eventIcons];
  return (
    <button
      type="button"
      data-recorder-autofocus={autofocus ? "true" : undefined}
      onClick={() => onSelect(value)}
      disabled={disabled}
      className={`flex items-center gap-3 rounded-xl border-2 px-4 text-left text-sm font-bold ${
        compact ? "min-h-12 py-2" : "min-h-14 py-3"
      } ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
          : selected
            ? "border-emerald-800 bg-emerald-50 text-emerald-900"
            : "border-slate-200 bg-white text-slate-700"
      }`}
    >
      <Icon size={17} /> {label}
    </button>
  );
}

export function EventTypePicker({
  ready,
  eventType,
  hasPendingResults,
  canConfirmOwnerManaged,
  externalLegionella,
  legionellaResponsibility,
  bacteriologicalResponsibility,
  onSelect,
}: {
  ready: boolean;
  eventType: string;
  hasPendingResults: boolean;
  canConfirmOwnerManaged: boolean;
  externalLegionella: boolean;
  legionellaResponsibility: ServiceResponsibility | null;
  bacteriologicalResponsibility: ServiceResponsibility | null;
  onSelect: (value: string) => void;
}) {
  const visiblePrimaryEvents = primaryEvents.filter(
    ({ type }) =>
      ![
        "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
        "LEGIONELLA_RESULT_RECEIVED",
      ].includes(type) || legionellaResponsibility === "OUR_COMPANY",
  );
  const isDisabled = (value: string) =>
    !ready || (value === "LEGIONELLA_RESULT_RECEIVED" && !hasPendingResults);

  return (
    <section className="panel p-5 sm:p-6">
      <div>
        <div className="label">Step 1 of 2 · Choose completed work</div>
        <h2 className="mt-1 text-xl font-black">What happened?</h2>
        <p className="mt-1 text-sm text-slate-600">
          Choose the familiar field or office task below. TowerTrack will select
          the correct compliance record and calculate what comes next.
        </p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {visiblePrimaryEvents.map(({ label, type: value }, index) => (
          <EventChoice
            key={value}
            label={label}
            value={value}
            disabled={isDisabled(value)}
            selected={eventType === value}
            autofocus={index === 0}
            onSelect={onSelect}
          />
        ))}
      </div>
      <details className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
        <summary
          className={buttonClass(
            "ghost",
            "w-full cursor-pointer justify-start text-sm",
          )}
        >
          Less common completed work
        </summary>
        <p className="mt-2 text-sm text-slate-600">
          Emergency, shutdown, treatment, and other occasional records.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {moreEvents.map(({ label, type: value }) => (
            <EventChoice
              key={value}
              label={label}
              value={value}
              disabled={!ready}
              selected={eventType === value}
              compact
              onSelect={onSelect}
            />
          ))}
        </div>
        {canConfirmOwnerManaged && (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="label">Office confirmation</div>
            <p className="mt-1 text-sm text-slate-600">
              These obligations belong to the cooling-tower owner or an external
              provider and are not assigned to technicians.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {officeEvents
                .filter(
                  ({ type }) =>
                    type !== "BACTERIOLOGICAL_SAMPLE_COLLECTED" ||
                    bacteriologicalResponsibility !== "CUSTOMER",
                )
                .map(({ label, type: value }) => (
                  <EventChoice
                    key={value}
                    label={label}
                    value={value}
                    disabled={!ready}
                    selected={eventType === value}
                    compact
                    onSelect={onSelect}
                  />
                ))}
            </div>
          </div>
        )}
        {canConfirmOwnerManaged && externalLegionella && (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="label">Record External Legionella Information</div>
            <p className="mt-1 text-sm text-slate-600">
              {serviceResponsibilityLabel(legionellaResponsibility)}. These
              records are attributed externally, not to our technicians.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className={buttonClass("secondary")}
                type="button"
                onClick={() => onSelect("ROUTINE_LEGIONELLA_SAMPLE_COLLECTED")}
              >
                Record external sample date
              </button>
              <button
                className={buttonClass("secondary")}
                type="button"
                disabled={!hasPendingResults}
                onClick={() => onSelect("LEGIONELLA_RESULT_RECEIVED")}
              >
                Record external result
              </button>
            </div>
          </div>
        )}
      </details>
      {!hasPendingResults && (
        <p className="mt-3 text-sm font-bold text-slate-600">
          Add a Legionella sample before adding a laboratory result. Every
          result must be linked to the sample that produced it.
        </p>
      )}
    </section>
  );
}
