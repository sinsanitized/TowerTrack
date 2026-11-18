import { expect, test, type Locator } from "@playwright/test";

async function waitForReact(locator: Locator) {
  await locator.evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        const ready = () =>
          Object.keys(element).some((key) => key.startsWith("__reactProps$"));
        if (ready()) return resolve();
        const interval = window.setInterval(() => {
          if (!ready()) return;
          window.clearInterval(interval);
          resolve();
        }, 10);
      }),
  );
}

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

test("deadline register shows address, tower, work, and deadline", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1536, height: 900 });
  await page.getByRole("link", { name: "Deadline register" }).click();
  await expect(page.getByText(/deadlines? · \d+ towers?/)).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  const register = page.getByRole("region", { name: "Deadlines" });
  await expect(
    register.getByText("Address", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    register.getByText("Tower", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    register.getByText("Required work", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    register.getByText("Deadline", { exact: true }).first(),
  ).toBeVisible();
  await expect(register.getByRole("link").first()).toHaveAttribute(
    "href",
    /^\/systems\//,
  );
});

test("smaller desktop keeps tower summaries readable", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/deadlines");
  await expect(
    page.getByRole("heading", { name: "Deadline register" }),
  ).toBeVisible();
  const firstDeadline = page
    .getByRole("region", { name: "Deadlines" })
    .getByRole("link")
    .first();
  await expect(firstDeadline).toBeVisible();
  const horizontalOverflow = await page
    .locator("main")
    .evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(2);
});

test("due-date and work-type filters narrow displayed rows", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Deadline register" }).click();
  await page.getByText("Filter deadlines", { exact: true }).click();
  await expect(
    page.getByRole("navigation", {
      name: "Filter by Rule Configuration",
    }),
  ).toHaveCount(0);
  const dueDateFilter = page.getByRole("combobox", { name: "Due date" });
  await waitForReact(dueDateFilter);
  for (const label of [
    "All due dates",
    "Overdue",
    "This week",
    "Due next week",
    "Due later",
  ])
    await expect(
      dueDateFilter.getByRole("option", { name: label }),
    ).toHaveCount(1);
  await dueDateFilter.selectOption("NEXT_WEEK");
  await expect(page).toHaveURL("/deadlines?period=NEXT_WEEK");

  const workTypeFilter = page.getByRole("combobox", { name: "Work type" });
  await waitForReact(workTypeFilter);
  for (const label of [
    "All work types",
    "Samples",
    "Inspections",
    "Cleaning & treatment",
    "Reporting & certification",
  ])
    await expect(
      workTypeFilter.getByRole("option", { name: label }),
    ).toHaveCount(1);
  await workTypeFilter.selectOption("SAMPLE");
  await expect(page).toHaveURL("/deadlines?period=NEXT_WEEK&action=SAMPLE");

  await expect(page.getByText("Later this month", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("Next month", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Sort deadlines" }),
  ).toHaveCount(0);
  await expect(page.getByText("Tonnage low–high", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("Tonnage high–low", { exact: true })).toHaveCount(
    0,
  );

  const search = page.getByRole("searchbox", { name: "Search deadlines" });
  await expect(search).toHaveAttribute(
    "placeholder",
    "Search tower, address, or action",
  );

  const scheduleFilter = page.getByRole("combobox", {
    name: "Filter deadlines by operating schedule",
  });
  await waitForReact(scheduleFilter);
  for (const label of [
    "All schedules",
    "Seasonal",
    "Year-round",
    "Schedule not set",
  ])
    await expect(
      scheduleFilter.getByRole("option", { name: label }),
    ).toHaveCount(1);
  await scheduleFilter.selectOption("SEASONAL");
  await expect(page).toHaveURL(
    "/deadlines?period=NEXT_WEEK&action=SAMPLE&schedule=SEASONAL",
  );

  const responsibility = page.getByRole("combobox", {
    name: "Filter deadlines by responsible party",
  });
  await waitForReact(responsibility);
  for (const label of [
    "Our company",
    "Customer",
    "Other vendor",
    "Not tracked",
    "All responsibilities",
  ])
    await expect(
      responsibility.getByRole("option", { name: label, exact: true }),
    ).toHaveCount(1);
  await responsibility.selectOption("CUSTOMER");
  await expect(page).toHaveURL(
    "/deadlines?period=NEXT_WEEK&action=SAMPLE&schedule=SEASONAL&responsibility=CUSTOMER",
  );
  await expect(
    page.getByText("Seasonal · Customer managed").last(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL("/deadlines");
});

test("mobile keeps reference metadata readable without adding columns", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/deadlines");
  const firstDeadline = page
    .getByRole("region", { name: "Deadlines" })
    .getByRole("link")
    .first();
  await expect(
    firstDeadline.getByText("Address", { exact: true }),
  ).toBeVisible();
  await expect(firstDeadline.getByText("Tower", { exact: true })).toBeVisible();
  await expect(
    firstDeadline.getByText("Deadline", { exact: true }),
  ).toBeVisible();
});

test("Today stays focused on current-week work", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Next Week" })).toHaveCount(0);
  await expect(page.getByText(/next three working days/i)).toHaveCount(0);
  await expect(page.getByTestId("this-week-section")).toHaveClass(
    /action-center-due-week/,
  );
  await expect(page.getByText("Work requiring action now")).toBeVisible();
  await expect(page.getByText("Upcoming completion dates")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Work that can be completed together" }),
  ).toHaveCount(0);
  await expect(page.getByText("Shared valid completion dates")).toHaveCount(0);
  const dueThisWeek = page.getByRole("link", {
    name: "View all due this week",
  });
  if (await dueThisWeek.isVisible())
    await expect(dueThisWeek).toHaveAttribute(
      "href",
      "/deadlines?period=THIS_WEEK",
    );
  await expect(
    page.getByRole("link", { name: "View all due next week" }),
  ).toHaveCount(0);
});

test("simplified deadline controls wrap at laptop and mobile widths", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/deadlines");
    await page.getByText("Filter deadlines", { exact: true }).click();
    await expect(
      page.getByRole("searchbox", { name: "Search deadlines" }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", {
        name: "Filter deadlines by operating schedule",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Due date" }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Work type" }),
    ).toBeVisible();
    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBeLessThanOrEqual(pageWidth.client + 1);
  }
});
