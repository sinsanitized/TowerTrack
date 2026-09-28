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

test("operations manager can record cleaning without creating or resetting a sample window", async ({
  page,
}) => {
  const search = page.getByRole("combobox", { name: "Find a tower" });
  await search.fill("100 Park Avenue");
  await search.press("Enter");
  await page.getByRole("option").first().click();
  await page.getByRole("link", { name: "Required work", exact: true }).click();
  await page
    .getByText("Reporting and advanced requirement details", { exact: true })
    .click();

  const samplingHeading = page.getByRole("heading", {
    name: "Open Legionella sampling requirements",
  });
  await expect(samplingHeading).toBeVisible();
  const samplingSection = samplingHeading.locator("..");
  const beforeSampleDates = await samplingSection
    .locator("time")
    .evaluateAll((dates) =>
      dates.map((date) => ({
        dateTime: date.getAttribute("datetime"),
        text: date.textContent,
      })),
    );

  await page.getByRole("button", { name: "Add compliance record" }).click();
  const recorder = page.getByRole("dialog");
  await expect(recorder).toBeVisible();
  await recorder
    .getByText("Other work and special conditions", { exact: true })
    .click();
  await recorder.getByRole("button", { name: "Cleaning" }).click();
  await expect(
    page.getByRole("group", { name: /Cleaning type/ }),
  ).toBeVisible();
  const cleaningForm = page.locator("#record-event form");
  await cleaningForm.getByLabel(/Cleaning completion date/).fill("2026-07-13");
  await cleaningForm.getByText("Add notes (optional)", { exact: true }).click();
  await cleaningForm
    .getByLabel("Notes")
    .fill("Record cleaning separately from regulatory sampling");
  await cleaningForm.getByRole("button", { name: "Save record" }).click();

  await expect(page).toHaveURL(/event=/);
  await expect(page.getByText(/Cleaning completed ·/)).toBeVisible();
  await expect(page.getByText(/Cleaning is tracked separately/)).toBeVisible();
  expect(
    await samplingSection.locator("time").evaluateAll((dates) =>
      dates.map((date) => ({
        dateTime: date.getAttribute("datetime"),
        text: date.textContent,
      })),
    ),
  ).toEqual(beforeSampleDates);
});
