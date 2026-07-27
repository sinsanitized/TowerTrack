# TowerTrack

TowerTrack is a locally hosted, Legionella-first cooling-tower scheduling MVP. It separates regulatory hard dates from stable internal targets, keeps deadlines per system, recommends compatible combined visits, groups work by manual route zone, and records completion/audit follow-up.

## Start locally

1. Add `127.0.0.1 towertrack.local` to `/etc/hosts` (administrator access may be required).
2. Copy `.env.docker.example` to `.env` if you want to override the local demo defaults.
3. Run `docker compose up --build`.
4. Open [http://towertrack.local](http://towertrack.local).

Seed login: `admin@towertrack.local` / `ChangeMe123!`. Read-only fictional demo: `demo@towertrack.local` / `DemoOnly123!`.

Common commands:

```bash
docker compose down
docker compose logs -f
npm test
npm run typecheck
npm run test:e2e
npm run build
```

All seed records are fictional. TowerTrack is an operational aid, not legal advice.

## Database targets

Production uses Supabase Postgres through Prisma's `DATABASE_URL`; SQLite is not used. Local Docker development uses the PostgreSQL service in `docker-compose.yml`. The checked-in Prisma migrations are the single schema source for both environments.

See [DEPLOYMENT.md](DEPLOYMENT.md) for local and Supabase deployment steps and [SUPABASE.md](SUPABASE.md) for connection guidance.

The evidence-based implementation audit is in [CORE_LOGIC_CHECKLIST.md](CORE_LOGIC_CHECKLIST.md).
