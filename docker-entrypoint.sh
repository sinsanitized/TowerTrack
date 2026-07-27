#!/bin/sh
set -eu

set +e
npx tsx scripts/database-state.ts
database_state=$?
set -e

if [ "$database_state" -eq 10 ]; then
  echo "Existing TowerTrack schema detected; baselining the initial migration."
  npx prisma migrate resolve --applied 20260713190000_initial
elif [ "$database_state" -ne 0 ]; then
  echo "Unable to inspect database migration state."
  exit "$database_state"
fi

npx prisma migrate deploy

if [ "${SEED_ON_EMPTY:-false}" = "true" ]; then
  npx tsx scripts/seed-if-empty.ts
else
  npx tsx scripts/bootstrap-admin.ts
fi

exec node server.js
