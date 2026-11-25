import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { asUtc, dateOnly } from "@/lib/date";
import {
  lockSystemCompliance,
  rebuildSystemComplianceProjections,
} from "@/lib/obligation-projections";

const databaseUrl = process.env.E2E_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
const db = databaseUrl
  ? new PrismaClient({ datasourceUrl: databaseUrl })
  : null;

async function createTower(input: {
  label: string;
  profileId: string;
  configuration: "NYC_AND_NYS" | "NYS_ONLY";
}) {
  const client = db!;
  const suffix = `${input.label}-${randomUUID().slice(0, 8)}`;
  const profile = await client.ruleProfile.findUniqueOrThrow({
    where: { id: input.profileId },
    select: { jurisdictionId: true },
  });
  const jurisdictionId = profile.jurisdictionId!;
  const organization = await client.organization.create({
    data: { name: `Regression ${suffix}` },
  });
  const user = await client.user.create({
    data: {
      organizationId: organization.id,
      name: "Regression Administrator",
      email: `${suffix}@example.test`,
      passwordHash: "not-used-by-integration-tests",
      role: "ADMIN",
    },
  });
  const customer = await client.customer.create({
    data: {
      organizationId: organization.id,
      name: `Customer ${suffix}`,
      accountNumber: `ACCT-${suffix}`,
    },
  });
  const building = await client.building.create({
    data: {
      customerId: customer.id,
      buildingName: `Building ${suffix}`,
      streetAddress: "1 Test Way",
      city: "New York",
      state: "NY",
      postalCode: "10001",
      routeZone: "TEST",
    },
  });
  const system = await client.coolingTowerSystem.create({
    data: {
      buildingId: building.id,
      jurisdictionId,
      ruleProfileId: input.profileId,
      ruleConfiguration: input.configuration,
      ruleConfigurationEffectiveDate: asUtc("2026-01-01"),
      internalJobNumber: `JOB-${suffix}`,
      systemName: "CT-1",
      operatingStatus: "OPERATING",
      operationPeriodType: "YEAR_ROUND",
    },
  });
  await client.towerRuleAssignment.create({
    data: {
      coolingTowerSystemId: system.id,
      configuration: input.configuration,
      ruleProfileId: input.profileId,
      effectiveStartDate: asUtc("2026-01-01"),
      changedById: user.id,
      reason: "PostgreSQL regression test baseline assignment",
    },
  });
  return { organization, user, system };
}

async function recordSample(systemId: string, userId: string, date: string) {
  return db!.serviceEvent.create({
    data: {
      coolingTowerSystemId: systemId,
      eventType: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
      eventDate: asUtc(date),
      recordedById: userId,
      details: { performedByResponsibility: "OUR_COMPANY" },
    },
  });
}

integration.sequential("PostgreSQL compliance regressions", () => {
  afterAll(async () => {
    await db?.$disconnect();
  });

  it("isolates an explicitly assigned organization profile copy", async () => {
    const [towerA, towerB] = await Promise.all([
      createTower({
        label: "org-a",
        profileId: "nyc-2026",
        configuration: "NYC_AND_NYS",
      }),
      createTower({
        label: "org-b",
        profileId: "nyc-2026",
        configuration: "NYC_AND_NYS",
      }),
    ]);
    await Promise.all([
      recordSample(towerA.system.id, towerA.user.id, "2026-06-01"),
      recordSample(towerB.system.id, towerB.user.id, "2026-06-01"),
    ]);
    await db!.$transaction((tx) =>
      rebuildSystemComplianceProjections(tx, towerA.system.id, "2026-06-05"),
    );
    await db!.$transaction((tx) =>
      rebuildSystemComplianceProjections(tx, towerB.system.id, "2026-06-05"),
    );
    const baselineB = await db!.sampleObligation.findFirstOrThrow({
      where: {
        coolingTowerSystemId: towerB.system.id,
        obligationType: "ROUTINE_OPERATING_SAMPLE",
      },
    });

    const source = await db!.ruleProfile.findUniqueOrThrow({
      where: { id: "nyc-2026" },
      include: { rules: true },
    });
    const copiedId = `org-copy-${randomUUID()}`;
    await db!.$transaction(async (tx) => {
      await tx.ruleProfile.create({
        data: {
          id: copiedId,
          organizationId: towerA.organization.id,
          name: "Organization A NYC copy",
          jurisdictionMode: source.jurisdictionMode,
          jurisdictionId: source.jurisdictionId,
          effectiveStartDate: asUtc("2026-01-01"),
          description: source.description,
          legionellaIntervalDays: 14,
          internalTargetIntervalDays: 10,
          rules: {
            create: source.rules.map((rule) => ({
              id: `${copiedId}-${rule.id}`,
              revision: rule.revision + 1,
              requirementType: rule.requirementType,
              ruleName: rule.ruleName,
              sourceAuthority: rule.sourceAuthority,
              sourceCitation: rule.sourceCitation,
              isRegulatoryRequirement: rule.isRegulatoryRequirement,
              isGuidanceRequirement: rule.isGuidanceRequirement,
              isCompanyPolicy: rule.isCompanyPolicy,
              isContractRequirement: rule.isContractRequirement,
              isPendingRegulation: rule.isPendingRegulation,
              frequencyDays:
                rule.requirementType === "ROUTINE_LEGIONELLA_SAMPLE"
                  ? 14
                  : rule.frequencyDays,
              minimumDaysAfterTrigger: rule.minimumDaysAfterTrigger,
              maximumDaysAfterTrigger: rule.maximumDaysAfterTrigger,
              dueDateCalculation: rule.dueDateCalculation,
              appliesWhenOperating: rule.appliesWhenOperating,
              appliesWhenPartiallyOperating: rule.appliesWhenPartiallyOperating,
              appliesWhenSeasonal: rule.appliesWhenSeasonal,
              appliesWhenShutdown: rule.appliesWhenShutdown,
              triggerActivityType: rule.triggerActivityType,
              createsFollowUpRequirement: rule.createsFollowUpRequirement,
              followUpRequirementType: rule.followUpRequirementType,
              warningDays: rule.warningDays,
              criticalDays: rule.criticalDays,
              enabled: rule.enabled,
              notes: rule.notes,
            })),
          },
        },
      });
      await tx.towerRuleAssignment.updateMany({
        where: { coolingTowerSystemId: towerA.system.id },
        data: { ruleProfileId: copiedId },
      });
      await tx.coolingTowerSystem.update({
        where: { id: towerA.system.id },
        data: { ruleProfileId: copiedId },
      });
      await rebuildSystemComplianceProjections(
        tx,
        towerA.system.id,
        "2026-06-05",
      );
    });
    await db!.$transaction((tx) =>
      rebuildSystemComplianceProjections(tx, towerB.system.id, "2026-06-05"),
    );

    const [deadlineA, deadlineB] = await Promise.all([
      db!.sampleObligation.findFirstOrThrow({
        where: {
          coolingTowerSystemId: towerA.system.id,
          obligationType: "ROUTINE_OPERATING_SAMPLE",
        },
      }),
      db!.sampleObligation.findFirstOrThrow({
        where: {
          coolingTowerSystemId: towerB.system.id,
          obligationType: "ROUTINE_OPERATING_SAMPLE",
        },
      }),
    ]);
    expect(dateOnly(deadlineA.latestDueDate!)).toBe("2026-06-15");
    expect(dateOnly(deadlineB.latestDueDate!)).toBe(
      dateOnly(baselineB.latestDueDate!),
    );
    expect(deadlineB.ruleSetVersion).not.toContain(copiedId);
  }, 30_000);

  it("links on-time and late portal submissions without moving sampling", async () => {
    const tower = await createTower({
      label: "late-portal",
      profileId: "nyc-2026",
      configuration: "NYC_AND_NYS",
    });
    const firstSample = await recordSample(
      tower.system.id,
      tower.user.id,
      "2026-06-01",
    );
    await db!.$transaction((tx) =>
      rebuildSystemComplianceProjections(tx, tower.system.id, "2026-06-20"),
    );
    const latePortal = await db!.reportingObligation.findFirstOrThrow({
      where: {
        coolingTowerSystemId: tower.system.id,
        obligationType: "PORTAL_SAMPLE_DATE",
        triggerEventId: firstSample.id,
      },
    });
    const routineBefore = await db!.sampleObligation.findFirstOrThrow({
      where: {
        coolingTowerSystemId: tower.system.id,
        obligationType: "ROUTINE_OPERATING_SAMPLE",
      },
    });
    const lateReport = await db!.serviceEvent.create({
      data: {
        coolingTowerSystemId: tower.system.id,
        eventType: "REPORT_SUBMITTED",
        eventDate: asUtc("2026-06-10"),
        recordedById: tower.user.id,
        details: {
          reportType: "PORTAL_SAMPLE_DATE",
          reportingObligationId: latePortal.id,
          triggeringEventId: firstSample.id,
        },
      },
    });
    await db!.$transaction((tx) =>
      rebuildSystemComplianceProjections(tx, tower.system.id, "2026-06-20"),
    );
    const completedLate = await db!.reportingObligation.findUniqueOrThrow({
      where: { id: latePortal.id },
    });
    expect(completedLate.status).toBe("COMPLETED");
    expect(completedLate.completedByEventId).toBe(lateReport.id);
    expect(dateOnly(completedLate.latestDueDate!)).toBe(
      dateOnly(latePortal.latestDueDate!),
    );
    expect(
      await db!.reportingObligation.count({
        where: {
          id: latePortal.id,
          status: { in: ["PENDING", "SCHEDULED", "OVERDUE", "MISSED"] },
        },
      }),
    ).toBe(0);
    expect(
      dateOnly(
        (
          await db!.sampleObligation.findUniqueOrThrow({
            where: { id: routineBefore.id },
          })
        ).latestDueDate!,
      ),
    ).toBe(dateOnly(routineBefore.latestDueDate!));

    await db!.serviceEvent.update({
      where: { id: lateReport.id },
      data: { status: "CORRECTED" },
    });
    const replacement = await db!.serviceEvent.create({
      data: {
        coolingTowerSystemId: tower.system.id,
        eventType: "REPORT_SUBMITTED",
        eventDate: asUtc("2026-06-11"),
        recordedById: tower.user.id,
        correctedFromEventId: lateReport.id,
        details: lateReport.details!,
      },
    });
    await db!.$transaction((tx) =>
      rebuildSystemComplianceProjections(tx, tower.system.id, "2026-06-20"),
    );
    expect(
      (
        await db!.reportingObligation.findUniqueOrThrow({
          where: { id: latePortal.id },
        })
      ).completedByEventId,
    ).toBe(replacement.id);

    await db!.serviceEvent.update({
      where: { id: replacement.id },
      data: { status: "VOIDED" },
    });
    await db!.$transaction((tx) =>
      rebuildSystemComplianceProjections(tx, tower.system.id, "2026-06-20"),
    );
    expect(
      await db!.reportingObligation.findUniqueOrThrow({
        where: { id: latePortal.id },
      }),
    ).toMatchObject({ status: "MISSED", completedByEventId: null });

    const secondSample = await recordSample(
      tower.system.id,
      tower.user.id,
      "2026-07-01",
    );
    await db!.$transaction((tx) =>
      rebuildSystemComplianceProjections(tx, tower.system.id, "2026-07-02"),
    );
    const onTimePortal = await db!.reportingObligation.findFirstOrThrow({
      where: {
        coolingTowerSystemId: tower.system.id,
        obligationType: "PORTAL_SAMPLE_DATE",
        triggerEventId: secondSample.id,
      },
    });
    const nextRoutine = await db!.sampleObligation.findFirstOrThrow({
      where: {
        coolingTowerSystemId: tower.system.id,
        obligationType: "ROUTINE_OPERATING_SAMPLE",
        triggerEventId: secondSample.id,
      },
    });
    await db!.serviceEvent.create({
      data: {
        coolingTowerSystemId: tower.system.id,
        eventType: "REPORT_SUBMITTED",
        eventDate: asUtc("2026-07-04"),
        recordedById: tower.user.id,
        details: {
          reportType: "PORTAL_SAMPLE_DATE",
          reportingObligationId: onTimePortal.id,
          triggeringEventId: secondSample.id,
        },
      },
    });
    await db!.$transaction((tx) =>
      rebuildSystemComplianceProjections(tx, tower.system.id, "2026-07-04"),
    );
    expect(
      await db!.reportingObligation.findUniqueOrThrow({
        where: { id: onTimePortal.id },
      }),
    ).toMatchObject({ status: "COMPLETED" });
    expect(
      dateOnly(
        (
          await db!.sampleObligation.findUniqueOrThrow({
            where: { id: nextRoutine.id },
          })
        ).latestDueDate!,
      ),
    ).toBe(dateOnly(nextRoutine.latestDueDate!));
  }, 30_000);

  it("keeps annual certification periods stable across late rollover and rebuilds", async () => {
    const onTimeTower = await createTower({
      label: "annual-on-time",
      profileId: "nys-only",
      configuration: "NYS_ONLY",
    });
    await recordSample(
      onTimeTower.system.id,
      onTimeTower.user.id,
      "2026-06-01",
    );
    await db!.$transaction((tx) =>
      rebuildSystemComplianceProjections(
        tx,
        onTimeTower.system.id,
        "2026-10-01",
      ),
    );
    const onTimeAnnual = await db!.reportingObligation.findFirstOrThrow({
      where: {
        coolingTowerSystemId: onTimeTower.system.id,
        obligationType: "NYS_ANNUAL_CERTIFICATION",
        latestDueDate: asUtc("2026-11-01"),
      },
    });
    const onTimeSubmission = await db!.serviceEvent.create({
      data: {
        coolingTowerSystemId: onTimeTower.system.id,
        eventType: "REPORT_SUBMITTED",
        eventDate: asUtc("2026-10-15"),
        recordedById: onTimeTower.user.id,
        details: {
          reportType: "NYS_ANNUAL_CERTIFICATION",
          reportingObligationId: onTimeAnnual.id,
          triggeringEventId: onTimeAnnual.triggerEventId,
          certificationYear: 2026,
        },
      },
    });
    await db!.$transaction((tx) =>
      rebuildSystemComplianceProjections(
        tx,
        onTimeTower.system.id,
        "2026-10-15",
      ),
    );
    expect(
      await db!.reportingObligation.findUniqueOrThrow({
        where: { id: onTimeAnnual.id },
      }),
    ).toMatchObject({
      status: "COMPLETED",
      completedByEventId: onTimeSubmission.id,
    });

    const tower = await createTower({
      label: "annual-certification",
      profileId: "nys-only",
      configuration: "NYS_ONLY",
    });
    await recordSample(tower.system.id, tower.user.id, "2026-06-01");
    await db!.$transaction((tx) =>
      rebuildSystemComplianceProjections(tx, tower.system.id, "2026-10-01"),
    );
    await db!.$transaction((tx) =>
      rebuildSystemComplianceProjections(tx, tower.system.id, "2027-01-10"),
    );
    const annual2026 = await db!.reportingObligation.findFirstOrThrow({
      where: {
        coolingTowerSystemId: tower.system.id,
        obligationType: "NYS_ANNUAL_CERTIFICATION",
        latestDueDate: asUtc("2026-11-01"),
      },
    });
    const annual2027 = await db!.reportingObligation.findFirstOrThrow({
      where: {
        coolingTowerSystemId: tower.system.id,
        obligationType: "NYS_ANNUAL_CERTIFICATION",
        latestDueDate: asUtc("2027-11-01"),
      },
    });
    expect(annual2026.id).not.toBe(annual2027.id);
    const lateSubmission = await db!.serviceEvent.create({
      data: {
        coolingTowerSystemId: tower.system.id,
        eventType: "REPORT_SUBMITTED",
        eventDate: asUtc("2027-01-10"),
        recordedById: tower.user.id,
        details: {
          reportType: "NYS_ANNUAL_CERTIFICATION",
          reportingObligationId: annual2026.id,
          triggeringEventId: annual2026.triggerEventId,
          certificationYear: 2026,
        },
      },
    });
    await db!.$transaction((tx) =>
      rebuildSystemComplianceProjections(tx, tower.system.id, "2027-01-10"),
    );
    expect(
      await db!.reportingObligation.findUniqueOrThrow({
        where: { id: annual2026.id },
      }),
    ).toMatchObject({
      status: "COMPLETED",
      completedByEventId: lateSubmission.id,
    });
    expect(
      (
        await db!.reportingObligation.findUniqueOrThrow({
          where: { id: annual2027.id },
        })
      ).status,
    ).not.toBe("COMPLETED");
    await db!.$transaction((tx) =>
      rebuildSystemComplianceProjections(tx, tower.system.id, "2027-01-10"),
    );
    expect(
      await db!.reportingObligation.count({
        where: {
          coolingTowerSystemId: tower.system.id,
          obligationType: "NYS_ANNUAL_CERTIFICATION",
          latestDueDate: asUtc("2026-11-01"),
        },
      }),
    ).toBe(1);

    const ambiguousTower = await createTower({
      label: "ambiguous-annual",
      profileId: "nys-only",
      configuration: "NYS_ONLY",
    });
    await recordSample(
      ambiguousTower.system.id,
      ambiguousTower.user.id,
      "2026-06-01",
    );
    await db!.serviceEvent.create({
      data: {
        coolingTowerSystemId: ambiguousTower.system.id,
        eventType: "REPORT_SUBMITTED",
        eventDate: asUtc("2027-01-10"),
        recordedById: ambiguousTower.user.id,
        details: { reportType: "NYS_ANNUAL_CERTIFICATION" },
      },
    });
    await db!.$transaction((tx) =>
      rebuildSystemComplianceProjections(
        tx,
        ambiguousTower.system.id,
        "2027-01-10",
      ),
    );
    expect(
      await db!.reportingObligation.count({
        where: {
          coolingTowerSystemId: ambiguousTower.system.id,
          obligationType: "NYS_ANNUAL_CERTIFICATION",
          status: "COMPLETED",
        },
      }),
    ).toBe(0);
  }, 30_000);

  it("serializes sample voids and linked-result writes in either order", async () => {
    const tower = await createTower({
      label: "concurrency",
      profileId: "nyc-2026",
      configuration: "NYC_AND_NYS",
    });
    const first = new PrismaClient({ datasourceUrl: databaseUrl! });
    const second = new PrismaClient({ datasourceUrl: databaseUrl! });

    const runResultWrite = (
      sampleId: string,
      afterLock: () => Promise<void> = async () => {},
    ) =>
      first.$transaction(async (tx) => {
        await lockSystemCompliance(tx, tower.system.id);
        await afterLock();
        const sample = await tx.serviceEvent.findFirst({
          where: { id: sampleId, status: "ACTIVE" },
        });
        if (!sample) throw new Error("sample-not-active");
        return tx.serviceEvent.create({
          data: {
            coolingTowerSystemId: tower.system.id,
            eventType: "LEGIONELLA_RESULT_RECEIVED",
            eventDate: asUtc("2026-06-04"),
            recordedById: tower.user.id,
            details: { sampleEventId: sampleId, cfuPerMl: 1 },
          },
        });
      });
    const runSampleVoid = (
      sampleId: string,
      afterLock: () => Promise<void> = async () => {},
    ) =>
      second.$transaction(async (tx) => {
        await lockSystemCompliance(tx, tower.system.id);
        await afterLock();
        const results = await tx.serviceEvent.findMany({
          where: {
            coolingTowerSystemId: tower.system.id,
            eventType: "LEGIONELLA_RESULT_RECEIVED",
            status: "ACTIVE",
          },
        });
        if (
          results.some(
            (result) =>
              (result.details as { sampleEventId?: unknown } | null)
                ?.sampleEventId === sampleId,
          )
        )
          throw new Error("linked-result-active");
        return tx.serviceEvent.updateMany({
          where: { id: sampleId, status: "ACTIVE" },
          data: { status: "VOIDED" },
        });
      });

    const resultWinsSample = await recordSample(
      tower.system.id,
      tower.user.id,
      "2026-06-01",
    );
    let signalResultLock!: () => void;
    let releaseResultLock!: () => void;
    const resultLockAcquired = new Promise<void>((resolve) => {
      signalResultLock = resolve;
    });
    const resultLockRelease = new Promise<void>((resolve) => {
      releaseResultLock = resolve;
    });
    const resultFirst = runResultWrite(resultWinsSample.id, async () => {
      signalResultLock();
      await resultLockRelease;
    });
    await resultLockAcquired;
    const voidSecond = runSampleVoid(resultWinsSample.id);
    releaseResultLock();
    const resultWins = await Promise.allSettled([resultFirst, voidSecond]);
    expect(resultWins.map(({ status }) => status)).toEqual([
      "fulfilled",
      "rejected",
    ]);

    const voidWinsSample = await recordSample(
      tower.system.id,
      tower.user.id,
      "2026-07-01",
    );
    let signalVoidLock!: () => void;
    let releaseVoidLock!: () => void;
    const voidLockAcquired = new Promise<void>((resolve) => {
      signalVoidLock = resolve;
    });
    const voidLockRelease = new Promise<void>((resolve) => {
      releaseVoidLock = resolve;
    });
    const voidFirst = runSampleVoid(voidWinsSample.id, async () => {
      signalVoidLock();
      await voidLockRelease;
    });
    await voidLockAcquired;
    const resultSecond = runResultWrite(voidWinsSample.id);
    releaseVoidLock();
    const voidWins = await Promise.allSettled([voidFirst, resultSecond]);
    expect(voidWins.map(({ status }) => status)).toEqual([
      "fulfilled",
      "rejected",
    ]);

    const invalidLinks = await db!.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "ServiceEvent" result
      JOIN "ServiceEvent" sample
        ON result.details->>'sampleEventId' = sample.id
      WHERE result."eventType" = 'LEGIONELLA_RESULT_RECEIVED'
        AND result.status = 'ACTIVE'
        AND sample.status = 'VOIDED'
        AND result."coolingTowerSystemId" = ${tower.system.id}
    `;
    expect(Number(invalidLinks[0].count)).toBe(0);
    await Promise.all([first.$disconnect(), second.$disconnect()]);
  }, 30_000);
});
