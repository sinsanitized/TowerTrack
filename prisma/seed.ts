import {
  PrismaClient,
  ActivityType,
  ActivityStatus,
  ColorCategory,
  JurisdictionMode,
  OperatingStatus,
  RequirementStatus,
  SourceAuthority,
  UserRole,
  VisitStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays } from "../lib/date";
import { calculateLegionellaPlan, type ProfileMode } from "../lib/rules";
import { rebuildSystemComplianceProjections } from "../lib/obligation-projections";

const db = new PrismaClient();
const TODAY = "2026-07-13";
const D = (value: string) => new Date(`${value}T12:00:00Z`);

async function main() {
  await db.auditLog.deleteMany();
  await db.reviewItem.deleteMany();
  await db.complianceStatus.deleteMany();
  await db.labResult.deleteMany();
  await db.reportingObligation.deleteMany();
  await db.maintenanceObligation.deleteMany();
  await db.inspectionObligation.deleteMany();
  await db.sampleObligation.deleteMany();
  await db.operatingPeriod.deleteMany();
  await db.serviceEvent.deleteMany();
  await db.correctiveActionCase.deleteMany();
  await db.requirement.deleteMany();
  await db.visitActivity.deleteMany();
  await db.visit.deleteMany();
  await db.route.deleteMany();
  await db.coolingTowerSystem.deleteMany();
  await db.pendingRegulation.deleteMany();
  await db.ruleDefinition.deleteMany();
  await db.ruleProfile.deleteMany();
  await db.jurisdiction.deleteMany();
  await db.building.deleteMany();
  await db.customer.deleteMany();
  await db.user.deleteMany();
  await db.organization.deleteMany();
  const org = await db.organization.create({
    data: { name: "TowerTrack Demo Water Treatment" },
  });
  const password = await bcrypt.hash(
    process.env.INITIAL_ADMIN_PASSWORD || "ChangeMe123!",
    12,
  );
  const demoPassword = await bcrypt.hash("DemoOnly123!", 12);
  const admin = await db.user.create({
    data: {
      organizationId: org.id,
      name: "Avery Morgan",
      email: process.env.INITIAL_ADMIN_EMAIL || "admin@towertrack.local",
      passwordHash: password,
      role: UserRole.ADMIN,
    },
  });
  const mike = await db.user.create({
    data: {
      organizationId: org.id,
      name: "Mike Torres",
      email: "mike@towertrack.local",
      passwordHash: password,
      role: UserRole.TECHNICIAN,
    },
  });
  const nia = await db.user.create({
    data: {
      organizationId: org.id,
      name: "Nia Patel",
      email: "nia@towertrack.local",
      passwordHash: password,
      role: UserRole.TECHNICIAN,
    },
  });
  await db.user.create({
    data: {
      organizationId: org.id,
      name: "Fictional Demo Viewer",
      email: "demo@towertrack.local",
      passwordHash: demoPassword,
      role: UserRole.READ_ONLY,
    },
  });
  const nyc = await db.jurisdiction.create({
    data: {
      country: "US",
      state: "NY",
      city: "New York",
      notes: "Five boroughs",
    },
  });
  const nys = await db.jurisdiction.create({
    data: {
      country: "US",
      state: "NY",
      county: "Westchester",
      notes: "New York State outside NYC",
    },
  });
  const nj = await db.jurisdiction.create({
    data: { country: "US", state: "NJ", municipality: "Newark" },
  });
  const pa = await db.jurisdiction.create({
    data: { country: "US", state: "PA" },
  });
  const ct = await db.jurisdiction.create({
    data: { country: "US", state: "CT" },
  });
  const profiles = [
    {
      id: "nyc-2026",
      name: "NYC Chapter 8 2026 + NYS Part 4",
      mode: JurisdictionMode.NYC_CHAPTER_8_2026_PLUS_NYS_PART_4,
      jurisdictionId: nyc.id,
      interval: 31,
      authority: SourceAuthority.REGULATORY,
      description:
        "NYC Chapter 8 effective May 8, 2026 plus applicable NYS Part 4.",
    },
    {
      id: "nys-only",
      name: "NYS Part 4 Only",
      mode: JurisdictionMode.NYS_PART_4_ONLY,
      jurisdictionId: nys.id,
      interval: 90,
      authority: SourceAuthority.REGULATORY,
      description:
        "New York State outside NYC; never receives the NYC 31-day rule.",
    },
    {
      id: "oos-policy",
      name: "Out-of-State Company Policy",
      mode: JurisdictionMode.OUT_OF_STATE_COMPANY_POLICY,
      jurisdictionId: null,
      interval: 90,
      authority: SourceAuthority.COMPANY_POLICY,
      description:
        "Configurable operational policy; not represented as statutory compliance.",
    },
    {
      id: "oos-guidance",
      name: "Out-of-State Guidance",
      mode: JurisdictionMode.OUT_OF_STATE_GUIDANCE,
      jurisdictionId: null,
      interval: 120,
      authority: SourceAuthority.GUIDANCE,
      description: "Best-practice guidance only; no legal claim.",
    },
    {
      id: "pending",
      name: "Pending Regulation Review",
      mode: JurisdictionMode.PENDING_REGULATION,
      jurisdictionId: nj.id,
      interval: null,
      authority: SourceAuthority.PENDING_REGULATION,
      description: "Monitoring only. Generates no hard deadline.",
    },
    {
      id: "custom",
      name: "Custom Jurisdiction — Needs Review",
      mode: JurisdictionMode.CUSTOM_JURISDICTION,
      jurisdictionId: ct.id,
      interval: null,
      authority: SourceAuthority.UNKNOWN_REQUIRES_REVIEW,
      description:
        "Custom rule awaiting verified citation and admin confirmation.",
    },
  ];
  for (const p of profiles) {
    await db.ruleProfile.create({
      data: {
        id: p.id,
        name: p.name,
        jurisdictionMode: p.mode,
        jurisdictionId: p.jurisdictionId,
        effectiveStartDate:
          p.id === "nyc-2026" ? D("2026-05-08") : D("2016-07-06"),
        description: p.description,
        isDefault: true,
        legionellaIntervalDays: p.interval,
        internalTargetIntervalDays: p.id === "nys-only" ? 31 : null,
        appliesToPartialOperation:
          p.mode !== JurisdictionMode.PENDING_REGULATION,
      },
    });
    const regulatory = p.authority === SourceAuthority.REGULATORY;
    await db.ruleDefinition.create({
      data: {
        id: `${p.id}-legionella`,
        ruleProfileId: p.id,
        requirementType: "ROUTINE_LEGIONELLA_SAMPLE",
        ruleName: `${p.name} routine Legionella`,
        sourceAuthority: p.authority,
        sourceCitation:
          p.id === "nyc-2026"
            ? "NYC Chapter 8 §8-05; effective May 8, 2026"
            : p.id === "nys-only"
              ? "10 NYCRR §4-1.4(b)"
              : "Configured profile",
        isRegulatoryRequirement: regulatory,
        isGuidanceRequirement: p.authority === SourceAuthority.GUIDANCE,
        isCompanyPolicy: p.authority === SourceAuthority.COMPANY_POLICY,
        isPendingRegulation: p.authority === SourceAuthority.PENDING_REGULATION,
        frequencyDays: p.interval,
        dueDateCalculation: p.interval
          ? "LAST_QUALIFYING_ACTIVITY_PLUS_FREQUENCY"
          : "REVIEW_ONLY",
        warningDays: 7,
        criticalDays: 3,
        notes: p.description,
      },
    });
  }
  const extras = [
    [
      "nyc-portal",
      "nyc-2026",
      "PORTAL_SAMPLE_DATE",
      "NYC sample-date portal entry",
      5,
      "NYC Chapter 8 §8-05",
    ],
    [
      "nyc-inspection",
      "nyc-2026",
      "COMPLIANCE_INSPECTION",
      "NYC compliance inspection",
      90,
      "NYC Chapter 8; 10 NYCRR §4-1.8",
    ],
    [
      "nyc-hyper",
      "nyc-2026",
      "SUMMERTIME_HYPERHALOGENATION",
      "Summertime hyperhalogenation",
      null,
      "NYC Chapter 8",
    ],
    [
      "nyc-cleaning",
      "nyc-2026",
      "ANNUAL_CLEANING",
      "Twice-yearly cooling tower cleaning",
      null,
      "24 RCNY §8-04",
    ],
    [
      "nys-bac",
      "nys-only",
      "ROUTINE_BACTERIOLOGICAL_SAMPLE",
      "NYS bacteriological sampling",
      30,
      "10 NYCRR §4-1.4(b)(1)",
    ],
    [
      "nys-inspection",
      "nys-only",
      "COMPLIANCE_INSPECTION",
      "NYS inspection",
      90,
      "10 NYCRR §4-1.8",
    ],
  ] as const;
  for (const [id, profileId, type, name, days, citation] of extras)
    await db.ruleDefinition.create({
      data: {
        id,
        ruleProfileId: profileId,
        requirementType: type,
        ruleName: name,
        sourceAuthority: SourceAuthority.REGULATORY,
        sourceCitation: citation,
        isRegulatoryRequirement: true,
        frequencyDays: days,
        dueDateCalculation: days ? "TRIGGER_PLUS_FREQUENCY" : "ANNUAL_WINDOW",
        createsFollowUpRequirement: id === "nyc-hyper",
        followUpRequirementType:
          id === "nyc-hyper" ? "POST_HYPERHALOGENATION_SAMPLE" : null,
      },
    });
  const pending = await db.pendingRegulation.create({
    data: {
      jurisdictionId: nj.id,
      expectedRuleName: "Fictional New Jersey cooling-tower rule monitoring",
      expectedAuthority: "State/municipal authority — unverified",
      monitoringNotes:
        "Example only. Review official sources before conversion.",
      lastReviewedDate: D("2026-06-01"),
      nextReviewDate: D("2026-08-01"),
      status: "AWAITING_RULEMAKING",
    },
  });
  const customerNames = [
    "Northstar Property Group",
    "Harborview Health Partners",
    "Beacon Commercial Services",
    "Metro Industrial Holdings",
    "Greenline Campus Management",
  ];
  const customers = [];
  for (let i = 0; i < 5; i++)
    customers.push(
      await db.customer.create({
        data: {
          organizationId: org.id,
          name: customerNames[i],
          accountNumber: `TT-${String(i + 1).padStart(3, "0")}`,
          contacts: [
            {
              type: "property manager",
              name: `Fictional Contact ${i + 1}`,
              email: `contact${i + 1}@example.invalid`,
            },
          ],
          notes: "Fictional demonstration record",
        },
      }),
    );
  const buildingData = [
    [
      0,
      "100 Park Avenue",
      "100 Park Ave",
      "New York",
      "NY",
      "10017",
      "Manhattan",
      "New York",
      "MIDTOWN EAST",
      nyc.id,
    ],
    [
      0,
      "120 Park Plaza",
      "120 Park Ave",
      "New York",
      "NY",
      "10017",
      "Manhattan",
      "New York",
      "MIDTOWN EAST",
      nyc.id,
    ],
    [
      1,
      "Harborview Medical Pavilion",
      "85 Atlantic Ave",
      "Brooklyn",
      "NY",
      "11201",
      "Brooklyn",
      "Kings",
      "DOWNTOWN BROOKLYN",
      nyc.id,
    ],
    [
      1,
      "Queens Wellness Center",
      "42-20 Queens Blvd",
      "Queens",
      "NY",
      "11104",
      "Queens",
      "Queens",
      "QUEENS WEST",
      nyc.id,
    ],
    [
      2,
      "Bronx Commerce Center",
      "350 Grand Concourse",
      "Bronx",
      "NY",
      "10451",
      "Bronx",
      "Bronx",
      "SOUTH BRONX",
      nyc.id,
    ],
    [
      2,
      "Staten Island Logistics",
      "25 Victory Blvd",
      "Staten Island",
      "NY",
      "10301",
      "Staten Island",
      "Richmond",
      "STATEN ISLAND NORTH",
      nyc.id,
    ],
    [
      3,
      "White Plains Technology Park",
      "350 Westchester Ave",
      "White Plains",
      "NY",
      "10604",
      null,
      "Westchester",
      "WESTCHESTER CENTRAL",
      nys.id,
    ],
    [
      3,
      "Albany Processing Campus",
      "55 Fictional Way",
      "Albany",
      "NY",
      "12207",
      null,
      "Albany",
      "CAPITAL REGION",
      nys.id,
    ],
    [
      3,
      "Newark Industrial Site",
      "90 Example St",
      "Newark",
      "NJ",
      "07102",
      null,
      "Essex",
      "NEWARK CORE",
      nj.id,
    ],
    [
      4,
      "Pennsylvania Distribution Hub",
      "400 Sample Pike",
      "Allentown",
      "PA",
      "18101",
      null,
      "Lehigh",
      "LEHIGH VALLEY",
      pa.id,
    ],
    [
      4,
      "Connecticut Research Annex",
      "88 Test Lane",
      "Stamford",
      "CT",
      "06901",
      null,
      "Fairfield",
      "STAMFORD",
      ct.id,
    ],
    [
      4,
      "Garden State Guidance Site",
      "120 Demo Blvd",
      "Jersey City",
      "NJ",
      "07302",
      null,
      "Hudson",
      "JERSEY CITY",
      nj.id,
    ],
  ] as const;
  const buildings = [];
  for (const b of buildingData) {
    buildings.push(
      await db.building.create({
        data: {
          customerId: customers[b[0]].id,
          buildingName: b[1],
          streetAddress: b[2],
          city: b[3],
          state: b[4],
          postalCode: b[5],
          borough: b[6],
          county: b[7],
          municipality: b[3],
          routeZone: b[8],
          defaultVisitMinutes: 75,
        },
      }),
    );
  }
  const sampleDates = [
    "2026-06-08",
    "2026-06-12",
    "2026-06-15",
    "2026-06-17",
    "2026-06-20",
    "2026-06-25",
    "2026-07-01",
    "2026-06-18",
    "2026-06-10",
    "2026-06-22",
    "2026-06-26",
    "2026-07-04",
    "2026-04-20",
    "2026-05-10",
    "2026-05-28",
    "2026-06-02",
    "2026-05-01",
    "2026-05-15",
    "2026-04-30",
    "2026-05-20",
    "2026-04-01",
    "2026-03-15",
    null,
    null,
  ] as const;
  const systems = [];
  for (let i = 0; i < 24; i++) {
    const building = buildings[Math.floor(i / 2)];
    const profileId =
      i < 12
        ? "nyc-2026"
        : i < 16
          ? "nys-only"
          : i < 20
            ? "oos-policy"
            : i < 22
              ? "oos-guidance"
              : i === 22
                ? "pending"
                : "custom";
    const jurisdictionId =
      i < 12
        ? nyc.id
        : i < 16
          ? nys.id
          : i < 18
            ? nj.id
            : i < 20
              ? pa.id
              : i < 22
                ? nj.id
                : i === 22
                  ? nj.id
                  : ct.id;
    const operatingStatus =
      i === 9
        ? OperatingStatus.PARTIALLY_OPERATING
        : i === 15
          ? OperatingStatus.SEASONALLY_INACTIVE
          : OperatingStatus.OPERATING;
    const system = await db.coolingTowerSystem.create({
      data: {
        buildingId: building.id,
        jurisdictionId,
        ruleProfileId: profileId,
        pendingRegulationId: i === 16 || i === 22 ? pending.id : null,
        internalJobNumber: `JOB-${1001 + i}`,
        systemName: `CT-${(i % 2) + 1}`,
        NYCSystemId: i < 12 ? `NYC-${7000 + i}` : null,
        NYSSystemId: i < 16 ? `NYS-${8000 + i}` : null,
        registrationNumber: `REG-FX-${9000 + i}`,
        operatingStatus,
        seasonal: i === 15,
        operationPeriodType: i === 15 ? "SEASONAL" : "YEAR_ROUND",
        seasonStartMonth: 5,
        seasonStartDay: 1,
        seasonEndMonth: 10,
        seasonEndDay: 31,
        preferredTargetDay: [15, 18, 20, 22][i % 4],
        assignedTechnicianId: i % 2 ? mike.id : nia.id,
        mppVersion: "MPP-FX-2026.1",
        qualifiedPerson: "Fictional QP",
        laboratory: "Fictional ELAP Laboratory",
        notes: "Fictional seed data",
      },
    });
    systems.push(system);
    const profile = profiles.find((p) => p.id === profileId)!;
    const sample = sampleDates[i];
    let sampleActivityId: string | undefined;
    if (sample) {
      const visit = await db.visit.create({
        data: {
          buildingId: building.id,
          scheduledDate: D(sample),
          performedDate: D(sample),
          status: VisitStatus.COMPLETED,
          assignedTechnicianId: i % 2 ? mike.id : nia.id,
          createdById: admin.id,
          notes: "Seeded historical visit",
        },
      });
      const activity = await db.visitActivity.create({
        data: {
          visitId: visit.id,
          coolingTowerSystemId: system.id,
          activityType: ActivityType.ROUTINE_LEGIONELLA_SAMPLE,
          scheduledDate: D(sample),
          performedDate: D(sample),
          status: ActivityStatus.COMPLETED,
          qualifiesForRoutineLegionella: true,
          dateSource: i === 3 ? "CHAIN_OF_CUSTODY" : "FIELD_REPORT",
          ruleProfileId: profileId,
          ruleDefinitionId: `${profileId}-legionella`,
          sourceAuthority: profile.authority,
        },
      });
      sampleActivityId = activity.id;
      await db.serviceEvent.create({
        data: {
          coolingTowerSystemId: system.id,
          eventType: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
          eventDate: D(sample),
          details: { importedFrom: "seeded historical visit" },
          notes: "Fictional historical sample event",
          recordedById: admin.id,
        },
      });
      if (i < 12)
        await db.serviceEvent.create({
          data: {
            coolingTowerSystemId: system.id,
            eventType: "QUARTERLY_INSPECTION_COMPLETED",
            eventDate: D(addDays(sample, -40)),
            notes: "Fictional qualified-person inspection",
            recordedById: admin.id,
          },
        });
    }
    const plan = calculateLegionellaPlan({
      profile: profile.mode as ProfileMode,
      lastSample: sample,
      today: TODAY,
      operatingStatus,
      configuredIntervalDays: profile.interval,
      preferredTargetDay: [15, 18, 20, 22][i % 4],
      needsReview: profileId === "custom",
    });
    await db.requirement.create({
      data: {
        coolingTowerSystemId: system.id,
        requirementType: "ROUTINE_LEGIONELLA_SAMPLE",
        sourceRule: `${profile.name} routine Legionella`,
        ruleSetVersion: "2026.1",
        ruleDefinitionId: `${profileId}-legionella`,
        ruleProfileId: profileId,
        sourceAuthority: profile.authority,
        sourceCitation:
          profileId === "nyc-2026"
            ? "NYC Chapter 8 §8-05"
            : profileId === "nys-only"
              ? "10 NYCRR §4-1.4(b)"
              : "Configured profile",
        isRegulatoryRequirement:
          profile.authority === SourceAuthority.REGULATORY,
        isCompanyPolicy: profile.authority === SourceAuthority.COMPANY_POLICY,
        isGuidanceRequirement: profile.authority === SourceAuthority.GUIDANCE,
        isPendingRegulation:
          profile.authority === SourceAuthority.PENDING_REGULATION,
        schedulingWindowStart: plan.earliestUsefulDate
          ? D(plan.earliestUsefulDate)
          : null,
        preferredDate: plan.internalTargetDate
          ? D(plan.internalTargetDate)
          : null,
        latestAllowedDate: plan.latestSafeDate ? D(plan.latestSafeDate) : null,
        hardDueDate: plan.hardDueDate ? D(plan.hardDueDate) : null,
        status: plan.status.status as RequirementStatus,
        statusColorCategory: plan.status.color as ColorCategory,
        explanation: plan.explanation,
        completedActivityId: undefined,
      },
    });
  }
  const route = await db.route.create({
    data: {
      routeDate: D("2026-07-15"),
      technicianId: mike.id,
      name: "Midtown East · July 15",
      status: "CONFIRMED",
    },
  });
  for (const [idx, systemIndex] of [2, 3, 6].entries()) {
    const s = systems[systemIndex];
    const visit = await db.visit.create({
      data: {
        buildingId: s.buildingId,
        scheduledDate: D("2026-07-15"),
        status: VisitStatus.CONFIRMED,
        assignedTechnicianId: mike.id,
        routeId: route.id,
        routeSequence: idx + 1,
        createdById: admin.id,
        estimatedMinutes: systemIndex === 2 ? 105 : 60,
      },
    });
    const sample = await db.visitActivity.create({
      data: {
        visitId: visit.id,
        coolingTowerSystemId: s.id,
        activityType: ActivityType.ROUTINE_LEGIONELLA_SAMPLE,
        scheduledDate: D("2026-07-15"),
        status: ActivityStatus.PLANNED,
        qualifiesForRoutineLegionella: true,
        ruleProfileId: s.ruleProfileId,
        ruleDefinitionId: `${s.ruleProfileId}-legionella`,
        sourceAuthority: SourceAuthority.REGULATORY,
      },
    });
    if (systemIndex === 2) {
      await db.visitActivity.create({
        data: {
          visitId: visit.id,
          coolingTowerSystemId: s.id,
          activityType: ActivityType.COMPLIANCE_INSPECTION,
          scheduledDate: D("2026-07-15"),
          status: ActivityStatus.PLANNED,
          qualifiesForInspection: true,
          ruleProfileId: s.ruleProfileId,
          ruleDefinitionId: "nyc-inspection",
          sourceAuthority: SourceAuthority.REGULATORY,
        },
      });
      await db.visitActivity.create({
        data: {
          visitId: visit.id,
          coolingTowerSystemId: s.id,
          activityType: ActivityType.CLEANING,
          scheduledDate: D("2026-07-15"),
          status: ActivityStatus.PLANNED,
          qualifiesForCleaning: true,
          ruleProfileId: s.ruleProfileId,
          sourceAuthority: SourceAuthority.CONTRACT_REQUIREMENT,
        },
      });
    }
    await db.requirement.updateMany({
      where: {
        coolingTowerSystemId: s.id,
        requirementType: "ROUTINE_LEGIONELLA_SAMPLE",
      },
      data: {
        scheduledActivityId: sample.id,
        status: "SCHEDULED_PENDING",
        statusColorCategory: "GREEN",
      },
    });
  }
  const high = systems[0];
  const highSample = await db.serviceEvent.findFirstOrThrow({
    where: {
      coolingTowerSystemId: high.id,
      eventType: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
      status: "ACTIVE",
    },
    orderBy: { eventDate: "desc" },
    select: { id: true },
  });
  await db.serviceEvent.create({
    data: {
      coolingTowerSystemId: high.id,
      eventType: "LEGIONELLA_RESULT_RECEIVED",
      eventDate: D("2026-07-12"),
      eventTimestamp: new Date("2026-07-12T14:00:00.000Z"),
      details: { cfuPerMl: 1450, sampleEventId: highSample.id },
      notes: "Fictional Level 4 laboratory result",
      recordedById: admin.id,
    },
  });
  await db.serviceEvent.createMany({
    data: [
      {
        coolingTowerSystemId: systems[1].id,
        eventType: "SUMMERTIME_HYPERHALOGENATION",
        eventDate: D("2026-07-01"),
        details: {
          chemical: "Fictional sodium hypochlorite",
          quantity: "Fictional 12 gal",
          contactTime: "6 hours",
          ph: "7.4",
          freeHalogenResidual: "5.2–5.8 ppm",
          technician: "Mike Torres",
        },
        notes: "Fictional annual summertime event",
        recordedById: admin.id,
      },
      {
        coolingTowerSystemId: systems[4].id,
        eventType: "STARTUP",
        eventDate: D("2026-07-05"),
        details: {},
        notes: "Fictional startup event",
        recordedById: admin.id,
      },
      {
        coolingTowerSystemId: systems[5].id,
        eventType: "POWER_FAILURE",
        eventDate: D("2026-07-12"),
        details: {},
        notes: "Fictional outage long enough to permit growth",
        recordedById: admin.id,
      },
      {
        coolingTowerSystemId: systems[7].id,
        eventType: "WEEKLY_BIOLOGICAL_INDICATOR_RESULT",
        eventDate: D("2026-07-09"),
        details: {
          cfuPerMl: 12000,
          residualRestoredWithin3Days: false,
        },
        notes: "Fictional unresolved biological indicator event",
        recordedById: admin.id,
      },
      {
        coolingTowerSystemId: systems[2].id,
        eventType: "CLEANING_COMPLETED",
        eventDate: D("2026-07-10"),
        details: {},
        notes: "Fictional cleaning; creates no sample obligation",
        recordedById: admin.id,
      },
    ],
  });
  await db.correctiveActionCase.create({
    data: {
      coolingTowerSystemId: high.id,
      resultValue: 1450,
      severityLevel: "LEVEL_4",
      status: "OPEN",
      sourceAuthority: SourceAuthority.REGULATORY,
      notificationDeadline: new Date("2026-07-13T18:00:00Z"),
      disinfectionDeadline: new Date("2026-07-13T18:00:00Z"),
      remediationDeadline: new Date("2026-07-14T18:00:00Z"),
      retestWindowStart: D("2026-07-16"),
      retestWindowEnd: D("2026-07-20"),
    },
  });
  await db.requirement.create({
    data: {
      coolingTowerSystemId: systems[6].id,
      requirementType: "PORTAL_SAMPLE_DATE",
      sourceRule: "NYC sample-date portal entry",
      ruleSetVersion: "2026.1",
      ruleDefinitionId: "nyc-portal",
      ruleProfileId: "nyc-2026",
      sourceAuthority: SourceAuthority.REGULATORY,
      sourceCitation: "NYC Chapter 8 §8-05",
      isRegulatoryRequirement: true,
      hardDueDate: D("2026-07-11"),
      taskOwnershipLabel: "OWNER_FOLLOW_UP",
      status: "OWNER_FOLLOW_UP",
      statusColorCategory: "BLUE",
      explanation: "Sample date entry due five calendar days after collection.",
    },
  });
  const reviews = [
    [
      "Possible duplicate sample",
      "Two Legionella entries appear on the same system and date.",
      "VisitActivity",
      systems[4].id,
      "PURPLE",
    ],
    [
      "Lab date precedes collection",
      "A fictional imported lab result date is before its sample date.",
      "LaboratoryResult",
      systems[8].id,
      "RED",
    ],
    [
      "Pending regulation review",
      "New Jersey example profile is due for source review; it creates no hard deadlines.",
      "PendingRegulation",
      pending.id,
      "PURPLE",
    ],
    [
      "Custom rule source unverified",
      "Connecticut custom profile needs a qualified-person citation check.",
      "RuleProfile",
      "custom",
      "PURPLE",
    ],
  ] as const;
  for (const [title, description, entityType, entityId, severity] of reviews)
    await db.reviewItem.create({
      data: { title, description, entityType, entityId, severity },
    });
  await db.auditLog.create({
    data: {
      entityType: "Seed",
      entityId: org.id,
      action: "IMPORTED",
      reason: "Fictional MVP seed data",
      changedById: admin.id,
      newValue: {
        customers: 5,
        buildings: 12,
        systems: 24,
        dateSource: "IMPORTED_CSV",
      },
    },
  });
  for (const system of systems.filter(
    (item) => item.ruleProfileId === "nyc-2026",
  ))
    await db.$transaction((tx) =>
      rebuildSystemComplianceProjections(tx, system.id, TODAY),
    );
  console.log("Seeded TowerTrack: 5 customers, 12 buildings, 24 systems.");
}
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
