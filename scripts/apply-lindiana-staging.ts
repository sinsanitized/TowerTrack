import type { Prisma, ServiceEventType } from "@prisma/client";
import { db } from "../lib/db";
import { asUtc, todayDateOnly } from "../lib/date";
import { DEFAULT_ROUTINE_SAMPLE_TARGET_WINDOW } from "../lib/rules";

const batchId = process.argv[2];
if (!batchId) throw new Error("Pass the staged batch ID.");

type StagedRow = {
  item: string;
  jobNumber: string;
  jobName: string;
  address: string;
  systemName: string;
  systemType: string;
  tonnage: number | null;
  operationPeriodType: "SEASONAL" | "YEAR_ROUND" | "UNKNOWN";
  legionellaResponsibility: "OUR_COMPANY" | "OTHER_PARTY" | "NEEDS_REVIEW";
  latestLegionellaDate: string | null;
  latestHyperhalogenationDate: string | null;
  reconciliation: {
    match:
      | { status: "MATCHED"; systemId: string }
      | { status: "AMBIGUOUS"; candidateSystemIds: string[] }
      | { status: "UNMATCHED" };
  };
};

function json(value: unknown) {
  return value as Prisma.InputJsonValue;
}

async function resolveSystemId(
  row: StagedRow,
  sourceRow: number,
  organizationId: string,
) {
  const match = row.reconciliation.match;
  if (match.status === "MATCHED") return match.systemId;
  if (match.status !== "AMBIGUOUS") return null;

  // The previous importer skipped workbook row 3, so its retained lineage is
  // one row higher. This distinguishes otherwise identical same-site towers.
  const prior = await db.legacyImportRow.findFirst({
    where: {
      sourceRow: sourceRow + 1,
      originalJobNumber: row.jobNumber,
      createdSystemId: { in: match.candidateSystemIds },
      batch: { organizationId, status: "CONFIRMED" },
    },
    select: { createdSystemId: true },
  });
  return prior?.createdSystemId ?? null;
}

async function main() {
  const batch = await db.legacyImportBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: { rows: { orderBy: { sourceRow: "asc" } } },
  });
  if (batch.status !== "PREVIEWED")
    throw new Error(
      `Batch is ${batch.status}; only PREVIEWED batches can apply.`,
    );

  const user = await db.user.findFirstOrThrow({
    where: {
      organizationId: batch.organizationId,
      role: "ADMIN",
      active: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const nycProfile = await db.ruleProfile.findUniqueOrThrow({
    where: { id: "nyc-2026" },
  });
  if (!nycProfile.jurisdictionId)
    throw new Error("NYC profile has no jurisdiction.");
  const nycJurisdictionId = nycProfile.jurisdictionId;

  const counts = {
    updated: 0,
    created: 0,
    identityResolvedFromLineage: 0,
    latestDatesVerified: 0,
    reviewItemsCreated: 0,
  };

  for (const stored of batch.rows) {
    const row = stored.proposedData as unknown as StagedRow;
    let systemId = await resolveSystemId(
      row,
      stored.sourceRow,
      batch.organizationId,
    );
    if (row.reconciliation.match.status === "AMBIGUOUS" && systemId)
      counts.identityResolvedFromLineage++;

    await db.$transaction(async (tx) => {
      if (!systemId) {
        if (row.reconciliation.match.status !== "UNMATCHED")
          throw new Error(
            `Row ${stored.sourceRow} identity remains unresolved.`,
          );
        const customer = await tx.customer.create({
          data: {
            organizationId: batch.organizationId,
            name: row.jobName,
            accountNumber: `LINDIANA-${batch.fileHash.slice(0, 8)}-${stored.sourceRow}`,
            notes: `Created from Lindiana workbook row ${stored.sourceRow}; location and jurisdiction require review.`,
          },
        });
        const building = await tx.building.create({
          data: {
            customerId: customer.id,
            buildingName: row.jobName,
            streetAddress: row.address,
            city: row.jobName.includes("Brooklyn") ? "Brooklyn" : "New York",
            state: "NY",
            postalCode: "",
            routeZone: "Needs review",
          },
        });
        const created = await tx.coolingTowerSystem.create({
          data: {
            buildingId: building.id,
            jurisdictionId: nycJurisdictionId,
            ruleProfileId: nycProfile.id,
            ruleConfiguration: "NYC_AND_NYS",
            ruleConfigurationEffectiveDate: asUtc(todayDateOnly()),
            ruleConfigurationConfirmed: false,
            internalJobNumber: `LINDIANA-${row.jobNumber}-${stored.sourceRow}`,
            systemName: row.systemName,
            tonnage: row.tonnage,
            operationPeriodType:
              row.operationPeriodType === "UNKNOWN"
                ? null
                : row.operationPeriodType,
            seasonal: row.operationPeriodType === "SEASONAL",
            monthlyTargetStartDay:
              DEFAULT_ROUTINE_SAMPLE_TARGET_WINDOW.startDay,
            monthlyTargetEndDay: DEFAULT_ROUTINE_SAMPLE_TARGET_WINDOW.endDay,
            legionellaResponsibility:
              row.legionellaResponsibility === "OUR_COMPANY"
                ? "OUR_COMPANY"
                : null,
            notes: `Lindiana ITEM: ${row.item || "missing"}. Original job number: ${row.jobNumber}. System type: ${row.systemType || "not provided"}.`,
          },
        });
        systemId = created.id;
        await tx.reviewItem.create({
          data: {
            title: "Confirm imported tower jurisdiction and identity",
            description: `Created from Lindiana workbook row ${stored.sourceRow}. Confirm address, jurisdiction, and rule profile before relying on deadlines.`,
            entityType: "CoolingTowerSystem",
            entityId: created.id,
            severity: "PURPLE",
          },
        });
        await tx.auditLog.create({
          data: {
            entityType: "CoolingTowerSystem",
            entityId: created.id,
            action: "CREATED_FROM_APPROVED_IMPORT",
            reason: `User directed Lindiana batch ${batch.id} to be placed in the app; source row ${stored.sourceRow}`,
            changedById: user.id,
            newValue: json({
              customerId: customer.id,
              buildingId: building.id,
              jobNumber: row.jobNumber,
              item: row.item,
            }),
          },
        });
        counts.created++;
        counts.reviewItemsCreated++;
      } else {
        const current = await tx.coolingTowerSystem.findUniqueOrThrow({
          where: { id: systemId },
        });
        const data = {
          tonnage: row.tonnage,
          operationPeriodType:
            row.operationPeriodType === "UNKNOWN"
              ? current.operationPeriodType
              : row.operationPeriodType,
          seasonal:
            row.operationPeriodType === "UNKNOWN"
              ? current.seasonal
              : row.operationPeriodType === "SEASONAL",
          legionellaResponsibility:
            row.legionellaResponsibility === "OUR_COMPANY"
              ? ("OUR_COMPANY" as const)
              : current.legionellaResponsibility,
        };
        await tx.coolingTowerSystem.update({ where: { id: systemId }, data });
        await tx.auditLog.create({
          data: {
            entityType: "CoolingTowerSystem",
            entityId: systemId,
            action: "UPDATED_FROM_APPROVED_IMPORT",
            reason: `User directed Lindiana batch ${batch.id} to be placed in the app; source row ${stored.sourceRow}`,
            changedById: user.id,
            previousValue: json({
              tonnage: current.tonnage,
              operationPeriodType: current.operationPeriodType,
              seasonal: current.seasonal,
              legionellaResponsibility: current.legionellaResponsibility,
            }),
            newValue: json(data),
          },
        });
        counts.updated++;
      }

      if (row.legionellaResponsibility !== "OUR_COMPANY") {
        await tx.reviewItem.create({
          data: {
            title: "Assign Legionella sampling responsibility",
            description:
              row.legionellaResponsibility === "OTHER_PARTY"
                ? `Workbook row ${stored.sourceRow} says another party is responsible. Choose customer or other vendor.`
                : `Workbook row ${stored.sourceRow} does not establish who is responsible.`,
            entityType: "CoolingTowerSystem",
            entityId: systemId!,
            severity: "PURPLE",
          },
        });
        counts.reviewItemsCreated++;
      }

      const latestDates: Array<{
        type: ServiceEventType;
        date: string | null;
      }> = [
        {
          type: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
          date: row.latestLegionellaDate,
        },
        {
          type: "SUMMERTIME_HYPERHALOGENATION",
          date: row.latestHyperhalogenationDate,
        },
      ];
      for (const latest of latestDates) {
        if (!latest.date) continue;
        const eventDate = asUtc(latest.date);
        const existing = await tx.serviceEvent.findFirst({
          where: {
            coolingTowerSystemId: systemId!,
            eventType: latest.type,
            eventDate,
            status: "ACTIVE",
          },
        });
        const details = json({
          source: "LEGACY_EXCEL",
          verificationStatus: "USER_ACCEPTED",
          importBatchId: batch.id,
          sourceRow: stored.sourceRow,
        });
        const event = existing
          ? await tx.serviceEvent.update({
              where: { id: existing.id },
              data: { details },
            })
          : await tx.serviceEvent.create({
              data: {
                coolingTowerSystemId: systemId!,
                eventType: latest.type,
                eventDate,
                recordedById: user.id,
                notes: "Latest date accepted from Lindiana workbook",
                details,
              },
            });
        await tx.auditLog.create({
          data: {
            entityType: "ServiceEvent",
            entityId: event.id,
            action: existing
              ? "LEGACY_DATE_ACCEPTED"
              : "CREATED_FROM_APPROVED_IMPORT",
            reason: `Latest source date accepted from Lindiana batch ${batch.id}, row ${stored.sourceRow}`,
            changedById: user.id,
            previousValue: existing ? json(existing.details) : undefined,
            newValue: details,
          },
        });
        counts.latestDatesVerified++;
      }

      await tx.legacyImportRow.update({
        where: { id: stored.id },
        data: {
          status: "IMPORTED",
          selected: true,
          createdSystemId: systemId,
          importedAt: new Date(),
        },
      });
    });
  }

  await db.$transaction([
    db.legacyImportBatch.update({
      where: { id: batch.id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        confirmedCounts: json(counts),
      },
    }),
    db.auditLog.create({
      data: {
        entityType: "LegacyImportBatch",
        entityId: batch.id,
        action: "APPLIED_TO_OPERATIONAL_RECORDS",
        reason:
          "User directed staged Lindiana workbook data to be placed in the app",
        changedById: user.id,
        newValue: json(counts),
      },
    }),
  ]);
  console.log(JSON.stringify({ batchId: batch.id, counts }, null, 2));
}

main().finally(() => db.$disconnect());
