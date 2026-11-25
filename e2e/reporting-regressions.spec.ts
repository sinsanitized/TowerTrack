import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { asUtc, dateOnly } from "@/lib/date";
import { rebuildSystemComplianceProjections } from "@/lib/obligation-projections";

const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl)
  throw new Error("E2E_DATABASE_URL is required for reporting regressions.");
const db = new PrismaClient({ datasourceUrl: databaseUrl });
let systemId: string;
let portalObligationId: string;
let routineObligationId: string;
let routineDeadline: string;

test.beforeAll(async () => {
  const admin = await db.user.findUniqueOrThrow({
    where: {
      email: process.env.INITIAL_ADMIN_EMAIL ?? "admin@towertrack.local",
    },
  });
  const shared = await db.ruleProfile.findUniqueOrThrow({
    where: { id: "nyc-2026" },
  });
  const suffix = randomUUID().slice(0, 8);
  const customer = await db.customer.create({
    data: {
      organizationId: admin.organizationId,
      name: `Late reporting test ${suffix}`,
      accountNumber: `REPORT-${suffix}`,
    },
  });
  const building = await db.building.create({
    data: {
      customerId: customer.id,
      buildingName: `Reporting Building ${suffix}`,
      streetAddress: "10 Portal Test Way",
      city: "New York",
      state: "NY",
      postalCode: "10001",
      routeZone: "TEST",
    },
  });
  const system = await db.coolingTowerSystem.create({
    data: {
      buildingId: building.id,
      jurisdictionId: shared.jurisdictionId!,
      ruleProfileId: shared.id,
      ruleConfiguration: "NYC_AND_NYS",
      ruleConfigurationEffectiveDate: asUtc("2026-01-01"),
      internalJobNumber: `REPORT-${suffix}`,
      systemName: "CT-Portal",
      operatingStatus: "OPERATING",
      operationPeriodType: "YEAR_ROUND",
    },
  });
  systemId = system.id;
  await db.towerRuleAssignment.create({
    data: {
      coolingTowerSystemId: system.id,
      configuration: "NYC_AND_NYS",
      ruleProfileId: shared.id,
      effectiveStartDate: asUtc("2026-01-01"),
      changedById: admin.id,
      reason: "Reporting regression test assignment",
    },
  });
  const sample = await db.serviceEvent.create({
    data: {
      coolingTowerSystemId: system.id,
      eventType: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
      eventDate: asUtc("2026-10-01"),
      recordedById: admin.id,
      details: { performedByResponsibility: "OUR_COMPANY" },
    },
  });
  await db.$transaction((tx) =>
    rebuildSystemComplianceProjections(tx, system.id, "2026-11-24"),
  );
  const portal = await db.reportingObligation.findFirstOrThrow({
    where: {
      coolingTowerSystemId: system.id,
      obligationType: "PORTAL_SAMPLE_DATE",
      triggerEventId: sample.id,
    },
  });
  const routine = await db.sampleObligation.findFirstOrThrow({
    where: {
      coolingTowerSystemId: system.id,
      obligationType: "ROUTINE_OPERATING_SAMPLE",
      triggerEventId: sample.id,
    },
  });
  portalObligationId = portal.id;
  routineObligationId = routine.id;
  routineDeadline = dateOnly(routine.latestDueDate!);
});

test.afterAll(async () => {
  await db.$disconnect();
});

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

test("records, corrects, and voids a late NYC portal submission", async ({
  page,
}) => {
  await page.goto(
    `/systems/${systemId}?view=obligations&report=${portalObligationId}`,
  );
  await page.getByLabel("Actual submission date · Required").fill("2026-10-10");
  await page
    .getByRole("button", { name: "Record NYC portal submission" })
    .click();
  await expect(page.getByText(/^Completed late/)).toBeVisible();

  const firstSubmission = await db.serviceEvent.findFirstOrThrow({
    where: {
      coolingTowerSystemId: systemId,
      eventType: "REPORT_SUBMITTED",
      status: "ACTIVE",
    },
  });
  expect(
    await db.reportingObligation.findUniqueOrThrow({
      where: { id: portalObligationId },
    }),
  ).toMatchObject({
    status: "COMPLETED",
    completedByEventId: firstSubmission.id,
  });
  expect(
    dateOnly(
      (
        await db.sampleObligation.findUniqueOrThrow({
          where: { id: routineObligationId },
        })
      ).latestDueDate!,
    ),
  ).toBe(routineDeadline);

  await page.goto(`/systems/${systemId}/events/${firstSubmission.id}?edit=1`);
  await page.getByLabel("Work completion date · Required").fill("2026-10-11");
  await page
    .getByLabel("Correction reason (required)")
    .fill("Corrected from the portal confirmation record");
  await page.getByRole("button", { name: "Save corrected record" }).click();
  await expect(page).toHaveURL(/correctedEvent=/);
  const replacement = await db.serviceEvent.findFirstOrThrow({
    where: { correctedFromEventId: firstSubmission.id },
  });
  expect(
    (
      await db.reportingObligation.findUniqueOrThrow({
        where: { id: portalObligationId },
      })
    ).completedByEventId,
  ).toBe(replacement.id);

  await page.goto(`/systems/${systemId}/events/${replacement.id}?edit=1`);
  await page
    .getByLabel("Reason this record is invalid · Required")
    .fill("Portal confirmation was withdrawn as entered in error");
  await page.getByLabel(/I understand this marks the record invalid/).check();
  await page.getByRole("button", { name: "Mark record invalid" }).click();
  await expect(page).toHaveURL(/voidedEvent=1/);
  expect(
    await db.reportingObligation.findUniqueOrThrow({
      where: { id: portalObligationId },
    }),
  ).toMatchObject({ status: "MISSED", completedByEventId: null });
  expect(
    dateOnly(
      (
        await db.sampleObligation.findUniqueOrThrow({
          where: { id: routineObligationId },
        })
      ).latestDueDate!,
    ),
  ).toBe(routineDeadline);
});
