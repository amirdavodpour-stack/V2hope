#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT/backend"

: "${ACCESS_TOKEN_SECRET:=ci-access-token-secret-012345678901234567890123456789}"
: "${REFRESH_TOKEN_SECRET:=ci-refresh-token-secret-012345678901234567890123456789}"
: "${DATABASE_URL:=postgres://ci:ci@127.0.0.1:5432/hope}"
: "${PUBLIC_BASE_URL:=https://ci.example.invalid}"
: "${METRICS_TOKEN:=ci-metrics-token-0123456789012345}"
: "${S3_BUCKET:=hope-ci}"
: "${PAYMENT_PROVIDER:=webhook}"
: "${STORAGE_BACKEND:=s3}"
: "${PAYMENT_PROVIDER_TOKEN:=ci-payment-provider-token-0123456789}"
: "${PAYMENT_PROVIDER_CREATE_URL:=https://ci.example.invalid/payment/create}"
: "${PAYMENT_PROVIDER_RELEASE_URL:=https://ci.example.invalid/payment/release}"
: "${PAYMENT_PROVIDER_REFUND_URL:=https://ci.example.invalid/payment/refund}"
: "${PAYMENT_WEBHOOK_SECRET:=ci-payment-webhook-secret-0123456789}"
: "${ALLOWED_CORS_ORIGINS:=https://ci.example.invalid}"
: "${RESET_TOKEN_DELIVERY_MODE:=webhook}"
: "${RESET_TOKEN_DELIVERY_URL:=https://ci.example.invalid/reset}"
: "${RESET_TOKEN_DELIVERY_SECRET:=ci-reset-delivery-secret-012345678901234567890123456789}"

export ACCESS_TOKEN_SECRET REFRESH_TOKEN_SECRET DATABASE_URL PUBLIC_BASE_URL METRICS_TOKEN \
  S3_BUCKET PAYMENT_PROVIDER STORAGE_BACKEND PAYMENT_PROVIDER_TOKEN \
  PAYMENT_PROVIDER_CREATE_URL PAYMENT_PROVIDER_RELEASE_URL PAYMENT_PROVIDER_REFUND_URL \
  PAYMENT_WEBHOOK_SECRET ALLOWED_CORS_ORIGINS RESET_TOKEN_DELIVERY_MODE RESET_TOKEN_DELIVERY_URL RESET_TOKEN_DELIVERY_SECRET

exec sh scripts/validate-production-env.sh
