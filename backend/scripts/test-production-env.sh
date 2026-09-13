#!/usr/bin/env sh
set -eu

# Deterministic contract fixture. These are intentionally fake values and are
# used only to prove that validate-production-env.sh accepts a complete,
# structurally valid production environment. Real secrets never belong here.
export ACCESS_TOKEN_SECRET='ci-access-token-secret-012345678901234567890123'
export REFRESH_TOKEN_SECRET='ci-refresh-token-secret-012345678901234567890123'
export DATABASE_URL='postgres://ci:ci@example.invalid/hope'
export PUBLIC_BASE_URL='https://example.invalid'
export METRICS_TOKEN='ci-metrics-token-0123456789012345'
export S3_BUCKET='hope-ci'
export PAYMENT_PROVIDER='webhook'
export PAYMENT_PROVIDER_TOKEN='ci-payment-provider-token-0123456789'
export PAYMENT_PROVIDER_CREATE_URL='https://example.invalid/create'
export PAYMENT_PROVIDER_RELEASE_URL='https://example.invalid/release'
export PAYMENT_PROVIDER_REFUND_URL='https://example.invalid/refund'
export PAYMENT_WEBHOOK_SECRET='ci-payment-webhook-secret-0123456789'
export ALLOWED_CORS_ORIGINS='https://example.invalid'
export STORAGE_BACKEND='s3'
export RESET_TOKEN_DELIVERY_MODE='webhook'
export RESET_TOKEN_DELIVERY_URL='https://example.invalid/reset'
export RESET_TOKEN_DELIVERY_SECRET='ci-reset-delivery-secret-012345678901234567890123456789'

exec sh scripts/validate-production-env.sh
