#!/bin/sh
set -eu
mkdir -p backups
docker compose exec -T db pg_dump -U towertrack -d towertrack -Fc > "backups/towertrack_manual_$(date +%Y-%m-%d_%H-%M-%S).dump"
