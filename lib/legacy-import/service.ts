import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { asUtc } from "@/lib/date";
import { DEFAULT_ROUTINE_SAMPLE_TARGET_WINDOW } from "@/lib/rules";
import { towerRuleConfigurationForMode } from "@/lib/tower-rule-configuration";
import { todayDateOnly } from "@/lib/date";
import {
  analyzeLegacyWorkbook,
  type LegacyPreviewRow,
} from "@/lib/legacy-import/parser";

export type LegacyImportDefaults = {
  jurisdictionId: string;
  ruleProfileId: string;
  city: string;
  state: string;
  postalCode: string;
  routeZone: string;
};

function json(value: unknown) {
  return value as Prisma.InputJsonValue;
}

export async function previewLegacyImport(input: {
  buffer: Buffer;
  filename: string;
  user: { id: string; organizationId: string };
  defaults: LegacyImportDefaults;
}) {
  const preview = await analyzeLegacyWorkbook(input.buffer, input.filename);
  const [jurisdiction, profile] = await Promise.all([
    db.jurisdiction.findUnique({
      where: { id: input.defaults.jurisdictionId },
    }),
    db.ruleProfile.findFirst({
      where: { id: input.defaults.ruleProfileId, active: true },
    }),
  ]);
  if (!jurisdiction || !profile)
    throw new Error("Choose a valid jurisdiction and active rule profile.");
  if (profile.jurisdictionId && profile.jurisdictionId !== jurisdiction.id)
    throw new Error(
      "The rule profile does not belong to the selected jurisdiction.",
    );

  if (!input.defaults.postalCode) {
    for (const row of preview.rows) {
      row.warnings.push(
        "ZIP code is missing and must be completed during post-import review",
      );
      if (row.reviewStatus === "READY")
        row.reviewStatus = "READY_WITH_WARNINGS";
    }
    preview.counts.missingPostalCodes = preview.rows.length;
    preview.counts.ready = preview.rows.filter(
      (row) => row.reviewStatus === "READY",
    ).length;
    preview.counts.readyWithWarnings = preview.rows.filter(
      (row) => row.reviewStatus === "READY_WITH_WARNINGS",
    ).length;
  } else {
    preview.counts.missingPostalCodes = 0;
  }

  const previous = await db.legacyImportBatch.findUnique({
    where: {
      organizationId_fileHash: {
        organizationId: input.user.organizationId,
        fileHash: preview.fileHash,
      },
    },
    include: { rows: { orderBy: { sourceRow: "asc" } } },
  });
  if (previous) return serializeBatch(previous, true);

  const possibleMatches = await db.coolingTowerSystem.findMany({
    where: {
      building: { customer: { organizationId: input.user.organizationId } },
      OR: preview.rows.flatMap((row) => [
        {
          building: {
            streetAddress: { equals: row.address, mode: "insensitive" },
          },
        },
        {
          building: {
            customer: { name: { equals: row.jobName, mode: "insensitive" } },
          },
        },
      ]),
    },
    include: { building: { include: { customer: true } } },
  });
  for (const row of preview.rows) {
    if (
      possibleMatches.some(
        (system) =>
          system.building.streetAddress.toLowerCase() ===
            row.address.toLowerCase() ||
          system.building.customer.name.toLowerCase() ===
            row.jobName.toLowerCase(),
      )
    ) {
      row.warnings.push(
        "A TowerTrack record may match this row; manual review is required",
      );
      row.reviewStatus = "NEEDS_REVIEW";
      row.eligible = false;
    }
  }
  preview.counts.needsReview = preview.rows.filter(
    (row) => row.reviewStatus === "NEEDS_REVIEW",
  ).length;

  const batch = await db.$transaction(async (tx) => {
    const created = await tx.legacyImportBatch.create({
      data: {
        organizationId: input.user.organizationId,
        importedById: input.user.id,
        filename: input.filename,
        fileHash: preview.fileHash,
        previewCounts: json(preview.counts),
        mapping: json(preview.mapping),
        warnings: json([
          "2021-2026 month blocks are inferred from repeated headers following the explicit 2020 column",
          "Imported events remain unverified and are excluded from compliance calculations",
        ]),
      },
    });
    await tx.legacyImportRow.createMany({
      data: preview.rows.map((row) => ({
        batchId: created.id,
        sourceKey: row.sourceKey,
        worksheetName: preview.worksheetName,
        sourceRow: row.sourceRow,
        originalJobNumber: row.jobNumber || null,
        status: row.reviewStatus,
        proposedData: json({ ...row, defaults: input.defaults }),
        sourceCells: json(row.sourceCells),
        recognizedEvents: json(row.events),
        ambiguousCells: json(row.ambiguousCells),
        warnings: json(row.warnings),
        errors: json(row.errors),
      })),
    });
    await tx.auditLog.create({
      data: {
        entityType: "LegacyImportBatch",
        entityId: created.id,
        action: "PREVIEWED",
        reason:
          "Analyzed legacy Excel workbook without creating operational records",
        changedById: input.user.id,
        newValue: json({
          filename: input.filename,
          fileHash: preview.fileHash,
          counts: preview.counts,
        }),
      },
    });
    return tx.legacyImportBatch.findUniqueOrThrow({
      where: { id: created.id },
      include: { rows: { orderBy: { sourceRow: "asc" } } },
    });
  });
  return serializeBatch(batch, false);
}

function serializeBatch(
  batch: Awaited<ReturnType<typeof db.legacyImportBatch.findUniqueOrThrow>> & {
    rows: Array<Record<string, unknown>>;
  },
  existing: boolean,
) {
  return {
    id: batch.id,
    filename: batch.filename,
    status: batch.status,
    counts: batch.previewCounts,
    mapping: batch.mapping,
    warnings: batch.warnings,
    existing,
    rows: batch.rows.map((row) => ({
      id: row.id,
      sourceRow: row.sourceRow,
      status: row.status,
      proposedData: row.proposedData,
      sourceCells: row.sourceCells,
      events: row.recognizedEvents,
      ambiguousCells: row.ambiguousCells,
      warnings: row.warnings,
      errors: row.errors,
    })),
  };
}

export async function confirmLegacyImport(input: {
  batchId: string;
  selectedRowIds: string[];
  user: { id: string; organizationId: string };
}) {
  const batch = await db.legacyImportBatch.findFirstOrThrow({
    where: { id: input.batchId, organizationId: input.user.organizationId },
    include: { rows: { where: { id: { in: input.selectedRowIds } } } },
  });
  if (batch.status !== "PREVIEWED")
    throw new Error(
      "This import batch has already been confirmed or rolled back.",
    );

  const counts = {
    facilitiesCreated: 0,
    systemsCreated: 0,
    existingRecordsMatched: 0,
    activitiesCreated: 0,
    rowsSkipped: 0,
    ambiguousCellsPreserved: 0,
    errors: [] as string[],
  };
  for (const stored of batch.rows) {
    if (!stored.selected && !input.selectedRowIds.includes(stored.id)) continue;
    if (!["READY", "READY_WITH_WARNINGS"].includes(stored.status)) {
      counts.rowsSkipped++;
      continue;
    }
    const row = stored.proposedData as unknown as LegacyPreviewRow & {
      defaults: LegacyImportDefaults;
    };
    try {
      await db.$transaction(async (tx) => {
        const assignedProfile = await tx.ruleProfile.findUniqueOrThrow({
          where: { id: row.defaults.ruleProfileId },
        });
        const ruleConfiguration = towerRuleConfigurationForMode(
          assignedProfile.jurisdictionMode,
        );
        const accountNumber = `LEG-${batch.fileHash.slice(0, 8)}-${row.sourceRow}`;
        const customer = await tx.customer.create({
          data: {
            organizationId: input.user.organizationId,
            name: row.facilityName,
            accountNumber,
            notes: `Unverified legacy Excel import batch ${batch.id}, row ${row.sourceRow}`,
          },
        });
        const building = await tx.building.create({
          data: {
            customerId: customer.id,
            buildingName: row.facilityName,
            streetAddress: row.address,
            city: row.defaults.city,
            state: row.defaults.state.toUpperCase(),
            postalCode: row.defaults.postalCode,
            routeZone: row.defaults.routeZone,
          },
        });
        const system = await tx.coolingTowerSystem.create({
          data: {
            buildingId: building.id,
            jurisdictionId: row.defaults.jurisdictionId,
            ruleProfileId: row.defaults.ruleProfileId,
            ruleConfiguration,
            ruleConfigurationEffectiveDate: asUtc(todayDateOnly()),
            ruleConfigurationConfirmed: false,
            internalJobNumber: `LEG-${batch.fileHash.slice(0, 8)}-${row.sourceRow}`,
            systemName: row.systemName,
            tonnage: row.tonnage,
            operationPeriodType:
              row.operationPeriodType === "SEASONAL"
                ? "SEASONAL"
                : row.operationPeriodType === "YEAR_ROUND"
                  ? "YEAR_ROUND"
                  : null,
            seasonal: row.operationPeriodType === "SEASONAL",
            monthlyTargetStartDay:
              DEFAULT_ROUTINE_SAMPLE_TARGET_WINDOW.startDay,
            monthlyTargetEndDay: DEFAULT_ROUTINE_SAMPLE_TARGET_WINDOW.endDay,
            notes: `Original job number: ${row.jobNumber || "not provided"}. System type: ${row.systemType || "not provided"}. Source: LEGACY_EXCEL; verification: UNVERIFIED.`,
          },
        });
        await tx.towerRuleAssignment.create({
          data: {
            coolingTowerSystemId: system.id,
            configuration: ruleConfiguration,
            ruleProfileId: row.defaults.ruleProfileId,
            effectiveStartDate: asUtc(todayDateOnly()),
            requiresReview: true,
            changedById: input.user.id,
            reason:
              "Legacy Excel import preserved the selected profile but requires compliance-rule confirmation.",
          },
        });
        await tx.reviewItem.create({
          data: {
            title: "Compliance rules must be confirmed.",
            description:
              "This tower was created from unverified legacy data. Confirm the applicable compliance-rule configuration before relying on generated obligations.",
            entityType: "CoolingTowerSystem",
            entityId: system.id,
            severity: "PURPLE",
          },
        });
        const eventIds: string[] = [];
        for (const event of row.events) {
          const created = await tx.serviceEvent.create({
            data: {
              coolingTowerSystemId: system.id,
              eventType: event.eventType,
              eventDate: asUtc(event.date),
              recordedById: input.user.id,
              notes:
                "Unverified historical activity imported from a legacy workbook",
              details: json({
                source: "LEGACY_EXCEL",
                verificationStatus: "UNVERIFIED",
                workbookName: batch.filename,
                worksheetName: stored.worksheetName,
                sourceRow: stored.sourceRow,
                sourceColumn: event.sourceColumn,
                originalCellValue: event.originalValue,
                importBatchId: batch.id,
                legacySourceKey: stored.sourceKey,
              }),
            },
          });
          eventIds.push(created.id);
        }
        const reviewIds: string[] = [];
        if (row.operationPeriodType === "UNKNOWN") {
          const review = await tx.reviewItem.create({
            data: {
              title: "Operating schedule must be confirmed.",
              description:
                "The legacy workbook did not establish whether this cooling tower is seasonal or year-round. Confirm the schedule before relying on schedule-dependent planning.",
              entityType: "CoolingTowerSystem",
              entityId: system.id,
              severity: "PURPLE",
            },
          });
          reviewIds.push(review.id);
        }
        if (row.ambiguousCells.length || row.warnings.length) {
          const review = await tx.reviewItem.create({
            data: {
              title: `Review legacy import row ${stored.sourceRow}`,
              description: `${row.ambiguousCells.length} ambiguous cells and ${row.warnings.length} warnings were preserved from ${batch.filename}.`,
              entityType: "CoolingTowerSystem",
              entityId: system.id,
              severity: "PURPLE",
            },
          });
          reviewIds.push(review.id);
        }
        await tx.legacyImportRow.update({
          where: { id: stored.id },
          data: {
            status: "IMPORTED",
            selected: true,
            createdCustomerId: customer.id,
            createdBuildingId: building.id,
            createdSystemId: system.id,
            createdEventIds: json(eventIds),
            createdReviewIds: json(reviewIds),
            importedAt: new Date(),
          },
        });
        await tx.auditLog.createMany({
          data: [
            {
              entityType: "CoolingTowerSystem",
              entityId: system.id,
              action: "IMPORTED_UNVERIFIED",
              reason: `Legacy Excel batch ${batch.id}, source row ${stored.sourceRow}`,
              changedById: input.user.id,
              newValue: json({
                customerId: customer.id,
                buildingId: building.id,
                eventIds,
              }),
            },
            ...eventIds.map((eventId) => ({
              entityType: "ServiceEvent",
              entityId: eventId,
              action: "IMPORTED_UNVERIFIED",
              reason: `Legacy Excel batch ${batch.id}, source row ${stored.sourceRow}`,
              changedById: input.user.id,
              newValue: json({ verificationStatus: "UNVERIFIED" }),
            })),
          ],
        });
      });
      counts.facilitiesCreated++;
      counts.systemsCreated++;
      counts.activitiesCreated += row.events.length;
      counts.ambiguousCellsPreserved += row.ambiguousCells.length;
    } catch (error) {
      counts.errors.push(
        `Row ${stored.sourceRow}: ${error instanceof Error ? error.message : "Import failed"}`,
      );
    }
  }
  const status = counts.errors.length ? "PARTIAL" : "CONFIRMED";
  await db.$transaction([
    db.legacyImportBatch.update({
      where: { id: batch.id },
      data: {
        status,
        confirmedCounts: json(counts),
        confirmedAt: new Date(),
      },
    }),
    db.auditLog.create({
      data: {
        entityType: "LegacyImportBatch",
        entityId: batch.id,
        action: "CONFIRMED",
        reason: "Administrator confirmed selected legacy Excel rows",
        changedById: input.user.id,
        newValue: json(counts),
      },
    }),
  ]);
  return { batchId: batch.id, status, ...counts };
}

export async function rollbackLegacyImport(input: {
  batchId: string;
  user: { id: string; organizationId: string };
}) {
  const batch = await db.legacyImportBatch.findFirstOrThrow({
    where: { id: input.batchId, organizationId: input.user.organizationId },
    include: { rows: { where: { status: "IMPORTED" } } },
  });
  let rolledBack = 0;
  const blocked: string[] = [];
  for (const row of batch.rows) {
    if (!row.createdSystemId || !row.importedAt) continue;
    const system = await db.coolingTowerSystem.findUnique({
      where: { id: row.createdSystemId },
      include: { serviceEvents: true, activities: true, requirements: true },
    });
    if (!system) continue;
    const importedIds = new Set((row.createdEventIds as string[] | null) ?? []);
    const externallyReferenced =
      system.updatedAt.getTime() > row.importedAt.getTime() + 1000 ||
      system.serviceEvents.some((event) => !importedIds.has(event.id)) ||
      system.activities.length > 0 ||
      system.requirements.length > 0;
    if (externallyReferenced) {
      blocked.push(
        `Row ${row.sourceRow} was edited or referenced after import`,
      );
      continue;
    }
    await db.$transaction(async (tx) => {
      const reviewIds = (row.createdReviewIds as string[] | null) ?? [];
      if (reviewIds.length)
        await tx.reviewItem.deleteMany({ where: { id: { in: reviewIds } } });
      await tx.coolingTowerSystem.delete({ where: { id: system.id } });
      if (row.createdBuildingId)
        await tx.building.delete({ where: { id: row.createdBuildingId } });
      if (row.createdCustomerId)
        await tx.customer.delete({ where: { id: row.createdCustomerId } });
      await tx.legacyImportRow.update({
        where: { id: row.id },
        data: { status: "ROLLED_BACK", rolledBackAt: new Date() },
      });
    });
    rolledBack++;
  }
  await db.$transaction([
    db.legacyImportBatch.update({
      where: { id: batch.id },
      data: {
        status: blocked.length ? "PARTIAL" : "ROLLED_BACK",
        rolledBackAt: new Date(),
      },
    }),
    db.auditLog.create({
      data: {
        entityType: "LegacyImportBatch",
        entityId: batch.id,
        action: "ROLLED_BACK",
        reason: "Administrator requested guarded legacy import rollback",
        changedById: input.user.id,
        newValue: json({ rolledBack, blocked }),
      },
    }),
  ]);
  return { batchId: batch.id, rolledBack, blocked };
}
