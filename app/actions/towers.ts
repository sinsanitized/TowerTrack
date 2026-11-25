"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { addDays, asUtc, dateOnly, todayInTimeZone } from "@/lib/date";
import { db } from "@/lib/db";
import { rebuildSystemComplianceProjections } from "@/lib/obligation-projections";
import { DEFAULT_ROUTINE_SAMPLE_TARGET_WINDOW } from "@/lib/rules";
import { serviceResponsibilityValues } from "@/lib/service-responsibility";
import {
  profileMatchesTowerConfiguration,
  towerRuleConfigurationForJurisdiction,
  towerRuleConfigurationValues,
} from "@/lib/tower-rule-configuration";

export async function createCoolingTowerSystemAction(formData: FormData) {
  const user = await requireRole([UserRole.ADMIN, UserRole.OPERATIONS_MANAGER]);
  const parsed = z
    .object({
      customerId: z.string().min(1),
      buildingId: z.string().min(1),
      systemName: z.string().trim().min(1),
      manufacturer: z.string().trim().optional(),
      modelNumber: z.string().trim().optional(),
      serialNumber: z.string().trim().optional(),
      towerLocation: z.string().trim().min(2),
      tonnage: z.preprocess(
        (value) => (value === "" ? undefined : value),
        z.coerce.number().positive().optional(),
      ),
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
        modelNumber: parsed.modelNumber || null,
        serialNumber: parsed.serialNumber || null,
        towerLocation: parsed.towerLocation,
        tonnage: parsed.tonnage ?? null,
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
          modelNumber: parsed.modelNumber || null,
          serialNumber: parsed.serialNumber || null,
          towerLocation: parsed.towerLocation,
          tonnage: parsed.tonnage ?? null,
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
