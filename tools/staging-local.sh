#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export COMPOSE_FILE="$ROOT/backend/staging/docker-compose.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo 'BLOCKED: Docker is not installed; local staging cannot be booted here.' >&2
  exit 2
fi
if ! docker compose version >/dev/null 2>&1; then
  echo 'BLOCKED: docker compose plugin is unavailable.' >&2
  exit 2
fi

cd "$ROOT"
export ACCESS_TOKEN_SECRET="${ACCESS_TOKEN_SECRET:-local-staging-access-secret-012345678901234567890123}"
export REFRESH_TOKEN_SECRET="${REFRESH_TOKEN_SECRET:-local-staging-refresh-secret-012345678901234567890123}"
export METRICS_TOKEN="${METRICS_TOKEN:-local-staging-metrics-token-0123456789}"
export PAYMENT_PROVIDER_TOKEN="${PAYMENT_PROVIDER_TOKEN:-local-staging-payment-token-0123456789}"
export PAYMENT_PROVIDER_CREATE_URL="${PAYMENT_PROVIDER_CREATE_URL:-https://payment.invalid/create}"
export PAYMENT_PROVIDER_RELEASE_URL="${PAYMENT_PROVIDER_RELEASE_URL:-https://payment.invalid/release}"
export PAYMENT_PROVIDER_REFUND_URL="${PAYMENT_PROVIDER_REFUND_URL:-https://payment.invalid/refund}"
export PAYMENT_WEBHOOK_SECRET="${PAYMENT_WEBHOOK_SECRET:-local-staging-webhook-secret-0123456789}"
export NOTIFICATION_PUSH_URL="${NOTIFICATION_PUSH_URL:-https://notify.invalid/push}"
export NOTIFICATION_EMAIL_URL="${NOTIFICATION_EMAIL_URL:-https://notify.invalid/email}"
export NOTIFICATION_PROVIDER_TOKEN="${NOTIFICATION_PROVIDER_TOKEN:-local-staging-notify-token-0123456789}"
export RESET_TOKEN_DELIVERY_URL="${RESET_TOKEN_DELIVERY_URL:-https://reset.invalid/deliver}"
export RESET_TOKEN_DELIVERY_SECRET="${RESET_TOKEN_DELIVERY_SECRET:-local-reset-delivery-secret-012345678901234567890123456789}"
export PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://staging.invalid}"
export ALLOWED_CORS_ORIGINS="${ALLOWED_CORS_ORIGINS:-https://staging.invalid}"

echo '== staging compose config =='
docker compose -f "$COMPOSE_FILE" config -q

echo '== staging boot =='
docker compose -f "$COMPOSE_FILE" up -d --build
trap 'docker compose -f "$COMPOSE_FILE" down -v' EXIT

for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8088/ready >/tmp/hope-staging-ready.json; then break; fi
  sleep 2
done
curl -fsS http://127.0.0.1:8088/ready >/dev/null
curl -fsS http://127.0.0.1:8088/categories >/tmp/hope-staging-categories.json

# Prove the gateway reaches both API replicas, not just one healthy backend.
: > /tmp/hope-staging-instances.txt
for i in $(seq 1 40); do
  curl -fsSI http://127.0.0.1:8088/live | awk -F': ' 'tolower($1)=="x-instance-id" {gsub(/\r/,"",$2); print $2}' >> /tmp/hope-staging-instances.txt
done

# Prove shared PostgreSQL state: register through the gateway, then read the
# same account export through each replica directly.
python3 - <<'PY'
import json, os, subprocess, uuid, urllib.request
base='http://127.0.0.1:8088'
email=f"staging-{uuid.uuid4().hex[:12]}@example.test"
payload=json.dumps({'email':email,'password':'StagingPass-0123456789','displayName':'Staging Probe'}).encode()
req=urllib.request.Request(base+'/api/v1/auth/register',data=payload,headers={'Content-Type':'application/json'},method='POST')
with urllib.request.urlopen(req,timeout=10) as r: body=json.load(r)
token=body['data']['accessToken']
open('/tmp/hope-staging-token','w').write(token)
for service in ('api1','api2'):
    js=f"""const r=await fetch('http://127.0.0.1:3000/api/v1/account/export',{{headers:{{authorization:'Bearer {token}'}}}}}); console.log(await r.text()); process.exit(r.ok?0:1)"""
    out=subprocess.check_output(['docker','compose','-f',os.environ['COMPOSE_FILE'],'exec','-T',service,'node','--input-type=module','-e',js],text=True)
    data=json.loads(out)['data']
    assert data['user']['email']==email, (service,data.get('user'))
print('PASS: PostgreSQL-backed account state is visible from both API replicas')
PY

python3 - <<'PY'
import json
ready=json.load(open('/tmp/hope-staging-ready.json'))
assert ready['ready'] is True, ready
categories=json.load(open('/tmp/hope-staging-categories.json'))
assert len(categories.get('data',[])) >= 10, categories
instances={x.strip() for x in open('/tmp/hope-staging-instances.txt') if x.strip()}
assert {'api1','api2'} <= instances, instances
print('PASS: gateway exercised both api1 and api2')
PY
