import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  analyzeLegacyWorkbook,
  parseLegacyResponsibility,
  parseLegacyDateCell,
} from "@/lib/legacy-import/parser";
import { isUnverifiedLegacyEvent } from "@/lib/legacy-import/safety";

describe("legacy Excel date parsing", () => {
  it("accepts Excel dates and preserves the calendar date", () => {
    expect(parseLegacyDateCell(new Date("2026-07-10T00:00:00.000Z"))).toEqual({
      kind: "date",
      date: "2026-07-10",
    });
  });

  it("accepts complete date strings", () => {
    expect(parseLegacyDateCell("7/10/2026")).toEqual({
      kind: "date",
      date: "2026-07-10",
    });
    expect(parseLegacyDateCell("2026-07-10")).toEqual({
      kind: "date",
      date: "2026-07-10",
    });
  });

  it("accepts day-only values only with a known year and month", () => {
    expect(parseLegacyDateCell(21, { year: 2026, month: 7 })).toEqual({
      kind: "date",
      date: "2026-07-21",
    });
    expect(parseLegacyDateCell(21).kind).toBe("ambiguous");
  });

  it("handles leap years and rejects impossible dates", () => {
    expect(parseLegacyDateCell(29, { year: 2024, month: 2 }).kind).toBe("date");
    expect(parseLegacyDateCell(29, { year: 2023, month: 2 }).kind).toBe(
      "ambiguous",
    );
    expect(parseLegacyDateCell("2/30/2026").kind).toBe("ambiguous");
  });

  it.each([87848, "PD", "NO", "NEEDS", "MAY", "canceled", "*", "6/1-6/15"])(
    "does not treat %s as a completed date",
    (value) => {
      expect(parseLegacyDateCell(value, { year: 2026, month: 7 }).kind).toBe(
        "ambiguous",
      );
    },
  );

  it("ignores blank cells", () => {
    expect(parseLegacyDateCell(null)).toEqual({ kind: "blank" });
    expect(parseLegacyDateCell("")).toEqual({ kind: "blank" });
  });
});

describe("legacy responsibility parsing", () => {
  it("preserves the three source states without guessing the other party", () => {
    expect(parseLegacyResponsibility(44000)).toBe("OUR_COMPANY");
    expect(parseLegacyResponsibility(new Date("2020-06-01T00:00:00Z"))).toBe(
      "OUR_COMPANY",
    );
    expect(parseLegacyResponsibility("NO")).toBe("OTHER_PARTY");
    expect(parseLegacyResponsibility("no")).toBe("NEEDS_REVIEW");
    expect(parseLegacyResponsibility("8/21/2020")).toBe("NEEDS_REVIEW");
    expect(parseLegacyResponsibility(null)).toBe("NEEDS_REVIEW");
  });
});

describe("legacy workbook preview", () => {
  it("keeps duplicate job numbers as separate systems and isolates partial failures", async () => {
    const workbook = await readFile(
      "tests/fixtures/legacy-import-sanitized.xlsx",
    );
    const preview = await analyzeLegacyWorkbook(workbook, "sanitized.xlsx");

    expect(preview.rows).toHaveLength(3);
    expect(preview.rows[0].sourceKey).not.toBe(preview.rows[1].sourceKey);
    expect(preview.rows[0].duplicateJobNumber).toBe(true);
    expect(preview.rows[1].duplicateJobNumber).toBe(true);
    expect(preview.rows[2].reviewStatus).toBe("NEEDS_REVIEW");
    expect(preview.rows[0].latestLegionellaDate).toBe("2026-01-15");
    expect(preview.rows[0].latestHyperhalogenationDate).toBe("2026-07-10");
  });

  it("is deterministic and never fabricates result events", async () => {
    const workbook = await readFile(
      "tests/fixtures/legacy-import-sanitized.xlsx",
    );
    const first = await analyzeLegacyWorkbook(workbook, "sanitized.xlsx");
    const second = await analyzeLegacyWorkbook(workbook, "sanitized.xlsx");

    expect(second.fileHash).toBe(first.fileHash);
    expect(second.rows.map((row) => row.sourceKey)).toEqual(
      first.rows.map((row) => row.sourceKey),
    );
    expect(first.rows.flatMap((row) => row.events)).not.toContainEqual(
      expect.objectContaining({ eventType: "LEGIONELLA_RESULT_RECEIVED" }),
    );
  });
});

describe("legacy compliance safety", () => {
  it("identifies unverified legacy events for exclusion from compliance clocks", () => {
    expect(
      isUnverifiedLegacyEvent({
        source: "LEGACY_EXCEL",
        verificationStatus: "UNVERIFIED",
      }),
    ).toBe(true);
    expect(isUnverifiedLegacyEvent({ source: "USER_ENTRY" })).toBe(false);
  });
});
