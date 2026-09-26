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

test("operational list rows open their primary action from row space", async ({
  page,
}) => {
  await page.goto("/deadlines");
  const deadlineRow = page.locator("tbody tr[data-action-label]").first();
  await expect(deadlineRow).toBeVisible();
  await deadlineRow.locator('td[data-label="Target window"]').click();
  await expect(page).toHaveURL(/\/systems\/.+/);

  await page.goto("/samples");
  const sampleRow = page.locator("article[data-action-label]").first();
  await expect(sampleRow).toBeVisible();
  await sampleRow.getByText("Laboratory result", { exact: true }).click();
  await expect(page).toHaveURL(/\/systems\/.+/);

  await page.goto("/customers");
  const customerRow = page.locator("tbody tr[data-action-label]").first();
  await expect(customerRow).toBeVisible();
  await customerRow.locator("td").nth(1).click();
  await expect(page).toHaveURL(/\/systems\/.+|\/customers\/.+\/towers\/new/);
});
