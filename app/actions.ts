"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ActivityType, SourceAuthority, UserRole } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { clearSession, requireRole } from "@/lib/auth";
import { addDays, asUtc, dateOnly, todayInTimeZone } from "@/lib/date";
import { rebuildSystemComplianceProjections } from "@/lib/obligation-projections";
import { ruleSetVersion } from "@/lib/rule-profile";
import { scopedSystem } from "@/app/actions/shared";

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
            select: { id: true, effectiveStartDate: true },
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
      const currentAssignment = system.ruleAssignments[0];
      if (
        currentAssignment &&
        dateOnly(currentAssignment.effectiveStartDate) === today
      )
        await tx.towerRuleAssignment.update({
          where: { id: currentAssignment.id },
          data: {
            configuration: system.ruleConfiguration,
            ruleProfileId: clonedProfileId,
            changedById: user.id,
            reason: parsed.reason,
          },
        });
      else {
        await tx.towerRuleAssignment.updateMany({
          where: {
            coolingTowerSystemId: system.id,
            effectiveEndDate: null,
          },
          data: { effectiveEndDate: asUtc(addDays(today, -1)) },
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
      }
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
