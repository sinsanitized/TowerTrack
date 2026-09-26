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

test("history records open from anywhere in the row", async ({ page }) => {
  await page.goto("/history");
  const firstRow = page.getByTestId("history-record-row").first();
  await expect(firstRow).toBeVisible();
  await expect(firstRow.getByRole("link")).toHaveCount(1);
  await expect(firstRow.getByRole("link")).toHaveAttribute(
    "href",
    /\/systems\/.+\/events\/.+/,
  );
  await expect(firstRow.getByText("Open", { exact: false })).toBeVisible();
});
