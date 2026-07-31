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

  const search = page.getByRole("combobox", { name: "Search towers" });
  await search.fill("JOB-1001");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/systems\//);
});

test("tower details uses focused role-aware views", async ({ page }) => {
  await expect(
    page.getByRole("heading", { name: "Next required actions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Recent activity" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Two-day cleaning plan" }),
  ).toHaveCount(0);

  const recordButton = page.getByRole("button", { name: "Record an event" });
  await recordButton.click();
  const drawer = page.getByRole("dialog", { name: "Record an event" });
  await expect(drawer).toBeVisible();
  for (const action of [
    "Record Legionella sample",
    "Record Legionella result",
    "Record inspection",
    "Record disinfection",
  ])
    await expect(drawer.getByRole("button", { name: action })).toBeVisible();
  await expect(
    drawer.getByRole("button", { name: "Record cleaning" }),
  ).not.toBeVisible();
  await expect(
    drawer.getByRole("heading", { name: "Expected Compliance Impact" }),
  ).toBeVisible();
  await expect(drawer.getByText("Show Preview", { exact: true })).toHaveCount(
    0,
  );
  await drawer.getByRole("button", { name: "Record inspection" }).click();
  const saveEvent = drawer.getByRole("button", { name: "Save Event" });
  const cancel = drawer.getByRole("button", { name: "Cancel", exact: true });
  await expect(saveEvent).toHaveClass(/btn-primary/);
  await expect(cancel).not.toHaveClass(/btn-primary/);
  await expect(
    drawer.getByRole("heading", { name: "Expected Compliance Impact" }),
  ).toBeVisible();
  const moreEvents = drawer.getByText("More event types", { exact: true });
  await moreEvents.focus();
  await expect(moreEvents).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    drawer.getByRole("button", { name: "Record cleaning" }),
  ).toBeVisible();
  await expect(
    drawer.getByRole("button", {
      name: "Confirm owner-managed bacteriological sample",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close event recorder" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(recordButton).toBeFocused();

  await page.getByRole("link", { name: "Obligations", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "All open obligations" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Two-day cleaning plan" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "History", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Regulatory events" }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: "Tower Information", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tower location" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Equipment details" }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: "Settings", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Tower operation pattern" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Jurisdiction & rules" }),
  ).toBeVisible();
});

test("recent activity is ordered by completed event date, newest first", async ({
  page,
}) => {
  const recentActivity = page.locator("section.panel").filter({
    has: page.getByRole("heading", { name: "Recent activity" }),
  });
  const dates = await recentActivity
    .locator("time")
    .evaluateAll((items) =>
      items.map((item) => item.getAttribute("datetime") || ""),
    );

  expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
});
