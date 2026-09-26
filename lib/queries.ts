import { db } from "@/lib/db";
import type { ObligationStatus } from "@prisma/client";
import { dateOnly, diffDays, todayDateOnly } from "@/lib/date";
import { seasonLabel, seasonalStatus } from "@/lib/season";
import { ruleProfileWarnings, type ProfileMode } from "@/lib/rules";
import {
  annualCleaningProgress,
  nextAnnualCleaningObligation,
} from "@/lib/obligation-engine";
import { ruleSetVersion } from "@/lib/rule-profile";
import {
  complianceJurisdictionForConfiguration,
  complianceJurisdictionLabel,
  profileSourceLabel,
} from "@/lib/compliance-profile";
import { previousLegionellaSummary } from "@/lib/legionella-summary";
import {
  bestVisitOpportunity,
  complianceBaselineReview,
  getComplianceStatus,
  getUrgency,
  inactiveComplianceStatus,
} from "@/lib/compliance-intelligence";
import {
  responsibilityForServiceObligation,
  shouldTrackSampleObligation,
} from "@/lib/service-responsibility";

const cleaningServiceEventTypes = new Set([
  "CLEANING_COMPLETED",
  "STARTUP_CLEANING_DISINFECTION",
  "FULL_REMEDIATION",
]);

export type OperationalQueryScope = {
  organizationId: string;
  today?: string;
  systemId?: string;
  includeMissed?: boolean;
};

export async function planningRows({
  organizationId,
  today = todayDateOnly(),
  systemId,
}: OperationalQueryScope) {
  const systems = await db.coolingTowerSystem.findMany({
    where: {
      active: true,
      ...(systemId ? { id: systemId } : {}),
      building: { customer: { organizationId } },
    },
    include: {
      building: { include: { customer: true } },
      ruleProfile: { include: { rules: true } },
      pendingRegulation: true,
      assignedTechnician: true,
      activities: {
        where: {
          status: "PLANNED",
          visit: { status: { in: ["PLANNED", "CONFIRMED", "IN_PROGRESS"] } },
        },
        orderBy: { scheduledDate: "asc" },
        include: { visit: true },
      },
      serviceEvents: {
        where: {
          status: "ACTIVE",
          eventType: {
            in: [
              "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
              "STARTUP",
              "CLEANING_COMPLETED",
              "STARTUP_CLEANING_DISINFECTION",
              "FULL_REMEDIATION",
            ],
          },
        },
        orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      },
      sampleObligations: {
        where: {
          status: { in: ["PENDING", "SCHEDULED", "OVERDUE", "MISSED"] },
        },
        orderBy: [{ latestDueDate: "asc" }, { createdAt: "asc" }],
      },
      inspectionObligations: {
        where: {
          status: { in: ["PENDING", "SCHEDULED", "OVERDUE", "MISSED"] },
        },
        orderBy: [{ latestDueDate: "asc" }, { createdAt: "asc" }],
      },
      reportingObligations: {
        where: {
          status: { in: ["PENDING", "SCHEDULED", "OVERDUE", "MISSED"] },
        },
        orderBy: [{ latestDueDate: "asc" }, { createdAt: "asc" }],
      },
      maintenanceObligations: {
        where: {
          status: { in: ["PENDING", "SCHEDULED", "OVERDUE", "MISSED"] },
        },
        orderBy: [{ latestDueDate: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: [
      { building: { routeZone: "asc" } },
      { building: { buildingName: "asc" } },
      { systemName: "asc" },
    ],
  });
  const rows = systems.map((system) => {
    const lastSample =
      system.serviceEvents.find(
        (event) => event.eventType === "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
      )?.eventDate ?? null;
    const lastCleaning =
      system.serviceEvents
        .filter((event) => cleaningServiceEventTypes.has(event.eventType))
        .map((event) => dateOnly(event.eventDate))
        .sort()
        .at(-1) ?? null;
    const obligationIdsByActivity = new Map<string, string>();
    for (const activity of system.activities) {
      const details = activity.details as { obligationIds?: unknown } | null;
      if (!Array.isArray(details?.obligationIds)) continue;
      for (const id of details.obligationIds) {
        if (typeof id === "string")
          obligationIdsByActivity.set(id, activity.id);
      }
    }
    const obligationRows = [
      ...system.sampleObligations
        .filter((item) =>
          shouldTrackSampleObligation(item.obligationType, system),
        )
        .map((item) => ({
          ...item,
          type: item.obligationType,
          category: "SAMPLE" as const,
        })),
      ...system.inspectionObligations.map((item) => ({
        ...item,
        type: "QUARTERLY_COMPLIANCE_INSPECTION",
        category: "INSPECTION" as const,
      })),
      ...system.reportingObligations.map((item) => ({
        ...item,
        type: item.obligationType,
        category: "REPORTING_ACTION" as const,
      })),
      ...system.maintenanceObligations.map((item) => ({
        ...item,
        type: item.obligationType,
        category: "MAINTENANCE" as const,
      })),
    ].map((item) => {
      const earliest = item.earliestDueDate
        ? dateOnly(item.earliestDueDate)
        : null;
      const targetStart = item.targetStartDate
        ? dateOnly(item.targetStartDate)
        : null;
      const targetEnd = item.targetEndDate
        ? dateOnly(item.targetEndDate)
        : null;
      const latest = item.latestDueDate ? dateOnly(item.latestDueDate) : null;
      return {
        id: item.id,
        type: item.type,
        category: item.category,
        earliest,
        targetStart,
        targetEnd,
        latest,
        priority: item.priority,
        status: item.status,
        reason: item.reason,
        sourceCitation: item.sourceCitation,
        ruleSetVersion: item.ruleSetVersion,
      };
    });
    const openObligationIds = new Set(obligationRows.map((item) => item.id));
    const planned =
      system.activities.find((activity) => {
        const details = activity.details as { obligationIds?: unknown } | null;
        return (
          Array.isArray(details?.obligationIds) &&
          details.obligationIds.some(
            (id) => typeof id === "string" && openObligationIds.has(id),
          )
        );
      }) ?? null;
    const routineRequirement = obligationRows.find(
      (item) => item.type === "ROUTINE_OPERATING_SAMPLE",
    );
    const nextDated = obligationRows
      .filter((item) => item.latest)
      .sort((a, b) => (a.latest ?? "").localeCompare(b.latest ?? ""))[0];
    const isNyc = system.ruleConfiguration === "NYC_AND_NYS";
    const profileJurisdiction = complianceJurisdictionForConfiguration(
      system.ruleConfiguration,
    );
    const compliance =
      inactiveComplianceStatus(system.operatingStatus) ??
      complianceBaselineReview({
        isNyc,
        operatingStatus: system.operatingStatus,
        hasSamplingAnchor: system.serviceEvents.some((event) =>
          ["ROUTINE_LEGIONELLA_SAMPLE_COLLECTED", "STARTUP"].includes(
            event.eventType,
          ),
        ),
      }) ??
      getComplianceStatus(obligationRows, today);
    const controlling =
      obligationRows.find(
        (item) => item.id === compliance.controllingObligationId,
      ) ??
      nextDated ??
      routineRequirement ??
      null;
    const hardDueDate = controlling?.latest ?? null;
    const targetDate =
      controlling?.targetStart ?? controlling?.earliest ?? null;
    const warnings = ruleProfileWarnings({
      profile: system.ruleProfile.jurisdictionMode as ProfileMode,
      configuredIntervalDays: system.ruleProfile.legionellaIntervalDays,
      state: system.building.state,
      borough: system.building.borough,
      hardDueDate,
    });
    const openRequirements = obligationRows.map((item) => ({
      id: item.id,
      type:
        item.type === "QUARTERLY_COMPLIANCE_INSPECTION"
          ? "COMPLIANCE_INSPECTION"
          : item.type,
      sourceRule: item.sourceCitation,
      status: item.status,
      color: getUrgency({
        today,
        status: item.status,
        priority: item.priority,
        latestDueDate: item.latest,
        targetStartDate: item.targetStart,
      }).color,
      ownership: "INTERNAL",
      earliestAllowedDate: item.earliest,
      schedulingWindowStart: item.targetStart,
      hardDueDate: item.latest,
      preferredDate: item.targetStart,
      latestAllowedDate: item.targetEnd ?? item.latest,
      scheduledActivityId: obligationIdsByActivity.get(item.id) ?? null,
      explanation: item.reason,
    }));
    return {
      id: system.id,
      systemId: system.id,
      systemName: system.systemName,
      jobNumber: system.internalJobNumber,
      customer: system.building.customer.name,
      buildingId: system.building.id,
      building: system.building.buildingName,
      address: [
        system.building.streetAddress,
        system.building.addressLine2,
        `${system.building.city}, ${system.building.state} ${system.building.postalCode || "Postal code not recorded"}`,
      ]
        .filter(Boolean)
        .join(", "),
      state: system.building.state,
      routeZone: system.routeZoneOverride || system.building.routeZone,
      borough: system.building.borough,
      county: system.building.county,
      municipality: system.building.municipality || system.building.city,
      postalCode: system.building.postalCode,
      seasonal: system.seasonal,
      seasonLabel: seasonLabel(system),
      seasonStatus: seasonalStatus(system, today),
      actualStartupDate: system.actualStartupDate
        ? dateOnly(system.actualStartupDate)
        : null,
      actualShutdownDate: system.actualShutdownDate
        ? dateOnly(system.actualShutdownDate)
        : null,
      profileId: system.ruleProfileId,
      profile: system.ruleProfile.name,
      ruleConfiguration: system.ruleConfiguration,
      legionellaResponsibility: system.legionellaResponsibility,
      laboratoryResultResponsibility: system.laboratoryResultResponsibility,
      bacteriologicalResponsibility: system.bacteriologicalResponsibility,
      inspectionResponsibility: system.inspectionResponsibility,
      cleaningResponsibility: system.cleaningResponsibility,
      waterTreatmentResponsibility: system.waterTreatmentResponsibility,
      regulatoryReportingResponsibility:
        system.regulatoryReportingResponsibility,
      certificationResponsibility: system.certificationResponsibility,
      legionellaVendorName: system.legionellaVendorName,
      ruleConfigurationConfirmed: system.ruleConfigurationConfirmed,
      profileJurisdiction,
      profileJurisdictionLabel:
        complianceJurisdictionLabel(profileJurisdiction),
      profileSourceLabel: profileSourceLabel(profileJurisdiction),
      profileVersion: ruleSetVersion(system.ruleProfile),
      profileEffectiveDate: system.ruleProfile.effectiveStartDate
        ? dateOnly(system.ruleProfile.effectiveStartDate)
        : null,
      authority:
        system.ruleProfile.rules[0]?.sourceAuthority ??
        "UNKNOWN_REQUIRES_REVIEW",
      lastSample: lastSample ? dateOnly(lastSample) : null,
      lastCleaning,
      plannedDate: planned ? dateOnly(planned.scheduledDate) : null,
      plannedVisitId: planned?.visitId || null,
      targetDate,
      hardDueDate,
      daysRemaining: hardDueDate ? diffDays(today, hardDueDate) : null,
      technician: system.assignedTechnician?.name || "Unassigned",
      status: {
        color: compliance.color,
        label: compliance.label,
        nextAction: compliance.reason,
      },
      explanation: compliance.reason,
      canCombine: Boolean(planned && planned.visit.status !== "COMPLETED"),
      pending: system.pendingRegulation?.status || null,
      warnings,
      openRequirements,
    };
  });
  const urgency = { RED: 0, YELLOW: 1, PURPLE: 2, BLUE: 3, GREEN: 4, GRAY: 5 };
  return rows.sort(
    (a, b) =>
      a.routeZone.localeCompare(b.routeZone) ||
      urgency[a.status.color] - urgency[b.status.color] ||
      (a.daysRemaining ?? Number.MAX_SAFE_INTEGER) -
        (b.daysRemaining ?? Number.MAX_SAFE_INTEGER) ||
      a.building.localeCompare(b.building) ||
      a.systemName.localeCompare(b.systemName),
  );
}

export async function complianceDashboardRows({
  organizationId,
  today = todayDateOnly(),
  systemId,
  includeMissed = false,
}: OperationalQueryScope) {
  const obligationStatuses: ObligationStatus[] = includeMissed
    ? ["PENDING", "SCHEDULED", "OVERDUE", "MISSED"]
    : ["PENDING", "SCHEDULED", "OVERDUE"];
  const systems = await db.coolingTowerSystem.findMany({
    where: {
      active: true,
      ...(systemId ? { id: systemId } : {}),
      building: { customer: { organizationId } },
    },
    include: {
      building: { include: { customer: true } },
      ruleProfile: { include: { rules: true } },
      complianceStatus: true,
      activities: {
        where: {
          activityType: "ROUTINE_CLEANING",
          status: "PLANNED",
          visit: { status: { in: ["PLANNED", "CONFIRMED", "IN_PROGRESS"] } },
        },
        orderBy: { scheduledDate: "asc" },
        include: { visit: true },
      },
      sampleObligations: {
        where: { status: { in: obligationStatuses } },
        orderBy: [{ latestDueDate: "asc" }, { createdAt: "asc" }],
        include: {
          triggerEvent: {
            select: {
              id: true,
              eventType: true,
              eventDate: true,
              triggeredReportingObligations: {
                where: { obligationType: "PORTAL_SAMPLE_DATE" },
                select: {
                  status: true,
                  completedByEvent: {
                    select: { eventDate: true, status: true },
                  },
                },
              },
            },
          },
        },
      },
      inspectionObligations: {
        where: { status: { in: obligationStatuses } },
        orderBy: [{ latestDueDate: "asc" }, { createdAt: "asc" }],
        include: {
          triggerEvent: {
            select: { id: true, eventType: true, eventDate: true },
          },
        },
      },
      reportingObligations: {
        where: { status: { in: obligationStatuses } },
        orderBy: [{ latestDueDate: "asc" }, { createdAt: "asc" }],
        include: {
          triggerEvent: {
            select: { id: true, eventType: true, eventDate: true },
          },
        },
      },
      maintenanceObligations: {
        where: { status: { in: obligationStatuses } },
        orderBy: [{ latestDueDate: "asc" }, { createdAt: "asc" }],
        include: {
          triggerEvent: {
            select: { id: true, eventType: true, eventDate: true },
          },
        },
      },
      serviceEvents: {
        where: {
          status: "ACTIVE",
          eventType: {
            in: [
              "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
              "STARTUP",
              "SUMMERTIME_HYPERHALOGENATION",
              "CLEANING_COMPLETED",
              "STARTUP_CLEANING_DISINFECTION",
              "FULL_REMEDIATION",
            ],
          },
        },
        orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      },
    },
  });
  const rows = systems.map((system) => {
    const samples = system.sampleObligations
      .filter((item) =>
        shouldTrackSampleObligation(item.obligationType, system),
      )
      .map((item) => ({
        id: item.id,
        type: item.obligationType,
        earliest: item.earliestDueDate ? dateOnly(item.earliestDueDate) : null,
        targetStart: item.targetStartDate
          ? dateOnly(item.targetStartDate)
          : null,
        targetEnd: item.targetEndDate ? dateOnly(item.targetEndDate) : null,
        latest: item.latestDueDate ? dateOnly(item.latestDueDate) : null,
        priority: item.priority,
        status: item.status,
        reason: item.reason,
        sourceCitation: item.sourceCitation,
        ruleSetVersion: item.ruleSetVersion,
        trigger: {
          id: item.triggerEvent.id,
          type: item.triggerEvent.eventType,
          date: dateOnly(item.triggerEvent.eventDate),
          triggeredReportingObligations:
            item.triggerEvent.triggeredReportingObligations,
        },
      }));
    const inspections = system.inspectionObligations.map((item) => ({
      id: item.id,
      type: "QUARTERLY_COMPLIANCE_INSPECTION",
      earliest: item.earliestDueDate ? dateOnly(item.earliestDueDate) : null,
      targetStart: item.targetStartDate ? dateOnly(item.targetStartDate) : null,
      targetEnd: item.targetEndDate ? dateOnly(item.targetEndDate) : null,
      latest: item.latestDueDate ? dateOnly(item.latestDueDate) : null,
      priority: item.priority,
      status: item.status,
      reason: item.reason,
      sourceCitation: item.sourceCitation,
      ruleSetVersion: item.ruleSetVersion,
      trigger: {
        id: item.triggerEvent.id,
        type: item.triggerEvent.eventType,
        date: dateOnly(item.triggerEvent.eventDate),
      },
    }));
    const reports = system.reportingObligations.map((item) => ({
      id: item.id,
      type: item.obligationType,
      earliest: item.earliestDueDate ? dateOnly(item.earliestDueDate) : null,
      targetStart: item.targetStartDate ? dateOnly(item.targetStartDate) : null,
      targetEnd: item.targetEndDate ? dateOnly(item.targetEndDate) : null,
      latest: item.latestDueDate ? dateOnly(item.latestDueDate) : null,
      priority: item.priority,
      status: item.status,
      reason: item.reason,
      sourceCitation: item.sourceCitation,
      ruleSetVersion: item.ruleSetVersion,
      trigger: {
        id: item.triggerEvent.id,
        type: item.triggerEvent.eventType,
        date: dateOnly(item.triggerEvent.eventDate),
      },
    }));
    const maintenance = system.maintenanceObligations.map((item) => ({
      id: item.id,
      type: item.obligationType,
      earliest: item.earliestDueDate ? dateOnly(item.earliestDueDate) : null,
      targetStart: item.targetStartDate ? dateOnly(item.targetStartDate) : null,
      targetEnd: item.targetEndDate ? dateOnly(item.targetEndDate) : null,
      latest: item.latestDueDate ? dateOnly(item.latestDueDate) : null,
      priority: item.priority,
      status: item.status,
      reason: item.reason,
      sourceCitation: item.sourceCitation,
      ruleSetVersion: item.ruleSetVersion,
      trigger: {
        id: item.triggerEvent.id,
        type: item.triggerEvent.eventType,
        date: dateOnly(item.triggerEvent.eventDate),
      },
    }));
    const nextSample =
      samples.find((item) => item.priority === "EMERGENCY") ||
      samples[0] ||
      null;
    const routineSample =
      samples.find((item) => item.type === "ROUTINE_OPERATING_SAMPLE") || null;
    const previousLegionella = previousLegionellaSummary({
      ruleConfiguration: system.ruleConfiguration,
      anchors: samples
        .filter(
          (item) =>
            item.type === "ROUTINE_OPERATING_SAMPLE" &&
            item.status !== "MISSED" &&
            item.trigger.type === "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
        )
        .map((item) => ({
          sampleId: item.trigger.id,
          sampleCollectedDate: item.trigger.date,
          portalObligations: item.trigger.triggeredReportingObligations.map(
            (report) => ({
              status: report.status,
              submittedDate:
                report.completedByEvent?.status === "ACTIVE"
                  ? dateOnly(report.completedByEvent.eventDate)
                  : null,
            }),
          ),
        })),
    });
    const nextInspection = inspections[0] || null;
    const isNyc = system.ruleConfiguration === "NYC_AND_NYS";
    const profileJurisdiction = complianceJurisdictionForConfiguration(
      system.ruleConfiguration,
    );
    const currentYear = Number(today.slice(0, 4));
    const summertimeDue =
      reports.find(
        (item) => item.type === "SUMMERTIME_HYPERHALOGENATION_DUE",
      ) || null;
    const actionReports = reports.filter(
      (item) => item.type !== "SUMMERTIME_HYPERHALOGENATION_DUE",
    );
    const summertimeCompletedDate =
      system.serviceEvents
        .filter(
          (event) =>
            event.eventType === "SUMMERTIME_HYPERHALOGENATION" &&
            dateOnly(event.eventDate) >= `${currentYear}-07-01` &&
            dateOnly(event.eventDate) <= `${currentYear}-08-31`,
        )
        .map((event) => dateOnly(event.eventDate))
        .sort()
        .at(-1) ?? null;
    const cleaningProgress = annualCleaningProgress(
      system.serviceEvents
        .filter((event) => cleaningServiceEventTypes.has(event.eventType))
        .map((event) => dateOnly(event.eventDate)),
      currentYear,
    );
    const cleaningRule = system.ruleProfile.rules.find(
      (rule) => rule.requirementType === "ANNUAL_CLEANING",
    );
    const projectedCleaning =
      isNyc && (cleaningRule?.enabled ?? true)
        ? nextAnnualCleaningObligation({
            systemId: system.id,
            year: currentYear,
            completed: cleaningProgress.completed,
            ruleSetVersion: ruleSetVersion(system.ruleProfile),
            sourceCitation: cleaningRule?.sourceCitation,
          })
        : null;
    const cleaningObligation = projectedCleaning
      ? {
          id: `annual-cleaning:${system.id}:${currentYear}:${cleaningProgress.completed + 1}`,
          type: projectedCleaning.obligationType,
          earliest: projectedCleaning.earliestDueDate,
          targetStart: projectedCleaning.targetStartDate,
          targetEnd: projectedCleaning.targetEndDate,
          latest: projectedCleaning.latestDueDate,
          priority: projectedCleaning.priority,
          status: "PENDING" as const,
          reason: projectedCleaning.reason,
          sourceCitation: projectedCleaning.sourceCitation,
          ruleSetVersion: projectedCleaning.ruleSetVersion,
          trigger: null,
        }
      : null;
    const cleaningPlanActivity = system.activities.find((activity) => {
      const details = activity.details as { planType?: unknown } | null;
      return details?.planType === "TWO_DAY_ANNUAL_CLEANING";
    });
    const cleaningPlanDetails = cleaningPlanActivity?.details as {
      chemicalAddDate?: unknown;
      cleaningDate?: unknown;
    } | null;
    const all = [
      ...samples,
      ...inspections,
      ...reports,
      ...maintenance,
      ...(cleaningObligation ? [cleaningObligation] : []),
    ];
    const openObligations = [
      ...samples.map((item) => ({ ...item, category: "SAMPLE" as const })),
      ...inspections.map((item) => ({
        ...item,
        category: "INSPECTION" as const,
      })),
      ...reports.map((item) => ({
        ...item,
        category: "REPORTING_ACTION" as const,
      })),
      ...maintenance.map((item) => ({
        ...item,
        category: "MAINTENANCE" as const,
      })),
      ...(cleaningObligation
        ? [{ ...cleaningObligation, category: "MAINTENANCE" as const }]
        : []),
    ];
    const companyFieldObligations = openObligations.filter(
      (item) =>
        responsibilityForServiceObligation(item.type, item.category, system) ===
        "OUR_COMPANY",
    );
    const visitOpportunity = bestVisitOpportunity(
      companyFieldObligations,
      today,
    );
    const complianceHealth =
      inactiveComplianceStatus(system.operatingStatus) ??
      complianceBaselineReview({
        isNyc,
        operatingStatus: system.operatingStatus,
        hasSamplingAnchor: system.serviceEvents.some((event) =>
          ["ROUTINE_LEGIONELLA_SAMPLE_COLLECTED", "STARTUP"].includes(
            event.eventType,
          ),
        ),
      }) ??
      getComplianceStatus(openObligations, today);
    const canBundle = Boolean(
      visitOpportunity && visitOpportunity.obligations.length > 1,
    );
    const overdue = all.find((item) => item.latest && item.latest < today);
    const emergency = samples.find((item) => item.priority === "EMERGENCY");
    const nextDated = all
      .filter((item) => item.latest)
      .sort((a, b) => (a.latest || "").localeCompare(b.latest || ""))[0];
    const remaining = nextDated?.latest
      ? diffDays(today, nextDated.latest)
      : null;
    const inactive = ["FULLY_SHUT_DOWN", "SEASONALLY_INACTIVE"].includes(
      system.operatingStatus,
    );
    const baselineRequired = complianceHealth.label === "Baseline required";
    const risk:
      | "INACTIVE"
      | "REVIEW"
      | "OVERDUE"
      | "CRITICAL"
      | "WARNING"
      | "UPCOMING"
      | "GOOD" = inactive
      ? "INACTIVE"
      : baselineRequired
        ? "REVIEW"
        : overdue
          ? "OVERDUE"
          : emergency
            ? "CRITICAL"
            : remaining != null && remaining <= 2
              ? "CRITICAL"
              : remaining != null && remaining <= 7
                ? "WARNING"
                : all.length
                  ? "UPCOMING"
                  : "GOOD";
    const riskDisplay = {
      GOOD: { label: "Good", color: "GREEN" },
      UPCOMING: { label: "Upcoming", color: "GREEN" },
      WARNING: { label: "Warning", color: "YELLOW" },
      CRITICAL: { label: "Critical", color: "RED" },
      OVERDUE: { label: "Overdue", color: "RED" },
      INACTIVE: { label: "Inactive", color: "GRAY" },
      REVIEW: { label: "Baseline required", color: "PURPLE" },
    }[risk] as {
      label: string;
      color: "GREEN" | "YELLOW" | "RED" | "GRAY" | "PURPLE";
    };
    return {
      id: system.id,
      building: system.building.buildingName,
      customer: system.building.customer.name,
      systemName: system.systemName,
      tonnage: system.tonnage,
      operatingSchedule:
        system.operationPeriodType === "SEASONAL" ||
        system.operationPeriodType === "YEAR_ROUND"
          ? (system.operationPeriodType as "SEASONAL" | "YEAR_ROUND")
          : null,
      address: [
        system.building.streetAddress,
        system.building.addressLine2,
        `${system.building.city}, ${system.building.state} ${system.building.postalCode || "Postal code not recorded"}`,
      ]
        .filter(Boolean)
        .join(", "),
      routeZone: system.routeZoneOverride || system.building.routeZone,
      operatingStatus: system.operatingStatus,
      profile: system.ruleProfile.name,
      ruleConfiguration: system.ruleConfiguration,
      legionellaResponsibility: system.legionellaResponsibility,
      laboratoryResultResponsibility: system.laboratoryResultResponsibility,
      bacteriologicalResponsibility: system.bacteriologicalResponsibility,
      inspectionResponsibility: system.inspectionResponsibility,
      cleaningResponsibility: system.cleaningResponsibility,
      waterTreatmentResponsibility: system.waterTreatmentResponsibility,
      regulatoryReportingResponsibility:
        system.regulatoryReportingResponsibility,
      certificationResponsibility: system.certificationResponsibility,
      legionellaVendorName: system.legionellaVendorName,
      ruleConfigurationConfirmed: system.ruleConfigurationConfirmed,
      profileJurisdiction,
      profileJurisdictionLabel:
        complianceJurisdictionLabel(profileJurisdiction),
      profileSourceLabel: profileSourceLabel(profileJurisdiction),
      profileVersion: ruleSetVersion(system.ruleProfile),
      profileEffectiveDate: system.ruleProfile.effectiveStartDate
        ? dateOnly(system.ruleProfile.effectiveStartDate)
        : null,
      risk,
      riskDisplay,
      nextSample,
      routineSample,
      previousLegionella,
      nextInspection,
      summertimeHyperhalogenation: {
        applicable: isNyc,
        due: summertimeDue,
        completedDate: summertimeCompletedDate,
      },
      cleaning: {
        applicable: isNyc,
        ...cleaningProgress,
      },
      cleaningPlan: cleaningPlanActivity
        ? {
            visitId: cleaningPlanActivity.visitId,
            chemicalAddDate:
              typeof cleaningPlanDetails?.chemicalAddDate === "string"
                ? cleaningPlanDetails.chemicalAddDate
                : null,
            cleaningDate:
              typeof cleaningPlanDetails?.cleaningDate === "string"
                ? cleaningPlanDetails.cleaningDate
                : dateOnly(cleaningPlanActivity.scheduledDate),
            technician: cleaningPlanActivity.visit.assignedTechnicianId ?? null,
          }
        : null,
      reports: actionReports,
      otherSamples: samples.filter((item) => item.id !== nextSample?.id),
      canBundle,
      visitOpportunity,
      complianceHealth,
      openCount: all.length,
      openObligations,
      lastEvent: system.serviceEvents[0]
        ? {
            type: system.serviceEvents[0].eventType,
            date: dateOnly(system.serviceEvents[0].eventDate),
          }
        : null,
    };
  });
  const urgency = {
    OVERDUE: 0,
    CRITICAL: 1,
    WARNING: 2,
    REVIEW: 3,
    UPCOMING: 4,
    GOOD: 5,
    INACTIVE: 6,
  };
  return rows.sort(
    (a, b) =>
      urgency[a.risk] - urgency[b.risk] ||
      (a.nextSample?.latest || "9999-12-31").localeCompare(
        b.nextSample?.latest || "9999-12-31",
      ) ||
      a.routeZone.localeCompare(b.routeZone) ||
      a.building.localeCompare(b.building),
  );
}
