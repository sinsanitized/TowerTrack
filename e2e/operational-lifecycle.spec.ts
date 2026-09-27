import { expect, test, type Locator, type Page } from "@playwright/test";

test.describe.configure({ timeout: 240_000 });

async function login(page: Page) {
  await page.goto("/login");
  await page
    .getByLabel("Email")
    .fill(process.env.INITIAL_ADMIN_EMAIL ?? "admin@towertrack.local");
  await page
    .getByLabel("Password")
    .fill(process.env.INITIAL_ADMIN_PASSWORD ?? "ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

async function createNycTower(
  page: Page,
  name: string,
  legionellaResponsibility: "OUR_COMPANY" | "CUSTOMER" = "OUR_COMPANY",
) {
  await page.getByRole("link", { name: "Customers" }).click();
  const customerForm = page.locator("form").filter({
    has: page.getByRole("button", {
      name: "Continue to cooling tower details",
    }),
  });
  await customerForm.getByLabel("Customer name").fill(name);
  await customerForm.getByLabel("Street address").fill("410 Lifecycle Way");
  await customerForm.getByLabel("City").fill("New York");
  await customerForm.getByLabel("State").fill("NY");
  await customerForm.getByLabel("ZIP code").fill("10001");
  await customerForm
    .getByRole("button", { name: "Continue to cooling tower details" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Add cooling tower details" }),
  ).toBeVisible();
  await page.getByLabel("Manufacturer (optional)").fill("Lifecycle Works");
  await page.getByLabel("Model number").fill("LC-500");
  await page.getByLabel("Serial number").fill(`SER-${Date.now()}`);
  await page.getByLabel("Tower location").fill("Roof, mechanical penthouse");
  await page.getByLabel("Cooling Tower Tonnage").fill("500");
  await page.getByLabel("Year-round").check();
  await page
    .getByLabel(
      legionellaResponsibility === "OUR_COMPANY"
        ? "Our company manages Legionella"
        : "Customer manages Legionella",
    )
    .check();
  await page
    .getByLabel("Jurisdiction", { exact: true })
    .selectOption({ label: "New York, NY" });
  await page.getByLabel("NYC Chapter 8 and NYS Part 4").check();
  await page
    .getByLabel("Profile version", { exact: true })
    .selectOption("nyc-2026");
  await page.getByRole("button", { name: "Create cooling tower" }).click();
  await expect(page.getByText("Cooling tower created")).toBeVisible();
  await expect(page.getByText("Baseline required").first()).toBeVisible();
  return page.url().split("?")[0];
}

async function waitForSavedRecord(page: Page) {
  await expect(page.locator("#record-event")).toHaveCount(0);
}

async function saveRecorder(
  page: Page,
  configure: (form: Locator) => Promise<void>,
) {
  const form = page.locator("#record-event form");
  await form.getByText("Add notes (optional)", { exact: true }).click();
  await configure(form);
  await form.getByRole("button", { name: "Save record" }).click();
  await waitForSavedRecord(page);
}

async function recordEvent(
  page: Page,
  button: string,
  date: string,
  notes: string,
  configure?: (form: Locator) => Promise<void>,
) {
  const recorder = page.locator("#record-event");
  const eventButton = recorder.getByRole("button", { name: button });
  const moreActions = recorder.getByText("Other work and special conditions", {
    exact: true,
  });
  if (!(await recorder.isVisible())) {
    const openRecorder = page.getByRole("button", {
      name: "Add compliance record",
    });
    await openRecorder.click();
    await expect(recorder).toBeVisible();
  }
  await expect(moreActions).toBeVisible();
  if (!(await eventButton.isVisible())) {
    await moreActions.click();
  }
  await expect(eventButton).toBeVisible();
  await eventButton.click();
  await expect(recorder.getByLabel(/date.*Required/)).toBeVisible();
  await saveRecorder(page, async (form) => {
    await form.getByLabel(/date.*Required/).fill(date);
    await form.getByLabel("Notes").fill(notes);
    if (configure) await configure(form);
  });
}

async function submitReport(page: Page, reportType: string, date: string) {
  const form = page.locator(
    `form:has(input[name="reportType"][value="${reportType}"])`,
  );
  await expect(form).toBeVisible();
  await form.getByLabel("Submission date").fill(date);
  await form
    .getByRole("button", {
      name:
        reportType === "PORTAL_SAMPLE_DATE"
          ? "Record NYC portal submission"
          : "Record submission",
    })
    .click();
  await expect(
    page.locator(`form:has(input[name="reportType"][value="${reportType}"])`),
  ).toHaveCount(0);
}

async function expandObligation(section: Locator, title: string) {
  const card = section.locator("article").filter({ hasText: title }).first();
  await card
    .getByText("Required action, source record, and rule details", {
      exact: true,
    })
    .click();
}

async function recordSampleAndPortal(
  page: Page,
  sampleDate: string,
  submissionDate: string,
) {
  await recordEvent(
    page,
    "Sample",
    sampleDate,
    "ELAP culture sample with signed chain of custody",
  );
  await expect(
    page.getByRole("heading", {
      name: "Submit this sample date to the NYC Health Department portal",
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Record NYC portal submission" })
    .click();
  await submitReport(page, "PORTAL_SAMPLE_DATE", submissionDate);
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("customer-managed sampling is excluded from TowerTrack work", async ({
  page,
}) => {
  const name = `Owner-Managed Tower ${Date.now()}`;
  await createNycTower(page, name, "CUSTOMER");

  await page.getByRole("button", { name: "Add compliance record" }).click();
  const drawer = page.getByRole("dialog", { name: "Add compliance record" });
  await expect(drawer.getByRole("button", { name: "Sample" })).toHaveCount(0);
  await drawer
    .getByText("Other work and special conditions", { exact: true })
    .click();
  await expect(
    drawer.getByRole("button", {
      name: "Confirm owner-managed bacteriological sample",
    }),
  ).toHaveCount(0);
  await expect(
    drawer.getByText("Record External Legionella Information"),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.getByRole("link", { name: "Required work", exact: true }).click();
  await expect(
    page.getByRole("link", { name: /Record .*sample/i }),
  ).toHaveCount(0);
  await page.goto(`/deadlines?q=${encodeURIComponent(name)}`);
  await expect(page.getByText(name)).toHaveCount(0);
});

test("new NYC tower completes an auditable lifecycle and one sample closes overlapping obligations", async ({
  page,
}) => {
  const name = `Lifecycle Building ${Date.now()}`;
  const systemUrl = await createNycTower(page, name);
  await page.getByRole("button", { name: "Add compliance record" }).click();
  await expect(
    page.getByRole("button", { name: "Laboratory result" }),
  ).toBeDisabled();
  await expect(
    page.getByText(/Add a Legionella sample before adding a laboratory result/),
  ).toBeVisible();

  await recordEvent(
    page,
    "Cleaning",
    "2026-07-01",
    "Initial cleaning and disinfection before first operation",
    async (form) => {
      await form.getByLabel("Startup cleaning and disinfection").check();
    },
  );
  await expect(page.getByText("Baseline required").first()).toBeVisible();
  await expect(
    page.getByText(
      "No sample requirement created by a compliance record is open.",
    ),
  ).toBeVisible();

  await recordEvent(
    page,
    "Record startup",
    "2026-07-02",
    "Commissioning startup after documented cleaning",
  );
  const samples = page
    .locator("section:visible")
    .filter({
      has: page.getByRole("heading", {
        name: "Open Legionella sampling requirements",
      }),
    })
    .last();
  await expect(samples.getByText("Startup sample").first()).toBeVisible();
  await expandObligation(samples, "Startup sample");
  await expect(samples.getByText(/Jul 5, 2026/).first()).toBeVisible();
  await expect(samples.getByText(/Jul 16, 2026/).first()).toBeVisible();
  await submitReport(page, "STARTUP_DOH_NOTIFICATION", "2026-07-03");

  await recordSampleAndPortal(page, "2026-07-06", "2026-07-07");
  await expect(samples.getByText("Startup sample")).toHaveCount(0);
  await expect(
    samples.getByText("Monthly Legionella sample").first(),
  ).toBeVisible();
  await expandObligation(samples, "Monthly Legionella sample");
  await expect(samples.getByText(/Aug 6, 2026/).first()).toBeVisible();
  await page.getByRole("button", { name: "Add compliance record" }).click();
  await expect(
    page.getByRole("button", { name: "Laboratory result" }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Records", exact: true }).click();
  const recordedSample = page
    .locator("#regulatory-events article")
    .filter({ hasText: "Routine legionella sample collected" })
    .first();
  await recordedSample.getByRole("link", { name: "Record lab result" }).click();
  await expect(page).toHaveURL(/record=result.*sample=/);
  await expect(
    page.locator("#record-event").getByRole("heading", {
      name: "Record Legionella result received",
    }),
  ).toBeVisible();
  await expect(
    page.locator("#record-event").getByLabel("Sample tested"),
  ).toHaveValue(/.+/);
  await recordEvent(
    page,
    "Inspection",
    "2026-07-06",
    "Qualified-person commissioning inspection",
  );
  await page.getByRole("link", { name: "Required work", exact: true }).click();
  await expect(
    page.locator('time[datetime="2026-10-04"]:visible').first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add compliance record" }).click();
  await page
    .locator("#record-event")
    .getByText("Other work and special conditions", { exact: true })
    .click();
  await page.getByRole("button", { name: "Disinfection" }).click();
  const recorder = page.locator("#record-event");
  await recorder.getByLabel(/date.*Required/).fill("2026-07-06");
  await expect(
    recorder.getByText(/weekend dates inside this window/),
  ).toBeVisible();
  await saveRecorder(page, async (form) => {
    await form
      .getByLabel("Notes")
      .fill("Preventive disinfection with field treatment record");
  });
  await expandObligation(samples, "Post disinfection retest");
  await expect(samples.getByText(/Jul 9, 2026/).first()).toBeVisible();

  await page.getByRole("link", { name: "Records", exact: true }).click();
  await page
    .locator("#regulatory-events a")
    .filter({ hasText: "High legionella disinfection" })
    .filter({ hasText: "Jul 6, 2026" })
    .first()
    .click();
  await expect(
    page.getByRole("heading", {
      name: "The information is wrong—replace it with corrected information",
    }),
  ).toBeVisible();
  await page.getByLabel(/date.*Required/).fill("2026-07-05");
  await expect(page.getByLabel(/date.*Required/)).toHaveValue("2026-07-05");
  await page
    .getByLabel("Correction reason (required)")
    .fill("Corrected against the signed treatment ticket");
  await page.getByRole("button", { name: "Save corrected record" }).click();
  await expect(page.getByText(/Compliance record corrected/)).toBeVisible();
  await page.getByRole("link", { name: "Required work", exact: true }).click();
  await expect(samples.getByText("Post disinfection retest")).toHaveCount(1);
  await expect(
    page.locator('time[datetime="2026-07-12"]:visible').first(),
  ).toBeVisible();

  await page.getByRole("link", { name: "Records", exact: true }).click();
  await page
    .locator("#regulatory-events a")
    .filter({ hasText: "High legionella disinfection" })
    .filter({ hasText: "Jul 5, 2026" })
    .first()
    .click();
  await page
    .getByLabel("Reason this record is invalid · Required")
    .fill("Treatment was recorded against the wrong cooling tower");
  await page.getByLabel(/I understand this marks the record invalid/).check();
  await page.getByRole("button", { name: "Mark record invalid" }).click();
  await expect(
    page.getByText(/Compliance record marked invalid/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Required work", exact: true }).click();
  await expect(samples.getByText("Post disinfection retest")).toHaveCount(0);

  await page.getByRole("link", { name: "Records", exact: true }).click();
  await page
    .locator("#regulatory-events article")
    .filter({ hasText: "Routine legionella sample collected" })
    .first()
    .getByRole("link", { name: "Record lab result" })
    .click();
  await saveRecorder(page, async (form) => {
    await form.getByLabel(/date.*Required/).fill("2026-07-10");
    await form
      .getByLabel("Notes")
      .fill("Final ELAP report reviewed by the qualified person");
    await expect(form.getByLabel("Sample tested")).toBeVisible();
    await expect(
      form.getByLabel("Sample tested").locator("option:checked"),
    ).toContainText("Monday 07/06/2026");
    await form.getByLabel("Result (CFU/mL)").fill("250");
  });
  await page.getByRole("link", { name: "Required work", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Level 3 corrective action" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Legionella level 3 retest" }).first(),
  ).toBeVisible();

  await recordEvent(
    page,
    "Disinfection",
    "2026-07-11",
    "Corrective biocide response to the Level 3 result",
  );
  await expect(
    page.getByRole("heading", { name: "Level 3 corrective action" }),
  ).toHaveCount(0);
  await expect(
    samples.getByText("Post disinfection retest").first(),
  ).toBeVisible();

  await page.goto("/work/visit-opportunities");
  const opportunity = page.locator("article").filter({ hasText: name });
  await expect(
    opportunity.getByText(/One visit can complete [2-9] requirements/),
  ).toBeVisible();
  await expect(opportunity.getByText("Schedule this visit")).toHaveCount(0);
  await opportunity.getByRole("link", { name: "Open tower" }).last().click();
  await recordEvent(
    page,
    "Sample",
    "2026-07-18",
    "Technician collected one sample covering every compatible open window",
  );
  await expect(samples.getByText("Post disinfection retest")).toHaveCount(0);
  await expect(
    page.locator('time[datetime="2026-08-18"]:visible').first(),
  ).toBeVisible();
  await expect(page.getByText("NYC portal follow-up").first()).toBeVisible();
});

test("a year-round tower keeps one rolling sample clock and closes historical portal follow-ups", async ({
  page,
}) => {
  const name = `Year-Round Tower ${Date.now()}`;
  await createNycTower(page, name);
  const systemUrl = page.url().split("?")[0];
  await recordEvent(
    page,
    "Cleaning",
    "2026-01-20",
    "Startup cleaning before continuous year-round operation",
    async (form) => {
      await form.getByLabel("Startup cleaning and disinfection").check();
    },
  );
  await recordEvent(
    page,
    "Record startup",
    "2026-02-01",
    "Start of continuous operation",
  );
  await submitReport(page, "STARTUP_DOH_NOTIFICATION", "2026-02-02");

  for (const [sample, submitted] of [
    ["2026-02-04", "2026-02-05"],
    ["2026-03-07", "2026-03-08"],
    ["2026-04-07", "2026-04-08"],
    ["2026-05-08", "2026-05-09"],
    ["2026-06-08", "2026-06-09"],
    ["2026-07-09", "2026-07-10"],
  ] as const) {
    await recordSampleAndPortal(page, sample, submitted);
  }

  const samples = page
    .locator("section:visible")
    .filter({
      has: page.getByRole("heading", {
        name: "Open Legionella sampling requirements",
      }),
    })
    .last();
  await expect(samples.getByText("Monthly Legionella sample")).toHaveCount(1);
  await expect(samples.getByText(/Aug 9, 2026/).first()).toBeVisible();
  await expect(page.getByText("NYC portal follow-up")).toHaveCount(0);
  await expect(page.getByText("Overdue requirement")).toHaveCount(0);

  await page
    .getByLabel("Tower workspace")
    .getByRole("link", { name: "Settings", exact: true })
    .click();
  const cleaningPlanForm = page.locator("#cleaning-plan form");
  await expect(
    cleaningPlanForm.getByRole("button", {
      name: "Create two-day cleaning plan",
    }),
  ).toBeVisible();
  await expect(
    cleaningPlanForm.locator('input[name="chemicalAddDate"]'),
  ).toHaveValue("2026-07-20");
  await expect(
    cleaningPlanForm.locator('input[name="cleaningDate"]'),
  ).toHaveValue("2026-07-21");
  await cleaningPlanForm
    .locator('select[name="technicianId"]')
    .selectOption({ label: "Mike Torres" });
  await cleaningPlanForm
    .getByRole("button", { name: "Create two-day cleaning plan" })
    .click();
  await expect(page).toHaveURL(/\/visits\/[a-z0-9]+\?planned=1$/);
  await expect(page.getByText("Two-day cleaning plan created")).toBeVisible();
  await expect(page.getByText("Monday 07/20/2026")).toBeVisible();
  await expect(page.getByText("Tuesday 07/21/2026")).toBeVisible();
  await expect(page.getByText("Annual cleaning").first()).toBeVisible();

  await page.goto(systemUrl);
  await expect(page.getByText("Active cleaning plan")).toBeVisible();
  await expect(
    page.getByText(/annual cleaning obligation remains open/i),
  ).toBeVisible();
});

test("a seasonal tower preserves its history but stops the routine clock after shutdown", async ({
  page,
}) => {
  const name = `Seasonal Tower ${Date.now()}`;
  await createNycTower(page, name);
  await page
    .getByLabel("Tower workspace")
    .getByRole("link", { name: "Settings", exact: true })
    .click();
  const seasonalForm = page.locator("form").filter({
    has: page.getByRole("button", { name: "Save operating schedule" }),
  });
  await seasonalForm.getByRole("radio", { name: /^Seasonal/ }).check();
  await seasonalForm.getByLabel("Season start month").selectOption("1");
  await seasonalForm.getByLabel("Season start day").fill("1");
  await seasonalForm.getByLabel("Season end month").selectOption("6");
  await seasonalForm.getByLabel("Season end day").fill("30");
  await seasonalForm
    .getByLabel("Reason for change")
    .fill("Document January through June seasonal operation");
  await seasonalForm
    .getByRole("button", { name: "Save operating schedule" })
    .click();
  await expect(
    page.getByText("Seasonal Tower · Jan 1–Jun 30").first(),
  ).toBeVisible();

  await recordEvent(
    page,
    "Cleaning",
    "2025-12-20",
    "Pre-startup seasonal cleaning and disinfection",
    async (form) => {
      await form.getByLabel("Startup cleaning and disinfection").check();
    },
  );
  await recordEvent(page, "Record startup", "2026-01-01", "Seasonal startup");
  await submitReport(page, "STARTUP_DOH_NOTIFICATION", "2026-01-02");
  for (const [sample, submitted] of [
    ["2026-01-04", "2026-01-05"],
    ["2026-02-04", "2026-02-05"],
    ["2026-03-07", "2026-03-08"],
    ["2026-04-07", "2026-04-08"],
    ["2026-05-08", "2026-05-09"],
    ["2026-06-08", "2026-06-09"],
  ] as const) {
    await recordSampleAndPortal(page, sample, submitted);
  }
  await recordEvent(
    page,
    "Record shutdown",
    "2026-06-30",
    "Tower fully drained for the end of its operating season",
  );
  await submitReport(page, "SHUTDOWN_DOH_NOTIFICATION", "2026-07-01");

  const samples = page
    .locator("section:visible")
    .filter({
      has: page.getByRole("heading", {
        name: "Open Legionella sampling requirements",
      }),
    })
    .last();
  await expect(samples.getByText("Monthly Legionella sample")).toHaveCount(0);
  await expect(page.getByText("Inactive").first()).toBeVisible();
  await expect(
    page
      .locator("#regulatory-events")
      .getByText("Routine legionella sample collected"),
  ).toHaveCount(6);
  await expect(page.getByText("No open summertime requirement")).toBeVisible();
});
