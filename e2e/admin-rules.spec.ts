import { expect, test } from "@playwright/test";

test("administrator adds a supported jurisdiction rule", async ({ page }) => {
  await page.goto("/login");
  await page
    .getByLabel("Email")
    .fill(process.env.INITIAL_ADMIN_EMAIL ?? "admin@towertrack.local");
  await page
    .getByLabel("Password")
    .fill(process.env.INITIAL_ADMIN_PASSWORD ?? "ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/admin");

  const sharedProfile = page
    .getByRole("heading", { name: "Out-of-State Company Policy" })
    .locator("xpath=ancestor::details[1]");
  await sharedProfile.locator("summary").first().click();
  await expect(
    sharedProfile.getByText("Protected regulatory baseline"),
  ).toBeVisible();
  await sharedProfile
    .getByRole("button", { name: "Create editable copy" })
    .click();
  await expect(
    page.getByText(
      "Organization-owned rule copy created, tower assignments updated, and deadlines recalculated.",
    ),
  ).toBeVisible();

  const editableProfile = page
    .getByRole("heading", {
      name: "Out-of-State Company Policy — Organization copy",
    })
    .locator("xpath=ancestor::details[1]");
  const addSummary = editableProfile
    .locator("summary")
    .filter({ hasText: "Add jurisdiction rule" });
  const addRule = addSummary.locator("xpath=ancestor::details[1]");
  await addSummary.click();
  const form = addRule.locator("form");
  const requirementType = await form
    .getByLabel("Requirement type")
    .inputValue();
  await form
    .getByLabel("Rule name")
    .fill(`Verified ${requirementType.toLowerCase()} rule`);
  await form.getByLabel("Authority").selectOption("COMPANY_POLICY");
  await form
    .getByLabel("Source citation")
    .fill("Verified operations policy §1");
  await form.getByLabel("Hard interval (days)").fill("91");
  await form.getByLabel("Minimum days after trigger").fill("3");
  await form.getByLabel("Maximum days after trigger").fill("14");
  await form
    .getByLabel("Notes")
    .fill("Created by the jurisdiction rule workflow test");
  await form
    .getByLabel("Reason for adding rule")
    .fill("Verify audited jurisdiction rule creation");
  await form
    .getByRole("button", { name: "Add rule and recalculate towers" })
    .click();

  await expect(
    page.getByText("Jurisdiction rule added and affected towers recalculated."),
  ).toBeVisible();
  await expect(
    page.getByText(`Verified ${requirementType.toLowerCase()} rule`),
  ).toBeVisible();
});
