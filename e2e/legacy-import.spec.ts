import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

test("administrator previews, confirms, and safely rolls back a legacy workbook", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByLabel("Email")
    .fill(process.env.INITIAL_ADMIN_EMAIL ?? "admin@towertrack.local");
  await page
    .getByLabel("Password")
    .fill(process.env.INITIAL_ADMIN_PASSWORD ?? "ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/admin/legacy-import");

  const fixture = await readFile("tests/fixtures/legacy-import-sanitized.xlsx");
  const workbook = unzipSync(fixture);
  const coreProperties = strFromU8(workbook["docProps/core.xml"]);
  workbook["docProps/core.xml"] = strToU8(
    coreProperties.replace(
      "</cp:coreProperties>",
      `<!-- test-run-${Date.now()} --></cp:coreProperties>`,
    ),
  );
  await page.getByLabel("Legacy Excel workbook").setInputFiles({
    name: `legacy-import-${Date.now()}.xlsx`,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(zipSync(workbook)),
  });
  await page
    .locator('select[name="jurisdictionId"]')
    .selectOption({ label: "New York, NY" });
  await page
    .locator('select[name="ruleProfileId"]')
    .selectOption({ label: "NYC Chapter 8 2026 + NYS Part 4" });
  await page.getByRole("button", { name: "Analyze workbook" }).click();

  await expect(
    page.getByText(
      "Analysis complete. No operational records have been written.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Proposed systems")).toBeVisible();
  const missingZipSummary = page.locator("div.rounded-lg").filter({
    hasText: "missing Postal Codes",
  });
  await expect(missingZipSummary.getByText("3", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm import of 2 rows" }),
  ).toBeVisible();
  await expect(page.getByText("NEEDS REVIEW", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Confirm import of 2 rows" }).click();
  await expect(page.getByText(/Import confirmed: 2 systems/)).toBeVisible();
  await page
    .getByRole("button", { name: "Rollback untouched imported records" })
    .click();
  await expect(
    page.getByText("Rolled back 2 untouched imported rows."),
  ).toBeVisible();
});
