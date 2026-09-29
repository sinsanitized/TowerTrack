import Link from "next/link";
import type { ServiceEventStatus, ServiceEventType } from "@prisma/client";
import { voidServiceEventAction } from "@/app/actions";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { dateOnly, formatDate } from "@/lib/date";
import { eventEntryHref } from "@/lib/event-entry-intent";
import { plainEnumLabel } from "@/lib/labels";
import {
  serviceResponsibilityLabel,
  type ServiceResponsibility,
} from "@/lib/service-responsibility";

type RecordSummary = {
  id: string;
  status: ServiceEventStatus;
  eventType: ServiceEventType;
  eventDate: Date;
  correctedFromEventId: string | null;
  performedByResponsibility: ServiceResponsibility;
  externalProviderName: string | null;
};

export function RecentTowerActivity({
  systemId,
  events,
}: {
  systemId: string;
  events: RecordSummary[];
}) {
  return (
    <section className="panel p-5 lg:col-span-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label">Latest completed records</div>
          <h2 className="mt-1 font-black">Recent activity</h2>
        </div>
        <Link className="btn" href={`/systems/${systemId}?view=history`}>
          View full history
        </Link>
      </div>
      <div className="mt-4 space-y-3">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/systems/${systemId}/events/${event.id}`}
            className="block border-b pb-3 text-sm last:border-0"
          >
            <div className="font-bold">{plainEnumLabel(event.eventType)}</div>
            <div className="text-slate-500">
              <time dateTime={dateOnly(event.eventDate)}>
                {formatDate(event.eventDate)}
              </time>{" "}
              · {plainEnumLabel(event.status)}
            </div>
          </Link>
        ))}
        {!events.length && (
          <p className="text-sm text-slate-500">No events recorded yet.</p>
        )}
      </div>
    </section>
  );
}

export function TowerComplianceRecords({
  systemId,
  events,
  mostRecentActiveEvent,
  samplesAwaitingResultIds,
}: {
  systemId: string;
  events: RecordSummary[];
  mostRecentActiveEvent?: RecordSummary;
  samplesAwaitingResultIds: Set<string>;
}) {
  return (
    <>
      <span id="compliance-history" className="block scroll-mt-6" />
      <section id="regulatory-events" className="panel mt-6 scroll-mt-6 p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="label">Audit history</div>
            <h2 className="mt-1 text-xl font-black">Compliance records</h2>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <p className="text-sm text-slate-500">
              Edits create a replacement; removals preserve the audit trail.
              Both recalculate every projection.
            </p>
            {mostRecentActiveEvent && (
              <details className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-left text-sm text-amber-950">
                <summary className="cursor-pointer font-black">
                  Mark {plainEnumLabel(mostRecentActiveEvent.eventType)} from{" "}
                  {formatDate(mostRecentActiveEvent.eventDate)} invalid
                </summary>
                <p className="mt-2 max-w-sm">
                  This voids {plainEnumLabel(mostRecentActiveEvent.eventType)}{" "}
                  from {formatDate(mostRecentActiveEvent.eventDate)} and
                  recalculates every dependent date. The audit record remains.
                </p>
                <form action={voidServiceEventAction} className="mt-3">
                  <input
                    type="hidden"
                    name="eventId"
                    value={mostRecentActiveEvent.id}
                  />
                  <input
                    type="hidden"
                    name="reason"
                    value="Void most recently recorded active compliance record"
                  />
                  <label className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-white p-3 font-bold">
                    <input
                      className="mt-1"
                      type="checkbox"
                      name="confirmVoid"
                      value="yes"
                      required
                    />
                    <span>
                      I understand this preserves the audit record and
                      recalculates dependent requirements and deadlines.
                    </span>
                  </label>
                  <SubmitButton
                    variant="destructive"
                    pendingLabel="Marking record invalid…"
                  >
                    Mark this record invalid
                  </SubmitButton>
                </form>
              </details>
            )}
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {events.length ? (
            events.map((event) => (
              <article
                key={event.id}
                className="group grid gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-emerald-700 hover:shadow-sm lg:grid-cols-[1fr_auto]"
              >
                <Link href={`/systems/${systemId}/events/${event.id}`}>
                  <StatusBadge
                    color={event.status === "ACTIVE" ? "GREEN" : "GRAY"}
                    label={plainEnumLabel(event.status)}
                  />
                  <div className="mt-2 font-black">
                    {plainEnumLabel(event.eventType)}
                  </div>
                  <div className="text-sm text-slate-500">
                    {formatDate(event.eventDate)}
                    {event.correctedFromEventId
                      ? " · corrected replacement"
                      : ""}
                  </div>
                  {event.performedByResponsibility !== "OUR_COMPANY" && (
                    <div className="mt-1 text-xs font-bold text-purple-800">
                      {serviceResponsibilityLabel(
                        event.performedByResponsibility,
                      )}
                      {event.externalProviderName
                        ? ` — ${event.externalProviderName}`
                        : ""}
                    </div>
                  )}
                </Link>
                <div className="flex flex-wrap items-center gap-2 self-center text-sm font-black text-emerald-800">
                  {samplesAwaitingResultIds.has(event.id) && (
                    <Link
                      className="btn"
                      href={eventEntryHref({
                        type: "result",
                        towerId: systemId,
                        sampleEventId: event.id,
                        returnTo: `/systems/${systemId}?view=history#regulatory-events`,
                      })}
                    >
                      Record lab result
                    </Link>
                  )}
                  <Link
                    className="group-hover:underline"
                    href={`/systems/${systemId}/events/${event.id}`}
                  >
                    {event.status === "ACTIVE"
                      ? "View or edit event →"
                      : "View audit record →"}
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-500">
              No regulatory events have been recorded yet.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
