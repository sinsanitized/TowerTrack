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
test("home leads directly into tower event entry", async ({ page }) => {
  await expect(
    page.getByRole("heading", { name: "Action Center" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Combine work into one visit" }),
  ).toBeVisible();
  await expect(page.getByText("Tower directory")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Planning", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Schedule", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Calendar", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Routes", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/truck rolls?/i)).toHaveCount(0);
  await page.getByRole("link", { name: "Record sample" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Record what happened" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sample" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cleaning" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record startup" }),
  ).not.toBeVisible();
  await expect(
    page.getByText("Other work and special conditions", { exact: true }),
  ).toBeVisible();
  await page
    .getByText("Other work and special conditions", { exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Cleaning" })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Record routine legionella sample collected",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save record" })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Open Legionella sampling requirements",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Next required actions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Recent activity" }),
  ).toBeVisible();
});
test("system view shows authority and separate target and hard due", async ({
  page,
}) => {
  const search = page.getByRole("combobox", { name: "Find a tower" });
  await search.fill("JOB-1002");
  await expect(
    page
      .getByRole("listbox", { name: "Tower search results" })
      .getByRole("option")
      .first(),
  ).toBeVisible();
  await search.press("Enter");
  await expect(page).toHaveURL(/\/systems\//);
  await expect(
    page.getByRole("heading", { name: "Next required actions" }),
  ).toBeVisible();
  await expect(
    page.getByText("Recommended service date").first(),
  ).toBeVisible();
  await expect(page.getByText("Compliance deadline").first()).toBeVisible();
  await expect(page.getByText("Next hard due")).toHaveCount(0);
  await page.getByRole("link", { name: "Requirements", exact: true }).click();
  await page
    .getByText("Rule details and completion tools", { exact: true })
    .click();
  await expect(
    page.getByText(/Regulatory|Company policy|Guidance only/).first(),
  ).toBeVisible();
});
test("theme toggle replaces the decorative bell and persists the choice", async ({
  page,
}) => {
  const darkMode = page.getByRole("button", { name: "Switch to dark mode" });
  await expect(darkMode).toBeVisible();
  await darkMode.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const darkPalette = await page.evaluate(() => {
    const read = (className: string) => {
      const element = document.createElement("div");
      element.className = className;
      document.body.append(element);
      const style = getComputedStyle(element);
      const colors = {
        background: style.backgroundColor,
        border: style.borderTopColor,
        text: style.color,
      };
      element.remove();
      return colors;
    };
    return {
      warning: read("border border-amber-300 bg-amber-50 text-amber-950"),
      information: read("border border-blue-300 bg-blue-50 text-blue-950"),
      danger: read("border border-red-300 bg-red-50 text-red-950"),
      strongText: read("text-slate-950"),
    };
  });
  expect(darkPalette.warning).toEqual({
    background: "rgb(50, 37, 14)",
    border: "rgb(211, 167, 67)",
    text: "rgb(255, 224, 160)",
  });
  expect(darkPalette.information.text).toBe("rgb(197, 231, 255)");
  expect(darkPalette.danger.text).toBe("rgb(255, 196, 200)");
  expect(darkPalette.strongText.text).toBe("rgb(219, 229, 223)");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("unused corrective action and review destinations are removed", async ({
  page,
}) => {
  await expect(
    page.getByRole("link", { name: "Corrective Actions" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Review" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Customers" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Overdue & Problems" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Towers", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Samples", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "History", exact: true }),
  ).toBeVisible();
});

test("home presents mutually exclusive Action Center sections", async ({
  page,
}) => {
  await expect(page.getByText("Booked field visits")).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "Due this week",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Combined Visit Recommendations" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Upcoming and currently actionable" }),
  ).toBeVisible();
  await expect(
    page.getByText("Deadline", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/)
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^Overdue towers:/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /^Emergency samples:/ }),
  ).toHaveCount(0);
  const homeText = await page.locator("main").innerText();
  expect(homeText).not.toContain("Missed or overdue obligations");
  expect(homeText).not.toContain("Recently completed");
  expect(homeText).not.toContain("Annual and recurring requirements");
  await page.getByRole("link", { name: "View all recommendations" }).click();
  await expect(page).toHaveURL("/work/visit-opportunities");
  await expect(
    page.getByRole("heading", { name: "Visit opportunities" }),
  ).toBeVisible();
});

test("priority queue remains scannable on a phone-sized screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Due this week",
    }),
  ).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test("mobile navigation stays compact and exposes the active destinations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toBeHidden();
  await page.locator("aside details summary").click();
  const navigation = page.getByRole("navigation", {
    name: "Mobile navigation",
  });
  await expect(navigation).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Action Center", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    navigation.getByRole("link", { name: "All Deadlines" }),
  ).toBeVisible();
});

test("top search finds towers by building and job number", async ({ page }) => {
  const search = page.getByRole("combobox", { name: "Find a tower" });
  await search.fill("100 Park Avenue");
  const result = page
    .getByRole("listbox", { name: "Tower search results" })
    .getByRole("option", { name: /100 Park Avenue — CT-1/ })
    .first();
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/\/systems\/[a-z0-9]+$/);
  await expect(
    page.getByRole("heading", { name: /100 Park Avenue/ }),
  ).toBeVisible();

  await page.goto("/");
  await search.fill("JOB-1001");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/systems\/[a-z0-9]+$/);
});

test("visit opportunities guide technicians to record actual work without booking samples", async ({
  page,
}) => {
  await page.goto("/work/visit-opportunities");
  await expect(page.getByText("Schedule this visit")).toHaveCount(0);
  await expect(page.getByText("Create this visit")).toHaveCount(0);
  await expect(
    page.getByText(/This is field guidance, not a booked visit/).first(),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Open tower & record work" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/systems\/[a-z0-9]+#record-event$/);
  await expect(
    page.getByRole("heading", { name: "Record what happened" }),
  ).toBeVisible();
});

test("admin can view and revise a versioned rule definition", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await expect(page.getByText("Effective start")).toHaveCount(0);
  await expect(page.getByText("Effective end")).toHaveCount(0);
  const nycProfile = page
    .locator("details.panel")
    .filter({ hasText: "NYC Chapter 8 2026 + NYS Part 4" })
    .first();
  await nycProfile.locator(":scope > summary").click();
  await expect(
    nycProfile.getByText("Legionella sample date ranges"),
  ).toBeVisible();
  await expect(nycProfile.getByText("System startup")).toBeVisible();
  await expect(
    nycProfile.getByText("Twice-yearly cleaning or inspection"),
  ).toBeVisible();
  const profile = page
    .locator("details.panel")
    .filter({ hasText: "Custom Jurisdiction — Needs Review" })
    .first();
  await profile.locator(":scope > summary").click();
  await expect(profile.getByText("Routine Legionella timing")).toBeVisible();
  await expect(
    profile.getByLabel("Hard interval (days)").first(),
  ).toBeVisible();
  await expect(
    profile.getByLabel("Internal target interval (days)"),
  ).toBeVisible();
  const timingForm = profile.locator("form").first();
  await timingForm.getByLabel("Hard interval (days)").fill("45");
  await timingForm.getByLabel("Internal target interval (days)").fill("30");
  await timingForm
    .getByLabel("Reason for timing change")
    .fill("Verify audited routine timing configuration");
  await timingForm.getByRole("button", { name: "Save routine timing" }).click();
  await expect(page).toHaveURL(/savedProfile=custom/);
  await expect(
    page.getByText(/Routine timing for custom updated/),
  ).toBeVisible();
  const updatedProfile = page
    .locator("details.panel")
    .filter({ hasText: "Custom Jurisdiction — Needs Review" })
    .first();
  await expect(
    updatedProfile.getByLabel("Hard interval (days)").first(),
  ).toHaveValue("45");
  await expect(
    updatedProfile.getByLabel("Internal target interval (days)"),
  ).toHaveValue("30");
  const rule = updatedProfile
    .locator("article")
    .filter({ hasText: "Routine Legionella culture sample" })
    .first();
  await rule.getByText(/Edit rule details/).click();
  const form = rule.locator("form");
  await form.getByLabel("Notes").fill("Verified through admin rule editor");
  await form
    .getByLabel("Reason for revision")
    .fill("Verify audited administrative rule editing");
  await form.getByRole("button", { name: /Save as revision/ }).click();
  await expect(page).toHaveURL(/savedRule=custom-legionella/);
  await expect(page.getByText(/revised and affected towers/)).toBeVisible();
  const restoredProfile = page
    .locator("details.panel")
    .filter({ hasText: "Custom Jurisdiction — Needs Review" })
    .first();
  const restoreTimingForm = restoredProfile.locator("form").first();
  await restoreTimingForm.getByLabel("Hard interval (days)").fill("");
  await restoreTimingForm
    .getByLabel("Internal target interval (days)")
    .fill("");
  await restoreTimingForm
    .getByLabel("Reason for timing change")
    .fill("Restore unverified custom timing after workflow test");
  await restoreTimingForm
    .getByRole("button", { name: "Save routine timing" })
    .click();
  await expect(page).toHaveURL(/savedProfile=custom/);
});

test("customer onboarding continues from address to cooling tower details", async ({
  page,
}) => {
  const customerName = `Workflow Test Customer ${Date.now()}`;
  await page.getByRole("link", { name: "Customers" }).click();
  const addCustomer = page.locator("form").filter({
    has: page.getByRole("button", {
      name: "Continue to cooling tower details",
    }),
  });
  await addCustomer.getByLabel("Customer name").fill(customerName);
  await addCustomer.getByLabel("Street address").fill("123 Test Avenue");
  await addCustomer.getByLabel("City").fill("New York");
  await addCustomer.getByLabel("State").fill("NY");
  await addCustomer.getByLabel("ZIP code").fill("10001");
  await addCustomer
    .getByRole("button", { name: "Continue to cooling tower details" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Add cooling tower details" }),
  ).toBeVisible();
  await page.getByLabel("Manufacturer (optional)").fill("Test Manufacturer");
  await page.getByLabel("Model number").fill("MODEL-100");
  await page.getByLabel("Serial number").fill("SERIAL-100");
  await page.getByLabel("Tower location").fill("Roof, west side");
  await page.getByLabel("Cooling Tower Tonnage").fill("450");
  await page.getByLabel("Year-round").check();
  await page
    .getByLabel("Legionella Responsibility")
    .selectOption("OUR_COMPANY");
  await page
    .getByLabel("Jurisdiction", { exact: true })
    .selectOption({ label: "New York, NY" });
  await page
    .getByLabel("Compliance rules", { exact: true })
    .selectOption("NYC_AND_NYS");
  await page.getByLabel("Profile version", { exact: true }).selectOption({
    label: "NYC Chapter 8 + New York State — NYC Chapter 8 2026 + NYS Part 4",
  });
  await page.getByRole("button", { name: "Create cooling tower" }).click();
  await expect(page.getByText("Cooling tower created")).toBeVisible();
  await page.getByRole("link", { name: "Tower Information" }).click();
  await expect(
    page.getByRole("heading", { name: "Equipment details" }),
  ).toBeVisible();
  await expect(page.getByText("MODEL-100")).toBeVisible();
  await expect(page.getByText("SERIAL-100")).toBeVisible();
  await expect(page.getByText("450 tons")).toBeVisible();
  await page
    .getByRole("link", { name: "Settings", exact: true })
    .last()
    .click();
  await page.getByRole("link", { name: "Edit customer & tower" }).click();
  await expect(
    page.getByRole("heading", { name: new RegExp(`Edit ${customerName}`) }),
  ).toBeVisible();
  await expect(page.getByLabel("Jurisdiction", { exact: true })).toHaveValue(
    /.+/,
  );
  await expect(
    page.getByText("NYC Chapter 8 + New York State").first(),
  ).toBeVisible();
  await page.getByLabel("Tower location").fill("Roof, east side");
  await page
    .getByRole("button", { name: "Save customer and tower changes" })
    .click();
  await expect(
    page.getByText(/customer, tower, jurisdiction, and rule settings updated/i),
  ).toBeVisible();
  await page.getByRole("link", { name: "Tower Information" }).click();
  await expect(page.getByText("Roof, east side")).toBeVisible();
});

test("legacy sample correction route opens the audited event editor", async ({
  page,
}) => {
  const search = page.getByRole("combobox", { name: "Find a tower" });
  await search.fill("JOB-1001");
  const result = page
    .getByRole("listbox", { name: "Tower search results" })
    .getByRole("option")
    .first();
  await expect(result).toHaveAttribute("href", /^\/systems\//);
  const systemUrl = await result.getAttribute("href");
  await page.goto(`${systemUrl}/correct`);
  await expect(page).toHaveURL(/\/events\//);
  await expect(
    page.getByRole("heading", { name: "Correct record details" }),
  ).toBeVisible();
  await expect(page.getByText("Correction reason (required)")).toBeVisible();
});

test("operations manager can open and correct an individual event", async ({
  page,
}) => {
  const search = page.getByRole("combobox", { name: "Find a tower" });
  await search.fill("JOB-1002");
  await search.press("Enter");
  const eventHistory = page.locator("#regulatory-events");
  await eventHistory
    .getByRole("link", { name: /View or edit event/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Correct record details" }),
  ).toBeVisible();
  await expect(page.getByLabel("Event type")).toBeVisible();
  await expect(page.getByLabel(/date.*Required/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Correction impact preview" }),
  ).toBeVisible();
  await page.getByLabel(/date.*Required/).fill("2026-07-17");
  await page
    .getByLabel("Notes")
    .fill("Corrected through event detail workflow");
  await page
    .getByLabel("Correction reason (required)")
    .fill("Verified against the signed field record");
  await page.getByRole("button", { name: "Save corrected record" }).click();
  await expect(page.getByText(/Compliance record corrected/)).toBeVisible();
  await expect(
    page
      .locator("#regulatory-events")
      .getByText("corrected replacement")
      .first(),
  ).toBeVisible();
});

test("operations manager records cleaning in the tower event workflow", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Find a tower" });
  await search.fill("Pennsylvania Distribution Hub");
  await page
    .getByRole("listbox", { name: "Tower search results" })
    .getByRole("option", { name: /Pennsylvania Distribution Hub/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/systems\//);
  await page.getByRole("button", { name: "Add compliance record" }).click();
  await expect(
    page.getByRole("heading", { name: "Record what happened" }),
  ).toBeVisible();
  await page
    .getByText("Other work and special conditions", { exact: true })
    .click();
  const addCleaning = page.getByRole("button", { name: "Cleaning" });
  await expect(addCleaning).toBeVisible();
  await addCleaning.click();
  await expect(page.getByLabel("Cleaning type")).toBeVisible();
  const eventForm = page.locator("#record-event form");
  await eventForm.getByLabel(/date.*Required/).fill("2026-07-14");
  await eventForm.getByText("Add notes (optional)", { exact: true }).click();
  await eventForm.getByLabel("Notes").fill("Verified field cleaning record");
  await eventForm.getByRole("button", { name: "Save record" }).click();
  await expect(page).toHaveURL(/event=/);
  await expect(page.getByText(/Event recorded/)).toBeVisible();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  const recentActivity = page.locator(".panel").filter({
    has: page.getByRole("heading", { name: "Recent activity" }),
  });
  await expect(recentActivity).toBeVisible();
  await expect(recentActivity.getByText("Tue, Jul 14, 2026")).toBeVisible();
});
