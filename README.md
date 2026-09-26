# TowerTrack

TowerTrack is a cooling-tower compliance and operations application for water-treatment companies. It turns verified regulatory rules and recorded field activity into clear deadlines, work queues, laboratory follow-up, reporting tasks, and auditable compliance history.

The current implementation focuses on one operational outcome: **make every active obligation visible and help users avoid missed compliance deadlines.**

## What TowerTrack does

- Generates date-only compliance requirements from versioned jurisdiction rules.
- Supports NYC Chapter 8, New York State Part 4, Company Policy, and verified custom profiles.
- Separates regulatory deadlines from recommended service dates.
- Tracks Legionella collection, laboratory results, bacteriological sampling, inspections, cleaning, disinfection, treatment, reporting, and certification.
- Shows overdue work, work due this week, next-week planning, and combined-visit opportunities.
- Distinguishes deadline urgency, work state, dependencies, and service responsibility.
- Configures responsibility independently for each service family.
- Records corrections and invalid records without deleting audit history.
- Recalculates affected requirements after verified completion, correction, or invalidation.
- Imports legacy Excel data through a preview, validation, confirmation, and rollback workflow.
- Provides role-based access for administrators, operations managers, schedulers, technicians, and read-only users.

## Primary workflow

1. Start in the **Action Center** and work from top to bottom.
2. Address **Act now** and overdue/problem deadlines first.
3. Complete work due during the current week.
4. Use next week for near-term planning.
5. Open a tower and follow its **Do this next** action.
6. Record the verified completion date and review the predicted compliance impact.
7. Save the record. TowerTrack recalculates deadlines and identifies any remaining work.

Scheduling does not satisfy an obligation. A compliance clock changes only when qualifying completed work is recorded.

## Key product areas

- **Action Center** — prioritized daily work and optional combined-visit suggestions.
- **Compliance issues** — Action Center drill-down for missed deadlines and issues requiring review.
- **All Deadlines** — portfolio-wide active requirements with due-date, work-type, responsibility, and schedule filters.
- **Towers** — cooling-tower identity, current status, next action, requirements, records, and settings.
- **Samples** — samples needing results, samples waiting on another party, and completed sample records.
- **All Compliance Records** — chronological records, corrections, invalid records, and preserved audit history.
- **Customers** — customer, facility, and cooling-tower onboarding.
- **Settings** — users, versioned compliance rules, imports, exports, and administrative configuration.

## Start with Docker

Requirements:

- Docker Desktop with Docker Compose
- A hosts-file entry for `towertrack.local` if that hostname is used

```bash
cp .env.docker.example .env
docker compose up --build -d
```

Open [http://towertrack.local](http://towertrack.local) or [http://localhost](http://localhost).

The local example credentials are defined in `.env.docker.example`:

```text
Email: admin@towertrack.local
Password: ChangeMe123!
```

Change all example credentials before using TowerTrack outside local development.

Useful Docker commands:

```bash
docker compose ps
docker compose logs -f web
docker compose exec web npm run db:migrate
docker compose down
```

PostgreSQL data, uploads, and Caddy data use persistent Docker volumes. The local stack also writes scheduled database backups to `./backups`.

## Run the application without Docker

Provide a PostgreSQL `DATABASE_URL` and the authentication variables shown in `.env.example`, then run:

```bash
npm install
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality checks

```bash
npm run format
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The test suite includes date-only behavior, Chapter 8 rule matrices, obligation generation, service responsibility, corrections, workflow coverage, responsive layouts, and browser-level operational scenarios.

## Technology

- Next.js App Router and React
- TypeScript and Tailwind CSS
- Prisma and PostgreSQL
- Zod validation
- Vitest and Testing Library
- Playwright
- Docker Compose and Caddy
- Supabase Postgres for the documented production target

Server actions enforce role authorization for writes and create audit records for compliance-sensitive changes. Prisma migrations are the canonical database schema.

## Compliance safeguards

- Compliance dates remain date-only and are not converted through browser-local time.
- NYC behavior is never used as the global default.
- Planned or scheduled activity does not reset a compliance clock.
- Cleaning and sampling remain separate activities.
- Responsibility labels coordinate operational work; they do not determine legal responsibility.
- Unverified rules create review work instead of authoritative regulatory deadlines.
- Corrections preserve the original record and rebuild dependent projections.

TowerTrack is an operational aid. It does not provide legal advice or replace review by a qualified professional.

## Documentation

- [Deployment](DEPLOYMENT.md)
- [Supabase setup](SUPABASE.md)
- [Architecture](ARCHITECTURE.md)
- [Business rules](BUSINESS_RULES.md)
- [User guide](USER_GUIDE.md)
- [Core logic checklist](CORE_LOGIC_CHECKLIST.md)
- [NYS rule matrix](docs/NYS_RULE_MATRIX.md)
- [Event workflow and NYS sampling](docs/event-workflow-and-nys-sampling.md)
- [Backup and restore](BACKUP_RESTORE.md)
- [Legacy Excel import](LEGACY_EXCEL_IMPORT.md)

All seeded demonstration records are fictional.
