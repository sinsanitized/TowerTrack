import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page
    .getByLabel("Email")
    .fill(process.env.INITIAL_ADMIN_EMAIL ?? "admin@towertrack.local");
  await page
    .getByLabel("Password")
    .fill(process.env.INITIAL_ADMIN_PASSWORD ?? "ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
});

test("tower settings expose explicit effective-dated compliance rules", async ({
  page,
}) => {
  await page.goto("/deadlines?configuration=NYC_AND_NYS");
  const table = page.getByRole("table", {
    name: "All cooling tower required work",
  });
  await table.getByRole("row").nth(1).getByRole("link").first().click();
  await page
    .getByLabel("Tower workspace")
    .getByRole("link", { name: "Settings", exact: true })
    .click();
  await expect(
    page.getByText("4. Jurisdiction and compliance rules"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Current rule assignment" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Change compliance rules" }).click();
  await expect(
    page.getByText("Compliance rules", { exact: true }).first(),
  ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Change compliance rules" })
    .click();
  await expect(page.getByLabel("Rule configuration")).toBeVisible();
  await expect(page.getByLabel("Assigned profile version")).toBeVisible();
  await expect(
    page.getByLabel("Effective date", { exact: true }),
  ).toBeVisible();
});

test("deadline hyperhalogenation action opens the date-only focused form", async ({
  page,
}) => {
  await page.goto("/deadlines");
  const action = page.locator('a[href*="record=hyperhalogenation"]');
  await expect(action.first()).toBeVisible();
  await action.first().click();
  await expect(page).toHaveURL(/record=hyperhalogenation/);
  await expect(
    page.getByRole("heading", {
      name: "Record summertime hyperhalogenation",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Date Performed")).toBeVisible();
  await expect(
    page.getByText(
      "Record the date the summertime hyperhalogenation was completed. Treatment details are maintained on the separate service form.",
    ),
  ).toBeVisible();
  for (const removedField of [
    "Chemical",
    "Quantity",
    "Contact time",
    "pH",
    "Free halogen residual",
    "Technician",
    "Notes",
  ])
    await expect(page.getByLabel(removedField, { exact: true })).toHaveCount(0);
});
