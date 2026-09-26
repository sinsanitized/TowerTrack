import readXlsxFile, { type CellValue } from "read-excel-file/node";
import { createHash } from "node:crypto";

export type LegacyEvent = {
  eventType:
    "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED" | "SUMMERTIME_HYPERHALOGENATION";
  date: string;
  sourceColumn: string;
  originalValue: string;
};

export type LegacyPreviewRow = {
  sourceRow: number;
  sourceKey: string;
  item: string;
  jobNumber: string;
  jobName: string;
  address: string;
  facilityName: string;
  systemName: string;
  systemType: string;
  tonnage: number | null;
  operationPeriodType: "SEASONAL" | "YEAR_ROUND" | "UNKNOWN";
  legionellaResponsibility: "OUR_COMPANY" | "OTHER_PARTY" | "NEEDS_REVIEW";
  latestLegionellaDate: string | null;
  latestHyperhalogenationDate: string | null;
  events: LegacyEvent[];
  ambiguousCells: Array<{ column: string; value: string; reason: string }>;
  sourceCells: Record<string, string>;
  warnings: string[];
  errors: string[];
  duplicateJobNumber: boolean;
  reviewStatus: "READY" | "READY_WITH_WARNINGS" | "NEEDS_REVIEW" | "EXCLUDED";
  eligible: boolean;
};

export type LegacyWorkbookPreview = {
  filename: string;
  fileHash: string;
  worksheetName: string;
  mapping: Array<{ columns: string; year: number; note: string }>;
  rows: LegacyPreviewRow[];
  counts: Record<string, number>;
};

const monthBlocks = [
  { start: 10, end: 21, year: 2021 },
  { start: 22, end: 33, year: 2022 },
  { start: 34, end: 45, year: 2023 },
  { start: 46, end: 57, year: 2024 },
  { start: 58, end: 69, year: 2025 },
] as const;

export const legacyColumnMapping = [
  {
    columns: "I",
    year: 2020,
    note: "Standalone legacy value; only complete dates are accepted",
  },
  ...monthBlocks.map((block) => ({
    columns: `${columnName(block.start)}-${columnName(block.end)}`,
    year: block.year,
    note: "January through December; day-only values use the header month",
  })),
  {
    columns: "BR-BX, BZ-CD",
    year: 2026,
    note: "January through December; day-only values use the header month",
  },
  {
    columns: "BY",
    year: 2026,
    note: "Summertime hyperhalogenation; only a single confident date is accepted",
  },
];

export function columnName(index: number) {
  let value = index;
  let result = "";
  while (value > 0) {
    value--;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function isoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  )
    return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function completeDate(value: string) {
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (match)
    return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(value);
  if (match)
    return isoDate(Number(match[3]), Number(match[1]), Number(match[2]));
  return null;
}

export function parseLegacyDateCell(
  value: CellValue | Date | null,
  context?: { year: number; month: number },
) {
  if (value == null || value === "") return { kind: "blank" as const };
  if (value instanceof Date) {
    const date = isoDate(
      value.getUTCFullYear(),
      value.getUTCMonth() + 1,
      value.getUTCDate(),
    );
    return date
      ? { kind: "date" as const, date }
      : { kind: "ambiguous" as const, reason: "Invalid Excel date" };
  }
  if (typeof value === "number") {
    if (context && Number.isInteger(value) && value >= 1 && value <= 31) {
      const date = isoDate(context.year, context.month, value);
      return date
        ? { kind: "date" as const, date }
        : {
            kind: "ambiguous" as const,
            reason: "Impossible day for column month",
          };
    }
    return {
      kind: "ambiguous" as const,
      reason: "Numeric value may be a work order",
    };
  }
  const text = String(value).trim();
  const full = completeDate(text);
  if (full) return { kind: "date" as const, date: full };
  if (context && /^\d{1,2}$/.test(text)) {
    const date = isoDate(context.year, context.month, Number(text));
    return date
      ? { kind: "date" as const, date }
      : {
          kind: "ambiguous" as const,
          reason: "Impossible day for column month",
        };
  }
  return {
    kind: "ambiguous" as const,
    reason: "Status, note, range, or unclear value",
  };
}

function historyContext(column: number) {
  for (const block of monthBlocks)
    if (column >= block.start && column <= block.end)
      return { year: block.year, month: column - block.start + 1 };
  if (column >= 70 && column <= 76) return { year: 2026, month: column - 69 };
  if (column >= 78 && column <= 82) return { year: 2026, month: column - 70 };
  return undefined;
}

function cellText(value: CellValue | null) {
  if (value == null) return "";
  if (value instanceof Date)
    return (
      isoDate(
        value.getUTCFullYear(),
        value.getUTCMonth() + 1,
        value.getUTCDate(),
      ) ?? String(value)
    );
  return String(value).trim();
}

export function parseLegacyResponsibility(value: CellValue | Date | null) {
  // Date-formatted numeric Excel cells are returned as Date objects by the
  // workbook reader. Text that merely looks like a date remains a string.
  if (typeof value === "number" || value instanceof Date)
    return "OUR_COMPANY" as const;
  if (typeof value === "string" && value.trim() === "NO")
    return "OTHER_PARTY" as const;
  return "NEEDS_REVIEW" as const;
}

export async function analyzeLegacyWorkbook(
  buffer: Buffer,
  filename: string,
): Promise<LegacyWorkbookPreview> {
  const fileHash = createHash("sha256").update(buffer).digest("hex");
  const sheets = await readXlsxFile(buffer);
  const worksheetName = sheets[0]?.sheet ?? "Sheet1";
  const data = sheets[0]?.data ?? [];
  const rows: LegacyPreviewRow[] = [];

  for (let index = 2; index < data.length; index++) {
    const sourceRow = index + 1;
    const row = data[index] ?? [];
    const item = cellText(row[0] ?? null);
    const master = row.slice(1, 8).map(cellText);
    if (!master.some(Boolean)) continue;
    const [
      jobNumber,
      jobName,
      address,
      systemType,
      tonnageValue,
      cleaning,
      schedule,
    ] = master;
    if (
      jobNumber.toLowerCase() === "job number" ||
      jobName.toLowerCase() === "job name"
    )
      continue;
    const errors: string[] = [];
    const warnings: string[] = [];
    const ambiguousCells: LegacyPreviewRow["ambiguousCells"] = [];
    const events: LegacyEvent[] = [];
    const sourceCells: Record<string, string> = {};
    for (let column = 2; column <= 82; column++) {
      const text = cellText(row[column - 1]);
      if (text) sourceCells[columnName(column)] = text;
    }
    if (!jobName) errors.push("Job name is missing");
    if (!address) errors.push("Address is missing");
    if (/^\d+(\.\d+)?$/.test(systemType))
      warnings.push("System type appears numeric");
    const tonnage =
      tonnageValue !== "" && Number.isFinite(Number(tonnageValue))
        ? Number(tonnageValue)
        : null;
    if (tonnage == null) warnings.push("Tonnage is missing or nonnumeric");
    const normalizedSchedule = schedule.toLowerCase();
    const operationPeriodType = normalizedSchedule.includes("seasonal")
      ? "SEASONAL"
      : normalizedSchedule.includes("12 month")
        ? "YEAR_ROUND"
        : "UNKNOWN";
    if (operationPeriodType === "UNKNOWN")
      errors.push("Operating schedule is unknown");
    if (schedule && !["seasonal", "12 months"].includes(normalizedSchedule))
      warnings.push(`Extra operating schedule wording preserved: ${schedule}`);
    if (cleaning)
      warnings.push(
        "Cleaning value preserved for review; no cleaning event will be created",
      );
    const legionellaResponsibility = parseLegacyResponsibility(row[8] ?? null);
    if (legionellaResponsibility === "NEEDS_REVIEW")
      warnings.push("Legionella responsibility needs review");

    // Column I is a responsibility indicator, not a monthly event column.
    for (let column = 10; column <= 82; column++) {
      const value = row[column - 1];
      if (value == null || value === "") continue;
      const context = column === 9 ? undefined : historyContext(column);
      const parsed = parseLegacyDateCell(value, context);
      const originalValue = cellText(value);
      if (parsed.kind === "date") {
        events.push({
          eventType:
            column === 77
              ? "SUMMERTIME_HYPERHALOGENATION"
              : "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
          date: parsed.date,
          sourceColumn: columnName(column),
          originalValue,
        });
      } else if (parsed.kind === "ambiguous") {
        ambiguousCells.push({
          column: columnName(column),
          value: originalValue,
          reason: parsed.reason,
        });
      }
    }
    if (
      ambiguousCells.filter((cell) => cell.value.toUpperCase() === "NO")
        .length >= 12
    )
      warnings.push("Repeated NO values may indicate an inactive account");
    const reviewStatus = errors.length
      ? "NEEDS_REVIEW"
      : warnings.length || ambiguousCells.length
        ? "READY_WITH_WARNINGS"
        : "READY";
    const legionellaDates = events
      .filter(
        (event) => event.eventType === "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
      )
      .map((event) => event.date)
      .sort();
    const hyperDates = events
      .filter((event) => event.eventType === "SUMMERTIME_HYPERHALOGENATION")
      .map((event) => event.date)
      .sort();
    rows.push({
      sourceRow,
      sourceKey: `${fileHash}:${worksheetName}:${sourceRow}`,
      item,
      jobNumber,
      jobName,
      address,
      facilityName: jobName,
      systemName: `${jobName || "Legacy tower"}${systemType ? ` — ${systemType}` : ` — row ${sourceRow}`}`,
      systemType,
      tonnage,
      operationPeriodType,
      legionellaResponsibility,
      latestLegionellaDate: legionellaDates.at(-1) ?? null,
      latestHyperhalogenationDate: hyperDates.at(-1) ?? null,
      events,
      ambiguousCells,
      sourceCells,
      warnings,
      errors,
      duplicateJobNumber: false,
      reviewStatus,
      eligible: errors.length === 0,
    });
  }

  const jobCounts = new Map<string, number>();
  for (const row of rows)
    if (row.jobNumber)
      jobCounts.set(row.jobNumber, (jobCounts.get(row.jobNumber) ?? 0) + 1);
  for (const row of rows) {
    row.duplicateJobNumber = Boolean(
      row.jobNumber && (jobCounts.get(row.jobNumber) ?? 0) > 1,
    );
    if (row.duplicateJobNumber) {
      row.warnings.push(
        "Job number appears on multiple source rows; records will remain separate",
      );
      if (row.reviewStatus === "READY")
        row.reviewStatus = "READY_WITH_WARNINGS";
    }
  }
  return {
    filename,
    fileHash,
    worksheetName,
    mapping: legacyColumnMapping,
    rows,
    counts: {
      total: rows.length,
      ready: rows.filter((row) => row.reviewStatus === "READY").length,
      readyWithWarnings: rows.filter(
        (row) => row.reviewStatus === "READY_WITH_WARNINGS",
      ).length,
      needsReview: rows.filter((row) => row.reviewStatus === "NEEDS_REVIEW")
        .length,
      recognizedEvents: rows.reduce((sum, row) => sum + row.events.length, 0),
      ambiguousCells: rows.reduce(
        (sum, row) => sum + row.ambiguousCells.length,
        0,
      ),
      duplicateJobRows: rows.filter((row) => row.duplicateJobNumber).length,
    },
  };
}
