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

  await page.goto("/towers");
  await page.getByRole("link", { name: "Open tower" }).first().click();
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

  const recordButton = page.getByRole("button", {
    name: "Add compliance record",
  });
  await recordButton.click();
  const drawer = page.getByRole("dialog", { name: "Add compliance record" });
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByRole("button", { name: "Inspection" }),
  ).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Cleaning" })).toBeVisible();
  await drawer.getByRole("button", { name: "Inspection" }).click();
  const saveEvent = drawer.getByRole("button", { name: "Save record" });
  const cancel = drawer.getByRole("button", { name: "Cancel", exact: true });
  await expect(saveEvent).toHaveClass(/btn-primary/);
  await expect(cancel).not.toHaveClass(/btn-primary/);
  await expect(
    drawer.getByRole("heading", { name: "What saving this record will do" }),
  ).toBeVisible();
  const moreEvents = drawer.getByText("Other work and special conditions", {
    exact: true,
  });
  await moreEvents.focus();
  await expect(moreEvents).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    drawer.getByRole("button", {
      name: "Confirm owner-managed bacteriological sample",
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(recordButton).toBeFocused();

  await page.getByRole("link", { name: "Requirements", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "All open requirements" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Two-day cleaning plan" }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: "Records & History", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Compliance records" }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: "Tower Information", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tower location" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Who handles each service" }),
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

test("samples prioritize action and expose clear status views", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Samples", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Samples" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Action needed/ }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("link", { name: /Waiting on another party/ }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Completed/ })).toBeVisible();
  await expect(
    page.getByRole("searchbox", {
      name: "Find a customer, facility, tower, or job",
    }),
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
