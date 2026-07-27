#!/bin/sh
set -eu
if [ "$#" -ne 1 ]; then echo "Usage: ./scripts/restore.sh backups/file.dump"; exit 1; fi
docker compose exec -T db pg_restore -U towertrack -d towertrack --clean --if-exists < "$1"
