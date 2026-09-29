"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ActivityType,
  ObligationStatus,
  type Prisma,
  SourceAuthority,
  UserRole,
} from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { clearSession, requireRole } from "@/lib/auth";
import { addDays, asUtc, dateOnly, todayInTimeZone } from "@/lib/date";
import {
  completedEventsConflictOnSameDate,
  isAnnualCleaningActivity,
} from "@/lib/activity-compatibility";
import { rebuildSystemComplianceProjections } from "@/lib/obligation-projections";
import {
  parseServiceEventCommand,
  serviceEventInputFromFormData,
} from "@/lib/service-event-command";
import { DEFAULT_ROUTINE_SAMPLE_TARGET_WINDOW } from "@/lib/rules";
import { ruleSetVersion } from "@/lib/rule-profile";
import {
  profileMatchesTowerConfiguration,
  towerRuleConfigurationForJurisdiction,
  towerRuleConfigurationValues,
} from "@/lib/tower-rule-configuration";
import { serviceResponsibilityValues } from "@/lib/service-responsibility";
import { safeReturnPath, withWorkflowNotice } from "@/lib/workflow-context";

const sourceAuthorities = [
  "REGULATORY",
  "GUIDANCE",
  "COMPANY_POLICY",
  "CONTRACT_REQUIREMENT",
  "PENDING_REGULATION",
  "UNKNOWN_REQUIRES_REVIEW",
] as const;

const supportedRequirementTypes = [
  "ROUTINE_LEGIONELLA_SAMPLE",
  "ROUTINE_BACTERIOLOGICAL_SAMPLE",
  "COMPLIANCE_INSPECTION",
  "PORTAL_SAMPLE_DATE",
  "NYS_REGISTRY_REPORTING",
  "ANNUAL_CERTIFICATION",
  "SUMMERTIME_HYPERHALOGENATION",
  "ANNUAL_CLEANING",
  "STARTUP_CLEANING_DISINFECTION",
  "STARTUP_SAMPLE",
  "SHUTDOWN_REQUIREMENT",
  "POST_CLEANING_SAMPLE",
  "POST_DISINFECTION_SAMPLE",
  "CUSTOMER_RECURRING_EVENT",
  "COMPANY_POLICY_OBLIGATION",
] as const;

export async function createCustomRuleProfileAction(formData: FormData) {
  const user = await requireRole([UserRole.ADMIN]);
  const parsed = z
    .object({
      name: z.string().trim().min(3).max(160),
      effectiveDate: z.string().date(),
      description: z.string().trim().min(8).max(2000),
      reason: z.string().trim().min(8).max(2000),
    })
    .parse({
      name: String(formData.get("name") || ""),
      effectiveDate: String(formData.get("effectiveDate") || ""),
      description: String(formData.get("description") || ""),
      reason: String(formData.get("reason") || ""),
    });
  const id = `custom-${crypto.randomUUID()}`;
  await db.$transaction(async (tx) => {
    await tx.ruleProfile.create({
      data: {
        id,
        organizationId: user.organizationId,
        name: parsed.name,
        jurisdictionMode: "CUSTOM_JURISDICTION",
        effectiveStartDate: asUtc(parsed.effectiveDate),
        description: parsed.description,
        isDefault: false,
        active: true,
        legionellaIntervalDays: null,
        internalTargetIntervalDays: null,
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: "RuleProfile",
        entityId: id,
        action: "CREATED",
        reason: parsed.reason,
        changedById: user.id,
        newValue: {
          name: parsed.name,
          complianceJurisdiction: "CUSTOM",
          effectiveDate: parsed.effectiveDate,
          enabledRequirements: [],
          safetyNotice: "Company policy — verify local requirements",
        },
      },
    });
  });
  revalidatePath("/admin");
  redirect(`/admin?savedProfile=${id}&profileAction=created`);
}

export async function cloneSharedRuleProfileAction(formData: FormData) {
  const user = await requireRole([UserRole.ADMIN]);
  const parsed = z
    .object({
      profileId: z.string().min(1),
      reason: z.string().trim().min(8).max(2000),
    })
    .parse(Object.fromEntries(formData));
  const today = todayInTimeZone();
  const source = await db.ruleProfile.findFirstOrThrow({
    where: {
      id: parsed.profileId,
      organizationId: null,
      systems: {
        some: {
          building: { customer: { organizationId: user.organizationId } },
        },
      },
    },
    include: {
      rules: true,
      systems: {
        where: {
          building: { customer: { organizationId: user.organizationId } },
        },
        select: {
          id: true,
          jurisdictionId: true,
          ruleConfiguration: true,
          ruleAssignments: {
            where: { effectiveEndDate: null },
            orderBy: { effectiveStartDate: "desc" },
            take: 1,
            select: { effectiveStartDate: true },
          },
        },
      },
    },
  });
  const clonedProfileId = `org-${user.organizationId}-${crypto.randomUUID()}`;
  await db.$transaction(async (tx) => {
    await tx.ruleProfile.create({
      data: {
        id: clonedProfileId,
        organizationId: user.organizationId,
        name: `${source.name} — Organization copy`,
        jurisdictionMode: source.jurisdictionMode,
        jurisdictionId: source.jurisdictionId,
        effectiveStartDate: asUtc(today),
        description: source.description,
        isDefault: false,
        active: true,
        legionellaIntervalDays: source.legionellaIntervalDays,
        internalTargetIntervalDays: source.internalTargetIntervalDays,
        appliesToPartialOperation: source.appliesToPartialOperation,
      },
    });
    await tx.ruleDefinition.createMany({
      data: source.rules.map((rule) => ({
        id: `${clonedProfileId}-${rule.requirementType.toLowerCase().replaceAll("_", "-")}-${crypto.randomUUID().slice(0, 8)}`,
        revision: rule.revision,
        ruleProfileId: clonedProfileId,
        requirementType: rule.requirementType,
        ruleName: rule.ruleName,
        sourceAuthority: rule.sourceAuthority,
        sourceCitation: rule.sourceCitation,
        isRegulatoryRequirement: rule.isRegulatoryRequirement,
        isGuidanceRequirement: rule.isGuidanceRequirement,
        isCompanyPolicy: rule.isCompanyPolicy,
        isContractRequirement: rule.isContractRequirement,
        isPendingRegulation: rule.isPendingRegulation,
        frequencyDays: rule.frequencyDays,
        minimumDaysAfterTrigger: rule.minimumDaysAfterTrigger,
        maximumDaysAfterTrigger: rule.maximumDaysAfterTrigger,
        dueDateCalculation: rule.dueDateCalculation,
        appliesWhenOperating: rule.appliesWhenOperating,
        appliesWhenPartiallyOperating: rule.appliesWhenPartiallyOperating,
        appliesWhenSeasonal: rule.appliesWhenSeasonal,
        appliesWhenShutdown: rule.appliesWhenShutdown,
        triggerActivityType: rule.triggerActivityType,
        createsFollowUpRequirement: rule.createsFollowUpRequirement,
        followUpRequirementType: rule.followUpRequirementType,
        warningDays: rule.warningDays,
        criticalDays: rule.criticalDays,
        enabled: rule.enabled,
        notes: rule.notes,
      })),
    });
    for (const system of source.systems) {
      await tx.towerRuleAssignment.updateMany({
        where: {
          coolingTowerSystemId: system.id,
          effectiveEndDate: null,
        },
        data: {
          effectiveEndDate: asUtc(
            system.ruleAssignments[0] &&
              dateOnly(system.ruleAssignments[0].effectiveStartDate) < today
              ? addDays(today, -1)
              : today,
          ),
        },
      });
      await tx.towerRuleAssignment.create({
        data: {
          coolingTowerSystemId: system.id,
          configuration: system.ruleConfiguration,
          ruleProfileId: clonedProfileId,
          effectiveStartDate: asUtc(today),
          changedById: user.id,
          reason: parsed.reason,
        },
      });
      await tx.coolingTowerSystem.update({
        where: { id: system.id },
        data: { ruleProfileId: clonedProfileId },
      });
      await rebuildSystemComplianceProjections(tx, system.id);
    }
    await tx.auditLog.create({
      data: {
        entityType: "RuleProfile",
        entityId: clonedProfileId,
        action: "CLONED_FOR_ORGANIZATION",
        reason: parsed.reason,
        changedById: user.id,
        previousValue: { sourceProfileId: source.id },
        newValue: {
          organizationId: user.organizationId,
          assignedSystemIds: source.systems.map(({ id }) => id),
          effectiveDate: today,
        },
      },
    });
  });
  revalidatePath("/");
  revalidatePath("/admin");
  redirect(
    `/admin?savedProfile=${clonedProfileId}&profileAction=cloned#compliance-rules`,
  );
}

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
        select: { id: true },
      });
      if (!matchingObligation)
        throw new Error(
          "That reporting requirement is not available for this tower.",
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
  revalidatePath("/deadlines");
  revalidatePath(`/systems/${parsed.systemId}`);
  redirect(`/systems/${parsed.systemId}?view=settings&targetWindow=1`);
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
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
    await tx.reviewItem.updateMany({
      where: {
        entityType: "CoolingTowerSystem",
        entityId: parsed.systemId,
        title: "Operating schedule must be confirmed.",
        status: "OPEN",
      },
      data: { status: "RESOLVED", resolvedAt: new Date() },
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
  revalidatePath("/deadlines");
  revalidatePath(`/systems/${parsed.systemId}`);
  redirect(`/systems/${parsed.systemId}?view=settings&operationPattern=1`);
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
  if (existing.organizationId !== user.organizationId)
    throw new Error(
      "Shared regulatory profiles are read-only. Create an organization copy before revising this profile.",
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
      effectiveDate: z.preprocess(
        (value) => (value == null || value === "" ? null : value),
        z.string().date().nullable(),
      ),
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
      effectiveDate: formData.get("effectiveDate"),
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
          rules: true,
        },
      },
    },
  });
  if (existing.ruleProfile.organizationId !== user.organizationId)
    throw new Error(
      "Shared regulatory profiles are read-only. Create an organization copy before revising this profile.",
    );
  if (
    existing.ruleProfile.jurisdictionMode === "CUSTOM_JURISDICTION" &&
    parsed.sourceAuthority === "REGULATORY"
  )
    throw new Error(
      "Custom profile requirements must be labeled as company, customer, contract, guidance, or review—not as verified regulation.",
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
    "ROUTINE_BACTERIOLOGICAL_SAMPLE",
    "PORTAL_SAMPLE_DATE",
    "NYS_REGISTRY_REPORTING",
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
  const createCustomVersion =
    existing.ruleProfile.jurisdictionMode === "CUSTOM_JURISDICTION" &&
    existing.ruleProfile.systems.length > 0;
  if (createCustomVersion && parsed.effectiveDate !== todayInTimeZone())
    throw new Error(
      "Changing an assigned custom profile creates a new version. Use today's effective date so future requirements can be recalculated without changing the past.",
    );
  let savedRuleId = existing.id;
  await db.$transaction(async (tx) => {
    if (createCustomVersion) {
      const effectiveDate = parsed.effectiveDate as string;
      const nextProfileId = `${existing.ruleProfile.id}-v-${effectiveDate}-${crypto.randomUUID().slice(0, 8)}`;
      const clonedRules = existing.ruleProfile.rules.map((rule) => {
        const { id, ruleProfileId, createdAt, updatedAt, ...definition } = rule;
        void id;
        void ruleProfileId;
        void createdAt;
        void updatedAt;
        const nextRuleId = `${nextProfileId}-${rule.requirementType.toLowerCase().replaceAll("_", "-")}`;
        if (rule.id === existing.id) savedRuleId = nextRuleId;
        return {
          ...definition,
          id: nextRuleId,
          ...(rule.id === existing.id ? nextValue : {}),
        };
      });
      await tx.ruleProfile.create({
        data: {
          id: nextProfileId,
          organizationId: user.organizationId,
          name: existing.ruleProfile.name,
          jurisdictionMode: existing.ruleProfile.jurisdictionMode,
          jurisdictionId: existing.ruleProfile.jurisdictionId,
          effectiveStartDate: asUtc(effectiveDate),
          description: existing.ruleProfile.description,
          isDefault: existing.ruleProfile.isDefault,
          active: true,
          legionellaIntervalDays:
            existing.requirementType === "ROUTINE_LEGIONELLA_SAMPLE"
              ? parsed.frequencyDays
              : existing.ruleProfile.legionellaIntervalDays,
          internalTargetIntervalDays:
            existing.ruleProfile.internalTargetIntervalDays,
          appliesToPartialOperation:
            existing.ruleProfile.appliesToPartialOperation,
          rules: { create: clonedRules },
        },
      });
      await tx.ruleProfile.update({
        where: { id: existing.ruleProfile.id },
        data: {
          active: false,
          effectiveEndDate: asUtc(addDays(effectiveDate, -1)),
        },
      });
      await tx.coolingTowerSystem.updateMany({
        where: { id: { in: existing.ruleProfile.systems.map(({ id }) => id) } },
        data: { ruleProfileId: nextProfileId },
      });
      await tx.auditLog.create({
        data: {
          entityType: "RuleProfile",
          entityId: nextProfileId,
          action: "VERSION_CREATED",
          reason: parsed.reason,
          changedById: user.id,
          previousValue: {
            profileId: existing.ruleProfile.id,
            effectiveStartDate: existing.ruleProfile.effectiveStartDate,
            ruleSetVersion: ruleSetVersion(existing.ruleProfile),
          },
          newValue: {
            profileId: nextProfileId,
            effectiveDate,
            revisedRuleId: savedRuleId,
          },
        },
      });
    } else {
      await tx.ruleDefinition.update({
        where: { id: existing.id },
        data: nextValue,
      });
      if (existing.requirementType === "ROUTINE_LEGIONELLA_SAMPLE")
        await tx.ruleProfile.update({
          where: { id: existing.ruleProfileId },
          data: { legionellaIntervalDays: parsed.frequencyDays },
        });
    }
    for (const system of existing.ruleProfile.systems)
      await rebuildSystemComplianceProjections(tx, system.id);
    await tx.auditLog.create({
      data: {
        entityType: "RuleDefinition",
        entityId: savedRuleId,
        action: createCustomVersion ? "CREATED_IN_NEW_VERSION" : "REVISED",
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
  redirect(`/admin?savedRule=${savedRuleId}`);
}

export async function createRuleDefinitionAction(formData: FormData) {
  const user = await requireRole([UserRole.ADMIN]);
  const parsed = z
    .object({
      profileId: z.string().min(1),
      requirementType: z.enum(supportedRequirementTypes),
      ruleName: z.string().trim().min(3).max(200),
      sourceAuthority: z.enum(sourceAuthorities),
      sourceCitation: z.string().trim().min(3).max(2000),
      triggerActivityType: z.preprocess(
        (value) => (value == null || value === "" ? null : value),
        z.nativeEnum(ActivityType).nullable(),
      ),
      frequencyDays: optionalRuleInteger,
      minimumDaysAfterTrigger: optionalRuleInteger,
      maximumDaysAfterTrigger: optionalRuleInteger,
      enabled: z.boolean(),
      notes: z.string().trim().max(4000).optional(),
      reason: z.string().trim().min(8).max(2000),
    })
    .parse({
      profileId: String(formData.get("profileId") || ""),
      requirementType: String(formData.get("requirementType") || ""),
      ruleName: String(formData.get("ruleName") || ""),
      sourceAuthority: String(formData.get("sourceAuthority") || ""),
      sourceCitation: String(formData.get("sourceCitation") || ""),
      triggerActivityType: formData.get("triggerActivityType"),
      frequencyDays: formData.get("frequencyDays"),
      minimumDaysAfterTrigger: formData.get("minimumDaysAfterTrigger"),
      maximumDaysAfterTrigger: formData.get("maximumDaysAfterTrigger"),
      enabled: formData.get("enabled") === "on",
      notes: String(formData.get("notes") || ""),
      reason: String(formData.get("reason") || ""),
    });

  const intervalType = [
    "ROUTINE_LEGIONELLA_SAMPLE",
    "ROUTINE_BACTERIOLOGICAL_SAMPLE",
    "COMPLIANCE_INSPECTION",
    "PORTAL_SAMPLE_DATE",
    "NYS_REGISTRY_REPORTING",
  ].includes(parsed.requirementType);
  const customTriggeredType = [
    "ANNUAL_CLEANING",
    "STARTUP_CLEANING_DISINFECTION",
    "STARTUP_SAMPLE",
    "SHUTDOWN_REQUIREMENT",
    "POST_CLEANING_SAMPLE",
    "POST_DISINFECTION_SAMPLE",
    "CUSTOMER_RECURRING_EVENT",
    "COMPANY_POLICY_OBLIGATION",
  ].includes(parsed.requirementType);
  const triggerWindowType =
    parsed.requirementType === "SUMMERTIME_HYPERHALOGENATION" ||
    (customTriggeredType && parsed.minimumDaysAfterTrigger != null);
  if (
    intervalType &&
    (parsed.frequencyDays == null || parsed.frequencyDays < 1)
  )
    throw new Error("This rule requires a hard interval of at least one day.");
  if (
    triggerWindowType &&
    (parsed.minimumDaysAfterTrigger == null ||
      parsed.maximumDaysAfterTrigger == null)
  )
    throw new Error(
      "This rule requires both minimum and maximum trigger offsets.",
    );
  if (
    parsed.minimumDaysAfterTrigger != null &&
    parsed.maximumDaysAfterTrigger != null &&
    parsed.maximumDaysAfterTrigger < parsed.minimumDaysAfterTrigger
  )
    throw new Error("The maximum trigger offset must be after the minimum.");
  if (customTriggeredType && parsed.triggerActivityType == null)
    throw new Error(
      "Custom recurring and follow-up rules require a trigger activity.",
    );
  if (
    customTriggeredType &&
    parsed.frequencyDays == null &&
    (parsed.minimumDaysAfterTrigger == null ||
      parsed.maximumDaysAfterTrigger == null)
  )
    throw new Error(
      "Custom rules require either a recurring interval or both trigger offsets.",
    );

  const profile = await db.ruleProfile.findUniqueOrThrow({
    where: { id: parsed.profileId },
    include: {
      rules: {
        where: { requirementType: parsed.requirementType },
        select: { id: true },
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
  if (profile.organizationId !== user.organizationId)
    throw new Error(
      "Shared regulatory profiles are read-only. Create an organization copy before revising this profile.",
    );
  if (
    profile.jurisdictionMode === "CUSTOM_JURISDICTION" &&
    parsed.sourceAuthority === "REGULATORY"
  )
    throw new Error(
      "Custom profile requirements must be labeled as company, customer, contract, guidance, or review—not as verified regulation.",
    );
  if (profile.rules.length)
    throw new Error(
      "This jurisdiction already has that requirement type. Edit its existing rule instead.",
    );
  if (
    parsed.requirementType === "ROUTINE_LEGIONELLA_SAMPLE" &&
    parsed.frequencyDays != null &&
    profile.internalTargetIntervalDays != null &&
    profile.internalTargetIntervalDays >= parsed.frequencyDays
  )
    throw new Error(
      "The hard interval must remain later than the internal target interval.",
    );

  const ruleId = `${profile.id}-${parsed.requirementType.toLowerCase().replaceAll("_", "-")}-${crypto.randomUUID().slice(0, 8)}`;
  const newValue = {
    ruleProfileId: profile.id,
    requirementType: parsed.requirementType,
    ruleName: parsed.ruleName,
    sourceAuthority: parsed.sourceAuthority as SourceAuthority,
    sourceCitation: parsed.sourceCitation,
    frequencyDays: intervalType ? parsed.frequencyDays : null,
    minimumDaysAfterTrigger: triggerWindowType
      ? parsed.minimumDaysAfterTrigger
      : null,
    maximumDaysAfterTrigger: triggerWindowType
      ? parsed.maximumDaysAfterTrigger
      : null,
    triggerActivityType: customTriggeredType
      ? parsed.triggerActivityType
      : null,
    dueDateCalculation: intervalType
      ? "LAST_QUALIFYING_ACTIVITY_PLUS_FREQUENCY"
      : triggerWindowType
        ? "TRIGGER_DATE_PLUS_WINDOW"
        : customTriggeredType
          ? "TRIGGER_DATE_PLUS_FREQUENCY"
          : "CALENDAR_YEAR_REQUIREMENT",
    enabled: parsed.enabled,
    notes: parsed.notes || null,
    isRegulatoryRequirement: parsed.sourceAuthority === "REGULATORY",
    isGuidanceRequirement: parsed.sourceAuthority === "GUIDANCE",
    isCompanyPolicy: parsed.sourceAuthority === "COMPANY_POLICY",
    isContractRequirement: parsed.sourceAuthority === "CONTRACT_REQUIREMENT",
    isPendingRegulation: parsed.sourceAuthority === "PENDING_REGULATION",
  };

  await db.$transaction(async (tx) => {
    await tx.ruleDefinition.create({
      data: { id: ruleId, ...newValue },
    });
    if (parsed.requirementType === "ROUTINE_LEGIONELLA_SAMPLE")
      await tx.ruleProfile.update({
        where: { id: profile.id },
        data: { legionellaIntervalDays: parsed.frequencyDays },
      });
    for (const system of profile.systems)
      await rebuildSystemComplianceProjections(tx, system.id);
    await tx.auditLog.create({
      data: {
        entityType: "RuleDefinition",
        entityId: ruleId,
        action: "CREATED",
        reason: parsed.reason,
        changedById: user.id,
        newValue: { revision: 1, ...newValue },
      },
    });
  });

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(`/admin?savedRule=${ruleId}&ruleAction=created`);
}

export async function createCoolingTowerSystemAction(formData: FormData) {
  const user = await requireRole([UserRole.ADMIN, UserRole.OPERATIONS_MANAGER]);
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
      operatingSchedule: z.enum(["YEAR_ROUND", "SEASONAL"]),
      seasonStartMonth: z.coerce.number().int().min(1).max(12).optional(),
      seasonStartDay: z.coerce.number().int().min(1).max(31).optional(),
      seasonEndMonth: z.coerce.number().int().min(1).max(12).optional(),
      seasonEndDay: z.coerce.number().int().min(1).max(31).optional(),
      jurisdictionId: z.string().min(1),
      ruleProfileId: z.string().min(1),
      ruleConfiguration: z.enum(towerRuleConfigurationValues),
      ruleEffectiveDate: z.string().date(),
      legionellaResponsibility: z.enum(serviceResponsibilityValues),
      legionellaVendorName: z.string().trim().max(200).optional(),
    })
    .parse(Object.fromEntries(formData));
  const seasonal = parsed.operatingSchedule === "SEASONAL";
  if (
    parsed.legionellaResponsibility === "OTHER_VENDOR" &&
    !parsed.legionellaVendorName
  )
    throw new Error("Enter the Legionella vendor name.");
  const validMonthDay = (
    month: number | undefined,
    day: number | undefined,
  ) => {
    if (month == null || day == null) return false;
    const test = new Date(Date.UTC(2024, month - 1, day));
    return test.getUTCMonth() === month - 1 && test.getUTCDate() === day;
  };
  if (
    seasonal &&
    (!validMonthDay(parsed.seasonStartMonth, parsed.seasonStartDay) ||
      !validMonthDay(parsed.seasonEndMonth, parsed.seasonEndDay))
  )
    throw new Error("Season start and end dates must be valid calendar dates.");
  const [building, profile] = await Promise.all([
    db.building.findFirstOrThrow({
      where: {
        id: parsed.buildingId,
        customerId: parsed.customerId,
        customer: { organizationId: user.organizationId },
      },
    }),
    db.ruleProfile.findFirstOrThrow({
      where: {
        id: parsed.ruleProfileId,
        active: true,
        OR: [{ organizationId: null }, { organizationId: user.organizationId }],
      },
    }),
  ]);
  if (
    profile.jurisdictionId &&
    profile.jurisdictionId !== parsed.jurisdictionId
  )
    throw new Error(
      "The selected jurisdiction does not match that compliance profile.",
    );
  if (
    !profileMatchesTowerConfiguration(
      parsed.ruleConfiguration,
      profile.jurisdictionMode,
    )
  )
    throw new Error(
      "The selected profile does not match the tower compliance-rule configuration.",
    );
  const jurisdiction = await db.jurisdiction.findUniqueOrThrow({
    where: { id: parsed.jurisdictionId },
  });
  if (
    parsed.ruleConfiguration !==
    towerRuleConfigurationForJurisdiction(jurisdiction)
  )
    throw new Error(
      "The compliance program does not match the selected tower jurisdiction.",
    );
  if (
    jurisdiction.state === "NJ" &&
    profile.jurisdictionMode !== "PENDING_REGULATION"
  )
    throw new Error(
      "New Jersey towers must remain regulation-monitoring only until a verified active rule is configured.",
    );
  const internalJobNumber = `JOB-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
  const system = await db.$transaction(async (tx) => {
    const created = await tx.coolingTowerSystem.create({
      data: {
        buildingId: building.id,
        jurisdictionId: jurisdiction.id,
        ruleProfileId: profile.id,
        ruleConfiguration: parsed.ruleConfiguration,
        ruleConfigurationEffectiveDate: asUtc(parsed.ruleEffectiveDate),
        legionellaResponsibility: parsed.legionellaResponsibility,
        legionellaVendorName:
          parsed.legionellaResponsibility === "OTHER_VENDOR"
            ? parsed.legionellaVendorName
            : null,
        laboratoryResultResponsibility: parsed.legionellaResponsibility,
        bacteriologicalResponsibility: "CUSTOMER",
        inspectionResponsibility: "OUR_COMPANY",
        cleaningResponsibility: "OUR_COMPANY",
        waterTreatmentResponsibility: "OUR_COMPANY",
        regulatoryReportingResponsibility: "OUR_COMPANY",
        certificationResponsibility: "CUSTOMER",
        internalJobNumber,
        systemName: parsed.systemName,
        manufacturer: parsed.manufacturer || null,
        modelNumber: parsed.modelNumber,
        serialNumber: parsed.serialNumber,
        towerLocation: parsed.towerLocation,
        tonnage: parsed.tonnage,
        operationPeriodType: parsed.operatingSchedule,
        seasonal,
        ...(seasonal
          ? {
              seasonStartMonth: parsed.seasonStartMonth!,
              seasonStartDay: parsed.seasonStartDay!,
              seasonEndMonth: parsed.seasonEndMonth!,
              seasonEndDay: parsed.seasonEndDay!,
            }
          : {}),
        operatingStatus: "UNKNOWN",
        monthlyTargetStartDay: DEFAULT_ROUTINE_SAMPLE_TARGET_WINDOW.startDay,
        monthlyTargetEndDay: DEFAULT_ROUTINE_SAMPLE_TARGET_WINDOW.endDay,
      },
    });
    await tx.towerRuleAssignment.create({
      data: {
        coolingTowerSystemId: created.id,
        configuration: parsed.ruleConfiguration,
        ruleProfileId: profile.id,
        effectiveStartDate: asUtc(parsed.ruleEffectiveDate),
        changedById: user.id,
        reason: "Initial cooling tower compliance-rule assignment",
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
          operatingSchedule: parsed.operatingSchedule,
          ...(seasonal
            ? {
                seasonStartMonth: parsed.seasonStartMonth,
                seasonStartDay: parsed.seasonStartDay,
                seasonEndMonth: parsed.seasonEndMonth,
                seasonEndDay: parsed.seasonEndDay,
              }
            : {}),
          jurisdictionId: jurisdiction.id,
          ruleProfileId: profile.id,
          ruleConfiguration: parsed.ruleConfiguration,
          ruleEffectiveDate: parsed.ruleEffectiveDate,
          legionellaResponsibility: parsed.legionellaResponsibility,
          laboratoryResultResponsibility: parsed.legionellaResponsibility,
          bacteriologicalResponsibility: "CUSTOMER",
          inspectionResponsibility: "OUR_COMPANY",
          cleaningResponsibility: "OUR_COMPANY",
          waterTreatmentResponsibility: "OUR_COMPANY",
          regulatoryReportingResponsibility: "OUR_COMPANY",
          certificationResponsibility: "CUSTOMER",
          legionellaVendorName: parsed.legionellaVendorName || null,
          internalJobNumber,
        },
      },
    });
    return created;
  });
  revalidatePath("/");
  revalidatePath("/deadlines");
  revalidatePath("/customers");
  redirect(`/systems/${system.id}?created=1`);
}

export async function updateCustomerTowerAction(formData: FormData) {
  const user = await requireRole([UserRole.ADMIN, UserRole.OPERATIONS_MANAGER]);
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
      reason: z.string().trim().min(8).max(2000),
    })
    .parse(Object.fromEntries(formData));
  const existing = await db.coolingTowerSystem.findFirstOrThrow({
    where: {
      id: parsed.systemId,
      building: { customer: { organizationId: user.organizationId } },
    },
    include: { building: { include: { customer: true } } },
  });
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
      },
    });
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
          },
          newValue: {
            systemName: parsed.systemName,
            manufacturer: parsed.manufacturer || null,
            modelNumber: parsed.modelNumber || null,
            serialNumber: parsed.serialNumber || null,
            towerLocation: parsed.towerLocation || null,
            tonnage: parsed.tonnage ?? null,
          },
        },
      ],
    });
  });
  revalidatePath("/");
  revalidatePath("/deadlines");
  revalidatePath("/customers");
  revalidatePath(`/systems/${existing.id}`);
  redirect(`/systems/${existing.id}?view=information&updated=1`);
}

export async function changeTowerRuleConfigurationAction(formData: FormData) {
  const user = await requireRole([UserRole.ADMIN, UserRole.OPERATIONS_MANAGER]);
  const parsed = z
    .object({
      systemId: z.string().min(1),
      ruleConfiguration: z.enum(towerRuleConfigurationValues),
      ruleProfileId: z.string().min(1),
      jurisdictionId: z.string().min(1),
      effectiveDate: z.string().date(),
      reason: z.string().trim().min(8).max(2000),
      impactConfirmed: z.literal("yes"),
    })
    .parse(Object.fromEntries(formData));
  const [system, profile, jurisdiction] = await Promise.all([
    db.coolingTowerSystem.findFirstOrThrow({
      where: {
        id: parsed.systemId,
        building: { customer: { organizationId: user.organizationId } },
      },
      include: {
        ruleAssignments: {
          where: { effectiveEndDate: null },
          orderBy: { effectiveStartDate: "desc" },
          take: 1,
        },
      },
    }),
    db.ruleProfile.findFirstOrThrow({
      where: {
        id: parsed.ruleProfileId,
        active: true,
        OR: [{ organizationId: null }, { organizationId: user.organizationId }],
      },
      include: { rules: true },
    }),
    db.jurisdiction.findUniqueOrThrow({
      where: { id: parsed.jurisdictionId },
    }),
  ]);
  if (parsed.effectiveDate !== todayInTimeZone())
    throw new Error(
      "Jurisdiction and rule changes must take effect today. Future changes should be recorded when they become effective.",
    );
  if (profile.jurisdictionId && profile.jurisdictionId !== jurisdiction.id)
    throw new Error(
      "The selected compliance profile does not match the selected jurisdiction.",
    );
  if (
    !profileMatchesTowerConfiguration(
      parsed.ruleConfiguration,
      profile.jurisdictionMode,
    )
  )
    throw new Error(
      "The selected profile does not match the tower compliance-rule configuration.",
    );
  if (
    parsed.ruleConfiguration !==
    towerRuleConfigurationForJurisdiction(jurisdiction)
  )
    throw new Error(
      "The compliance program does not match the selected tower jurisdiction.",
    );
  if (
    jurisdiction.state === "NJ" &&
    profile.jurisdictionMode !== "PENDING_REGULATION"
  )
    throw new Error(
      "New Jersey towers must remain regulation-monitoring only until a verified active rule is configured.",
    );
  if (parsed.ruleConfiguration === "NYC_AND_NYS") {
    const hasNysProfile = await db.ruleProfile.count({
      where: {
        active: true,
        jurisdictionMode: "NYS_PART_4_ONLY",
        effectiveStartDate: { lte: asUtc(parsed.effectiveDate) },
        OR: [
          { effectiveEndDate: null },
          { effectiveEndDate: { gte: asUtc(parsed.effectiveDate) } },
        ],
      },
    });
    if (!hasNysProfile)
      throw new Error(
        "NYC + NYS cannot be assigned because no effective New York State base profile is available.",
      );
  }
  const current = system.ruleAssignments[0];
  if (current && parsed.effectiveDate <= dateOnly(current.effectiveStartDate))
    throw new Error(
      "The new effective date must be after the current assignment start date.",
    );
  const customNeedsReview =
    parsed.ruleConfiguration === "CUSTOM" &&
    !profile.rules.some((rule) => rule.enabled);
  await db.$transaction(async (tx) => {
    if (current)
      await tx.towerRuleAssignment.update({
        where: { id: current.id },
        data: { effectiveEndDate: asUtc(addDays(parsed.effectiveDate, -1)) },
      });
    const assignment = await tx.towerRuleAssignment.create({
      data: {
        coolingTowerSystemId: system.id,
        configuration: parsed.ruleConfiguration,
        ruleProfileId: profile.id,
        effectiveStartDate: asUtc(parsed.effectiveDate),
        requiresReview: customNeedsReview,
        changedById: user.id,
        reason: parsed.reason,
      },
    });
    await tx.coolingTowerSystem.update({
      where: { id: system.id },
      data: {
        ruleConfiguration: parsed.ruleConfiguration,
        ruleConfigurationEffectiveDate: asUtc(parsed.effectiveDate),
        ruleConfigurationConfirmed: !customNeedsReview,
        ruleProfileId: profile.id,
        jurisdictionId: jurisdiction.id,
      },
    });
    await tx.reviewItem.updateMany({
      where: {
        entityType: "CoolingTowerSystem",
        entityId: system.id,
        title: "Compliance rules must be confirmed.",
        status: "OPEN",
      },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
    if (customNeedsReview)
      await tx.reviewItem.create({
        data: {
          title: "Compliance rules must be confirmed.",
          description:
            "The selected custom profile has no enabled requirements. Configure and confirm the company or customer program before relying on generated dates.",
          entityType: "CoolingTowerSystem",
          entityId: system.id,
          severity: "PURPLE",
        },
      });
    await rebuildSystemComplianceProjections(tx, system.id);
    await tx.auditLog.create({
      data: {
        entityType: "TowerRuleAssignment",
        entityId: assignment.id,
        action: "COMPLIANCE_RULES_CHANGED",
        reason: parsed.reason,
        changedById: user.id,
        previousValue: current
          ? {
              configuration: current.configuration,
              ruleProfileId: current.ruleProfileId,
              jurisdictionId: system.jurisdictionId,
              effectiveStartDate: current.effectiveStartDate,
            }
          : undefined,
        newValue: {
          configuration: parsed.ruleConfiguration,
          ruleProfileId: profile.id,
          jurisdictionId: jurisdiction.id,
          effectiveDate: parsed.effectiveDate,
          requiresReview: customNeedsReview,
        },
      },
    });
  });
  revalidatePath("/");
  revalidatePath("/deadlines");
  revalidatePath(`/systems/${system.id}`);
  redirect(`/systems/${system.id}?view=settings&rulesChanged=1`);
}
