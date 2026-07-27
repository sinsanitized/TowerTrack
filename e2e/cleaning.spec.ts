import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@towertrack.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
});

test("operations manager can record cleaning without creating or resetting a sample window", async ({
  page,
}) => {
  const search = page.getByRole("combobox", { name: "Search towers" });
  await search.fill("100 Park Avenue");
  await search.press("Enter");

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

  await page.getByRole("button", { name: "Add cleaning" }).click();
  await expect(page.getByLabel("Cleaning type")).toBeVisible();
  const cleaningForm = page.locator("#record-event form");
  await cleaningForm.getByLabel("Event date").fill("2026-07-14");
  await cleaningForm.getByText("Add notes (optional)", { exact: true }).click();
  await cleaningForm
    .getByLabel("Notes")
    .fill("Record cleaning separately from regulatory sampling");
  await cleaningForm
    .getByRole("button", { name: "Save completed event" })
    .click();

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
