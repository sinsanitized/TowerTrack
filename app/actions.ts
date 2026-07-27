"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ActivityType,
  type Prisma,
  SourceAuthority,
  UserRole,
  VisitStatus,
} from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { clearSession, requireRole } from "@/lib/auth";
import { asUtc, dateOnly, isWeekend, todayInTimeZone } from "@/lib/date";
import {
  activitiesCanShareVisit,
  completedEventsConflictOnSameDate,
  isAnnualCleaningActivity,
} from "@/lib/activity-compatibility";
import { rebuildSystemComplianceProjections } from "@/lib/obligation-projections";
import {
  activityTypeCoversObligation,
  activityTypeForObligation,
} from "@/lib/compliance-intelligence";
import {
  parseServiceEventCommand,
  serviceEventInputFromFormData,
  serviceEventTypeForActivity,
} from "@/lib/service-event-command";
import {
  annualCleaningProgress,
  nextAnnualCleaningObligation,
} from "@/lib/obligation-engine";

const sourceAuthorities = [
  "REGULATORY",
  "GUIDANCE",
  "COMPANY_POLICY",
  "CONTRACT_REQUIREMENT",
  "PENDING_REGULATION",
  "UNKNOWN_REQUIRES_REVIEW",
] as const;

const optionalRuleInteger = z.preprocess(
  (value) => (value === "" || value == null ? null : value),
  z.coerce.number().int().min(0).max(3650).nullable(),
);

function eventDetailsObject(details: unknown): Record<string, unknown> {
  return details && typeof details === "object" && !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : {};
}

function linkedVisitActivityId(details: unknown) {
  const value = eventDetailsObject(details).visitActivityId;
  return typeof value === "string" ? value : null;
}

async function scopedSystem(systemId: string, organizationId: string) {
  return db.coolingTowerSystem.findFirstOrThrow({
    where: {
      id: systemId,
      active: true,
      building: { customer: { organizationId } },
    },
    include: { ruleProfile: true },
  });
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
  const command = parseServiceEventCommand(
    serviceEventInputFromFormData(formData),
  );
  await scopedSystem(systemId, user.organizationId);
  const result = await db.$transaction(async (tx) => {
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
    if (command.eventType === "REPORT_SUBMITTED") {
      const reportType = command.details.reportType as string;
      const reportingObligationId = command.details.reportingObligationId;
      if (!reportingObligationId)
        throw new Error("Choose the exact reporting obligation submitted.");
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
        select: { id: true },
      });
      if (!matchingObligation)
        throw new Error(
          "That reporting obligation is not available for this tower.",
        );
    }
    const event = await tx.serviceEvent.create({
      data: {
        coolingTowerSystemId: systemId,
        eventType: command.eventType,
        eventDate: asUtc(command.eventDate),
        eventTimestamp: command.eventTimestamp,
        details: command.details,
        notes: command.notes,
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
          details: command.details,
          satisfiedObligationIds: satisfiedObligations.map((item) => item.id),
          generated: projection,
        },
      },
    });
    return { event, projection, satisfiedObligations };
  });
  revalidatePath("/");
  revalidatePath(`/systems/${systemId}`);
  redirect(
    `/systems/${systemId}?event=${result.event.id}&sample=${result.projection.sampleCount}&inspection=${result.projection.inspectionCount}&maintenance=${result.projection.maintenanceCount}&reporting=${result.projection.reportingCount}&satisfied=${encodeURIComponent(result.satisfiedObligations.map((item) => item.obligationType).join(","))}`,
  );
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
  const details = {
    ...eventDetailsObject(existing.details),
    ...command.details,
  };
  const replacement = await db.$transaction(async (tx) => {
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
      throw new Error("This event has already been changed. Reload and retry.");
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
    `/systems/${existing.coolingTowerSystemId}?correctedEvent=${replacement.id}`,
  );
}

export async function voidServiceEventAction(formData: FormData) {
  const user = await requireRole([UserRole.ADMIN, UserRole.OPERATIONS_MANAGER]);
  const parsed = z
    .object({
      eventId: z.string().min(1),
      reason: z.string().trim().min(8).max(2000),
    })
    .parse({
      eventId: String(formData.get("eventId") || ""),
      reason: String(formData.get("reason") || ""),
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
  if (existing.eventType === "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED") {
    const activeResults = await db.serviceEvent.findMany({
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
  await db.$transaction(async (tx) => {
    const claimed = await tx.serviceEvent.updateMany({
      where: { id: existing.id, status: "ACTIVE" },
      data: { status: "VOIDED" },
    });
    if (claimed.count !== 1)
      throw new Error("This event has already been changed. Reload and retry.");
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
  redirect(`/systems/${existing.coolingTowerSystemId}?voidedEvent=1`);
}

export async function updateMonthlyTargetWindowAction(formData: FormData) {
  const user = await requireRole([
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.SCHEDULER,
  ]);
  const parsed = z
    .object({
      systemId: z.string().min(1),
      startDay: z.coerce.number().int().min(1).max(28),
      endDay: z.coerce.number().int().min(1).max(28),
      reason: z.string().trim().min(8).max(2000),
    })
    .parse({
      systemId: String(formData.get("systemId") || ""),
      startDay: formData.get("startDay"),
      endDay: formData.get("endDay"),
      reason: String(formData.get("reason") || ""),
    });
  if (parsed.endDay < parsed.startDay)
    throw new Error("The target end day must be on or after the start day.");
  const system = await scopedSystem(parsed.systemId, user.organizationId);
  await db.$transaction(async (tx) => {
    await tx.coolingTowerSystem.update({
      where: { id: parsed.systemId },
      data: {
        monthlyTargetStartDay: parsed.startDay,
        monthlyTargetEndDay: parsed.endDay,
      },
    });
    await rebuildSystemComplianceProjections(tx, parsed.systemId);
    await tx.auditLog.create({
      data: {
        entityType: "CoolingTowerSystem",
        entityId: parsed.systemId,
        action: "UPDATED_MONTHLY_TARGET_WINDOW",
        previousValue: {
          startDay: system.monthlyTargetStartDay,
          endDay: system.monthlyTargetEndDay,
        },
        newValue: { startDay: parsed.startDay, endDay: parsed.endDay },
        reason: parsed.reason,
        changedById: user.id,
      },
    });
  });
  revalidatePath("/");
  revalidatePath(`/systems/${parsed.systemId}`);
  redirect(`/systems/${parsed.systemId}?targetWindow=1`);
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

type SchedulableObligation = {
  id: string;
  type: string;
  category: "SAMPLE" | "INSPECTION" | "MAINTENANCE" | "REPORTING_ACTION";
  earliest: Date | null;
  latest: Date | null;
};

function activityGroupsForObligations(obligations: SchedulableObligation[]) {
  const mapped = obligations.map((item) => ({
    ...item,
    activityType: activityTypeForObligation(item),
  }));
  if (mapped.some((item) => item.activityType == null))
    throw new Error(
      "This opportunity includes a reporting task that cannot be completed as a field visit.",
    );
  const sampleItems = mapped.filter((item) => item.category === "SAMPLE");
  const sampleActivityPreference: ActivityType[] = [
    ActivityType.EMERGENCY_SAMPLE,
    ActivityType.CORRECTIVE_RETEST,
    ActivityType.POST_HYPERHALOGENATION_SAMPLE,
    ActivityType.STARTUP_LEGIONELLA_SAMPLE,
    ActivityType.ROUTINE_LEGIONELLA_SAMPLE,
  ];
  const groups = [
    ...(sampleItems.length
      ? [
          {
            activityType: sampleItems
              .map((item) => item.activityType as ActivityType)
              .sort(
                (a, b) =>
                  sampleActivityPreference.indexOf(a) -
                  sampleActivityPreference.indexOf(b),
              )[0],
            obligationIds: sampleItems.map((item) => item.id),
            category: "SAMPLE" as const,
          },
        ]
      : []),
    ...mapped
      .filter((item) => item.category !== "SAMPLE")
      .map((item) => ({
        activityType: item.activityType as ActivityType,
        obligationIds: [item.id],
        category: item.category,
      })),
  ];
  return { groups, sampleItems };
}

export async function updateSeasonalSettingsAction(formData: FormData) {
  const user = await requireRole([UserRole.ADMIN, UserRole.OPERATIONS_MANAGER]);
  const optionalMonth = z.preprocess(
    (value) => (value == null || value === "" ? null : value),
    z.coerce.number().int().min(1).max(12).nullable(),
  );
  const optionalDay = z.preprocess(
    (value) => (value == null || value === "" ? null : value),
    z.coerce.number().int().min(1).max(31).nullable(),
  );
  const parsed = z
    .object({
      systemId: z.string().min(1),
      operationPattern: z.enum(["YEAR_ROUND", "SEASONAL"]),
      seasonStartMonth: optionalMonth,
      seasonStartDay: optionalDay,
      seasonEndMonth: optionalMonth,
      seasonEndDay: optionalDay,
      reason: z.string().trim().min(8).max(2000),
    })
    .parse({
      systemId: String(formData.get("systemId") || ""),
      operationPattern: String(formData.get("operationPattern") || ""),
      seasonStartMonth: formData.get("seasonStartMonth"),
      seasonStartDay: formData.get("seasonStartDay"),
      seasonEndMonth: formData.get("seasonEndMonth"),
      seasonEndDay: formData.get("seasonEndDay"),
      reason: String(formData.get("reason") || ""),
    });
  const seasonal = parsed.operationPattern === "SEASONAL";
  const validMonthDay = (month: number, day: number) => {
    const test = new Date(Date.UTC(2024, month - 1, day));
    return test.getUTCMonth() === month - 1 && test.getUTCDate() === day;
  };
  if (
    seasonal &&
    (parsed.seasonStartMonth == null ||
      parsed.seasonStartDay == null ||
      parsed.seasonEndMonth == null ||
      parsed.seasonEndDay == null ||
      !validMonthDay(parsed.seasonStartMonth, parsed.seasonStartDay) ||
      !validMonthDay(parsed.seasonEndMonth, parsed.seasonEndDay))
  ) {
    throw new Error("Season start and end dates must be valid calendar dates.");
  }
  const existing = await db.coolingTowerSystem.findFirstOrThrow({
    where: {
      id: parsed.systemId,
      building: { customer: { organizationId: user.organizationId } },
    },
    select: {
      id: true,
      seasonal: true,
      operationPeriodType: true,
      seasonStartMonth: true,
      seasonStartDay: true,
      seasonEndMonth: true,
      seasonEndDay: true,
      actualStartupDate: true,
      actualShutdownDate: true,
    },
  });
  const nextValue = {
    seasonal,
    operationPeriodType: seasonal ? "SEASONAL" : "YEAR_ROUND",
    seasonStartMonth: seasonal
      ? parsed.seasonStartMonth!
      : existing.seasonStartMonth,
    seasonStartDay: seasonal ? parsed.seasonStartDay! : existing.seasonStartDay,
    seasonEndMonth: seasonal ? parsed.seasonEndMonth! : existing.seasonEndMonth,
    seasonEndDay: seasonal ? parsed.seasonEndDay! : existing.seasonEndDay,
  };
  await db.$transaction(async (tx) => {
    await tx.coolingTowerSystem.update({
      where: { id: parsed.systemId },
      data: nextValue,
    });
    await rebuildSystemComplianceProjections(tx, parsed.systemId);
    await tx.auditLog.create({
      data: {
        entityType: "CoolingTowerSystem",
        entityId: parsed.systemId,
        action: "UPDATED_SEASONAL_SETTINGS",
        previousValue: {
          seasonal: existing.seasonal,
          operationPeriodType: existing.operationPeriodType,
          seasonStartMonth: existing.seasonStartMonth,
          seasonStartDay: existing.seasonStartDay,
          seasonEndMonth: existing.seasonEndMonth,
          seasonEndDay: existing.seasonEndDay,
          actualStartupDate: existing.actualStartupDate
            ? dateOnly(existing.actualStartupDate)
            : null,
          actualShutdownDate: existing.actualShutdownDate
            ? dateOnly(existing.actualShutdownDate)
            : null,
        },
        newValue: nextValue,
        reason: parsed.reason,
        changedById: user.id,
      },
    });
  });
  revalidatePath("/");
  revalidatePath(`/systems/${parsed.systemId}`);
  redirect(`/systems/${parsed.systemId}?operationPattern=1`);
}

export async function createAnnualCleaningPlanAction(formData: FormData) {
  const user = await requireRole([
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.SCHEDULER,
  ]);
  const parsed = z
    .object({
      systemId: z.string().min(1),
      chemicalAddDate: z.string().date(),
      cleaningDate: z.string().date(),
      technicianId: z.string().min(1).nullable(),
      notes: z.string().trim().max(1000).nullable(),
      reason: z.string().trim().min(8).max(2000),
    })
    .parse({
      systemId: String(formData.get("systemId") || ""),
      chemicalAddDate: String(formData.get("chemicalAddDate") || ""),
      cleaningDate: String(formData.get("cleaningDate") || ""),
      technicianId: String(formData.get("technicianId") || "") || null,
      notes: String(formData.get("notes") || "") || null,
      reason: String(formData.get("reason") || ""),
    });
  if (
    parsed.chemicalAddDate >= parsed.cleaningDate ||
    isWeekend(parsed.chemicalAddDate) ||
    isWeekend(parsed.cleaningDate)
  )
    throw new Error(
      "Choose a Monday–Friday chemical-add date followed by a later Monday–Friday cleaning date.",
    );

  const cleaningYear = Number(parsed.cleaningDate.slice(0, 4));
  if (parsed.chemicalAddDate.slice(0, 4) !== String(cleaningYear))
    throw new Error(
      "Both cleaning-plan dates must be in the same calendar year.",
    );

  const system = await db.coolingTowerSystem.findFirstOrThrow({
    where: {
      id: parsed.systemId,
      active: true,
      building: { customer: { organizationId: user.organizationId } },
    },
    include: {
      building: true,
      ruleProfile: { include: { rules: true } },
      serviceEvents: {
        where: {
          status: "ACTIVE",
          eventType: {
            in: [
              "CLEANING_COMPLETED",
              "STARTUP_CLEANING_DISINFECTION",
              "FULL_REMEDIATION",
              "SUMMERTIME_HYPERHALOGENATION",
            ],
          },
        },
        select: { eventType: true, eventDate: true },
      },
      activities: {
        where: {
          status: "PLANNED",
          visit: { status: { in: ["PLANNED", "CONFIRMED", "IN_PROGRESS"] } },
        },
        select: { activityType: true, scheduledDate: true },
      },
    },
  });
  if (
    system.ruleProfile.jurisdictionMode !== "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4"
  )
    throw new Error(
      "This tower does not have the NYC annual cleaning rule enabled.",
    );
  if (
    system.activities.some((activity) =>
      isAnnualCleaningActivity(activity.activityType),
    )
  )
    throw new Error(
      "An active annual cleaning plan already exists for this tower.",
    );

  const cleaningProgress = annualCleaningProgress(
    system.serviceEvents
      .filter((event) => event.eventType !== "SUMMERTIME_HYPERHALOGENATION")
      .map((event) => dateOnly(event.eventDate)),
    cleaningYear,
  );
  const cleaningRule = system.ruleProfile.rules.find(
    (rule) => rule.requirementType === "ANNUAL_CLEANING" && rule.enabled,
  );
  const obligation = cleaningRule
    ? nextAnnualCleaningObligation({
        systemId: system.id,
        year: cleaningYear,
        completed: cleaningProgress.completed,
        sourceCitation: cleaningRule.sourceCitation,
      })
    : null;
  if (!obligation)
    throw new Error(
      "No open annual cleaning requirement is available to plan for that year.",
    );
  if (
    (obligation.earliestDueDate &&
      parsed.chemicalAddDate < obligation.earliestDueDate) ||
    (obligation.latestDueDate && parsed.cleaningDate > obligation.latestDueDate)
  )
    throw new Error(
      "Both phases must remain inside the open annual cleaning window.",
    );

  const phaseDates = new Set([parsed.chemicalAddDate, parsed.cleaningDate]);
  const conflictingHyperRecord = system.serviceEvents.some(
    (event) =>
      event.eventType === "SUMMERTIME_HYPERHALOGENATION" &&
      phaseDates.has(dateOnly(event.eventDate)),
  );
  const conflictingHyperPlan = system.activities.some(
    (activity) =>
      activity.activityType === "SUMMERTIME_HYPERHALOGENATION" &&
      phaseDates.has(dateOnly(activity.scheduledDate)),
  );
  if (conflictingHyperRecord || conflictingHyperPlan)
    throw new Error(
      "Annual cleaning cannot share a date with summertime hyperhalogenation.",
    );

  const technician = parsed.technicianId
    ? await db.user.findFirst({
        where: {
          id: parsed.technicianId,
          organizationId: user.organizationId,
          role: UserRole.TECHNICIAN,
          active: true,
        },
        select: { id: true },
      })
    : null;
  if (parsed.technicianId && !technician)
    throw new Error("Choose an active technician in your organization.");

  const obligationId = `annual-cleaning:${system.id}:${cleaningYear}:${cleaningProgress.completed + 1}`;
  const visit = await db.$transaction(async (tx) => {
    const created = await tx.visit.create({
      data: {
        buildingId: system.buildingId,
        scheduledDate: asUtc(parsed.cleaningDate),
        status: VisitStatus.PLANNED,
        assignedTechnicianId: technician?.id,
        createdById: user.id,
        notes: parsed.notes,
      },
    });
    const activity = await tx.visitActivity.create({
      data: {
        visitId: created.id,
        coolingTowerSystemId: system.id,
        activityType: ActivityType.ROUTINE_CLEANING,
        scheduledDate: asUtc(parsed.cleaningDate),
        qualifiesForCleaning: true,
        ruleProfileId: system.ruleProfileId,
        ruleDefinitionId: cleaningRule!.id,
        sourceAuthority: cleaningRule!.sourceAuthority,
        details: {
          planType: "TWO_DAY_ANNUAL_CLEANING",
          chemicalAddDate: parsed.chemicalAddDate,
          cleaningDate: parsed.cleaningDate,
          obligationIds: [obligationId],
        },
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: "Visit",
        entityId: created.id,
        action: "CREATED_TWO_DAY_CLEANING_PLAN",
        reason: parsed.reason,
        changedById: user.id,
        newValue: {
          systemId: system.id,
          activityId: activity.id,
          chemicalAddDate: parsed.chemicalAddDate,
          cleaningDate: parsed.cleaningDate,
          assignedTechnicianId: technician?.id ?? null,
          obligationId,
        },
      },
    });
    return created;
  });
  revalidatePath("/");
  revalidatePath(`/systems/${system.id}`);
  redirect(`/visits/${visit.id}?planned=1`);
}

export async function createVisitOpportunityAction(formData: FormData) {
  const user = await requireRole([
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.SCHEDULER,
  ]);
  const parsed = z
    .object({
      systemId: z.string().min(1),
      visitDate: z.string().date(),
      obligationIds: z.array(z.string().min(1)).min(1),
      technicianId: z.string().min(1).nullable(),
    })
    .parse({
      systemId: String(formData.get("systemId") || ""),
      visitDate: String(formData.get("visitDate") || ""),
      obligationIds: String(formData.get("obligationIds") || "")
        .split(",")
        .filter(Boolean),
      technicianId: String(formData.get("technicianId") || "") || null,
    });
  const [system, technician] = await Promise.all([
    db.coolingTowerSystem.findFirstOrThrow({
      where: {
        id: parsed.systemId,
        active: true,
        building: { customer: { organizationId: user.organizationId } },
      },
      include: {
        ruleProfile: { include: { rules: true } },
        sampleObligations: {
          where: {
            id: { in: parsed.obligationIds },
            status: { in: ["PENDING", "SCHEDULED", "OVERDUE"] },
          },
        },
        inspectionObligations: {
          where: {
            id: { in: parsed.obligationIds },
            status: { in: ["PENDING", "SCHEDULED", "OVERDUE"] },
          },
        },
        reportingObligations: {
          where: {
            id: { in: parsed.obligationIds },
            status: { in: ["PENDING", "SCHEDULED", "OVERDUE"] },
          },
        },
        serviceEvents: {
          where: {
            status: "ACTIVE",
            eventType: {
              in: [
                "CLEANING_COMPLETED",
                "STARTUP_CLEANING_DISINFECTION",
                "FULL_REMEDIATION",
              ],
            },
          },
          select: { eventDate: true },
        },
      },
    }),
    parsed.technicianId
      ? db.user.findFirst({
          where: {
            id: parsed.technicianId,
            organizationId: user.organizationId,
            role: UserRole.TECHNICIAN,
            active: true,
          },
        })
      : Promise.resolve(null),
  ]);
  if (parsed.technicianId && !technician)
    throw new Error("Choose an active technician in your organization.");
  const obligations: SchedulableObligation[] = [
    ...system.sampleObligations.map((item) => ({
      id: item.id,
      type: item.obligationType,
      category: "SAMPLE" as const,
      earliest: item.earliestDueDate,
      latest: item.latestDueDate,
    })),
    ...system.inspectionObligations.map((item) => ({
      id: item.id,
      type: "QUARTERLY_COMPLIANCE_INSPECTION",
      category: "INSPECTION" as const,
      earliest: item.earliestDueDate,
      latest: item.latestDueDate,
    })),
    ...system.reportingObligations.map((item) => ({
      id: item.id,
      type: item.obligationType,
      category: "REPORTING_ACTION" as const,
      earliest: item.earliestDueDate,
      latest: item.latestDueDate,
    })),
  ];
  const visitYear = Number(parsed.visitDate.slice(0, 4));
  const cleaningProgress = annualCleaningProgress(
    system.serviceEvents.map((event) => dateOnly(event.eventDate)),
    visitYear,
  );
  const projectedCleaning =
    system.ruleProfile.jurisdictionMode === "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4"
      ? nextAnnualCleaningObligation({
          systemId: system.id,
          year: visitYear,
          completed: cleaningProgress.completed,
        })
      : null;
  if (projectedCleaning) {
    const id = `annual-cleaning:${system.id}:${visitYear}:${cleaningProgress.completed + 1}`;
    if (parsed.obligationIds.includes(id))
      obligations.push({
        id,
        type: projectedCleaning.obligationType,
        category: "MAINTENANCE",
        earliest: projectedCleaning.earliestDueDate
          ? asUtc(projectedCleaning.earliestDueDate)
          : null,
        latest: projectedCleaning.latestDueDate
          ? asUtc(projectedCleaning.latestDueDate)
          : null,
      });
  }
  if (obligations.length !== new Set(parsed.obligationIds).size)
    throw new Error(
      "One or more obligations changed. Refresh Visit opportunities before scheduling.",
    );
  const outsideWindow = obligations.find(
    (item) =>
      (item.earliest && parsed.visitDate < dateOnly(item.earliest)) ||
      (item.latest && parsed.visitDate > dateOnly(item.latest)),
  );
  if (outsideWindow)
    throw new Error(
      `${outsideWindow.type.replaceAll("_", " ")} is not legally satisfiable on ${parsed.visitDate}.`,
    );
  const { groups: activityGroups, sampleItems } =
    activityGroupsForObligations(obligations);
  if (
    activityGroups.some((group, index) =>
      activityGroups
        .slice(index + 1)
        .some(
          (other) =>
            !activitiesCanShareVisit(group.activityType, other.activityType),
        ),
    )
  )
    throw new Error(
      "Annual cleaning and summertime hyperhalogenation require separate visits.",
    );
  const visit = await db.$transaction(async (tx) => {
    const created = await tx.visit.create({
      data: {
        buildingId: system.buildingId,
        scheduledDate: asUtc(parsed.visitDate),
        status: VisitStatus.PLANNED,
        assignedTechnicianId: technician?.id,
        createdById: user.id,
        notes: `Created from ${obligations.length} intersecting compliance obligation${obligations.length === 1 ? "" : "s"}.`,
      },
    });
    for (const group of activityGroups) {
      const requirementType =
        group.category === "INSPECTION"
          ? "COMPLIANCE_INSPECTION"
          : group.category === "MAINTENANCE"
            ? "ANNUAL_CLEANING"
            : group.activityType === ActivityType.SUMMERTIME_HYPERHALOGENATION
              ? "SUMMERTIME_HYPERHALOGENATION"
              : group.category === "SAMPLE"
                ? "ROUTINE_LEGIONELLA_SAMPLE"
                : null;
      const rule = requirementType
        ? system.ruleProfile.rules.find(
            (item) => item.requirementType === requirementType,
          )
        : null;
      await tx.visitActivity.create({
        data: {
          visitId: created.id,
          coolingTowerSystemId: system.id,
          activityType: group.activityType,
          scheduledDate: asUtc(parsed.visitDate),
          qualifiesForRoutineLegionella:
            group.category === "SAMPLE" &&
            sampleItems.some(
              (item) => item.type === "ROUTINE_OPERATING_SAMPLE",
            ),
          qualifiesForInspection: group.category === "INSPECTION",
          qualifiesForCleaning: (
            [
              ActivityType.ROUTINE_CLEANING,
              ActivityType.CORRECTIVE_DISINFECTION,
              ActivityType.FULL_REMEDIATION,
            ] as ActivityType[]
          ).includes(group.activityType),
          ruleProfileId: system.ruleProfileId,
          ruleDefinitionId: rule?.id,
          sourceAuthority:
            rule?.sourceAuthority ?? SourceAuthority.UNKNOWN_REQUIRES_REVIEW,
          details: { obligationIds: group.obligationIds },
        },
      });
    }
    if (system.sampleObligations.length)
      await tx.sampleObligation.updateMany({
        where: { id: { in: system.sampleObligations.map((item) => item.id) } },
        data: { status: "SCHEDULED" },
      });
    if (system.inspectionObligations.length)
      await tx.inspectionObligation.updateMany({
        where: {
          id: { in: system.inspectionObligations.map((item) => item.id) },
        },
        data: { status: "SCHEDULED" },
      });
    if (system.reportingObligations.length)
      await tx.reportingObligation.updateMany({
        where: {
          id: { in: system.reportingObligations.map((item) => item.id) },
        },
        data: { status: "SCHEDULED" },
      });
    await tx.auditLog.create({
      data: {
        entityType: "Visit",
        entityId: created.id,
        action: "CREATED_FROM_VISIT_OPPORTUNITY",
        reason: "Scheduled from an intersecting compliance window",
        changedById: user.id,
        newValue: {
          systemId: system.id,
          scheduledDate: parsed.visitDate,
          assignedTechnicianId: technician?.id ?? null,
          obligationIds: parsed.obligationIds,
          activityTypes: activityGroups.map((item) => item.activityType),
        },
      },
    });
    return created;
  });
  revalidatePath("/");
  revalidatePath("/work/visit-opportunities");
  revalidatePath(`/systems/${system.id}`);
  redirect(`/visits/${visit.id}`);
}

export async function completeVisitAction(formData: FormData) {
  const user = await requireRole([
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.SCHEDULER,
    UserRole.TECHNICIAN,
  ]);
  const parsed = z
    .object({
      visitId: z.string().min(1),
      performedDate: z.string().date(),
    })
    .parse({
      visitId: String(formData.get("visitId") || ""),
      performedDate: String(formData.get("performedDate") || ""),
    });
  if (parsed.performedDate > todayInTimeZone())
    throw new Error("Completed work cannot be recorded with a future date.");
  const visit = await db.visit.findFirstOrThrow({
    where: {
      id: parsed.visitId,
      building: { customer: { organizationId: user.organizationId } },
    },
    include: {
      activities: {
        include: { coolingTowerSystem: { include: { ruleProfile: true } } },
      },
    },
  });
  if (
    user.role === UserRole.TECHNICIAN &&
    visit.assignedTechnicianId !== user.id
  ) {
    throw new Error("Technicians may complete only visits assigned to them.");
  }
  if (visit.status === VisitStatus.COMPLETED)
    throw new Error("This visit is already completed.");
  if (visit.status === VisitStatus.CANCELLED)
    throw new Error("A canceled visit cannot be completed.");
  const completedActivityIds = visit.activities
    .filter((activity) => formData.get(`activity_${activity.id}`) === "on")
    .map((activity) => activity.id);
  if (!completedActivityIds.length)
    throw new Error("Select at least one completed activity.");
  await db.$transaction(async (tx) => {
    const projectionSystemIds = new Set<string>();
    const createdEvents: Array<{
      id: string;
      systemId: string;
      eventType: string;
      activityId: string;
    }> = [];
    for (const activity of visit.activities) {
      if (!completedActivityIds.includes(activity.id)) continue;
      const eventType = serviceEventTypeForActivity(
        activity.activityType,
        activity.qualifiesForInspection,
      );
      if (eventType)
        await assertNoCleaningHyperConflict(tx, {
          systemId: activity.coolingTowerSystemId,
          eventType,
          eventDate: parsed.performedDate,
        });
    }
    const transitioned = await tx.visit.updateMany({
      where: {
        id: parsed.visitId,
        status: { notIn: [VisitStatus.COMPLETED, VisitStatus.CANCELLED] },
      },
      data: {
        performedDate: asUtc(parsed.performedDate),
        status: VisitStatus.COMPLETED,
      },
    });
    if (transitioned.count !== 1)
      throw new Error("This visit can no longer be completed.");
    for (const activity of visit.activities) {
      const done = completedActivityIds.includes(activity.id);
      await tx.visitActivity.update({
        where: { id: activity.id },
        data: {
          status: done ? "COMPLETED" : "CANCELLED",
          performedDate: done ? asUtc(parsed.performedDate) : null,
        },
      });
      if (done) {
        const eventType = serviceEventTypeForActivity(
          activity.activityType,
          activity.qualifiesForInspection,
        );
        if (eventType) {
          const field = (name: string) =>
            String(formData.get(`activity_${activity.id}_${name}`) ?? "");
          const command = parseServiceEventCommand({
            eventType,
            eventDate: parsed.performedDate,
            eventTimestamp: "",
            cfuPerMl: "",
            residualOutcome: "UNKNOWN",
            reportType: "",
            chemical: field("chemical"),
            quantity: field("quantity"),
            contactTime: field("contactTime"),
            ph: field("ph"),
            freeHalogenResidual: field("freeHalogenResidual"),
            technician: user.name,
            notes: "Created from completed field visit",
          });
          const event = await tx.serviceEvent.create({
            data: {
              coolingTowerSystemId: activity.coolingTowerSystemId,
              eventType: command.eventType,
              eventDate: asUtc(command.eventDate),
              eventTimestamp: command.eventTimestamp,
              details: {
                ...command.details,
                visitId: parsed.visitId,
                visitActivityId: activity.id,
                sampleActivityType: activity.qualifiesForRoutineLegionella
                  ? activity.activityType
                  : null,
              },
              notes: command.notes,
              recordedById: user.id,
            },
          });
          createdEvents.push({
            id: event.id,
            systemId: activity.coolingTowerSystemId,
            eventType: command.eventType,
            activityId: activity.id,
          });
          projectionSystemIds.add(activity.coolingTowerSystemId);
        }
      }
    }
    for (const systemId of projectionSystemIds)
      await rebuildSystemComplianceProjections(tx, systemId);
    await tx.auditLog.create({
      data: {
        entityType: "Visit",
        entityId: parsed.visitId,
        action: "COMPLETED",
        reason: "Visit completion",
        changedById: user.id,
        newValue: {
          performedDate: parsed.performedDate,
          completedActivityIds,
          createdEventIds: createdEvents.map((event) => event.id),
        },
      },
    });
    if (createdEvents.length)
      await tx.auditLog.createMany({
        data: createdEvents.map((event) => ({
          entityType: "ServiceEvent",
          entityId: event.id,
          action: "CREATED_FROM_VISIT",
          reason: "Field visit completion",
          changedById: user.id,
          newValue: {
            systemId: event.systemId,
            eventType: event.eventType,
            eventDate: parsed.performedDate,
            visitId: parsed.visitId,
            visitActivityId: event.activityId,
          },
        })),
      });
  });
  revalidatePath("/");
  redirect(`/visits/${parsed.visitId}?completed=1`);
}

export async function cancelVisitAction(formData: FormData) {
  const user = await requireRole([
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.SCHEDULER,
  ]);
  const parsed = z
    .object({
      visitId: z.string().min(1),
      reason: z.string().trim().min(8).max(2000),
    })
    .parse({
      visitId: String(formData.get("visitId") || ""),
      reason: String(formData.get("reason") || ""),
    });
  const visit = await db.visit.findFirstOrThrow({
    where: {
      id: parsed.visitId,
      building: { customer: { organizationId: user.organizationId } },
    },
    include: { activities: true },
  });
  if (
    visit.status === VisitStatus.COMPLETED ||
    visit.status === VisitStatus.CANCELLED
  )
    throw new Error("This visit can no longer be canceled.");
  const systemIds = [
    ...new Set(visit.activities.map((item) => item.coolingTowerSystemId)),
  ];
  await db.$transaction(async (tx) => {
    await tx.visit.update({
      where: { id: visit.id },
      data: { status: VisitStatus.CANCELLED },
    });
    await tx.visitActivity.updateMany({
      where: { visitId: visit.id, status: "PLANNED" },
      data: { status: "CANCELLED" },
    });
    for (const systemId of systemIds)
      await rebuildSystemComplianceProjections(tx, systemId);
    await tx.auditLog.create({
      data: {
        entityType: "Visit",
        entityId: visit.id,
        action: "CANCELLED",
        reason: parsed.reason,
        changedById: user.id,
        previousValue: { status: visit.status },
        newValue: { status: VisitStatus.CANCELLED, systemIds },
      },
    });
  });
  revalidatePath("/");
  revalidatePath(`/visits/${visit.id}`);
  for (const systemId of systemIds) revalidatePath(`/systems/${systemId}`);
  redirect(`/visits/${visit.id}?cancelled=1`);
}

export async function rescheduleVisitAction(formData: FormData) {
  const user = await requireRole([
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.SCHEDULER,
  ]);
  const parsed = z
    .object({
      visitId: z.string().min(1),
      scheduledDate: z.string().date(),
      reason: z.string().trim().min(8).max(2000),
    })
    .parse({
      visitId: String(formData.get("visitId") || ""),
      scheduledDate: String(formData.get("scheduledDate") || ""),
      reason: String(formData.get("reason") || ""),
    });
  const visit = await db.visit.findFirstOrThrow({
    where: {
      id: parsed.visitId,
      status: {
        in: [VisitStatus.DRAFT, VisitStatus.PLANNED, VisitStatus.CONFIRMED],
      },
      building: { customer: { organizationId: user.organizationId } },
    },
    include: { activities: true },
  });
  if (!visit.activities.length)
    throw new Error("This visit has no generated work to reschedule.");
  const requestedYear = parsed.scheduledDate.slice(0, 4);
  const cleaningFromAnotherYear = visit.activities.some((activity) => {
    const details = eventDetailsObject(activity.details);
    const ids = Array.isArray(details.obligationIds)
      ? details.obligationIds
      : [];
    return ids.some(
      (id) =>
        typeof id === "string" &&
        id.startsWith("annual-cleaning:") &&
        id.split(":")[2] !== requestedYear,
    );
  });
  if (cleaningFromAnotherYear)
    throw new Error(
      "An annual cleaning visit cannot be moved into a different calendar year.",
    );
  const systemIds = [
    ...new Set(visit.activities.map((item) => item.coolingTowerSystemId)),
  ];
  const systems = await db.coolingTowerSystem.findMany({
    where: {
      id: { in: systemIds },
      building: { customer: { organizationId: user.organizationId } },
    },
    include: {
      ruleProfile: true,
      sampleObligations: {
        where: { status: { in: ["PENDING", "SCHEDULED", "OVERDUE"] } },
      },
      inspectionObligations: {
        where: { status: { in: ["PENDING", "SCHEDULED", "OVERDUE"] } },
      },
      reportingObligations: {
        where: { status: { in: ["PENDING", "SCHEDULED", "OVERDUE"] } },
      },
      serviceEvents: {
        where: {
          status: "ACTIVE",
          eventType: {
            in: [
              "CLEANING_COMPLETED",
              "STARTUP_CLEANING_DISINFECTION",
              "FULL_REMEDIATION",
            ],
          },
        },
        select: { eventDate: true },
      },
    },
  });
  const obligationsBySystem = new Map(
    systems.map((system) => [
      system.id,
      [
        ...system.sampleObligations.map((item) => ({
          type: item.obligationType,
          category: "SAMPLE" as const,
          earliest: item.earliestDueDate,
          latest: item.latestDueDate,
        })),
        ...system.inspectionObligations.map((item) => ({
          type: "QUARTERLY_COMPLIANCE_INSPECTION",
          category: "INSPECTION" as const,
          earliest: item.earliestDueDate,
          latest: item.latestDueDate,
        })),
        ...system.reportingObligations.map((item) => ({
          type: item.obligationType,
          category: "REPORTING_ACTION" as const,
          earliest: item.earliestDueDate,
          latest: item.latestDueDate,
        })),
        ...(system.ruleProfile.jurisdictionMode ===
        "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4"
          ? (() => {
              const year = Number(requestedYear);
              const progress = annualCleaningProgress(
                system.serviceEvents.map((event) => dateOnly(event.eventDate)),
                year,
              );
              const cleaning = nextAnnualCleaningObligation({
                systemId: system.id,
                year,
                completed: progress.completed,
              });
              return cleaning
                ? [
                    {
                      type: cleaning.obligationType,
                      category: "MAINTENANCE" as const,
                      earliest: cleaning.earliestDueDate
                        ? asUtc(cleaning.earliestDueDate)
                        : null,
                      latest: cleaning.latestDueDate
                        ? asUtc(cleaning.latestDueDate)
                        : null,
                    },
                  ]
                : [];
            })()
          : []),
      ],
    ]),
  );
  const unsupported = visit.activities.find(
    (activity) =>
      !(obligationsBySystem.get(activity.coolingTowerSystemId) ?? []).some(
        (obligation) =>
          activityTypeCoversObligation(activity.activityType, obligation) &&
          (!obligation.earliest ||
            dateOnly(obligation.earliest) <= parsed.scheduledDate) &&
          (!obligation.latest ||
            dateOnly(obligation.latest) >= parsed.scheduledDate),
      ),
  );
  if (unsupported)
    throw new Error(
      `The selected date would leave ${unsupported.activityType.replaceAll("_", " ").toLowerCase()} outside every current compliance window.`,
    );
  const previousDate = dateOnly(visit.scheduledDate);
  await db.$transaction(async (tx) => {
    await tx.visit.update({
      where: { id: visit.id },
      data: { scheduledDate: asUtc(parsed.scheduledDate) },
    });
    await tx.visitActivity.updateMany({
      where: { visitId: visit.id, status: "PLANNED" },
      data: { scheduledDate: asUtc(parsed.scheduledDate) },
    });
    for (const systemId of systemIds)
      await rebuildSystemComplianceProjections(tx, systemId);
    await tx.auditLog.create({
      data: {
        entityType: "Visit",
        entityId: visit.id,
        action: "RESCHEDULED",
        reason: parsed.reason,
        changedById: user.id,
        previousValue: { scheduledDate: previousDate },
        newValue: { scheduledDate: parsed.scheduledDate, systemIds },
      },
    });
  });
  revalidatePath("/");
  revalidatePath(`/visits/${visit.id}`);
  for (const systemId of systemIds) revalidatePath(`/systems/${systemId}`);
  redirect(`/visits/${visit.id}?rescheduled=1`);
}

export async function updateRuleProfileAction(formData: FormData) {
  const user = await requireRole([UserRole.ADMIN]);
  const parsed = z
    .object({
      profileId: z.string().min(1),
      hardIntervalDays: optionalRuleInteger.refine(
        (value) => value == null || value >= 1,
        "The hard interval must be at least one day.",
      ),
      internalTargetIntervalDays: optionalRuleInteger.refine(
        (value) => value == null || value >= 1,
        "The internal target must be at least one day.",
      ),
      reason: z.string().trim().min(8).max(2000),
    })
    .parse({
      profileId: String(formData.get("profileId") || ""),
      hardIntervalDays: formData.get("hardIntervalDays"),
      internalTargetIntervalDays: formData.get("internalTargetIntervalDays"),
      reason: String(formData.get("reason") || ""),
    });
  if (
    parsed.hardIntervalDays != null &&
    parsed.internalTargetIntervalDays != null &&
    parsed.internalTargetIntervalDays >= parsed.hardIntervalDays
  )
    throw new Error(
      "The internal target must be earlier than the hard compliance interval.",
    );
  const existing = await db.ruleProfile.findUniqueOrThrow({
    where: { id: parsed.profileId },
    include: {
      rules: {
        where: { requirementType: "ROUTINE_LEGIONELLA_SAMPLE" },
        take: 1,
      },
      systems: {
        where: {
          building: { customer: { organizationId: user.organizationId } },
        },
        select: { id: true },
      },
      _count: { select: { systems: true } },
    },
  });
  if (
    existing.systems.length === 0 ||
    existing._count.systems !== existing.systems.length
  )
    throw new Error(
      "This rule profile is shared by another organization and cannot be revised from an organization admin account.",
    );
  const routineRule = existing.rules[0] ?? null;
  await db.$transaction(async (tx) => {
    await tx.ruleProfile.update({
      where: { id: existing.id },
      data: {
        legionellaIntervalDays: parsed.hardIntervalDays,
        internalTargetIntervalDays: parsed.internalTargetIntervalDays,
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: "RuleProfile",
        entityId: existing.id,
        action: "TIMING_UPDATED",
        reason: parsed.reason,
        changedById: user.id,
        previousValue: {
          hardIntervalDays: existing.legionellaIntervalDays,
          internalTargetIntervalDays: existing.internalTargetIntervalDays,
        },
        newValue: {
          hardIntervalDays: parsed.hardIntervalDays,
          internalTargetIntervalDays: parsed.internalTargetIntervalDays,
        },
      },
    });
    if (routineRule) {
      const nextRevision = routineRule.revision + 1;
      await tx.ruleDefinition.update({
        where: { id: routineRule.id },
        data: {
          frequencyDays: parsed.hardIntervalDays,
          revision: nextRevision,
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: "RuleDefinition",
          entityId: routineRule.id,
          action: "REVISED",
          reason: parsed.reason,
          changedById: user.id,
          previousValue: {
            revision: routineRule.revision,
            frequencyDays: routineRule.frequencyDays,
          },
          newValue: {
            revision: nextRevision,
            frequencyDays: parsed.hardIntervalDays,
          },
        },
      });
    }
    for (const system of existing.systems)
      await rebuildSystemComplianceProjections(tx, system.id);
  });
  revalidatePath("/");
  revalidatePath("/admin");
  redirect(`/admin?savedProfile=${existing.id}`);
}

export async function updateRuleDefinitionAction(formData: FormData) {
  const user = await requireRole([UserRole.ADMIN]);
  const parsed = z
    .object({
      ruleId: z.string().min(1),
      ruleName: z.string().trim().min(3),
      sourceAuthority: z.enum(sourceAuthorities),
      sourceCitation: z.string().trim().min(3),
      frequencyDays: optionalRuleInteger,
      minimumDaysAfterTrigger: optionalRuleInteger,
      maximumDaysAfterTrigger: optionalRuleInteger,
      enabled: z.boolean(),
      notes: z.string().trim().optional(),
      reason: z.string().trim().min(8).max(2000),
    })
    .parse({
      ruleId: String(formData.get("ruleId") || ""),
      ruleName: String(formData.get("ruleName") || ""),
      sourceAuthority: String(formData.get("sourceAuthority") || ""),
      sourceCitation: String(formData.get("sourceCitation") || ""),
      frequencyDays: formData.get("frequencyDays"),
      minimumDaysAfterTrigger: formData.get("minimumDaysAfterTrigger"),
      maximumDaysAfterTrigger: formData.get("maximumDaysAfterTrigger"),
      enabled: formData.get("enabled") === "on",
      notes: String(formData.get("notes") || ""),
      reason: String(formData.get("reason") || ""),
    });
  if (
    parsed.minimumDaysAfterTrigger != null &&
    parsed.maximumDaysAfterTrigger != null &&
    parsed.maximumDaysAfterTrigger < parsed.minimumDaysAfterTrigger
  )
    throw new Error("The maximum trigger offset must be after the minimum.");
  const existing = await db.ruleDefinition.findUniqueOrThrow({
    where: { id: parsed.ruleId },
    include: {
      ruleProfile: {
        include: {
          systems: {
            where: {
              building: { customer: { organizationId: user.organizationId } },
            },
            select: { id: true },
          },
          _count: { select: { systems: true } },
        },
      },
    },
  });
  if (
    existing.ruleProfile.systems.length === 0 ||
    existing.ruleProfile._count.systems !== existing.ruleProfile.systems.length
  )
    throw new Error(
      "This rule profile is shared by another organization and cannot be revised from an organization admin account.",
    );
  if (
    existing.requirementType === "ROUTINE_LEGIONELLA_SAMPLE" &&
    parsed.frequencyDays != null &&
    existing.ruleProfile.internalTargetIntervalDays != null &&
    existing.ruleProfile.internalTargetIntervalDays >= parsed.frequencyDays
  )
    throw new Error(
      "The hard interval must remain later than the internal target interval.",
    );
  const nextRevision = existing.revision + 1;
  const intervalEditable = [
    "ROUTINE_LEGIONELLA_SAMPLE",
    "PORTAL_SAMPLE_DATE",
    "COMPLIANCE_INSPECTION",
  ].includes(existing.requirementType);
  const triggerWindowEditable =
    existing.requirementType === "SUMMERTIME_HYPERHALOGENATION";
  const nextValue = {
    ruleName: parsed.ruleName,
    sourceAuthority: parsed.sourceAuthority as SourceAuthority,
    sourceCitation: parsed.sourceCitation,
    frequencyDays: intervalEditable
      ? parsed.frequencyDays
      : existing.frequencyDays,
    minimumDaysAfterTrigger: triggerWindowEditable
      ? parsed.minimumDaysAfterTrigger
      : existing.minimumDaysAfterTrigger,
    maximumDaysAfterTrigger: triggerWindowEditable
      ? parsed.maximumDaysAfterTrigger
      : existing.maximumDaysAfterTrigger,
    enabled: parsed.enabled,
    notes: parsed.notes || null,
    isRegulatoryRequirement: parsed.sourceAuthority === "REGULATORY",
    isGuidanceRequirement: parsed.sourceAuthority === "GUIDANCE",
    isCompanyPolicy: parsed.sourceAuthority === "COMPANY_POLICY",
    isContractRequirement: parsed.sourceAuthority === "CONTRACT_REQUIREMENT",
    isPendingRegulation: parsed.sourceAuthority === "PENDING_REGULATION",
    revision: nextRevision,
  };
  await db.$transaction(async (tx) => {
    await tx.ruleDefinition.update({
      where: { id: existing.id },
      data: nextValue,
    });
    if (existing.requirementType === "ROUTINE_LEGIONELLA_SAMPLE")
      await tx.ruleProfile.update({
        where: { id: existing.ruleProfileId },
        data: { legionellaIntervalDays: parsed.frequencyDays },
      });
    for (const system of existing.ruleProfile.systems)
      await rebuildSystemComplianceProjections(tx, system.id);
    await tx.auditLog.create({
      data: {
        entityType: "RuleDefinition",
        entityId: existing.id,
        action: "REVISED",
        reason: parsed.reason,
        changedById: user.id,
        previousValue: {
          revision: existing.revision,
          ruleName: existing.ruleName,
          sourceAuthority: existing.sourceAuthority,
          sourceCitation: existing.sourceCitation,
          frequencyDays: existing.frequencyDays,
          minimumDaysAfterTrigger: existing.minimumDaysAfterTrigger,
          maximumDaysAfterTrigger: existing.maximumDaysAfterTrigger,
          enabled: existing.enabled,
        },
        newValue: nextValue,
      },
    });
  });
  revalidatePath("/");
  revalidatePath("/admin");
  redirect(`/admin?savedRule=${existing.id}`);
}

export async function createCustomerAction(formData: FormData) {
  const user = await requireRole([
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.SCHEDULER,
  ]);
  const data = z
    .object({
      name: z.string().trim().min(2),
      streetAddress: z.string().trim().min(3),
      addressLine2: z.string().trim().optional(),
      city: z.string().trim().min(2),
      state: z.string().trim().length(2),
      postalCode: z.string().trim().min(5).max(10),
    })
    .parse(Object.fromEntries(formData));
  const accountNumber = `CUST-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const result = await db.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        name: data.name,
        accountNumber,
        organizationId: user.organizationId,
      },
    });
    const building = await tx.building.create({
      data: {
        customerId: customer.id,
        buildingName: data.name,
        streetAddress: data.streetAddress,
        addressLine2: data.addressLine2 || null,
        city: data.city,
        state: data.state.toUpperCase(),
        postalCode: data.postalCode,
        routeZone: `${data.city}, ${data.state.toUpperCase()}`,
      },
    });
    await tx.auditLog.createMany({
      data: [
        {
          entityType: "Customer",
          entityId: customer.id,
          action: "CREATED",
          reason: "Customer onboarding step 1",
          changedById: user.id,
          newValue: { name: data.name, accountNumber },
        },
        {
          entityType: "Building",
          entityId: building.id,
          action: "CREATED",
          reason: "Customer address created during onboarding",
          changedById: user.id,
          newValue: {
            streetAddress: data.streetAddress,
            addressLine2: data.addressLine2 || null,
            city: data.city,
            state: data.state.toUpperCase(),
            postalCode: data.postalCode,
          },
        },
      ],
    });
    return { customer, building };
  });
  revalidatePath("/customers");
  redirect(
    `/customers/${result.customer.id}/towers/new?buildingId=${result.building.id}`,
  );
}

export async function createCoolingTowerSystemAction(formData: FormData) {
  const user = await requireRole([
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.SCHEDULER,
  ]);
  const parsed = z
    .object({
      customerId: z.string().min(1),
      buildingId: z.string().min(1),
      systemName: z.string().trim().min(1),
      manufacturer: z.string().trim().optional(),
      modelNumber: z.string().trim().min(1),
      serialNumber: z.string().trim().min(1),
      towerLocation: z.string().trim().min(2),
      tonnage: z.coerce.number().positive(),
      jurisdictionId: z.string().min(1),
      ruleProfileId: z.string().min(1),
    })
    .parse(Object.fromEntries(formData));
  const [building, profile] = await Promise.all([
    db.building.findFirstOrThrow({
      where: {
        id: parsed.buildingId,
        customerId: parsed.customerId,
        customer: { organizationId: user.organizationId },
      },
    }),
    db.ruleProfile.findFirstOrThrow({
      where: { id: parsed.ruleProfileId, active: true },
    }),
  ]);
  if (
    profile.jurisdictionId &&
    profile.jurisdictionId !== parsed.jurisdictionId
  )
    throw new Error(
      "The selected jurisdiction does not match that compliance profile.",
    );
  const jurisdiction = await db.jurisdiction.findUniqueOrThrow({
    where: { id: parsed.jurisdictionId },
  });
  const internalJobNumber = `JOB-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
  const system = await db.$transaction(async (tx) => {
    const created = await tx.coolingTowerSystem.create({
      data: {
        buildingId: building.id,
        jurisdictionId: jurisdiction.id,
        ruleProfileId: profile.id,
        internalJobNumber,
        systemName: parsed.systemName,
        manufacturer: parsed.manufacturer || null,
        modelNumber: parsed.modelNumber,
        serialNumber: parsed.serialNumber,
        towerLocation: parsed.towerLocation,
        tonnage: parsed.tonnage,
        operatingStatus: "UNKNOWN",
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: "CoolingTowerSystem",
        entityId: created.id,
        action: "CREATED",
        reason: "Customer onboarding step 2",
        changedById: user.id,
        newValue: {
          customerId: parsed.customerId,
          buildingId: building.id,
          systemName: parsed.systemName,
          manufacturer: parsed.manufacturer || null,
          modelNumber: parsed.modelNumber,
          serialNumber: parsed.serialNumber,
          towerLocation: parsed.towerLocation,
          tonnage: parsed.tonnage,
          jurisdictionId: jurisdiction.id,
          ruleProfileId: profile.id,
          internalJobNumber,
        },
      },
    });
    return created;
  });
  revalidatePath("/");
  revalidatePath("/customers");
  redirect(`/systems/${system.id}?created=1`);
}

export async function updateCustomerTowerAction(formData: FormData) {
  const user = await requireRole([
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.SCHEDULER,
  ]);
  const parsed = z
    .object({
      systemId: z.string().min(1),
      customerName: z.string().trim().min(2),
      streetAddress: z.string().trim().min(3),
      addressLine2: z.string().trim().optional(),
      city: z.string().trim().min(2),
      state: z.string().trim().length(2),
      postalCode: z.string().trim().min(5).max(10),
      systemName: z.string().trim().min(1),
      manufacturer: z.string().trim().optional(),
      modelNumber: z.string().trim().optional(),
      serialNumber: z.string().trim().optional(),
      towerLocation: z.string().trim().optional(),
      tonnage: z.preprocess(
        (value) => (value === "" ? undefined : value),
        z.coerce.number().positive().optional(),
      ),
      jurisdictionId: z.string().min(1),
      ruleProfileId: z.string().min(1),
      reason: z.string().trim().min(8).max(2000),
    })
    .parse(Object.fromEntries(formData));
  const [existing, profile, jurisdiction] = await Promise.all([
    db.coolingTowerSystem.findFirstOrThrow({
      where: {
        id: parsed.systemId,
        building: { customer: { organizationId: user.organizationId } },
      },
      include: { building: { include: { customer: true } } },
    }),
    db.ruleProfile.findFirstOrThrow({
      where: { id: parsed.ruleProfileId, active: true },
    }),
    db.jurisdiction.findUniqueOrThrow({
      where: { id: parsed.jurisdictionId },
    }),
  ]);
  if (profile.jurisdictionId && profile.jurisdictionId !== jurisdiction.id)
    throw new Error(
      "The selected jurisdiction does not match that compliance profile.",
    );
  const state = parsed.state.toUpperCase();
  const buildingName =
    existing.building.buildingName === existing.building.customer.name
      ? parsed.customerName
      : existing.building.buildingName;
  await db.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: existing.building.customerId },
      data: { name: parsed.customerName },
    });
    await tx.building.update({
      where: { id: existing.buildingId },
      data: {
        buildingName,
        streetAddress: parsed.streetAddress,
        addressLine2: parsed.addressLine2 || null,
        city: parsed.city,
        state,
        postalCode: parsed.postalCode,
        routeZone: `${parsed.city}, ${state}`,
      },
    });
    await tx.coolingTowerSystem.update({
      where: { id: existing.id },
      data: {
        systemName: parsed.systemName,
        manufacturer: parsed.manufacturer || null,
        modelNumber: parsed.modelNumber || null,
        serialNumber: parsed.serialNumber || null,
        towerLocation: parsed.towerLocation || null,
        tonnage: parsed.tonnage ?? null,
        jurisdictionId: jurisdiction.id,
        ruleProfileId: profile.id,
      },
    });
    await rebuildSystemComplianceProjections(tx, existing.id);
    await tx.auditLog.createMany({
      data: [
        {
          entityType: "Customer",
          entityId: existing.building.customerId,
          action: "UPDATED",
          reason: parsed.reason,
          changedById: user.id,
          previousValue: { name: existing.building.customer.name },
          newValue: { name: parsed.customerName },
        },
        {
          entityType: "Building",
          entityId: existing.buildingId,
          action: "UPDATED",
          reason: parsed.reason,
          changedById: user.id,
          previousValue: {
            streetAddress: existing.building.streetAddress,
            addressLine2: existing.building.addressLine2,
            city: existing.building.city,
            state: existing.building.state,
            postalCode: existing.building.postalCode,
          },
          newValue: {
            streetAddress: parsed.streetAddress,
            addressLine2: parsed.addressLine2 || null,
            city: parsed.city,
            state,
            postalCode: parsed.postalCode,
          },
        },
        {
          entityType: "CoolingTowerSystem",
          entityId: existing.id,
          action: "UPDATED",
          reason: parsed.reason,
          changedById: user.id,
          previousValue: {
            systemName: existing.systemName,
            manufacturer: existing.manufacturer,
            modelNumber: existing.modelNumber,
            serialNumber: existing.serialNumber,
            towerLocation: existing.towerLocation,
            tonnage: existing.tonnage,
            jurisdictionId: existing.jurisdictionId,
            ruleProfileId: existing.ruleProfileId,
          },
          newValue: {
            systemName: parsed.systemName,
            manufacturer: parsed.manufacturer || null,
            modelNumber: parsed.modelNumber || null,
            serialNumber: parsed.serialNumber || null,
            towerLocation: parsed.towerLocation || null,
            tonnage: parsed.tonnage ?? null,
            jurisdictionId: jurisdiction.id,
            ruleProfileId: profile.id,
          },
        },
      ],
    });
  });
  revalidatePath("/");
  revalidatePath("/customers");
  revalidatePath(`/systems/${existing.id}`);
  redirect(`/systems/${existing.id}?updated=1`);
}
