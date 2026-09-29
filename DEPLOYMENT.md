# Deployment

## Local Docker development

Copy `.env.docker.example` to `.env` if you want to override the demo defaults, add `127.0.0.1 towertrack.local` to the hosts file, then run:

```bash
docker compose up --build
docker compose logs -f
docker compose down
```

The local database is only reachable inside the Compose network. PostgreSQL and uploads use persistent volumes. Caddy exposes only HTTP port 80. For a LAN deployment, configure internal DNS for `towertrack.local`, use a trusted internal TLS certificate, and change all default credentials.

Apply checked-in migrations: `docker compose exec web npm run db:migrate`. The container automatically seeds only a confirmed-empty local database. Direct destructive reseeding is refused unless the database name contains a standalone `test`/`e2e` marker or the operator explicitly sets `ALLOW_DESTRUCTIVE_SEED=true`. Create admin: `docker compose exec web npm run admin:create -- person@example.com 'strong-password' 'Name'`. Reset password: `docker compose exec web npm run admin:reset-password -- person@example.com 'new-password'`.

Update with `git pull`, then `docker compose up --build -d`. Review schema changes and take a backup first.

## Production with Supabase Postgres

1. Create a Supabase project and a dedicated Prisma database user.
2. Copy `.env.example` to `.env` and replace every placeholder. Set `DATABASE_URL` to the Supavisor Session pooler URL on port `5432`, with `sslmode=require`.
3. Keep `SEED_ON_EMPTY=false` and `DEMO_MODE=false`. Use a unique initial admin password and at least 32 random characters for `AUTH_SECRET`.
4. Validate the resolved Compose configuration: `docker compose -f docker-compose.supabase.yml config`.
5. Start the web and proxy services: `docker compose -f docker-compose.supabase.yml up --build -d`.
6. Confirm startup and health: `docker compose -f docker-compose.supabase.yml logs web` and `curl http://towertrack.local/api/health`.

On first startup, the container applies checked-in migrations and creates only the configured organization and administrator. Later startups preserve existing data and apply only pending migrations. The production Compose file intentionally has no local database or demo backup container.

See [SUPABASE.md](SUPABASE.md) before connecting a production project.
