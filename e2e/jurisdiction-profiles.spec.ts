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
});

test("tower settings derive effective-dated compliance rules from location", async ({
  page,
}) => {
  const search = page.getByRole("combobox", { name: "Find a tower" });
  await search.fill("JOB-1002");
  await page.getByRole("option").first().click();
  await page
    .getByLabel("Tower workspace")
    .getByRole("link", { name: "Settings", exact: true })
    .click();
  await expect(
    page.getByText("4. Jurisdiction and compliance rules"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Current rule assignment" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Change compliance rules" }).click();
  await expect(
    page.getByText("Compliance rules", { exact: true }).first(),
  ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Change compliance rules" })
    .click();
  const jurisdiction = page.getByLabel(/Tower jurisdiction/);
  await expect(jurisdiction).toBeVisible();
  await jurisdiction.evaluate(
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
  await expect(
    page.getByRole("heading", { name: "New York City regulatory program" }),
  ).toBeVisible();
  await jurisdiction.selectOption({ label: "Newark, NJ" });
  await expect(
    page.getByRole("heading", { name: "New Jersey regulation monitoring" }),
  ).toBeVisible();
  await expect(
    page.getByText(/will not generate legal deadlines from it/),
  ).toBeVisible();
  await expect(
    page.getByText(/Using: Pending Regulation Review/),
  ).toBeVisible();
  await expect(page.getByText(/Effective today/)).toBeVisible();
});

test("hyperhalogenation entry opens the date-only focused form", async ({
  page,
}) => {
  const search = page.getByRole("combobox", { name: "Find a tower" });
  await search.fill("JOB-1002");
  await page.getByRole("option").first().click();
  const towerHref = new URL(page.url()).pathname;
  await page.goto(`${towerHref}?record=hyperhalogenation#record-event`);
  await expect(page).toHaveURL(/record=hyperhalogenation/);
  await expect(
    page.getByRole("heading", {
      name: "Record summertime hyperhalogenation",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Date Performed")).toBeVisible();
  await expect(
    page.getByText(
      "Record the date the summertime hyperhalogenation was completed. Treatment details are maintained on the separate service form.",
    ),
  ).toBeVisible();
  for (const removedField of [
    "Chemical",
    "Quantity",
    "Contact time",
    "pH",
    "Free halogen residual",
    "Technician",
    "Notes",
  ])
    await expect(page.getByLabel(removedField, { exact: true })).toHaveCount(0);
});
