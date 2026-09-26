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
import { serviceResponsibilityLabel } from "@/lib/service-responsibility";
import type { ServiceEventTypeValue } from "@/lib/service-events";
import {
  compileTowerRuleConfig,
  composeTowerRuleProfiles,
} from "@/lib/rule-profile";
import { eventEntryHref } from "@/lib/event-entry-intent";

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
          ruleAssignments: {
            include: { ruleProfile: { include: { rules: true } } },
            orderBy: { effectiveStartDate: "desc" },
          },
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
  const eventDate = dateOnly(event.eventDate);
  const assignment = system.ruleAssignments.find(
    (item) =>
      dateOnly(item.effectiveStartDate) <= eventDate &&
      (!item.effectiveEndDate || dateOnly(item.effectiveEndDate) >= eventDate),
  );
  const availableBaseProfiles = await db.ruleProfile.findMany({
    where: {
      jurisdictionMode: {
        in: ["NYC_CHAPTER_8_2026_PLUS_NYS_PART_4", "NYS_PART_4_ONLY"],
      },
      OR: [
        { effectiveStartDate: null },
        { effectiveStartDate: { lte: event.eventDate } },
      ],
      AND: [
        {
          OR: [
            { effectiveEndDate: null },
            { effectiveEndDate: { gte: event.eventDate } },
          ],
        },
      ],
    },
    include: { rules: true },
  });
  const assignedProfile = assignment?.ruleProfile ?? system.ruleProfile;
  const configuration = assignment?.configuration ?? system.ruleConfiguration;
  const composedProfile = composeTowerRuleProfiles(
    configuration,
    configuration === "CUSTOM" ? [assignedProfile] : availableBaseProfiles,
    assignedProfile.id,
  );
  const ruleConfig = compileTowerRuleConfig(composedProfile, {
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
  const historicalTreatmentDetails = [
    ["Chemical", textDetail(details, "chemical")],
    ["Quantity", textDetail(details, "quantity")],
    ["Contact time", textDetail(details, "contactTime")],
    ["pH", textDetail(details, "ph")],
    ["Free halogen residual", textDetail(details, "freeHalogenResidual")],
    ["Technician", textDetail(details, "technician")],
  ].filter(([, value]) => value);

  return (
    <>
      <PageHeader
        eyebrow={`${system.building.customer.name} · Compliance record`}
        title={plainEnumLabel(event.eventType)}
        description={`${system.building.buildingName} — ${system.systemName} · ${formatDate(event.eventDate)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {sampleAwaitingResult && (
              <Link
                className="btn"
                href={eventEntryHref({
                  type: "result",
                  towerId: id,
                  sampleEventId: event.id,
                  returnTo: `/systems/${id}/events/${event.id}`,
                })}
              >
                Record lab result for this sample
              </Link>
            )}
            <Link className="btn" href={`/systems/${id}#regulatory-events`}>
              Back to compliance records
            </Link>
          </div>
        }
      />
      {event.performedByResponsibility !== "OUR_COMPANY" && (
        <section className="panel mb-5 p-4">
          <div className="label">Work attribution</div>
          <div className="mt-1 font-black text-purple-900">
            {serviceResponsibilityLabel(event.performedByResponsibility)}
            {event.externalProviderName
              ? ` — ${event.externalProviderName}`
              : ""}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            This information was supplied externally and is not recorded as work
            performed by our company.
          </p>
          {event.externalSource && (
            <p className="mt-2 text-sm">Source: {event.externalSource}</p>
          )}
        </section>
      )}
      <section className="panel mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <StatusBadge
              color={event.status === "ACTIVE" ? "GREEN" : "GRAY"}
              label={plainEnumLabel(event.status)}
            />
            <p className="mt-3 text-sm text-slate-600">
              Recorded {formatDate(event.createdAt)} · {generatedCount}{" "}
              generated requirement{generatedCount === 1 ? "" : "s"}
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
      {event.eventType === "SUMMERTIME_HYPERHALOGENATION" &&
        historicalTreatmentDetails.length > 0 && (
          <section className="panel mb-6 p-5">
            <div className="label">Historical service-form details</div>
            <p className="mt-2 text-sm text-slate-600">
              Preserved from the original TowerTrack record. New entries require
              only the date performed.
            </p>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              {historicalTreatmentDetails.map(([label, value]) => (
                <div key={label}>
                  <dt className="label">{label}</dt>
                  <dd className="font-bold">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
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
              ? "Only an administrator or operations manager can correct this record."
              : "This historical version cannot be edited. Open its active replacement when available."}
          </p>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="label">Record type</dt>
              <dd className="font-black">{plainEnumLabel(event.eventType)}</dd>
            </div>
            <div>
              <dt className="label">Record date</dt>
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
