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

  await page.goto("/history");
  const historyRow = page.getByTestId("history-record-row").first();
  await expect(historyRow).toBeVisible();
  await historyRow.click();
  await expect(page).toHaveURL(/\/systems\/.+\/events\/.+/);

  await page.goto("/customers");
  const customerRow = page.locator("tbody tr[data-action-label]").first();
  await expect(customerRow).toBeVisible();
  await customerRow.locator("td").nth(1).click();
  await expect(page).toHaveURL(/\/systems\/.+|\/customers\/.+\/towers\/new/);
});

test("operational rows can be opened with the keyboard", async ({ page }) => {
  await page.goto("/deadlines");
  const deadlineRow = page.locator("tbody tr[data-action-label]").first();
  await deadlineRow.focus();
  await deadlineRow.press("Enter");
  await expect(page).toHaveURL(/\/systems\/.+/);
});

test("large operational directories are paginated and searchable", async ({
  page,
}) => {
  await page.goto("/samples");
  expect(
    await page.locator("article[data-action-label]").count(),
  ).toBeLessThanOrEqual(50);

  await page.goto("/towers");
  expect(
    await page.locator("article[data-action-label]").count(),
  ).toBeLessThanOrEqual(25);
  const towerName = (
    await page.locator("article[data-action-label] a").first().innerText()
  ).trim();
  await page.getByPlaceholder("Search the tower directory").fill(towerName);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.locator("article[data-action-label]").first(),
  ).toBeVisible();

  await page.goto("/customers");
  await page.getByPlaceholder("Search the customer directory").fill(towerName);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator("tbody tr[data-action-label]")).not.toHaveCount(0);
});
