# Architecture

TowerTrack uses Next.js App Router server components and server actions, TypeScript, Tailwind CSS, Prisma, and PostgreSQL. Supabase Postgres is the production database; the local Compose stack provides PostgreSQL for development only. Caddy is the reverse proxy. Signed HTTP-only cookies provide local authentication; role checks run on every server write. The local Compose stack owns the web, database, proxy, persistent uploads, and nightly backup services.

The compliance calculation layer is split by responsibility. `lib/rules.ts` owns shared constants and legacy plan helpers; `lib/obligation-engine.ts` is the canonical event-to-obligation calculator; `lib/rule-profile.ts` compiles versioned database rules; and `lib/obligation-projections.ts` persists rebuilt projections. These modules use date-only strings and have no UI dependency. Prisma stores versioned profiles/definitions, system assignments, visits with independent activities, requirements, corrections, and review items. `lib/queries.ts` projects those records into planning rows without collapsing multi-system buildings.

Server mutations are organized by domain. `app/actions/users.ts` owns administrator-managed user accounts, `app/actions/customers.ts` owns customer onboarding and addresses, and `app/actions.ts` retains the tightly coupled tower, compliance-event, and rule-profile workflows. Every write must authorize the user, scope database access to the user's organization, write its audit record in the same transaction, and rebuild affected projections when compliance state changes. Further extraction should follow the same domain boundary without changing those invariants.

The product is completion-date driven: recorded service events fulfill requirements and rebuild compliance projections. Legacy scheduling mutations have been removed; the remaining visit records are historical/read-only compatibility data, not a second compliance clock.

The initial migration in `prisma/migrations` is the canonical database schema. Container startup runs `prisma migrate deploy`. A database created by an earlier TowerTrack build is baselined once, without dropping or recreating its tables, before migrations run. Empty local databases receive fictional sample data; empty production databases receive only the configured initial organization and administrator.

Prisma is the only database access layer in the app. It connects directly to PostgreSQL with `DATABASE_URL`; no SQLite database or local production-data file exists.
