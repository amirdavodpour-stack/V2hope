#!/usr/bin/env bash
set -euo pipefail

: "${STAGING_BASE_URL:?Set STAGING_BASE_URL to the deployed staging API base, e.g. https://staging.example.com/api/v1}"
case "$STAGING_BASE_URL" in
  https://*) ;;
  *) echo 'STAGING_BASE_URL must use HTTPS.' >&2; exit 1 ;;
esac

curl_json() {
  local url="$1"
  curl --fail-with-body --silent --show-error --location \
    --connect-timeout 5 --max-time 10 \
    -H 'accept: application/json' "$url"
}

printf '%s\n' '== staging health =='
live="$(curl_json "${STAGING_BASE_URL%/}/health")"
python3 - "$live" <<'PY'
import json, sys
v=json.loads(sys.argv[1])
assert v.get('alive') is True, v
assert v.get('service') == 'hope-api', v
print('PASS: live', v.get('version'))
PY

printf '%s\n' '== staging readiness =='
ready="$(curl_json "${STAGING_BASE_URL%/}/ready")"
python3 - "$ready" <<'PY'
import json, sys
v=json.loads(sys.argv[1])
assert v.get('ready') is True, v
assert v.get('database',{}).get('status') == 'ok', v
print('PASS: ready')
PY

printf '%s\n' '== public categories =='
categories="$(curl_json "${STAGING_BASE_URL%/}/categories")"
python3 - "$categories" <<'PY'
import json, sys
v=json.loads(sys.argv[1])
data=v.get('data')
assert isinstance(data,list) and len(data)>=10, v
print('PASS: categories', len(data))
PY

printf '%s\n' 'STAGING SMOKE PASS'
