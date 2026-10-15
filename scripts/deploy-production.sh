#!/usr/bin/env bash
# main 머지 시 self-hosted runner(pahidc)에서 실행된다.
set -euo pipefail
cd "$(dirname "$0")/.."
exec 9>/tmp/fruit-info-deploy.lock
flock 9
test -f /etc/fruit-info/api.env || { echo "/etc/fruit-info/api.env 없음" >&2; exit 1; }
docker compose -f compose.production.yaml config --quiet
docker compose -f compose.production.yaml up -d --build --force-recreate --wait --wait-timeout 240 api
# API 재생성으로 IP가 바뀌어도 nginx가 새 upstream을 조회한다.
docker compose -f compose.production.yaml up -d --no-deps --force-recreate --wait --wait-timeout 60 gateway
curl --fail --silent --show-error http://127.0.0.1:8081/api/health
