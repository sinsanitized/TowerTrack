# Supabase Postgres

Supabase Postgres is TowerTrack's production database. Prisma remains the ORM and `prisma/schema.prisma` plus `prisma/migrations` remain the canonical data model. The app does not use SQLite and does not put production records in a local database file.

## Connection

Create a dedicated Prisma database user in Supabase. For the long-running Next.js server, use the Supavisor Session pooler connection string on port `5432` as `DATABASE_URL`:

```dotenv
DATABASE_URL="postgresql://prisma.[PROJECT_REF]:[PASSWORD]@[DB_REGION].pooler.supabase.com:5432/postgres?sslmode=require"
```

Copy the exact host and project reference from the Supabase Connect panel. Percent-encode special characters in the password. Do not expose `DATABASE_URL` to browser code or prefix it with `NEXT_PUBLIC_`.

Supabase documents Prisma setup in its [Prisma integration guide](https://supabase.com/docs/guides/database/prisma) and describes the available connection methods in [Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Schema lifecycle

- Create schema changes in `prisma/schema.prisma` and commit a reviewed Prisma migration.
- Deployment runs `prisma migrate deploy`; it does not run `prisma db push`.
- An existing pre-migration TowerTrack database is baselined without deleting tables or records.
- A brand-new production database creates only the initial organization and administrator from environment variables.
- Keep `SEED_ON_EMPTY=false` in production so fictional sample data is never inserted.

Supabase's API and browser client are not required for this server-only database path. Adding them later for Supabase Auth, Storage, or Realtime should be a separate, reviewed change with Row Level Security appropriate to that access model.
