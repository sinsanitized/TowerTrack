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

test("deadline table shows working days in a separate scan-friendly column", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1536, height: 900 });
  await page.getByRole("link", { name: "All Deadlines" }).click();
  await expect(
    page.getByRole("link", { name: /active requirements/ }),
  ).toHaveAttribute("href", "/deadlines");
  await expect(
    page.getByRole("link", { name: /cooling towers/ }),
  ).toHaveAttribute("href", "/towers");
  await expect(
    page.getByRole("link", { name: /^\d+ overdue/ }),
  ).toHaveAttribute("href", "/deadlines?period=OVERDUE");
  const table = page.getByRole("table", {
    name: "All cooling tower required work",
  });
  const expected = [
    "Cooling tower",
    "Required work",
    "Target window",
    "Hard deadline",
    "Working days left",
    "Next step",
  ];
  await expect(table.getByRole("columnheader")).toHaveCount(expected.length);
  for (const heading of expected)
    await expect(
      table.getByRole("columnheader", { name: heading, exact: true }),
    ).toBeVisible();
  for (const removed of [
    "Obligation Satisfied",
    "Jurisdiction",
    "Rule set",
    "Authority",
    "Primary Action",
    "Service Date",
    "Service Window",
    "Status",
  ])
    await expect(
      table.getByRole("columnheader", { name: removed }),
    ).toHaveCount(0);

  const firstDataRow = table.locator("tbody tr").first();
  await expect(firstDataRow.getByRole("link").first()).toHaveAttribute(
    "href",
    /^\/systems\//,
  );
  await expect(firstDataRow).toContainText(
    /, [A-Z]{2} (?:\d{5}|Postal code not recorded)/,
  );
  await expect(firstDataRow).toContainText(
    /Collect|Complete|Perform|Submit|Monitor|Review/,
  );

  const overflow = await page
    .getByTestId("deadline-table-scroll")
    .evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
  // The row priority border and enclosing panel borders account for up to six
  // layout pixels without creating user-scrollable content.
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 6);
});

test("smaller desktop keeps identity and decision columns visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/deadlines");
  const table = page.getByRole("table", {
    name: "All cooling tower required work",
  });
  for (const heading of [
    "Cooling tower",
    "Required work",
    "Target window",
    "Hard deadline",
    "Working days left",
    "Next step",
  ])
    await expect(
      table.getByRole("columnheader", { name: heading, exact: true }),
    ).toBeVisible();
  for (const removed of ["Service Date", "Service Window", "Status"])
    await expect(
      table.getByRole("columnheader", { name: removed }),
    ).toHaveCount(0);
});

test("due-date and work-type filters narrow displayed rows", async ({
  page,
}) => {
  await page.getByRole("link", { name: "All Deadlines" }).click();
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
    "Due this week",
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

  await page.getByRole("button", { name: /More deadline filters/ }).click();

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
  await page.getByRole("link", { name: "Reset more filters" }).click();
  await expect(page).toHaveURL("/deadlines?period=NEXT_WEEK&action=SAMPLE");
});

test("mobile keeps reference metadata readable without adding columns", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/deadlines");
  const table = page.getByRole("table", {
    name: "All cooling tower required work",
  });
  await expect(table.locator("th")).toHaveCount(6);
  await expect(table.getByRole("columnheader")).toHaveCount(0);
  await expect(table.locator("tbody tr").first()).toContainText(
    /(?:[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}|Not submitted|Submission date missing|Not applicable|Review)/,
  );
});

test("action center separates this week from next week", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Due this week" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Next Week" })).toBeVisible();
  await expect(page.getByText(/next three working days/i)).toHaveCount(0);
  await expect(page.getByTestId("this-week-section")).toHaveClass(
    /border-amber-200/,
  );
  await expect(page.getByTestId("next-week-section")).toHaveClass(
    /border-blue-200/,
  );
  await expect(page.getByText("Work requiring action now")).toBeVisible();
  await expect(page.getByText("Upcoming completion dates")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Work that can be completed together" }),
  ).toBeVisible();
  await expect(page.getByText("Shared valid completion dates")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View all due this week" }),
  ).toHaveAttribute("href", "/deadlines?period=THIS_WEEK");
  await expect(
    page.getByRole("link", { name: "View all due next week" }),
  ).toHaveAttribute("href", "/deadlines?period=NEXT_WEEK");
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
    await expect(
      page.getByRole("searchbox", { name: "Search deadlines" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "More deadline filters" }),
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
