# Architecture

TowerTrack uses Next.js App Router server components and server actions, TypeScript, Tailwind CSS, Prisma, and PostgreSQL. Supabase Postgres is the production database; the local Compose stack provides PostgreSQL for development only. Caddy is the reverse proxy. Signed HTTP-only cookies provide local authentication; role checks run on every server write. The local Compose stack owns the web, database, proxy, persistent uploads, and nightly backup services.

The pure rule layer (`lib/rules.ts`) accepts date-only strings and has no database/UI dependency. Prisma stores versioned profiles/definitions, system assignments, visits with independent activities, requirements, corrections, and review items. `lib/queries.ts` projects those records into planning rows without collapsing multi-system buildings.

The initial migration in `prisma/migrations` is the canonical database schema. Container startup runs `prisma migrate deploy`. A database created by an earlier TowerTrack build is baselined once, without dropping or recreating its tables, before migrations run. Empty local databases receive fictional sample data; empty production databases receive only the configured initial organization and administrator.

Prisma is the only database access layer in the app. It connects directly to PostgreSQL with `DATABASE_URL`; no SQLite database or local production-data file exists.
