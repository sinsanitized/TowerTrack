"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ObligationStatus, type Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  completedEventsConflictOnSameDate,
  isAnnualCleaningActivity,
} from "@/lib/activity-compatibility";
import { asUtc, dateOnly } from "@/lib/date";
import { db } from "@/lib/db";
import {
  lockSystemCompliance,
  rebuildSystemComplianceProjections,
} from "@/lib/obligation-projections";
import {
  parseServiceEventCommand,
  serviceEventInputFromFormData,
} from "@/lib/service-event-command";
import { serviceResponsibilityValues } from "@/lib/service-responsibility";
import { safeReturnPath, withWorkflowNotice } from "@/lib/workflow-context";

function eventDetailsObject(details: unknown): Record<string, unknown> {
  return details && typeof details === "object" && !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : {};
}

function linkedVisitActivityId(details: unknown) {
  const value = eventDetailsObject(details).visitActivityId;
  return typeof value === "string" ? value : null;
}

async function assertNoCleaningHyperConflict(
  tx: Prisma.TransactionClient,
  input: {
    systemId: string;
    eventType: string;
    eventDate: string;
    excludeEventId?: string;
  },
) {
  if (
    ![
      "CLEANING_COMPLETED",
      "STARTUP_CLEANING_DISINFECTION",
      "SUMMERTIME_HYPERHALOGENATION",
    ].includes(input.eventType)
  )
    return;
  const sameDateEvents = await tx.serviceEvent.findMany({
    where: {
      coolingTowerSystemId: input.systemId,
      status: "ACTIVE",
      eventDate: asUtc(input.eventDate),
      ...(input.excludeEventId ? { id: { not: input.excludeEventId } } : {}),
      eventType: {
        in: [
          "CLEANING_COMPLETED",
          "STARTUP_CLEANING_DISINFECTION",
          "SUMMERTIME_HYPERHALOGENATION",
        ],
      },
    },
    select: { eventType: true },
  });
  if (
    sameDateEvents.some((event) =>
      completedEventsConflictOnSameDate(input.eventType, event.eventType),
    )
  )
    throw new Error(
      "Annual cleaning and summertime hyperhalogenation cannot be recorded on the same date.",
    );

  const plannedActivities = await tx.visitActivity.findMany({
    where: {
      coolingTowerSystemId: input.systemId,
      status: "PLANNED",
      visit: { status: { in: ["PLANNED", "CONFIRMED", "IN_PROGRESS"] } },
      activityType: {
        in: ["ROUTINE_CLEANING", "SUMMERTIME_HYPERHALOGENATION"],
      },
    },
    select: { activityType: true, scheduledDate: true, details: true },
  });
  const plannedConflict = plannedActivities.some((activity) => {
    const details = eventDetailsObject(activity.details);
    const chemicalAddDate =
      typeof details.chemicalAddDate === "string"
        ? details.chemicalAddDate
        : null;
    const sharesDate =
      dateOnly(activity.scheduledDate) === input.eventDate ||
      chemicalAddDate === input.eventDate;
    if (!sharesDate) return false;
    const plannedEventType = isAnnualCleaningActivity(activity.activityType)
      ? "CLEANING_COMPLETED"
      : "SUMMERTIME_HYPERHALOGENATION";
    return completedEventsConflictOnSameDate(input.eventType, plannedEventType);
  });
  if (plannedConflict)
    throw new Error(
      "That date conflicts with an active cleaning or summertime hyperhalogenation plan.",
    );
}

async function assertValidLabResultSample(
  tx: Prisma.TransactionClient,
  input: {
    systemId: string;
    eventType: string;
    eventDate: string;
    sampleEventId: string | null;
    excludeResultEventId?: string;
  },
) {
  if (input.eventType !== "LEGIONELLA_RESULT_RECEIVED") return;
  if (!input.sampleEventId)
    throw new Error("Choose the recorded sample that produced this result.");
  const sample = await tx.serviceEvent.findFirst({
    where: {
      id: input.sampleEventId,
      coolingTowerSystemId: input.systemId,
      eventType: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
      status: "ACTIVE",
    },
    select: { id: true, eventDate: true },
  });
  if (!sample)
    throw new Error(
      "The selected sample is not an active sample for this tower.",
    );
  if (dateOnly(sample.eventDate) > input.eventDate)
    throw new Error(
      "A laboratory result cannot be received before its sample was collected.",
    );
  const activeResults = await tx.serviceEvent.findMany({
    where: {
      coolingTowerSystemId: input.systemId,
      eventType: "LEGIONELLA_RESULT_RECEIVED",
      status: "ACTIVE",
      ...(input.excludeResultEventId
        ? { id: { not: input.excludeResultEventId } }
        : {}),
    },
    select: { details: true },
  });
  if (
    activeResults.some(
      (result) =>
        eventDetailsObject(result.details).sampleEventId ===
        input.sampleEventId,
    )
  )
    throw new Error("That sample already has an active laboratory result.");
}

export async function recordServiceEventAction(formData: FormData) {
  const user = await requireRole([
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.SCHEDULER,
    UserRole.TECHNICIAN,
  ]);
  const systemId = z.string().min(1).parse(formData.get("systemId"));
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const command = parseServiceEventCommand(
    serviceEventInputFromFormData(formData),
  );
  if (
    command.eventType === "BACTERIOLOGICAL_SAMPLE_COLLECTED" &&
    user.role !== UserRole.ADMIN &&
    user.role !== UserRole.OPERATIONS_MANAGER
  )
    throw new Error(
      "Routine bacteriological sampling is owner managed and may only be confirmed by an authorized office user.",
    );
  const eventSystem = await db.coolingTowerSystem.findFirstOrThrow({
    where: {
      id: systemId,
      building: { customer: { organizationId: user.organizationId } },
    },
    select: {
      legionellaResponsibility: true,
      bacteriologicalResponsibility: true,
      legionellaVendorName: true,
    },
  });
  if (
    ([
      "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
      "LEGIONELLA_RESULT_RECEIVED",
    ].includes(command.eventType) &&
      eventSystem.legionellaResponsibility === "CUSTOMER") ||
    (command.eventType === "BACTERIOLOGICAL_SAMPLE_COLLECTED" &&
      eventSystem.bacteriologicalResponsibility === "CUSTOMER")
  )
    throw new Error("Customer-managed sampling is not recorded in TowerTrack.");
  const isLegionellaEvent = [
    "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
    "LEGIONELLA_RESULT_RECEIVED",
  ].includes(command.eventType);
  if (
    isLegionellaEvent &&
    eventSystem.legionellaResponsibility === "NOT_TRACKED"
  )
    throw new Error("Legionella is not tracked in TowerTrack for this tower.");
  if (
    isLegionellaEvent &&
    eventSystem.legionellaResponsibility !== "OUR_COMPANY" &&
    user.role !== UserRole.ADMIN &&
    user.role !== UserRole.OPERATIONS_MANAGER
  )
    throw new Error(
      "External Legionella information may only be recorded by an authorized office user.",
    );
  const performedBy = command.details.performedByResponsibility;
  if (
    isLegionellaEvent &&
    eventSystem.legionellaResponsibility !== "OUR_COMPANY"
  ) {
    if (performedBy !== eventSystem.legionellaResponsibility)
      throw new Error(
        "The person or company performing the work must match this tower's Legionella responsibility.",
      );
  } else if (performedBy !== "OUR_COMPANY") {
    throw new Error(
      "External attribution is only available for externally managed Legionella work.",
    );
  }
  const result = await db.$transaction(
    async (tx) => {
      await lockSystemCompliance(tx, systemId);
      let persistedDetails = { ...command.details } as Record<string, unknown>;
      await assertNoCleaningHyperConflict(tx, {
        systemId,
        eventType: command.eventType,
        eventDate: command.eventDate,
      });
      await assertValidLabResultSample(tx, {
        systemId,
        eventType: command.eventType,
        eventDate: command.eventDate,
        sampleEventId: command.details.sampleEventId,
      });
      if (command.details.obligationId) {
        const obligationWhere = {
          id: command.details.obligationId,
          coolingTowerSystemId: systemId,
          status: {
            in: [
              ObligationStatus.PENDING,
              ObligationStatus.SCHEDULED,
              ObligationStatus.OVERDUE,
              ObligationStatus.MISSED,
            ],
          },
        };
        const [sample, inspection, maintenance, reporting] = await Promise.all([
          tx.sampleObligation.findFirst({
            where: obligationWhere,
            select: { id: true, triggerEventId: true },
          }),
          tx.inspectionObligation.findFirst({
            where: obligationWhere,
            select: { id: true, triggerEventId: true },
          }),
          tx.maintenanceObligation.findFirst({
            where: obligationWhere,
            select: { id: true, triggerEventId: true },
          }),
          tx.reportingObligation.findFirst({
            where: obligationWhere,
            select: {
              id: true,
              triggerEventId: true,
              obligationType: true,
            },
          }),
        ]);
        const selected = sample ?? inspection ?? maintenance ?? reporting;
        if (!selected)
          throw new Error(
            "The selected requirement is no longer open for this tower.",
          );
        if (
          command.details.triggeringEventId &&
          command.details.triggeringEventId !== selected.triggerEventId
        )
          throw new Error(
            "The selected requirement no longer matches its triggering record.",
          );
        if (
          (sample &&
            ![
              "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
              "BACTERIOLOGICAL_SAMPLE_COLLECTED",
            ].includes(command.eventType)) ||
          (inspection &&
            command.eventType !== "QUARTERLY_INSPECTION_COMPLETED") ||
          (maintenance &&
            ![
              "CLEANING_COMPLETED",
              "STARTUP_CLEANING_DISINFECTION",
              "SUMMERTIME_HYPERHALOGENATION",
            ].includes(command.eventType)) ||
          (reporting &&
            !(
              (reporting.obligationType.includes("CORRECTIVE_ACTION") &&
                command.eventType === "HIGH_LEGIONELLA_DISINFECTION") ||
              (reporting.obligationType === "LEVEL_4_FULL_REMEDIATION" &&
                command.eventType === "FULL_REMEDIATION") ||
              (reporting.obligationType ===
                "BIOLOGICAL_INDICATOR_RESIDUAL_MONITORING" &&
                command.eventType === "WEEKLY_BIOLOGICAL_INDICATOR_RESULT") ||
              command.eventType === "REPORT_SUBMITTED"
            ))
        )
          throw new Error(
            "The selected requirement does not match this compliance record type.",
          );
      }
      if (command.eventType === "REPORT_SUBMITTED") {
        const reportType = command.details.reportType as string;
        const reportingObligationId = command.details.reportingObligationId;
        if (!reportingObligationId)
          throw new Error("Choose the exact reporting requirement submitted.");
        const matchingObligation = await tx.reportingObligation.findFirst({
          where: {
            id: reportingObligationId,
            coolingTowerSystemId: systemId,
            obligationType: reportType,
            status: { in: ["PENDING", "SCHEDULED", "OVERDUE", "MISSED"] },
            OR: [
              { earliestDueDate: null },
              { earliestDueDate: { lte: asUtc(command.eventDate) } },
            ],
          },
          select: {
            id: true,
            triggerEventId: true,
            latestDueDate: true,
            triggerEvent: { select: { eventType: true, eventDate: true } },
          },
        });
        if (!matchingObligation)
          throw new Error(
            "That reporting requirement is not available for this tower.",
          );
        if (
          command.details.triggeringEventId &&
          command.details.triggeringEventId !==
            matchingObligation.triggerEventId
        )
          throw new Error(
            "That reporting requirement no longer matches its sample or triggering record.",
          );
        if (
          reportType === "PORTAL_SAMPLE_DATE" &&
          matchingObligation.triggerEvent.eventType !==
            "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED"
        )
          throw new Error(
            "NYC portal submissions must be linked to the exact Legionella sample being reported.",
          );
        persistedDetails = {
          ...persistedDetails,
          triggeringEventId: matchingObligation.triggerEventId,
          ...(reportType === "NYS_ANNUAL_CERTIFICATION" &&
          matchingObligation.latestDueDate
            ? {
                certificationYear: Number(
                  dateOnly(matchingObligation.latestDueDate).slice(0, 4),
                ),
              }
            : {}),
        };
      }
      const event = await tx.serviceEvent.create({
        data: {
          coolingTowerSystemId: systemId,
          eventType: command.eventType,
          eventDate: asUtc(command.eventDate),
          eventTimestamp: command.eventTimestamp,
          details: persistedDetails as Prisma.InputJsonObject,
          notes: command.notes,
          performedByResponsibility: performedBy,
          externalProviderName:
            command.details.externalProviderName ||
            eventSystem.legionellaVendorName,
          externalSource: command.details.externalSource,
          recordedById: user.id,
        },
      });
      const projection = await rebuildSystemComplianceProjections(tx, systemId);
      const satisfiedObligations = await tx.sampleObligation.findMany({
        where: {
          coolingTowerSystemId: systemId,
          status: "COMPLETED",
          OR: [{ completedByEventId: event.id }, { triggerEventId: event.id }],
        },
        select: { id: true, obligationType: true },
      });
      await tx.auditLog.create({
        data: {
          entityType: "ServiceEvent",
          entityId: event.id,
          action: "CREATED",
          reason: `Recorded ${command.eventType.replaceAll("_", " ").toLowerCase()}`,
          changedById: user.id,
          newValue: {
            systemId,
            eventType: command.eventType,
            eventDate: command.eventDate,
            details: persistedDetails as Prisma.InputJsonObject,
            satisfiedObligationIds: satisfiedObligations.map((item) => item.id),
            generated: projection,
          },
        },
      });
      return { event, projection, satisfiedObligations };
    },
    { timeout: 15_000 },
  );
  revalidatePath("/");
  revalidatePath(`/systems/${systemId}`);
  if (returnTo)
    redirect(
      withWorkflowNotice(
        returnTo,
        "Compliance record saved. Requirements and deadlines were recalculated.",
      ),
    );
  redirect(
    `/systems/${systemId}?event=${result.event.id}&sample=${result.projection.sampleCount}&inspection=${result.projection.inspectionCount}&maintenance=${result.projection.maintenanceCount}&reporting=${result.projection.reportingCount}&satisfied=${encodeURIComponent(result.satisfiedObligations.map((item) => item.obligationType).join(","))}`,
  );
}

export async function updateServiceResponsibilityAction(formData: FormData) {
  const user = await requireRole([UserRole.ADMIN, UserRole.OPERATIONS_MANAGER]);
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const parsed = z
    .object({
      systemId: z.string().min(1),
      legionellaResponsibility: z.enum(serviceResponsibilityValues),
      laboratoryResultResponsibility: z.enum(serviceResponsibilityValues),
      bacteriologicalResponsibility: z.enum(serviceResponsibilityValues),
      inspectionResponsibility: z.enum(serviceResponsibilityValues),
      cleaningResponsibility: z.enum(serviceResponsibilityValues),
      waterTreatmentResponsibility: z.enum(serviceResponsibilityValues),
      regulatoryReportingResponsibility: z.enum(serviceResponsibilityValues),
      certificationResponsibility: z.enum(serviceResponsibilityValues),
      legionellaVendorName: z.string().trim().max(200).optional(),
      reason: z.string().trim().min(8).max(2000),
    })
    .parse(Object.fromEntries(formData));
  if (
    parsed.legionellaResponsibility === "OTHER_VENDOR" &&
    !parsed.legionellaVendorName
  )
    throw new Error("Enter the Legionella vendor name.");
  const existing = await db.coolingTowerSystem.findFirstOrThrow({
    where: {
      id: parsed.systemId,
      building: { customer: { organizationId: user.organizationId } },
    },
    select: {
      legionellaResponsibility: true,
      laboratoryResultResponsibility: true,
      bacteriologicalResponsibility: true,
      inspectionResponsibility: true,
      cleaningResponsibility: true,
      waterTreatmentResponsibility: true,
      regulatoryReportingResponsibility: true,
      certificationResponsibility: true,
      legionellaVendorName: true,
    },
  });
  await db.$transaction(async (tx) => {
    await tx.coolingTowerSystem.update({
      where: { id: parsed.systemId },
      data: {
        legionellaResponsibility: parsed.legionellaResponsibility,
        laboratoryResultResponsibility: parsed.laboratoryResultResponsibility,
        bacteriologicalResponsibility: parsed.bacteriologicalResponsibility,
        inspectionResponsibility: parsed.inspectionResponsibility,
        cleaningResponsibility: parsed.cleaningResponsibility,
        waterTreatmentResponsibility: parsed.waterTreatmentResponsibility,
        regulatoryReportingResponsibility:
          parsed.regulatoryReportingResponsibility,
        certificationResponsibility: parsed.certificationResponsibility,
        legionellaVendorName:
          parsed.legionellaResponsibility === "OTHER_VENDOR"
            ? parsed.legionellaVendorName
            : null,
      },
    });
    await tx.reviewItem.updateMany({
      where: {
        entityType: "CoolingTowerSystem",
        entityId: parsed.systemId,
        title: { contains: "responsibility must be confirmed" },
        status: "OPEN",
      },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        entityType: "CoolingTowerSystem",
        entityId: parsed.systemId,
        action: "SERVICE_RESPONSIBILITY_UPDATED",
        reason: parsed.reason,
        changedById: user.id,
        previousValue: existing,
        newValue: parsed,
      },
    });
  });
  revalidatePath("/");
  revalidatePath("/deadlines");
  revalidatePath(`/systems/${parsed.systemId}`);
  if (returnTo)
    redirect(
      withWorkflowNotice(
        returnTo,
        "Service responsibilities saved. Work queues were updated.",
      ),
    );
  redirect(`/systems/${parsed.systemId}?view=settings&responsibility=1`);
}

export async function correctServiceEventAction(formData: FormData) {
  const user = await requireRole([UserRole.ADMIN, UserRole.OPERATIONS_MANAGER]);
  const identifiers = z
    .object({
      eventId: z.string().min(1),
      reason: z.string().trim().min(8).max(2000),
    })
    .parse({
      eventId: String(formData.get("eventId") || ""),
      reason: String(formData.get("reason") || ""),
    });
  const command = parseServiceEventCommand(
    serviceEventInputFromFormData(formData),
  );
  const existing = await db.serviceEvent.findFirstOrThrow({
    where: {
      id: identifiers.eventId,
      status: "ACTIVE",
      coolingTowerSystem: {
        building: { customer: { organizationId: user.organizationId } },
      },
    },
  });
  const submittedDetails = Object.fromEntries(
    Object.entries(command.details).filter(([, value]) => value != null),
  );
  const details = {
    ...eventDetailsObject(existing.details),
    ...submittedDetails,
  } as Prisma.InputJsonObject;
  const replacement = await db.$transaction(async (tx) => {
    await lockSystemCompliance(tx, existing.coolingTowerSystemId);
    await assertNoCleaningHyperConflict(tx, {
      systemId: existing.coolingTowerSystemId,
      eventType: command.eventType,
      eventDate: command.eventDate,
      excludeEventId: existing.id,
    });
    await assertValidLabResultSample(tx, {
      systemId: existing.coolingTowerSystemId,
      eventType: command.eventType,
      eventDate: command.eventDate,
      sampleEventId: command.details.sampleEventId,
      excludeResultEventId: existing.id,
    });
    const linkedResults =
      existing.eventType === "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED"
        ? await tx.serviceEvent.findMany({
            where: {
              coolingTowerSystemId: existing.coolingTowerSystemId,
              eventType: "LEGIONELLA_RESULT_RECEIVED",
              status: "ACTIVE",
            },
            select: { id: true, eventDate: true, details: true },
          })
        : [];
    const resultsForThisSample = linkedResults.filter(
      (result) =>
        eventDetailsObject(result.details).sampleEventId === existing.id,
    );
    if (
      resultsForThisSample.length &&
      command.eventType !== "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED"
    )
      throw new Error(
        "This sample has a linked lab result. Keep it as a sample or correct the lab result first.",
      );
    if (
      resultsForThisSample.some(
        (result) => command.eventDate > dateOnly(result.eventDate),
      )
    )
      throw new Error(
        "The corrected sample date cannot be after its linked result was received.",
      );
    const claimed = await tx.serviceEvent.updateMany({
      where: { id: existing.id, status: "ACTIVE" },
      data: { status: "CORRECTED" },
    });
    if (claimed.count !== 1)
      throw new Error(
        "This record has already been changed. Reload and try again.",
      );
    const next = await tx.serviceEvent.create({
      data: {
        coolingTowerSystemId: existing.coolingTowerSystemId,
        eventType: command.eventType,
        eventDate: asUtc(command.eventDate),
        eventTimestamp: command.eventTimestamp,
        details,
        notes: command.notes,
        recordedById: user.id,
        correctedFromEventId: existing.id,
      },
    });
    for (const result of resultsForThisSample)
      await tx.serviceEvent.update({
        where: { id: result.id },
        data: {
          details: {
            ...eventDetailsObject(result.details),
            sampleEventId: next.id,
          },
        },
      });
    if (resultsForThisSample.length)
      await tx.auditLog.createMany({
        data: resultsForThisSample.map((result) => ({
          entityType: "ServiceEvent",
          entityId: result.id,
          action: "RELINKED_TO_CORRECTED_SAMPLE",
          reason: identifiers.reason,
          changedById: user.id,
          previousValue: { sampleEventId: existing.id },
          newValue: { sampleEventId: next.id },
        })),
      });
    const visitActivityId = linkedVisitActivityId(existing.details);
    if (visitActivityId)
      await tx.visitActivity.updateMany({
        where: {
          id: visitActivityId,
          coolingTowerSystemId: existing.coolingTowerSystemId,
        },
        data: {
          performedDate: asUtc(command.eventDate),
          dateSource: "CORRECTION",
        },
      });
    const projection = await rebuildSystemComplianceProjections(
      tx,
      existing.coolingTowerSystemId,
    );
    await tx.auditLog.create({
      data: {
        entityType: "ServiceEvent",
        entityId: existing.id,
        action: "CORRECTED",
        previousValue: {
          eventType: existing.eventType,
          eventDate: dateOnly(existing.eventDate),
          eventTimestamp: existing.eventTimestamp?.toISOString() ?? null,
          details: existing.details,
          notes: existing.notes,
        },
        newValue: {
          eventType: command.eventType,
          eventDate: command.eventDate,
          eventTimestamp: command.eventTimestamp?.toISOString() ?? null,
          details,
          notes: command.notes,
          replacementEventId: next.id,
          generated: projection,
        },
        reason: identifiers.reason,
        changedById: user.id,
        relatedReplacementId: next.id,
      },
    });
    return next;
  });
  revalidatePath("/");
  revalidatePath("/customers");
  revalidatePath(`/systems/${existing.coolingTowerSystemId}`);
  redirect(
    `/systems/${existing.coolingTowerSystemId}?view=history&correctedEvent=${replacement.id}`,
  );
}

export async function voidServiceEventAction(formData: FormData) {
  const user = await requireRole([UserRole.ADMIN, UserRole.OPERATIONS_MANAGER]);
  const parsed = z
    .object({
      eventId: z.string().min(1),
      reason: z.string().trim().min(8).max(2000),
      confirmVoid: z.literal("yes"),
    })
    .parse({
      eventId: String(formData.get("eventId") || ""),
      reason: String(formData.get("reason") || ""),
      confirmVoid: String(formData.get("confirmVoid") || ""),
    });
  const existing = await db.serviceEvent.findFirstOrThrow({
    where: {
      id: parsed.eventId,
      status: "ACTIVE",
      coolingTowerSystem: {
        building: { customer: { organizationId: user.organizationId } },
      },
    },
  });
  await db.$transaction(async (tx) => {
    await lockSystemCompliance(tx, existing.coolingTowerSystemId);
    if (existing.eventType === "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED") {
      const activeResults = await tx.serviceEvent.findMany({
        where: {
          coolingTowerSystemId: existing.coolingTowerSystemId,
          eventType: "LEGIONELLA_RESULT_RECEIVED",
          status: "ACTIVE",
        },
        select: { details: true },
      });
      if (
        activeResults.some(
          (result) =>
            eventDetailsObject(result.details).sampleEventId === existing.id,
        )
      )
        throw new Error(
          "This sample has a linked lab result. Void or correct the lab result before voiding the sample.",
        );
    }
    const claimed = await tx.serviceEvent.updateMany({
      where: { id: existing.id, status: "ACTIVE" },
      data: { status: "VOIDED" },
    });
    if (claimed.count !== 1)
      throw new Error(
        "This record has already been changed. Reload and try again.",
      );
    const visitActivityId = linkedVisitActivityId(existing.details);
    if (visitActivityId)
      await tx.visitActivity.updateMany({
        where: {
          id: visitActivityId,
          coolingTowerSystemId: existing.coolingTowerSystemId,
          status: "COMPLETED",
        },
        data: { status: "VOIDED", dateSource: "CORRECTION" },
      });
    const projection = await rebuildSystemComplianceProjections(
      tx,
      existing.coolingTowerSystemId,
    );
    await tx.auditLog.create({
      data: {
        entityType: "ServiceEvent",
        entityId: existing.id,
        action: "VOIDED",
        previousValue: {
          eventType: existing.eventType,
          eventDate: dateOnly(existing.eventDate),
          status: existing.status,
        },
        newValue: { status: "VOIDED", generated: projection },
        reason: parsed.reason,
        changedById: user.id,
      },
    });
  });
  revalidatePath("/");
  revalidatePath(`/systems/${existing.coolingTowerSystemId}`);
  redirect(
    `/systems/${existing.coolingTowerSystemId}?view=history&voidedEvent=1`,
  );
}
