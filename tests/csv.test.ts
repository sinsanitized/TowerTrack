import { describe, expect, it } from "vitest";
import { csvCell, parseCsv, previewSystemCsv } from "@/lib/csv";
describe("CSV import preview", () => {
  it("parses quoted commas", () =>
    expect(parseCsv('name,notes\n"Tower, One","ok"')[1]).toEqual([
      "Tower, One",
      "ok",
    ]));
  it("validates dates and duplicates before commit", () => {
    const csv =
      "customer_name,account_number,building_name,street_address,city,state,postal_code,route_zone,system_name,job_number,rule_profile_id,last_legionella_sample,date_source\nA,1,B,1 St,X,NY,1,Z,CT-1,J1,nyc-2026,bad,IMPORTED_CSV\nA,1,B,1 St,X,NY,1,Z,CT-2,J1,nyc-2026,2026-01-01,IMPORTED_CSV";
    const p = previewSystemCsv(csv, "2026-07-17");
    expect(p.errors[0].message).toMatch(/YYYY/);
    expect(p.duplicates).toEqual([3]);
  });
  it("rejects impossible and future date-only values", () => {
    const header =
      "customer_name,account_number,building_name,street_address,city,state,postal_code,route_zone,system_name,job_number,rule_profile_id,last_legionella_sample,date_source";
    const bad = previewSystemCsv(
      `${header}\nA,1,B,1 St,X,NY,10001,Z,CT-1,J1,nyc-2026,2026-02-30,IMPORTED_CSV`,
      "2026-07-17",
    );
    const future = previewSystemCsv(
      `${header}\nA,1,B,1 St,X,NY,10001,Z,CT-1,J1,nyc-2026,2026-07-18,IMPORTED_CSV`,
      "2026-07-17",
    );
    expect(bad.errors.some((error) => /valid YYYY/.test(error.message))).toBe(
      true,
    );
    expect(future.errors.some((error) => /future/.test(error.message))).toBe(
      true,
    );
  });
  it("neutralizes spreadsheet formulas in exports", () => {
    expect(csvCell('=HYPERLINK("bad")')).toBe(`"'=HYPERLINK(""bad"")"`);
  });
});
