import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@towertrack.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
});

test("operations manager can edit seasonal operation settings from a job", async ({
  page,
}) => {
  const search = page.getByRole("combobox", { name: "Search towers" });
  await search.fill("100 Park Avenue");
  await search.press("Enter");

  const seasonalForm = page.locator("form").filter({
    has: page.getByRole("button", { name: "Save operation pattern" }),
  });

  const seasonalChoice = seasonalForm.getByRole("radio", {
    name: /^Seasonal Tower/,
  });
  await seasonalForm.getByRole("radio", { name: /^Year-Round Tower/ }).check();
  await expect(seasonalForm.getByLabel("Season start month")).toHaveCount(0);
  await expect(seasonalForm.getByLabel("Season end month")).toHaveCount(0);
  if (!(await seasonalChoice.isChecked())) {
    await seasonalChoice.check();
  }
  await expect(seasonalForm.getByLabel("Season start month")).toBeVisible();
  await seasonalForm.getByLabel("Season start month").selectOption("5");
  await seasonalForm.getByLabel("Season start day").fill("1");
  await seasonalForm.getByLabel("Season end month").selectOption("10");
  await seasonalForm.getByLabel("Season end day").fill("31");
  await seasonalForm
    .getByLabel("Reason for change")
    .fill("Confirm seasonal May through October operation");
  await seasonalForm
    .getByRole("button", { name: "Save operation pattern" })
    .click();

  await expect(page).toHaveURL(/operationPattern=1/);
  await expect(
    page.getByText("Seasonal Tower · May 1–Oct 31").first(),
  ).toBeVisible();
  await expect(
    page.getByText("Seasonal Tower · May 1–Oct 31 · Operating season", {
      exact: true,
    }),
  ).toBeVisible();

  await expect(
    page.getByText(/Changing this configuration does not prove/),
  ).toBeVisible();
});
