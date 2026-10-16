#!/usr/bin/env bash
# 서버의 촬영 키를 바꾼다. 키는 입력할 때 화면에 보이지 않고 어디에도 출력되지 않는다.
#   bash scripts/set-upload-key.sh
set -euo pipefail
ssh -t pahidc '
  read -rsp "새 촬영 키: " K; echo
  read -rsp "한 번 더: " K2; echo
  [ -n "$K" ] && [ "$K" = "$K2" ] || { echo "키가 비었거나 서로 다릅니다"; exit 1; }
  NEW_KEY="$K" python3 - <<PY
import os, re
p = "/etc/fruit-info/api.env"
s = open(p).read()
s = re.sub(r"^UPLOAD_KEY=.*$", "UPLOAD_KEY=" + os.environ["NEW_KEY"], s, flags=re.M)
open(p, "w").write(s)
PY
  cd ~/actions-runner-fruit-info/_work/fruit-info/fruit-info
  docker compose -f compose.production.yaml up -d --no-deps --force-recreate --wait api >/dev/null
  docker compose -f compose.production.yaml up -d --no-deps --force-recreate --wait gateway >/dev/null
  echo "촬영 키를 바꿨습니다"
'
