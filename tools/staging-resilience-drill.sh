#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT/backend/staging/docker-compose.yml"

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo 'BLOCKED: Docker and docker compose are required for the staging resilience drill.' >&2
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

cleanup() { docker compose -f "$COMPOSE_FILE" down -v >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker compose -f "$COMPOSE_FILE" config -q
docker compose -f "$COMPOSE_FILE" up -d --build

wait_ready() {
  for _ in $(seq 1 60); do
    if curl -fsS http://127.0.0.1:8088/ready >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  echo 'Gateway never became ready.' >&2
  docker compose -f "$COMPOSE_FILE" ps >&2 || true
  return 1
}

probe() {
  curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8088/live >/dev/null
  curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8088/categories >/dev/null
}

wait_ready
probe
echo 'PASS: baseline gateway health'

docker compose -f "$COMPOSE_FILE" stop api1 >/dev/null
sleep 2
probe
echo 'PASS: gateway remains healthy with api1 stopped'

docker compose -f "$COMPOSE_FILE" start api1 >/dev/null
for _ in $(seq 1 30); do
  docker compose -f "$COMPOSE_FILE" ps --status running api1 | grep -q api1 && break || true
  sleep 2
done
wait_ready
probe
echo 'PASS: api1 recovers and gateway remains healthy'

docker compose -f "$COMPOSE_FILE" stop api2 >/dev/null
sleep 2
probe

echo 'PASS: gateway remains healthy with api2 stopped'

docker compose -f "$COMPOSE_FILE" stop api1 >/dev/null
sleep 2
if curl -fsS --max-time 5 http://127.0.0.1:8088/live >/dev/null 2>&1; then
  echo 'FAIL: gateway still reports healthy with both replicas stopped.' >&2
  exit 1
fi
echo 'PASS: gateway becomes unavailable when all API replicas are stopped'

docker compose -f "$COMPOSE_FILE" start api1 api2 >/dev/null
wait_ready
probe
echo 'PASS: both replicas recover after resilience drill'
