import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { EventEditor } from "@/components/event-editor";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  dateOnly,
  dateTimeLocalValue,
  formatDate,
  todayDateOnly,
} from "@/lib/date";
import { plainEnumLabel } from "@/lib/labels";
import type { ServiceEventTypeValue } from "@/lib/service-events";
import { compileTowerRuleConfig } from "@/lib/rule-profile";

function textDetail(details: Record<string, unknown>, key: string) {
  const value = details[key];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string; eventId: string }>;
}) {
  const { id, eventId } = await params;
  const user = await requireUser();
  const event = await db.serviceEvent.findFirst({
    where: {
      id: eventId,
      coolingTowerSystemId: id,
      coolingTowerSystem: {
        building: { customer: { organizationId: user.organizationId } },
      },
    },
    include: {
      coolingTowerSystem: {
        include: {
          building: { include: { customer: true } },
          ruleProfile: { include: { rules: true } },
          serviceEvents: {
            where: {
              status: "ACTIVE",
              eventType: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
            },
            orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
            select: { id: true, eventDate: true },
          },
          labResults: {
            select: { sourceEventId: true, sampleEventId: true },
          },
        },
      },
      triggeredSampleObligations: true,
      triggeredInspectionObligations: true,
      triggeredReportingObligations: true,
      triggeredMaintenanceObligations: true,
    },
  });
  if (!event) notFound();
  const replacement = await db.serviceEvent.findFirst({
    where: { correctedFromEventId: event.id },
    select: { id: true },
  });
  const system = event.coolingTowerSystem;
  const details =
    event.details &&
    typeof event.details === "object" &&
    !Array.isArray(event.details)
      ? (event.details as Record<string, unknown>)
      : {};
  const ruleConfig = compileTowerRuleConfig(system.ruleProfile, {
    operating: !["FULLY_SHUT_DOWN", "SEASONALLY_INACTIVE"].includes(
      system.operatingStatus,
    ),
    monthlyTargetStartDay: system.monthlyTargetStartDay,
    monthlyTargetEndDay: system.monthlyTargetEndDay,
  });
  const canEdit =
    event.status === "ACTIVE" &&
    ["ADMIN", "OPERATIONS_MANAGER"].includes(user.role);
  const currentSampleEventId = textDetail(details, "sampleEventId");
  const samplesUsedByOtherResults = new Set(
    system.labResults
      .filter((result) => result.sourceEventId !== event.id)
      .map((result) => result.sampleEventId),
  );
  const availableSamples = system.serviceEvents
    .filter(
      (sample) =>
        sample.id === currentSampleEventId ||
        !samplesUsedByOtherResults.has(sample.id),
    )
    .map((sample) => ({ id: sample.id, date: dateOnly(sample.eventDate) }));
  const sampleAwaitingResult =
    event.status === "ACTIVE" &&
    event.eventType === "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED" &&
    !system.labResults.some((result) => result.sampleEventId === event.id);
  const generatedCount =
    event.triggeredSampleObligations.length +
    event.triggeredInspectionObligations.length +
    event.triggeredReportingObligations.length +
    event.triggeredMaintenanceObligations.length;

  return (
    <>
      <PageHeader
        eyebrow={`${system.building.customer.name} · Event record`}
        title={plainEnumLabel(event.eventType)}
        description={`${system.building.buildingName} — ${system.systemName} · ${formatDate(event.eventDate)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {sampleAwaitingResult && (
              <Link
                className="btn"
                href={`/systems/${id}?labSample=${event.id}#record-event`}
              >
                Record lab result for this sample
              </Link>
            )}
            <Link className="btn" href={`/systems/${id}#regulatory-events`}>
              Back to tower events
            </Link>
          </div>
        }
      />
      <section className="panel mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <StatusBadge
              color={event.status === "ACTIVE" ? "GREEN" : "GRAY"}
              label={plainEnumLabel(event.status)}
            />
            <p className="mt-3 text-sm text-slate-600">
              Recorded {formatDate(event.createdAt)} · {generatedCount}{" "}
              generated obligation{generatedCount === 1 ? "" : "s"}
            </p>
          </div>
          {replacement && (
            <Link
              className="btn"
              href={`/systems/${id}/events/${replacement.id}`}
            >
              Open corrected replacement
            </Link>
          )}
        </div>
      </section>
      {canEdit ? (
        <EventEditor
          systemId={id}
          currentDate={todayDateOnly()}
          event={{
            id: event.id,
            eventType: event.eventType as ServiceEventTypeValue,
            eventDate: dateOnly(event.eventDate),
            eventTimestamp: event.eventTimestamp
              ? dateTimeLocalValue(event.eventTimestamp)
              : "",
            notes: event.notes ?? "",
            cfuPerMl: textDetail(details, "cfuPerMl"),
            residualOutcome:
              details.residualRestoredWithin3Days === true
                ? "RESTORED"
                : details.residualRestoredWithin3Days === false
                  ? "NOT_RESTORED"
                  : "UNKNOWN",
            reportType: textDetail(details, "reportType"),
            reportingObligationId: textDetail(details, "reportingObligationId"),
            sampleEventId: currentSampleEventId,
            chemical: textDetail(details, "chemical"),
            quantity: textDetail(details, "quantity"),
            contactTime: textDetail(details, "contactTime"),
            ph: textDetail(details, "ph"),
            freeHalogenResidual: textDetail(details, "freeHalogenResidual"),
            technician: textDetail(details, "technician"),
          }}
          ruleConfig={ruleConfig}
          availableSamples={availableSamples}
        />
      ) : (
        <section className="panel p-6">
          <h2 className="text-xl font-black">Audit record</h2>
          <p className="mt-2 text-sm text-slate-600">
            {event.status === "ACTIVE"
              ? "Only an administrator or operations manager can correct this event."
              : "This historical version cannot be edited. Open its active replacement when available."}
          </p>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="label">Event type</dt>
              <dd className="font-black">{plainEnumLabel(event.eventType)}</dd>
            </div>
            <div>
              <dt className="label">Event date</dt>
              <dd className="font-black">{formatDate(event.eventDate)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="label">Notes</dt>
              <dd>{event.notes || "No notes recorded"}</dd>
            </div>
          </dl>
        </section>
      )}
    </>
  );
}
