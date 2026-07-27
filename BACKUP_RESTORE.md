# Backup and restore

## Local Docker database

The backup container creates a compressed PostgreSQL dump daily and removes dumps older than 30 days. The host `backups/` directory retains them. Run `./scripts/backup.sh` for a manual dump.

Restore in a maintenance window:

```bash
docker compose stop web caddy
./scripts/restore.sh backups/towertrack_YYYY-MM-DD_HH-MM-SS.dump
docker compose start web caddy
curl http://towertrack.local/api/health
```

Test restore on a separate Compose project before relying on it. Uploaded documents live in the `uploads` Docker volume and are not inside PostgreSQL dumps; back up that volume separately with an encrypted filesystem backup.

## Supabase production database

Use the backup and point-in-time recovery options configured for the Supabase project. Review retention and recovery coverage for the project's plan before production use. Test recovery into a separate project rather than overwriting the active database.

The app's `uploads` volume is not stored in Supabase Postgres and is not included in database backups. Back it up separately, encrypted, or move document storage to a managed object-storage service before relying on the deployment for production records.
