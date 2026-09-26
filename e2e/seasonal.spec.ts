import { test, expect } from "@playwright/test";

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

test("operations manager can edit seasonal operation settings from a job", async ({
  page,
}) => {
  await page.goto("/deadlines");
  const systemUrl = await page
    .getByRole("table", { name: "All cooling tower required work" })
    .getByRole("row")
    .nth(1)
    .getByRole("link")
    .first()
    .getAttribute("href");
  expect(systemUrl).toMatch(/^\/systems\//);
  await page.goto(`${systemUrl}?view=settings`);

  const seasonalForm = page.locator("form").filter({
    has: page.getByRole("button", { name: "Save operating schedule" }),
  });

  const seasonalChoice = seasonalForm.getByRole("radio", {
    name: /^Seasonal/,
  });
  await seasonalForm.getByRole("radio", { name: /^Year-round/ }).check();
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
    .getByRole("button", { name: "Save operating schedule" })
    .click();

  await expect(page).toHaveURL(/operationPattern=1/);
  await expect(
    page.getByText("Seasonal Tower · May 1–Oct 31").first(),
  ).toBeVisible();
  await page.goto(`${systemUrl}?view=settings&operationPattern=1`);
  await expect(
    page.getByText(/Changing this configuration does not prove/),
  ).toBeVisible();
});
