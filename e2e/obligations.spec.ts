import { test, expect, type Locator } from "@playwright/test";

test.describe.configure({ timeout: 180_000 });

async function confirmRecorder(recorder: Locator) {
  await recorder.getByRole("button", { name: "Save record" }).click();
}

async function openCompliancePreview(recorder: Locator) {
  const preview = recorder.locator("section").filter({
    has: recorder.getByRole("heading", {
      name: "What saving this record will do",
    }),
  });
  await expect(preview).toBeVisible();
  return preview;
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
  const towerSearch = page.getByRole("combobox", { name: "Find a tower" });
  await towerSearch.fill("JOB-1001");
  const systemResult = page
    .getByRole("listbox", { name: "Tower search results" })
    .getByRole("option")
    .last();
  await expect(systemResult).toHaveAttribute("href", /^\/systems\//);
  const systemUrl = await systemResult.getAttribute("href");
  expect(systemUrl).toMatch(/^\/systems\//);
  await page.goto(systemUrl!, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/systems\//);
  await page.getByRole("link", { name: "Required work", exact: true }).click();
  await page
    .getByText("Rule details and completion tools", { exact: true })
    .click();
  await page.getByRole("button", { name: "Add compliance record" }).click();
  await expect(
    page.getByRole("heading", { name: "Record what happened" }),
  ).toBeVisible();
});

test("disinfection choices explain corrective treatment and full remediation", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Disinfection" }).click();
  const recorder = page.locator("#record-event");
  await expect(
    recorder.getByRole("heading", {
      name: "Corrective disinfection — chemical treatment response",
    }),
  ).toBeVisible();
  await expect(recorder.getByText(/Do not select this if/)).toBeVisible();
  await recorder.getByLabel(/date.*Required/).fill("2026-07-17");
  const preview = await openCompliancePreview(recorder);
  await expect(
    preview.getByText("Generates Post disinfection retest"),
  ).toBeVisible();
  await expect(preview.getByText(/Jul 20, 2026/).first()).toBeVisible();
  await expect(preview.getByText(/Jul 24, 2026/).first()).toBeVisible();

  await recorder.getByLabel(/date.*Required/).fill("2026-07-15");
  await expect(preview.getByText(/Jul 18, 2026/).first()).toBeVisible();
  await expect(
    preview.getByText(/weekend dates inside this window/),
  ).toBeVisible();

  await recorder.getByLabel(/date.*Required/).fill("2026-07-11");
  await expect(
    preview.getByText(/Legal deadline falls on a weekend/),
  ).toBeVisible();
  await expect(preview.getByText(/Fri, Jul 17, 2026/)).toBeVisible();
  await recorder
    .getByRole("button", {
      name: /Tower was drained, physically cleaned, and flushed/,
    })
    .click();
  await expect(
    recorder.getByRole("heading", {
      name: "Full remediation — complete physical tower treatment",
    }),
  ).toBeVisible();
  await expect(
    recorder.getByText(
      /hyperhalogenated, drained, physically cleaned, and flushed/,
    ),
  ).toBeVisible();
  await expect(
    recorder.getByText(/Collect the Legionella retest on day 3–7/),
  ).toBeVisible();
});

test("correction and reversion replay a post-disinfection sample window", async ({
  page,
}) => {
  const year = 2026;
  const triggerDate = `${year}-01-06`;
  const correctedDate = `${year}-01-08`;
  const collectionDate = `${year}-01-12`;
  for (const [eventType, eventDate] of [
    ["High legionella disinfection", `Jan 6, ${year}`],
    ["High legionella disinfection", `Jan 8, ${year}`],
    ["Routine legionella sample collected", `Jan 12, ${year}`],
  ]) {
    let priorReplayEvent = page
      .locator("#regulatory-events a")
      .filter({ hasText: "Active" })
      .filter({ hasText: eventType })
      .filter({ hasText: eventDate });
    while ((await priorReplayEvent.count()) > 0) {
      await priorReplayEvent.first().click();
      await page
        .getByLabel("Reason this record is invalid · Required")
        .fill("Remove an incomplete automated workflow-test record");
      await page.getByLabel(/I understand this voids the record/).check();
      await page.getByRole("button", { name: "Mark record invalid" }).click();
      await expect(page).toHaveURL(/voidedEvent=1/, { timeout: 30_000 });
      await expect(
        page.getByRole("heading", { name: "Record what happened" }),
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByText(/Compliance record marked invalid/),
      ).toBeVisible();
      priorReplayEvent = page
        .locator("#regulatory-events a")
        .filter({ hasText: "Active" })
        .filter({ hasText: eventType })
        .filter({ hasText: eventDate });
    }
  }
  await page.getByRole("button", { name: "Disinfection" }).click();
  let recorder = page.locator("#record-event");
  await recorder.getByLabel(/date.*Required/).fill(triggerDate);
  await recorder.getByText("Add notes (optional)", { exact: true }).click();
  await recorder
    .getByLabel("Notes")
    .fill("Workflow replay test corrective treatment");
  await confirmRecorder(recorder);
  await expect(page).toHaveURL(/event=/, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "Record what happened" }),
  ).toBeVisible({ timeout: 30_000 });

  const sampling = page
    .locator("section:visible")
    .filter({
      has: page.getByRole("heading", {
        name: "Open Legionella sampling requirements",
      }),
    })
    .first();
  await expect(
    sampling.getByText("Post disinfection retest").first(),
  ).toBeVisible();
  await expect(
    sampling.getByText(new RegExp(`Jan 13, ${year}`)).first(),
  ).toBeVisible();

  await page
    .locator("#regulatory-events a")
    .filter({ hasText: "High legionella disinfection" })
    .filter({ hasText: `Jan 6, ${year}` })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Correct record details" }),
  ).toBeVisible();
  await page.getByLabel(/date.*Required/).fill(correctedDate);
  await expect(page.getByLabel(/date.*Required/)).toHaveValue(correctedDate);
  await page
    .getByLabel("Correction reason (required)")
    .fill("Corrected against signed field service record");
  await page.getByRole("button", { name: "Save corrected record" }).click();
  await expect(page).toHaveURL(/correctedEvent=/, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "Record what happened" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Compliance record corrected/)).toBeVisible();
  await expect(
    sampling.getByText(new RegExp(`Jan 15, ${year}`)).first(),
  ).toBeVisible();

  const nextActionCallout = page.getByTestId("next-action-callout");
  const recordResample = nextActionCallout.getByRole("link", {
    name: "Record resample",
  });
  await expect(recordResample).toHaveAttribute(
    "href",
    /record=resample&obligation=/,
  );
  await recordResample.click();
  await expect(
    page.getByRole("dialog", { name: "Record resample" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What happened?" }),
  ).toHaveCount(0);
  recorder = page.locator("#record-event");
  await expect(recorder.locator('input[name="obligationId"]')).toHaveValue(
    /.+/,
  );
  await recorder.getByLabel(/date.*Required/).fill(collectionDate);
  await recorder.getByText("Add notes (optional)", { exact: true }).click();
  await recorder
    .getByLabel("Notes")
    .fill("Monthly collection also serving as corrective retest");
  await confirmRecorder(recorder);
  await expect(page).toHaveURL(/event=/, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "Record what happened" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page
      .getByText(/Post disinfection retest completed by this collection/)
      .first(),
  ).toBeVisible();
  await expect(sampling.getByText("Post disinfection retest")).toHaveCount(0);

  await page
    .locator("#regulatory-events a")
    .filter({ hasText: "Routine legionella sample collected" })
    .filter({ hasText: `Jan 12, ${year}` })
    .first()
    .click();
  await page
    .getByLabel("Reason this record is invalid · Required")
    .fill("Completion record reverted for workflow verification");
  await page.getByLabel(/I understand this voids the record/).check();
  await page.getByRole("button", { name: "Mark record invalid" }).click();
  await expect(page).toHaveURL(/voidedEvent=1/, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "Record what happened" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText(/Compliance record marked invalid/),
  ).toBeVisible();
  await expect(
    sampling.getByText("Post disinfection retest").first(),
  ).toBeVisible();
  await expect(
    sampling.getByText(new RegExp(`Jan 15, ${year}`)).first(),
  ).toBeVisible();

  await page
    .locator("#regulatory-events a")
    .filter({ hasText: "High legionella disinfection" })
    .filter({ hasText: `Jan 8, ${year}` })
    .first()
    .click();
  await page
    .getByLabel("Reason this record is invalid · Required")
    .fill("Triggering treatment record was entered for the wrong tower");
  await page.getByLabel(/I understand this voids the record/).check();
  await page.getByRole("button", { name: "Mark record invalid" }).click();
  await expect(page).toHaveURL(/voidedEvent=1/, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "Record what happened" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText(/Compliance record marked invalid/),
  ).toBeVisible();
  await expect(sampling.getByText(new RegExp(`Jan 15, ${year}`))).toHaveCount(
    0,
  );
});

test("startup immediately generates sampling and DOH reporting windows", async ({
  page,
}) => {
  await page
    .getByText("Other work and special conditions", { exact: true })
    .click();
  await page.getByRole("button", { name: "Record startup" }).click();
  const recorder = page.locator("#record-event");
  await recorder.getByLabel(/date.*Required/).fill("2026-07-14");
  await recorder.getByText("Add notes (optional)", { exact: true }).click();
  await recorder.getByLabel("Notes").fill("Seasonal startup field record");
  const startupPreview = await openCompliancePreview(recorder);
  await expect(
    startupPreview.getByText(/Generates Startup sample/),
  ).toBeVisible();
  await expect(startupPreview.getByText(/Jul 17, 2026/).first()).toBeVisible();
  await expect(startupPreview.getByText(/Jul 28, 2026/).first()).toBeVisible();
  await expect(
    startupPreview.getByText(/Generates Startup doh notification/),
  ).toBeVisible();
  await expect(
    startupPreview.getByText(/Generates Startup cleaning and disinfection/),
  ).toBeVisible();
  await expect(startupPreview.getByText(/Jun 29, 2026/).first()).toBeVisible();
  await expect(startupPreview.getByText(/Jul 14, 2026/).first()).toBeVisible();
  await expect(startupPreview.getByText(/Jul 19, 2026/).first()).toBeVisible();
  await confirmRecorder(recorder);

  await expect(page).toHaveURL(/event=/);
  await expect(
    page.getByRole("heading", { name: "Compliance Updated" }),
  ).toBeVisible();
  await expect(
    page.getByText("Startup cleaning and disinfection").first(),
  ).toBeVisible();
  const maintenancePanel = page
    .getByRole("heading", { name: "Startup maintenance requirements" })
    .locator("..");
  await maintenancePanel
    .getByText("Required action, triggering event, and rule details")
    .first()
    .click();
  await maintenancePanel.getByText("Why?", { exact: true }).first().click();
  await expect(
    maintenancePanel
      .getByText(/A cleaning recorded after startup cannot retroactively/)
      .first(),
  ).toBeVisible();
});

test("emergency event creates an immediate sample without a made-up latest date", async ({
  page,
}) => {
  await page
    .getByText("Other work and special conditions", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Record emergency condition" })
    .click();
  const recorder = page.locator("#record-event");
  await recorder.getByLabel("Emergency trigger").selectOption("BIOCIDE_LOSS");
  await recorder.getByLabel(/date.*Required/).fill("2026-07-14");
  await recorder.getByText("Add notes (optional)", { exact: true }).click();
  await recorder
    .getByLabel("Notes")
    .fill("Biocide feed interrupted long enough for growth");
  const emergencyPreview = await openCompliancePreview(recorder);
  await expect(
    emergencyPreview.getByText(/Generates Emergency sample/),
  ).toBeVisible();
  await expect(
    emergencyPreview.getByText(/Schedule immediately; no precise legal window/),
  ).toBeVisible();
  await expect(
    emergencyPreview.getByText(/Immediate \/ follow MPP/),
  ).toBeVisible();
  await confirmRecorder(recorder);

  await expect(page).toHaveURL(/event=/);
  await expect(
    page.getByRole("heading", { name: "Compliance Updated" }),
  ).toBeVisible();
});

test("Level 4 date-only result creates review reminders and a retest chain", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Sample" }).click();
  let recorder = page.locator("#record-event");
  await recorder.getByLabel(/date.*Required/).fill("2026-07-14");
  await recorder.getByText("Add notes (optional)", { exact: true }).click();
  await recorder
    .getByLabel("Notes")
    .fill("Sample associated with the verified laboratory report");
  await confirmRecorder(recorder);

  await page.getByRole("button", { name: "Laboratory result" }).click();
  recorder = page.locator("#record-event");
  await recorder.getByLabel(/date.*Required/).fill("2026-07-14");
  await recorder.getByLabel("Result (CFU/mL)").fill("1250");
  await recorder.getByText("Add notes (optional)", { exact: true }).click();
  await recorder
    .getByLabel("Notes")
    .fill("Verified ELAP final analytical report");
  await confirmRecorder(recorder);

  await expect(
    page.getByText("Legionella LEVEL 4 RETEST").first(),
  ).toBeVisible();
  await expect(
    page.getByText("Level 4 corrective action").first(),
  ).toBeVisible();
  await expect(
    page.getByText("Level 4 full remediation").first(),
  ).toBeVisible();
  await expect(
    page.getByText("Level 4 DOH notification").first(),
  ).toBeVisible();
});
