"use server";

import { ActivityStatus, UserRole, VisitStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { asUtc, dateOnly, todayDateOnly } from "@/lib/date";
import { db } from "@/lib/db";
import { cleaningGapMessage, shiftCleaningDate } from "@/lib/cleaning-schedule";
import { rebuildSystemComplianceProjections } from "@/lib/obligation-projections";

const schedulingRoles = [
  UserRole.ADMIN,
  UserRole.OPERATIONS_MANAGER,
  UserRole.SCHEDULER,
];

const createSchema = z.object({
  buildingId: z.string().min(1),
  scopeMode: z.enum(["ALL_TOWERS", "SELECTED_TOWERS"]),
  towerIds: z.array(z.string().min(1)).min(1),
  addDate: z.string().date(),
  cleaningDate: z.string().date(),
  assignedTechnicianId: z.string().optional(),
  notes: z.string().trim().max(2000).optional(),
});

function scheduleRefresh(jobId?: string) {
  revalidatePath("/");
  revalidatePath("/calendar");
  if (jobId) revalidatePath(`/calendar/jobs/${jobId}`);
}

export async function createCleaningJobAction(formData: FormData) {
  const user = await requireRole(schedulingRoles);
  const parsed = createSchema.parse({
    buildingId: formData.get("buildingId"),
    scopeMode: formData.get("scopeMode"),
    towerIds: formData.getAll("towerIds"),
    addDate: formData.get("addDate"),
    cleaningDate: formData.get("cleaningDate"),
    assignedTechnicianId:
      String(formData.get("assignedTechnicianId") || "") || undefined,
    notes: String(formData.get("notes") || "") || undefined,
  });

  const building = await db.building.findFirstOrThrow({
    where: {
      id: parsed.buildingId,
      active: true,
      deletedAt: null,
      customer: { organizationId: user.organizationId },
    },
    include: {
      systems: {
        where: { active: true, deletedAt: null },
        select: {
          id: true,
          systemName: true,
          ruleProfileId: true,
        },
      },
    },
  });
  const requested = new Set(parsed.towerIds);
  const towers = building.systems.filter((tower) => requested.has(tower.id));
  if (towers.length !== requested.size)
    throw new Error("Every selected tower must belong to this building.");
  if (
    parsed.scopeMode === "ALL_TOWERS" &&
    towers.length !== building.systems.length
  )
    throw new Error(
      "All active towers must be selected for an all-towers job.",
    );

  const technicianId = parsed.assignedTechnicianId || null;
  if (technicianId) {
    await db.user.findFirstOrThrow({
      where: {
        id: technicianId,
        organizationId: user.organizationId,
        active: true,
        role: { in: [UserRole.TECHNICIAN, UserRole.OPERATIONS_MANAGER] },
      },
    });
  }

  const job = await db.$transaction(async (tx) => {
    const addVisit = await tx.visit.create({
      data: {
        buildingId: building.id,
        scheduledDate: asUtc(parsed.addDate),
        assignedTechnicianId: technicianId,
        estimatedMinutes: building.defaultVisitMinutes,
        notes: parsed.notes || null,
        createdById: user.id,
        activities: {
          create: towers.map((tower) => ({
            coolingTowerSystemId: tower.id,
            activityType: "OTHER",
            scheduledDate: asUtc(parsed.addDate),
            ruleProfileId: tower.ruleProfileId,
            sourceAuthority: "COMPANY_POLICY",
            details: { cleaningPhase: "ADD" },
          })),
        },
      },
    });
    const cleaningVisit = await tx.visit.create({
      data: {
        buildingId: building.id,
        scheduledDate: asUtc(parsed.cleaningDate),
        assignedTechnicianId: technicianId,
        estimatedMinutes: building.defaultVisitMinutes,
        notes: parsed.notes || null,
        createdById: user.id,
        activities: {
          create: towers.map((tower) => ({
            coolingTowerSystemId: tower.id,
            activityType: "ROUTINE_CLEANING",
            scheduledDate: asUtc(parsed.cleaningDate),
            qualifiesForCleaning: true,
            ruleProfileId: tower.ruleProfileId,
            sourceAuthority: "COMPANY_POLICY",
            details: { cleaningPhase: "CLEAN" },
          })),
        },
      },
    });
    const created = await tx.cleaningJob.create({
      data: {
        buildingId: building.id,
        addVisitId: addVisit.id,
        cleaningVisitId: cleaningVisit.id,
        scopeMode: parsed.scopeMode,
        notes: parsed.notes || null,
        createdById: user.id,
        towers: {
          create: towers.map((tower) => ({
            coolingTowerSystemId: tower.id,
            systemNameSnapshot: tower.systemName,
          })),
        },
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: "CleaningJob",
        entityId: created.id,
        action: "CREATED",
        reason: "Scheduled linked chemical-add and cleaning visits",
        changedById: user.id,
        newValue: {
          buildingId: building.id,
          towerIds: towers.map((tower) => tower.id),
          scopeMode: parsed.scopeMode,
          addDate: parsed.addDate,
          cleaningDate: parsed.cleaningDate,
          timingReview: cleaningGapMessage(parsed.addDate, parsed.cleaningDate),
          assignedTechnicianId: technicianId,
        },
      },
    });
    return created;
  });
  scheduleRefresh(job.id);
  redirect(`/calendar?job=${job.id}&saved=1`);
}

export async function updateCleaningJobAction(formData: FormData) {
  const user = await requireRole(schedulingRoles);
  const parsed = z
    .object({
      jobId: z.string().min(1),
      addDate: z.string().date(),
      cleaningDate: z.string().date(),
      shiftCleaning: z.enum(["yes", "no"]).default("no"),
      assignedTechnicianId: z.string().optional(),
      notes: z.string().trim().max(2000).optional(),
    })
    .parse({
      ...Object.fromEntries(formData),
      assignedTechnicianId:
        String(formData.get("assignedTechnicianId") || "") || undefined,
      notes: String(formData.get("notes") || "") || undefined,
    });
  const job = await db.cleaningJob.findFirstOrThrow({
    where: {
      id: parsed.jobId,
      building: { customer: { organizationId: user.organizationId } },
    },
    include: { addVisit: true, cleaningVisit: true },
  });
  let cleaningDate = parsed.cleaningDate;
  if (
    parsed.shiftCleaning === "yes" &&
    parsed.addDate !== dateOnly(job.addVisit.scheduledDate)
  )
    cleaningDate = shiftCleaningDate(
      dateOnly(job.addVisit.scheduledDate),
      parsed.addDate,
      dateOnly(job.cleaningVisit.scheduledDate),
    );
  const technicianId = parsed.assignedTechnicianId || null;
  if (technicianId)
    await db.user.findFirstOrThrow({
      where: {
        id: technicianId,
        organizationId: user.organizationId,
        active: true,
        role: { in: [UserRole.TECHNICIAN, UserRole.OPERATIONS_MANAGER] },
      },
    });
  await db.$transaction(async (tx) => {
    await tx.visit.update({
      where: { id: job.addVisitId },
      data: {
        scheduledDate: asUtc(parsed.addDate),
        assignedTechnicianId: technicianId,
        notes: parsed.notes || null,
        activities: {
          updateMany: {
            where: {},
            data: { scheduledDate: asUtc(parsed.addDate) },
          },
        },
      },
    });
    await tx.visit.update({
      where: { id: job.cleaningVisitId },
      data: {
        scheduledDate: asUtc(cleaningDate),
        assignedTechnicianId: technicianId,
        notes: parsed.notes || null,
        activities: {
          updateMany: {
            where: {},
            data: { scheduledDate: asUtc(cleaningDate) },
          },
        },
      },
    });
    await tx.cleaningJob.update({
      where: { id: job.id },
      data: { notes: parsed.notes || null },
    });
    await tx.auditLog.create({
      data: {
        entityType: "CleaningJob",
        entityId: job.id,
        action: "RESCHEDULED",
        reason: "Updated linked cleaning-job schedule",
        changedById: user.id,
        previousValue: {
          addDate: dateOnly(job.addVisit.scheduledDate),
          cleaningDate: dateOnly(job.cleaningVisit.scheduledDate),
        },
        newValue: {
          addDate: parsed.addDate,
          cleaningDate,
          shiftedTogether: parsed.shiftCleaning === "yes",
          timingReview: cleaningGapMessage(parsed.addDate, cleaningDate),
        },
      },
    });
  });
  scheduleRefresh(job.id);
  redirect(`/calendar?job=${job.id}&updated=1`);
}

export async function completeAddVisitAction(formData: FormData) {
  const user = await requireRole([
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.SCHEDULER,
    UserRole.TECHNICIAN,
  ]);
  const parsed = z
    .object({
      jobId: z.string().min(1),
      completionDate: z.string().date(),
    })
    .parse(Object.fromEntries(formData));
  if (parsed.completionDate > todayDateOnly())
    throw new Error(
      "Actual chemical addition cannot be recorded in the future.",
    );
  const job = await db.cleaningJob.findFirstOrThrow({
    where: {
      id: parsed.jobId,
      building: { customer: { organizationId: user.organizationId } },
    },
    include: { addVisit: true },
  });
  if (job.addVisit.status === VisitStatus.COMPLETED) {
    scheduleRefresh(job.id);
    redirect(`/calendar?job=${job.id}`);
  }
  await db.$transaction(async (tx) => {
    await tx.visit.update({
      where: { id: job.addVisitId },
      data: {
        status: VisitStatus.COMPLETED,
        performedDate: asUtc(parsed.completionDate),
        activities: {
          updateMany: {
            where: { status: ActivityStatus.PLANNED },
            data: {
              status: ActivityStatus.COMPLETED,
              performedDate: asUtc(parsed.completionDate),
            },
          },
        },
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: "CleaningJob",
        entityId: job.id,
        action: "ADD_VISIT_COMPLETED",
        reason: "Chemical-add field visit completed",
        changedById: user.id,
        newValue: { performedDate: parsed.completionDate },
      },
    });
  });
  scheduleRefresh(job.id);
  redirect(`/calendar?job=${job.id}`);
}

export async function completeCleaningTowersAction(formData: FormData) {
  const user = await requireRole([
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.SCHEDULER,
    UserRole.TECHNICIAN,
  ]);
  const parsed = z
    .object({
      jobId: z.string().min(1),
      systemIds: z.array(z.string().min(1)).min(1),
      completionDate: z.string().date(),
    })
    .parse({
      jobId: formData.get("jobId"),
      systemIds: formData.getAll("systemIds"),
      completionDate: formData.get("completionDate"),
    });
  if (parsed.completionDate > todayDateOnly())
    throw new Error("Actual cleaning cannot be recorded in the future.");

  const targets = await db.cleaningJobTower.findMany({
    where: {
      cleaningJobId: parsed.jobId,
      coolingTowerSystemId: { in: parsed.systemIds },
      cleaningJob: {
        building: { customer: { organizationId: user.organizationId } },
      },
    },
    include: { cleaningJob: true },
  });
  if (targets.length !== new Set(parsed.systemIds).size)
    throw new Error("Every selected tower must belong to this cleaning job.");
  if (targets.some((target) => target.completedByServiceEventId))
    throw new Error(
      "One or more selected towers already has a cleaning record.",
    );

  await db.$transaction(async (tx) => {
    for (const target of targets) {
      const event = await tx.serviceEvent.create({
        data: {
          coolingTowerSystemId: target.coolingTowerSystemId,
          eventType: "CLEANING_COMPLETED",
          eventDate: asUtc(parsed.completionDate),
          details: { cleaningJobId: parsed.jobId },
          notes: "Completed from linked cleaning schedule",
          recordedById: user.id,
        },
      });
      await tx.cleaningJobTower.update({
        where: { id: target.id },
        data: { completedByServiceEventId: event.id },
      });
      await tx.visitActivity.updateMany({
        where: {
          visitId: target.cleaningJob.cleaningVisitId,
          coolingTowerSystemId: target.coolingTowerSystemId,
          status: ActivityStatus.PLANNED,
        },
        data: {
          status: ActivityStatus.COMPLETED,
          performedDate: asUtc(parsed.completionDate),
        },
      });
      const projection = await rebuildSystemComplianceProjections(
        tx,
        target.coolingTowerSystemId,
      );
      await tx.auditLog.create({
        data: {
          entityType: "CleaningJobTower",
          entityId: target.id,
          action: "CLEANING_COMPLETED",
          reason: "Recorded actual cleaning from linked cleaning job",
          changedById: user.id,
          newValue: {
            cleaningJobId: parsed.jobId,
            systemId: target.coolingTowerSystemId,
            completionDate: parsed.completionDate,
            serviceEventId: event.id,
            generated: projection,
          },
        },
      });
    }

    const cleaningVisitId = targets[0].cleaningJob.cleaningVisitId;
    const remaining = await tx.visitActivity.count({
      where: {
        visitId: cleaningVisitId,
        status: ActivityStatus.PLANNED,
      },
    });
    if (remaining === 0)
      await tx.visit.update({
        where: { id: cleaningVisitId },
        data: {
          status: VisitStatus.COMPLETED,
          performedDate: asUtc(parsed.completionDate),
        },
      });
  });

  scheduleRefresh(parsed.jobId);
  for (const systemId of parsed.systemIds)
    revalidatePath(`/systems/${systemId}`);
  redirect(`/calendar?job=${parsed.jobId}&completed=1`);
}

export async function completeCleaningTowerAction(formData: FormData) {
  const user = await requireRole([
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.SCHEDULER,
    UserRole.TECHNICIAN,
  ]);
  const parsed = z
    .object({
      jobId: z.string().min(1),
      systemId: z.string().min(1),
      completionDate: z.string().date(),
    })
    .parse(Object.fromEntries(formData));
  if (parsed.completionDate > todayDateOnly())
    throw new Error("Actual cleaning cannot be recorded in the future.");
  const target = await db.cleaningJobTower.findFirstOrThrow({
    where: {
      cleaningJobId: parsed.jobId,
      coolingTowerSystemId: parsed.systemId,
      cleaningJob: {
        building: { customer: { organizationId: user.organizationId } },
      },
    },
    include: { cleaningJob: true },
  });
  if (target.completedByServiceEventId) {
    scheduleRefresh(parsed.jobId);
    redirect(`/calendar?job=${parsed.jobId}`);
  }
  await db.$transaction(async (tx) => {
    const event = await tx.serviceEvent.create({
      data: {
        coolingTowerSystemId: parsed.systemId,
        eventType: "CLEANING_COMPLETED",
        eventDate: asUtc(parsed.completionDate),
        details: { cleaningJobId: parsed.jobId },
        notes: "Completed from linked cleaning schedule",
        recordedById: user.id,
      },
    });
    await tx.cleaningJobTower.update({
      where: { id: target.id },
      data: { completedByServiceEventId: event.id },
    });
    await tx.visitActivity.updateMany({
      where: {
        visitId: target.cleaningJob.cleaningVisitId,
        coolingTowerSystemId: parsed.systemId,
        status: ActivityStatus.PLANNED,
      },
      data: {
        status: ActivityStatus.COMPLETED,
        performedDate: asUtc(parsed.completionDate),
      },
    });
    const remaining = await tx.visitActivity.count({
      where: {
        visitId: target.cleaningJob.cleaningVisitId,
        status: ActivityStatus.PLANNED,
      },
    });
    if (remaining === 0)
      await tx.visit.update({
        where: { id: target.cleaningJob.cleaningVisitId },
        data: {
          status: VisitStatus.COMPLETED,
          performedDate: asUtc(parsed.completionDate),
        },
      });
    const projection = await rebuildSystemComplianceProjections(
      tx,
      parsed.systemId,
    );
    await tx.auditLog.create({
      data: {
        entityType: "CleaningJobTower",
        entityId: target.id,
        action: "CLEANING_COMPLETED",
        reason: "Recorded actual cleaning from linked cleaning job",
        changedById: user.id,
        newValue: {
          cleaningJobId: parsed.jobId,
          systemId: parsed.systemId,
          completionDate: parsed.completionDate,
          serviceEventId: event.id,
          generated: projection,
        },
      },
    });
  });
  scheduleRefresh(parsed.jobId);
  revalidatePath(`/systems/${parsed.systemId}`);
  redirect(`/calendar?job=${parsed.jobId}&completed=1`);
}

export async function cancelCleaningJobAction(formData: FormData) {
  const user = await requireRole(schedulingRoles);
  const parsed = z
    .object({
      jobId: z.string().min(1),
      cancel: z.enum(["BOTH", "ADD_ONLY", "CLEAN_ONLY"]),
      reason: z.string().trim().min(8).max(1000),
    })
    .parse(Object.fromEntries(formData));
  const job = await db.cleaningJob.findFirstOrThrow({
    where: {
      id: parsed.jobId,
      building: { customer: { organizationId: user.organizationId } },
    },
  });
  const cancelAdd = parsed.cancel !== "CLEAN_ONLY";
  const cancelClean = parsed.cancel !== "ADD_ONLY";
  await db.$transaction(async (tx) => {
    if (cancelAdd)
      await tx.visit.update({
        where: { id: job.addVisitId },
        data: {
          status: VisitStatus.CANCELLED,
          activities: {
            updateMany: {
              where: {},
              data: { status: ActivityStatus.CANCELLED },
            },
          },
        },
      });
    if (cancelClean)
      await tx.visit.update({
        where: { id: job.cleaningVisitId },
        data: {
          status: VisitStatus.CANCELLED,
          activities: {
            updateMany: {
              where: {},
              data: { status: ActivityStatus.CANCELLED },
            },
          },
        },
      });
    await tx.cleaningJob.update({
      where: { id: job.id },
      data: { cancelledAt: parsed.cancel === "BOTH" ? new Date() : null },
    });
    await tx.auditLog.create({
      data: {
        entityType: "CleaningJob",
        entityId: job.id,
        action: "VISIT_CANCELLED",
        reason: parsed.reason,
        changedById: user.id,
        newValue: { cancelled: parsed.cancel },
      },
    });
  });
  scheduleRefresh(job.id);
  redirect("/calendar?cancelled=1");
}
