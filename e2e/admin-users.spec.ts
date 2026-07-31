import { expect, test } from "@playwright/test";

test("administrator manages user access and roles", async ({ page }) => {
  await page.goto("/login");
  await page
    .getByLabel("Email")
    .fill(process.env.INITIAL_ADMIN_EMAIL ?? "admin@towertrack.local");
  await page
    .getByLabel("Password")
    .fill(process.env.INITIAL_ADMIN_PASSWORD ?? "ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/admin");

  const email = `managed-user-${Date.now()}@towertrack.local`;
  const management = page.getByRole("region", { name: "User management" });
  const createForm = management.locator("form").first();
  await createForm.getByLabel("Full name").fill("Managed User");
  await createForm.getByLabel("Email address").fill(email);
  await createForm.getByLabel("Initial password").fill("Temporary123!");
  await createForm.getByRole("combobox").selectOption("TECHNICIAN");
  await createForm.getByRole("button", { name: "Create user" }).click();

  await expect(
    page.getByText("User account created successfully."),
  ).toBeVisible();
  let row = page.locator("tr").filter({ hasText: email });
  await expect(row.getByText("Active", { exact: true })).toBeVisible();

  await row.getByRole("combobox").selectOption("READ_ONLY");
  await row.getByRole("button", { name: "Save role" }).click();
  await expect(page.getByText("User role updated successfully.")).toBeVisible();
  row = page.locator("tr").filter({ hasText: email });
  await expect(row.getByRole("combobox")).toHaveValue("READ_ONLY");

  await row.getByRole("button", { name: "Disable" }).click();
  await expect(
    page.getByText("User account disabled successfully."),
  ).toBeVisible();
  row = page.locator("tr").filter({ hasText: email });
  await expect(row.getByText("Disabled", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "Reactivate" }).click();
  await expect(
    page.getByText("User account reactivated successfully."),
  ).toBeVisible();
  row = page.locator("tr").filter({ hasText: email });
  await expect(row.getByText("Active", { exact: true })).toBeVisible();
});
