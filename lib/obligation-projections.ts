import type { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { asUtc, dateOnly, todayDateOnly } from "@/lib/date";
import {
  annualSummertimeHyperhalogenationObligation,
  annualCleaningProgress,
  canSampleSatisfyObligation,
  obligationPriorityForDate,
  projectEventObligations,
  type ProjectedObligation,
  type ProjectionPriority,
  type RegulatoryEventInput,
} from "@/lib/obligation-engine";
import { compileTowerRuleConfig } from "@/lib/rule-profile";
import { getComplianceStatus } from "@/lib/compliance-intelligence";

type Tx = Prisma.TransactionClient;

type ObligationCategory =
  "SAMPLE" | "INSPECTION" | "MAINTENANCE" | "REPORTING_ACTION";

export function projectionObligationId(
  category: ObligationCategory,
  triggerEventId: string,
  obligationType: string,
) {
  const digest = createHash("sha256")
    .update(`${category}:${triggerEventId}:${obligationType}`)
    .digest("hex")
    .slice(0, 24);
  return `obl_${digest}`;
}

function detailNumber(details: Prisma.JsonValue | null, key: string) {
  if (!details || Array.isArray(details) || typeof details !== "object")
    return null;
  const value = details[key];
  return typeof value === "number" ? value : null;
}

function detailBoolean(details: Prisma.JsonValue | null, key: string) {
  if (!details || Array.isArray(details) || typeof details !== "object")
    return null;
  const value = details[key];
  return typeof value === "boolean" ? value : null;
}

function detailString(details: Prisma.JsonValue | null, key: string) {
  if (!details || Array.isArray(details) || typeof details !== "object")
    return null;
  const value = details[key];
  return typeof value === "string" ? value : null;
}

function obligationData(
  obligation: ProjectedObligation,
  systemId: string,
  today: string,
  category: ObligationCategory,
  previouslyMissedIds: ReadonlySet<string> = new Set(),
) {
  const id = projectionObligationId(
    category,
    obligation.triggerEventId,
    obligation.obligationType,
  );
  return {
    id,
    coolingTowerSystemId: systemId,
    triggerEventId: obligation.triggerEventId,
    earliestDueDate: obligation.earliestDueDate
      ? asUtc(obligation.earliestDueDate)
      : null,
    targetStartDate: obligation.targetStartDate
      ? asUtc(obligation.targetStartDate)
      : null,
    targetEndDate: obligation.targetEndDate
      ? asUtc(obligation.targetEndDate)
      : null,
    latestDueDate: obligation.latestDueDate
      ? asUtc(obligation.latestDueDate)
      : null,
    status: previouslyMissedIds.has(id)
      ? ("MISSED" as const)
      : obligation.latestDueDate && obligation.latestDueDate < today
        ? ("OVERDUE" as const)
        : ("PENDING" as const),
    priority: obligationPriorityForDate({
      today,
      latestDueDate: obligation.latestDueDate,
      current: obligation.priority,
    }),
    reason: obligation.reason,
    ruleSetVersion: obligation.ruleSetVersion,
    sourceCitation: obligation.sourceCitation,
  };
}

async function completeCoveredSamples(
  tx: Tx,
  systemId: string,
  eventId: string,
  collectionDate: string,
) {
  const open = await tx.sampleObligation.findMany({
    where: {
      coolingTowerSystemId: systemId,
      status: { in: ["PENDING", "SCHEDULED", "OVERDUE"] },
    },
  });
  const covered = open.filter((obligation) =>
    canSampleSatisfyObligation(collectionDate, {
      earliestDueDate: obligation.earliestDueDate
        ? dateOnly(obligation.earliestDueDate)
        : null,
      latestDueDate: obligation.latestDueDate
        ? dateOnly(obligation.latestDueDate)
        : null,
    }),
  );
  if (covered.length)
    await tx.sampleObligation.updateMany({
      where: { id: { in: covered.map(({ id }) => id) } },
      data: { status: "COMPLETED", completedByEventId: eventId },
    });
}

function statusFromOpen(
  today: string,
  open: Array<{
    latestDueDate: Date | null;
    priority: ProjectionPriority;
    reason: string;
  }>,
  operating: boolean,
) {
  if (!operating)
    return {
      risk: "INACTIVE" as const,
      plainEnglishStatus: "Inactive",
      explanation: "Routine operating obligations are paused while shut down.",
    };
  const status = getComplianceStatus(
    open.map((item, index) => ({
      id: `projection-${index}`,
      type: "GENERATED_OBLIGATION",
      category: "REPORTING_ACTION" as const,
      earliest: null,
      targetStart: null,
      targetEnd: null,
      latest: item.latestDueDate ? dateOnly(item.latestDueDate) : null,
      priority: item.priority,
      status: "PENDING",
      reason: item.reason,
    })),
    today,
  );
  const risk = status.reason.startsWith("Overdue:")
    ? ("OVERDUE" as const)
    : status.health === "CRITICAL" || status.health === "AT_RISK"
      ? ("CRITICAL" as const)
      : status.health === "ATTENTION"
        ? ("WARNING" as const)
        : ("GOOD" as const);
  return {
    risk,
    plainEnglishStatus: status.label,
    explanation: status.reason,
  };
}

export async function rebuildSystemComplianceProjections(
  tx: Tx,
  systemId: string,
  today = todayDateOnly(),
) {
  await tx.$queryRaw<Array<{ locked: string | null }>>`
    SELECT pg_advisory_xact_lock(hashtextextended(${systemId}, 0))::text AS locked
  `;
  const system = await tx.coolingTowerSystem.findUniqueOrThrow({
    where: { id: systemId },
    include: {
      ruleProfile: {
        include: { rules: true },
      },
      serviceEvents: {
        where: { status: "ACTIVE" },
        orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  const recordedSamples = await tx.serviceEvent.findMany({
    where: {
      coolingTowerSystemId: systemId,
      eventType: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
    },
    orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }],
  });
  const priorMissedRows = await Promise.all([
    tx.sampleObligation.findMany({
      where: { coolingTowerSystemId: systemId, status: "MISSED" },
      select: { id: true },
    }),
    tx.inspectionObligation.findMany({
      where: { coolingTowerSystemId: systemId, status: "MISSED" },
      select: { id: true },
    }),
    tx.reportingObligation.findMany({
      where: { coolingTowerSystemId: systemId, status: "MISSED" },
      select: { id: true },
    }),
    tx.maintenanceObligation.findMany({
      where: { coolingTowerSystemId: systemId, status: "MISSED" },
      select: { id: true },
    }),
  ]);
  const previouslyMissedIds = new Set(
    priorMissedRows.flat().map(({ id }) => id),
  );
  await tx.sampleObligation.deleteMany({
    where: { coolingTowerSystemId: systemId },
  });
  await tx.inspectionObligation.deleteMany({
    where: { coolingTowerSystemId: systemId },
  });
  await tx.reportingObligation.deleteMany({
    where: { coolingTowerSystemId: systemId },
  });
  await tx.maintenanceObligation.deleteMany({
    where: { coolingTowerSystemId: systemId },
  });
  await tx.labResult.deleteMany({ where: { coolingTowerSystemId: systemId } });
  await tx.operatingPeriod.deleteMany({
    where: { coolingTowerSystemId: systemId },
  });

  let operating = !["FULLY_SHUT_DOWN", "SEASONALLY_INACTIVE"].includes(
    system.operatingStatus,
  );
  let openPeriodId: string | null = null;
  let latestOpenLabResultId: string | null = null;
  const usedSampleEventIds = new Set<string>();
  const ruleConfig = compileTowerRuleConfig(system.ruleProfile, {
    operating,
    monthlyTargetStartDay: system.monthlyTargetStartDay,
    monthlyTargetEndDay: system.monthlyTargetEndDay,
  });

  for (const stored of system.serviceEvents) {
    const event: RegulatoryEventInput = {
      id: stored.id,
      type: stored.eventType,
      date: dateOnly(stored.eventDate),
      timestamp: stored.eventTimestamp?.toISOString() ?? null,
      cfuPerMl: detailNumber(stored.details, "cfuPerMl"),
      residualRestoredWithin3Days: detailBoolean(
        stored.details,
        "residualRestoredWithin3Days",
      ),
      reportType: detailString(stored.details, "reportType"),
      reportingObligationId: detailString(
        stored.details,
        "reportingObligationId",
      ),
    };

    if (event.type === "STARTUP") {
      operating = true;
      const period = await tx.operatingPeriod.create({
        data: {
          coolingTowerSystemId: systemId,
          startDate: stored.eventDate,
          startupEventId: stored.id,
        },
      });
      openPeriodId = period.id;
    } else if (event.type === "SHUTDOWN") {
      operating = false;
      await tx.sampleObligation.updateMany({
        where: {
          coolingTowerSystemId: systemId,
          obligationType: "ROUTINE_OPERATING_SAMPLE",
          status: { in: ["PENDING", "SCHEDULED", "OVERDUE"] },
        },
        data: { status: "SUPERSEDED" },
      });
      if (openPeriodId)
        await tx.operatingPeriod.update({
          where: { id: openPeriodId },
          data: { endDate: stored.eventDate, shutdownEventId: stored.id },
        });
      openPeriodId = null;
    }

    if (event.type === "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED")
      await completeCoveredSamples(tx, systemId, event.id, event.date);

    if (event.type === "QUARTERLY_INSPECTION_COMPLETED") {
      const open = await tx.inspectionObligation.findMany({
        where: {
          coolingTowerSystemId: systemId,
          status: { in: ["PENDING", "SCHEDULED", "OVERDUE"] },
        },
      });
      const covered = open.filter(
        (item) =>
          (!item.earliestDueDate ||
            dateOnly(item.earliestDueDate) <= event.date) &&
          (!item.latestDueDate || dateOnly(item.latestDueDate) >= event.date),
      );
      if (covered.length)
        await tx.inspectionObligation.updateMany({
          where: { id: { in: covered.map(({ id }) => id) } },
          data: { status: "COMPLETED", completedByEventId: event.id },
        });
    }

    if (event.type === "REPORT_SUBMITTED" && event.reportType) {
      await tx.reportingObligation.updateMany({
        where: {
          coolingTowerSystemId: systemId,
          obligationType: event.reportType,
          ...(event.reportingObligationId
            ? { id: event.reportingObligationId }
            : {}),
          status: { in: ["PENDING", "SCHEDULED", "OVERDUE"] },
          earliestDueDate: { lte: stored.eventDate },
        },
        data: { status: "COMPLETED", completedByEventId: event.id },
      });
    }

    const completedFieldActionTypes =
      event.type === "HIGH_LEGIONELLA_DISINFECTION"
        ? [
            "LEVEL_2_CORRECTIVE_ACTION",
            "LEVEL_3_CORRECTIVE_ACTION",
            "LEVEL_4_CORRECTIVE_ACTION",
          ]
        : event.type === "FULL_REMEDIATION"
          ? ["LEVEL_4_FULL_REMEDIATION"]
          : [];
    if (completedFieldActionTypes.length)
      await tx.reportingObligation.updateMany({
        where: {
          coolingTowerSystemId: systemId,
          obligationType: { in: completedFieldActionTypes },
          status: { in: ["PENDING", "SCHEDULED", "OVERDUE"] },
          earliestDueDate: { lte: stored.eventDate },
          OR: [
            { latestDueDate: null },
            { latestDueDate: { gte: stored.eventDate } },
          ],
        },
        data: { status: "COMPLETED", completedByEventId: event.id },
      });

    if (
      event.type === "HIGH_LEGIONELLA_DISINFECTION" ||
      event.type === "FULL_REMEDIATION"
    ) {
      await tx.sampleObligation.updateMany({
        where: {
          coolingTowerSystemId: systemId,
          obligationType: { startsWith: "LEGIONELLA_", endsWith: "_RETEST" },
          status: { in: ["PENDING", "SCHEDULED", "OVERDUE"] },
        },
        data: { status: "SUPERSEDED" },
      });
    }

    const projection = projectEventObligations(event, {
      ...ruleConfig,
      operating,
    });
    for (const obligation of projection.sample)
      await tx.sampleObligation.create({
        data: {
          ...obligationData(
            obligation,
            systemId,
            today,
            "SAMPLE",
            previouslyMissedIds,
          ),
          obligationType: obligation.obligationType,
        },
      });
    for (const obligation of projection.inspection)
      await tx.inspectionObligation.create({
        data: obligationData(
          obligation,
          systemId,
          today,
          "INSPECTION",
          previouslyMissedIds,
        ),
      });
    for (const obligation of projection.reporting)
      await tx.reportingObligation.create({
        data: {
          ...obligationData(
            obligation,
            systemId,
            today,
            "REPORTING_ACTION",
            previouslyMissedIds,
          ),
          obligationType: obligation.obligationType,
        },
      });
    for (const obligation of projection.maintenance)
      await tx.maintenanceObligation.create({
        data: {
          ...obligationData(
            obligation,
            systemId,
            today,
            "MAINTENANCE",
            previouslyMissedIds,
          ),
          obligationType: obligation.obligationType,
        },
      });
    if (projection.labResult) {
      const explicitSampleEventId = detailString(
        stored.details,
        "sampleEventId",
      );
      const explicitSample = explicitSampleEventId
        ? recordedSamples.find(
            (candidate) =>
              candidate.id === explicitSampleEventId &&
              candidate.eventDate <= stored.eventDate,
          )
        : null;
      const sampleEventId =
        explicitSample && !usedSampleEventIds.has(explicitSample.id)
          ? explicitSample.id
          : undefined;
      if (!sampleEventId) continue;
      usedSampleEventIds.add(sampleEventId);
      const labResult: { id: string } = await tx.labResult.create({
        data: {
          coolingTowerSystemId: systemId,
          sourceEventId: stored.id,
          sampleEventId,
          cfuPerMl: projection.labResult.cfuPerMl,
          level: projection.labResult.level,
          receivedDate: stored.eventDate,
          receivedAt: asUtc(projection.labResult.receivedAt),
          parentResultId: latestOpenLabResultId,
          correctiveActionDueAt: projection.labResult.correctiveActionDueAt
            ? new Date(projection.labResult.correctiveActionDueAt)
            : null,
          remediationDueAt: projection.labResult.remediationDueAt
            ? new Date(projection.labResult.remediationDueAt)
            : null,
          chainClosed: projection.labResult.chainClosed,
        },
      });
      if (projection.labResult.chainClosed) {
        if (latestOpenLabResultId)
          await tx.labResult.update({
            where: { id: latestOpenLabResultId },
            data: { chainClosed: true },
          });
        latestOpenLabResultId = null;
      } else {
        latestOpenLabResultId = labResult.id;
      }
    }
  }

  const startupCleaningObligations = await tx.maintenanceObligation.findMany({
    where: {
      coolingTowerSystemId: systemId,
      obligationType: "STARTUP_CLEANING_DISINFECTION",
    },
  });
  const startupCleanings = system.serviceEvents.filter((event) =>
    ["STARTUP_CLEANING_DISINFECTION", "CLEANING_COMPLETED"].includes(
      event.eventType,
    ),
  );
  for (const obligation of startupCleaningObligations) {
    const qualifyingCleaning = startupCleanings.find(
      (event) =>
        (!obligation.earliestDueDate ||
          event.eventDate >= obligation.earliestDueDate) &&
        (!obligation.latestDueDate ||
          event.eventDate <= obligation.latestDueDate),
    );
    await tx.maintenanceObligation.update({
      where: { id: obligation.id },
      data: qualifyingCleaning
        ? {
            status: "COMPLETED",
            completedByEventId: qualifyingCleaning.id,
          }
        : {
            status:
              obligation.latestDueDate &&
              dateOnly(obligation.latestDueDate) <= today
                ? "OVERDUE"
                : obligation.status,
            completedByEventId: null,
          },
    });
  }

  if (
    ruleConfig.isNyc &&
    system.serviceEvents.length &&
    ruleConfig.hyperhalogenationEnabled !== false
  ) {
    const currentYear = Number(today.slice(0, 4));
    const completedThisYear = system.serviceEvents.some((item) => {
      const date = dateOnly(item.eventDate);
      return (
        item.eventType === "SUMMERTIME_HYPERHALOGENATION" &&
        date >= `${currentYear}-07-01` &&
        date <= `${currentYear}-08-31`
      );
    });
    const obligationYear = completedThisYear ? currentYear + 1 : currentYear;
    const summerStart = `${obligationYear}-07-01`;
    const summerEnd = `${obligationYear}-08-31`;
    const shutdownBeforeSummer = system.serviceEvents
      .filter(
        (item) =>
          item.eventType === "SHUTDOWN" &&
          dateOnly(item.eventDate) <= summerStart,
      )
      .at(-1);
    const startupBeforeSummerEnd = system.serviceEvents.some(
      (item) =>
        item.eventType === "STARTUP" &&
        (!shutdownBeforeSummer ||
          item.eventDate > shutdownBeforeSummer.eventDate) &&
        dateOnly(item.eventDate) <= summerEnd,
    );
    const documentedFullSummerShutdown = Boolean(
      shutdownBeforeSummer && !startupBeforeSummerEnd,
    );
    if (!documentedFullSummerShutdown) {
      const annual = annualSummertimeHyperhalogenationObligation(
        system.serviceEvents[0].id,
        obligationYear,
        ruleConfig.ruleSetVersion,
      );
      await tx.reportingObligation.create({
        data: {
          ...obligationData(
            annual,
            systemId,
            today,
            "REPORTING_ACTION",
            previouslyMissedIds,
          ),
          obligationType: annual.obligationType,
        },
      });
    }
  }

  const markMissed = {
    where: {
      coolingTowerSystemId: systemId,
      status: "OVERDUE" as const,
      latestDueDate: { lt: asUtc(today) },
    },
    data: { status: "MISSED" as const },
  };
  await Promise.all([
    tx.sampleObligation.updateMany(markMissed),
    tx.inspectionObligation.updateMany(markMissed),
    tx.reportingObligation.updateMany(markMissed),
    tx.maintenanceObligation.updateMany(markMissed),
  ]);

  const [sample, inspection, reporting, maintenance] = await Promise.all([
    tx.sampleObligation.findMany({
      where: {
        coolingTowerSystemId: systemId,
        status: { in: ["PENDING", "SCHEDULED", "OVERDUE"] },
      },
    }),
    tx.inspectionObligation.findMany({
      where: {
        coolingTowerSystemId: systemId,
        status: { in: ["PENDING", "SCHEDULED", "OVERDUE"] },
      },
    }),
    tx.reportingObligation.findMany({
      where: {
        coolingTowerSystemId: systemId,
        status: { in: ["PENDING", "SCHEDULED", "OVERDUE"] },
      },
    }),
    tx.maintenanceObligation.findMany({
      where: {
        coolingTowerSystemId: systemId,
        status: { in: ["PENDING", "SCHEDULED", "OVERDUE"] },
      },
    }),
  ]);
  const plannedActivities = await tx.visitActivity.findMany({
    where: {
      coolingTowerSystemId: systemId,
      status: "PLANNED",
      visit: {
        status: { in: ["DRAFT", "PLANNED", "CONFIRMED", "IN_PROGRESS"] },
      },
    },
    include: { visit: true },
  });
  const sampleActivityTypes = new Set([
    "ROUTINE_LEGIONELLA_SAMPLE",
    "STARTUP_LEGIONELLA_SAMPLE",
    "POST_HYPERHALOGENATION_SAMPLE",
    "CORRECTIVE_RETEST",
    "EMERGENCY_SAMPLE",
  ]);
  const activityMatches = (
    activityType: string,
    category: ObligationCategory,
    type: string,
  ) => {
    if (category === "SAMPLE") return sampleActivityTypes.has(activityType);
    if (category === "INSPECTION")
      return activityType === "COMPLIANCE_INSPECTION";
    if (category === "MAINTENANCE")
      return type === "STARTUP_CLEANING_DISINFECTION"
        ? activityType === "STARTUP_CLEANING"
        : activityType === "ROUTINE_CLEANING";
    if (type === "SUMMERTIME_HYPERHALOGENATION_DUE")
      return activityType === "SUMMERTIME_HYPERHALOGENATION";
    if (type === "LEVEL_4_FULL_REMEDIATION")
      return activityType === "FULL_REMEDIATION";
    if (type.includes("CORRECTIVE_ACTION"))
      return ["CORRECTIVE_DISINFECTION", "FULL_REMEDIATION"].includes(
        activityType,
      );
    return false;
  };
  for (const activity of plannedActivities) {
    const scheduledDate = dateOnly(activity.scheduledDate);
    const existingDetails =
      activity.details &&
      typeof activity.details === "object" &&
      !Array.isArray(activity.details)
        ? activity.details
        : {};
    if (activity.activityType === "ROUTINE_CLEANING") {
      const scheduledYear = Number(scheduledDate.slice(0, 4));
      const cleaningProgress = annualCleaningProgress(
        system.serviceEvents
          .filter((event) =>
            [
              "CLEANING_COMPLETED",
              "STARTUP_CLEANING_DISINFECTION",
              "FULL_REMEDIATION",
            ].includes(event.eventType),
          )
          .map((event) => dateOnly(event.eventDate)),
        scheduledYear,
      );
      await tx.visitActivity.update({
        where: { id: activity.id },
        data: {
          details: {
            ...existingDetails,
            schedulingWarning:
              cleaningProgress.remaining > 0
                ? null
                : `The ${scheduledYear} twice-yearly cleaning requirement is already complete. This visit may still be useful maintenance, but it is not needed for that annual minimum.`,
          },
        },
      });
      continue;
    }
    const matches = [
      ...sample.map((item) => ({ ...item, category: "SAMPLE" as const })),
      ...inspection.map((item) => ({
        ...item,
        category: "INSPECTION" as const,
        obligationType: "QUARTERLY_COMPLIANCE_INSPECTION",
      })),
      ...reporting.map((item) => ({
        ...item,
        category: "REPORTING_ACTION" as const,
      })),
      ...maintenance.map((item) => ({
        ...item,
        category: "MAINTENANCE" as const,
      })),
    ].filter(
      (item) =>
        activityMatches(
          activity.activityType,
          item.category,
          item.obligationType,
        ) &&
        (!item.earliestDueDate ||
          dateOnly(item.earliestDueDate) <= scheduledDate) &&
        (!item.latestDueDate || dateOnly(item.latestDueDate) >= scheduledDate),
    );
    if (!matches.length) {
      await tx.visitActivity.update({
        where: { id: activity.id },
        data: {
          details: {
            ...existingDetails,
            obligationIds: [],
            schedulingWarning: `The planned date ${scheduledDate} is outside every current generated window after compliance was recalculated. Reschedule before relying on this visit.`,
          },
        },
      });
      continue;
    }
    const ids = matches.map((item) => item.id);
    await tx.visitActivity.update({
      where: { id: activity.id },
      data: {
        details: {
          ...existingDetails,
          obligationIds: ids,
          schedulingWarning: null,
        },
      },
    });
    await tx.sampleObligation.updateMany({
      where: { id: { in: ids } },
      data: { status: "SCHEDULED" },
    });
    await tx.inspectionObligation.updateMany({
      where: { id: { in: ids } },
      data: { status: "SCHEDULED" },
    });
    await tx.reportingObligation.updateMany({
      where: { id: { in: ids } },
      data: { status: "SCHEDULED" },
    });
    await tx.maintenanceObligation.updateMany({
      where: { id: { in: ids } },
      data: { status: "SCHEDULED" },
    });
  }
  const open = [...sample, ...inspection, ...reporting, ...maintenance].map(
    (item) => ({
      latestDueDate: item.latestDueDate,
      priority: item.priority,
      reason: item.reason,
    }),
  );
  const missedCount =
    (await tx.sampleObligation.count({
      where: { coolingTowerSystemId: systemId, status: "MISSED" },
    })) +
    (await tx.inspectionObligation.count({
      where: { coolingTowerSystemId: systemId, status: "MISSED" },
    })) +
    (await tx.reportingObligation.count({
      where: { coolingTowerSystemId: systemId, status: "MISSED" },
    })) +
    (await tx.maintenanceObligation.count({
      where: { coolingTowerSystemId: systemId, status: "MISSED" },
    }));
  const status = missedCount
    ? {
        risk: "OVERDUE" as const,
        plainEnglishStatus: "Compliance issue",
        explanation: `${missedCount} obligation${missedCount === 1 ? " was" : "s were"} missed. Later work cannot repair a passed controlling deadline.`,
      }
    : statusFromOpen(today, open, operating);
  await tx.complianceStatus.upsert({
    where: { coolingTowerSystemId: systemId },
    create: {
      coolingTowerSystemId: systemId,
      ...status,
      asOfDate: asUtc(today),
    },
    update: { ...status, asOfDate: asUtc(today) },
  });
  await tx.coolingTowerSystem.update({
    where: { id: systemId },
    data: {
      operatingStatus: operating ? "OPERATING" : "FULLY_SHUT_DOWN",
      actualStartupDate:
        system.serviceEvents
          .filter((item) => item.eventType === "STARTUP")
          .at(-1)?.eventDate ?? system.actualStartupDate,
      actualShutdownDate:
        system.serviceEvents
          .filter((item) => item.eventType === "SHUTDOWN")
          .at(-1)?.eventDate ?? system.actualShutdownDate,
    },
  });
  return {
    sampleCount: sample.length,
    inspectionCount: inspection.length,
    reportingCount: reporting.length,
    maintenanceCount: maintenance.length,
    status,
  };
}
