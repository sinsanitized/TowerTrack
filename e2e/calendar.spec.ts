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

test("scheduler creates and reviews linked chemical addition and cleaning visits", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  await page
    .getByRole("link", { name: "Schedule cleaning", exact: true })
    .click();

  const dialog = page.locator(".fixed.inset-0");
  await expect(
    dialog.getByRole("heading", { name: "Schedule cleaning" }),
  ).toBeVisible();
  await expect(
    dialog.getByText(/Saving creates two linked visits/),
  ).toBeVisible();
  await dialog.getByLabel("Chemical addition date").fill("2026-11-06");
  await expect(dialog.getByLabel("Cleaning date")).toHaveValue("2026-11-07");
  await dialog
    .getByText("3. Optional assignment and notes", { exact: true })
    .click();
  await dialog.getByLabel("Notes (optional)").fill("Calendar end-to-end test");
  await dialog
    .getByRole("button", {
      name: "Schedule chemical addition and cleaning",
    })
    .click();

  await expect(page).toHaveURL(/\/calendar\?job=.*saved=1/);
  await expect(
    page.locator(".label").getByText("Chemical addition", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("CLEAN", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("paragraph").filter({ hasText: "Calendar end-to-end test" }),
  ).toBeVisible();
  await expect(page.getByText(/Status: Planned/)).toHaveCount(2);
});
