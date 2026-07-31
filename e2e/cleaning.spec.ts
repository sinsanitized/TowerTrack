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
  const search = page.getByRole("combobox", { name: "Search towers" });
  await search.fill("100 Park Avenue");
  await search.press("Enter");
  await page.getByRole("link", { name: "Obligations", exact: true }).click();
  await page
    .getByText("Rule details and obligation completion tools", { exact: true })
    .click();

  const samplingHeading = page.getByRole("heading", {
    name: "Open Legionella sampling obligations",
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

  await page.getByRole("button", { name: "Record an event" }).click();
  await page.getByText("More event types", { exact: true }).click();
  await page.getByRole("button", { name: "Record cleaning" }).click();
  await expect(page.getByLabel("Cleaning type")).toBeVisible();
  const cleaningForm = page.locator("#record-event form");
  await cleaningForm.getByLabel("Event date").fill("2026-07-14");
  await cleaningForm.getByText("Add notes (optional)", { exact: true }).click();
  await cleaningForm
    .getByLabel("Notes")
    .fill("Record cleaning separately from regulatory sampling");
  await cleaningForm.getByRole("button", { name: "Save Event" }).click();

  await expect(page).toHaveURL(/event=/);
  await expect(page.getByText("Cleaning completed").last()).toBeVisible();
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
