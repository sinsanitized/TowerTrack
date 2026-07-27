#!/bin/sh
set -eu
while true; do
  stamp="$(date +%Y-%m-%d_%H-%M-%S)"
  pg_dump -h db -U towertrack -d towertrack -Fc -f "/backups/towertrack_${stamp}.dump"
  find /backups -name 'towertrack_*.dump' -type f -mtime +30 -delete
  sleep 86400
done
