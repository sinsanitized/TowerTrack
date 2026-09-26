import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import type { Prisma } from "@prisma/client";
import { db } from "../lib/db";
import {
  analyzeLegacyWorkbook,
  type LegacyPreviewRow,
} from "../lib/legacy-import/parser";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalized(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type ExistingCandidate = {
  systemId: string;
  jobNumber: string;
  jobName: string;
  address: string;
  systemType: string;
  tonnage: number | null;
  operationPeriodType: string | null;
};

export function matchLindianaRow(
  row: LegacyPreviewRow,
  candidates: ExistingCandidate[],
) {
  const exact = candidates.filter(
    (candidate) =>
      normalized(candidate.jobNumber) === normalized(row.jobNumber) &&
      normalized(candidate.address) === normalized(row.address) &&
      normalized(candidate.jobName) === normalized(row.jobName) &&
      normalized(candidate.systemType) === normalized(row.systemType) &&
      candidate.tonnage === row.tonnage,
  );
  if (exact.length === 1)
    return { status: "MATCHED" as const, systemId: exact[0].systemId };
  if (exact.length > 1)
    return {
      status: "AMBIGUOUS" as const,
      candidateSystemIds: exact.map((candidate) => candidate.systemId),
    };

  const corroborated = candidates.filter(
    (candidate) =>
      normalized(candidate.jobNumber) === normalized(row.jobNumber) &&
      normalized(candidate.address) === normalized(row.address),
  );
  if (corroborated.length === 1)
    return {
      status: "MATCHED" as const,
      systemId: corroborated[0].systemId,
    };
  return corroborated.length
    ? {
        status: "AMBIGUOUS" as const,
        candidateSystemIds: corroborated.map((candidate) => candidate.systemId),
      }
    : { status: "UNMATCHED" as const };
}

async function main() {
  const file = argument("--file");
  const reportPath =
    argument("--report") ?? "reports/lindiana-import-staging.json";
  if (!file) throw new Error("Pass --file <workbook.xlsx>.");

  const buffer = await readFile(file);
  const preview = await analyzeLegacyWorkbook(
    buffer,
    file.split("/").at(-1) ?? file,
  );
  const user = await db.user.findFirst({
    where: { role: "ADMIN", active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!user)
    throw new Error(
      "No active administrator is available to own the staging batch.",
    );

  const priorRows = await db.legacyImportRow.findMany({
    where: { createdSystemId: { not: null } },
    include: {
      batch: { select: { organizationId: true } },
    },
  });
  const systemIds = priorRows.flatMap((row) =>
    row.createdSystemId ? [row.createdSystemId] : [],
  );
  const systems = await db.coolingTowerSystem.findMany({
    where: {
      id: { in: systemIds },
      building: { customer: { organizationId: user.organizationId } },
    },
    include: { building: { include: { customer: true } } },
  });
  const systemById = new Map(systems.map((system) => [system.id, system]));
  const candidates: ExistingCandidate[] = priorRows.flatMap((stored) => {
    if (
      !stored.createdSystemId ||
      stored.batch.organizationId !== user.organizationId
    )
      return [];
    const system = systemById.get(stored.createdSystemId);
    if (!system) return [];
    const proposed = stored.proposedData as Record<string, unknown>;
    return [
      {
        systemId: system.id,
        jobNumber: stored.originalJobNumber ?? "",
        jobName: String(proposed.jobName ?? system.building.customer.name),
        address: String(proposed.address ?? system.building.streetAddress),
        systemType: String(proposed.systemType ?? ""),
        tonnage:
          typeof proposed.tonnage === "number"
            ? proposed.tonnage
            : system.tonnage,
        operationPeriodType: system.operationPeriodType,
      },
    ];
  });

  const staged = preview.rows.map((row) => {
    const match = matchLindianaRow(row, candidates);
    const conflicts: Array<Record<string, unknown>> = [];
    if (match.status === "MATCHED") {
      const current = systemById.get(match.systemId);
      if (
        current &&
        row.operationPeriodType !== "UNKNOWN" &&
        current.operationPeriodType !== row.operationPeriodType
      )
        conflicts.push({
          field: "operationPeriodType",
          current: current.operationPeriodType,
          proposed: row.operationPeriodType,
          resolution: normalized(row.jobName).includes("polmost")
            ? "APPROVED_BY_USER"
            : "NEEDS_REVIEW",
        });
      const proposedResponsibility = row.legionellaResponsibility;
      if (current && proposedResponsibility === "NEEDS_REVIEW")
        conflicts.push({
          field: "legionellaResponsibility",
          current: current.legionellaResponsibility,
          proposed: "NEEDS_REVIEW",
          resolution: "NEEDS_REVIEW",
        });
      else if (
        current &&
        current.legionellaResponsibility !== proposedResponsibility
      )
        conflicts.push({
          field: "legionellaResponsibility",
          current: current.legionellaResponsibility,
          proposed: proposedResponsibility,
          resolution:
            proposedResponsibility === "OTHER_PARTY"
              ? "NEEDS_PARTY_CLASSIFICATION"
              : "NEEDS_REVIEW",
        });
    }
    if (match.status !== "MATCHED")
      conflicts.push({ field: "identity", resolution: match.status });
    return { row, match, conflicts };
  });

  const fileHash = createHash("sha256").update(buffer).digest("hex");
  const existing = await db.legacyImportBatch.findUnique({
    where: {
      organizationId_fileHash: {
        organizationId: user.organizationId,
        fileHash,
      },
    },
  });
  if (existing && existing.status !== "PREVIEWED")
    throw new Error(
      `Workbook batch ${existing.id} is ${existing.status} and cannot be refreshed.`,
    );

  const counts = {
    total: staged.length,
    matched: staged.filter((item) => item.match.status === "MATCHED").length,
    ambiguous: staged.filter((item) => item.match.status === "AMBIGUOUS")
      .length,
    unmatched: staged.filter((item) => item.match.status === "UNMATCHED")
      .length,
    conflictRows: staged.filter((item) => item.conflicts.length).length,
    ourCompany: staged.filter(
      (item) => item.row.legionellaResponsibility === "OUR_COMPANY",
    ).length,
    otherParty: staged.filter(
      (item) => item.row.legionellaResponsibility === "OTHER_PARTY",
    ).length,
    responsibilityReview: staged.filter(
      (item) => item.row.legionellaResponsibility === "NEEDS_REVIEW",
    ).length,
  };

  const batch = await db.$transaction(async (tx) => {
    if (existing)
      await tx.legacyImportRow.deleteMany({ where: { batchId: existing.id } });
    const created = existing
      ? await tx.legacyImportBatch.update({
          where: { id: existing.id },
          data: {
            previewCounts: counts as unknown as Prisma.InputJsonValue,
            mapping: preview.mapping as unknown as Prisma.InputJsonValue,
            warnings: [
              "Reconciliation staging only; no historical events were applied.",
              "Jurisdiction and OTHER_PARTY responsibility remain review-required.",
            ],
          },
        })
      : await tx.legacyImportBatch.create({
          data: {
            organizationId: user.organizationId,
            importedById: user.id,
            filename: preview.filename,
            fileHash,
            previewCounts: counts as unknown as Prisma.InputJsonValue,
            mapping: preview.mapping as unknown as Prisma.InputJsonValue,
            warnings: [
              "Reconciliation staging only; no historical events were applied.",
              "Jurisdiction and OTHER_PARTY responsibility remain review-required.",
            ],
          },
        });
    await tx.legacyImportRow.createMany({
      data: staged.map(({ row, match, conflicts }) => ({
        batchId: created.id,
        sourceKey: row.sourceKey,
        worksheetName: preview.worksheetName,
        sourceRow: row.sourceRow,
        originalJobNumber: row.jobNumber || null,
        status:
          match.status === "MATCHED" && !conflicts.length
            ? "READY"
            : "NEEDS_REVIEW",
        proposedData: {
          ...row,
          reconciliation: { match, conflicts },
        } as unknown as Prisma.InputJsonValue,
        sourceCells: row.sourceCells as Prisma.InputJsonValue,
        recognizedEvents: [],
        ambiguousCells: row.ambiguousCells as unknown as Prisma.InputJsonValue,
        warnings: row.warnings as Prisma.InputJsonValue,
        errors: row.errors as Prisma.InputJsonValue,
      })),
    });
    await tx.auditLog.create({
      data: {
        entityType: "LegacyImportBatch",
        entityId: created.id,
        action: existing ? "STAGING_REFRESHED" : "STAGED_FOR_REVIEW",
        reason: existing
          ? "Lindiana staging refreshed after parser validation; no unreviewed operational changes applied"
          : "Lindiana workbook reconciled without applying unreviewed operational changes",
        changedById: user.id,
        newValue: {
          filename: preview.filename,
          fileHash,
          counts,
        } as Prisma.InputJsonValue,
      },
    });
    return created;
  });

  const polmost = staged.find(
    (item) =>
      normalized(item.row.jobName).includes("polmost") &&
      item.match.status === "MATCHED",
  );
  if (polmost?.match.status === "MATCHED") {
    const current = systemById.get(polmost.match.systemId);
    if (current && current.operationPeriodType !== "YEAR_ROUND") {
      await db.$transaction([
        db.coolingTowerSystem.update({
          where: { id: current.id },
          data: { operationPeriodType: "YEAR_ROUND", seasonal: false },
        }),
        db.auditLog.create({
          data: {
            entityType: "CoolingTowerSystem",
            entityId: current.id,
            action: "UPDATED_FROM_APPROVED_IMPORT_REVIEW",
            reason: `User confirmed Polmost is year-round; source batch ${batch.id}, row ${polmost.row.sourceRow}`,
            changedById: user.id,
            previousValue: {
              operationPeriodType: current.operationPeriodType,
              seasonal: current.seasonal,
            },
            newValue: { operationPeriodType: "YEAR_ROUND", seasonal: false },
          },
        }),
      ]);
    }
  }

  const report = {
    batchId: batch.id,
    filename: preview.filename,
    fileHash,
    counts,
    approvedChangesApplied:
      polmost?.match.status === "MATCHED" ? ["Polmost: YEAR_ROUND"] : [],
    conflicts: staged
      .filter((item) => item.conflicts.length)
      .map((item) => ({
        sourceRow: item.row.sourceRow,
        item: item.row.item,
        jobNumber: item.row.jobNumber,
        jobName: item.row.jobName,
        match: item.match,
        conflicts: item.conflicts,
      })),
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify({ batchId: batch.id, reportPath, counts }, null, 2),
  );
}

main().finally(() => db.$disconnect());
