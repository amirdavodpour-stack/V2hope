# HOPE Configuration Contract

**Contract version:** 2026-09-06
**Application version:** 4.0.2+3
**Source of truth:** `backend/src/config.js` plus the production policy validator in `backend/scripts/validate-production-env.sh`.

This document defines the supported environment variables and the policy by environment. Secrets shown here are placeholders only; real secret material must come from the deployment secret store.

## Environment policy

| Environment | PostgreSQL | Storage | Payments | Reset delivery | CORS | Secret policy |
|---|---|---|---|---|---|---|
| local/development | optional | local | simulator | console | explicit local origins | safe local placeholders allowed |
| test | optional | test adapter/local | simulator | console | test-configured | isolated test values only |
| staging | required | S3-compatible | webhook/sandbox | webhook | explicit HTTPS origins | real staging secrets |
| production | required | S3 | webhook | webhook | explicit non-wildcard origins | fail-closed, 32+ char auth/reset secrets |

## Variables

### Runtime / HTTP
`NODE_ENV`, `HOST`, `PORT`, `DATA_FILE`, `PUBLIC_BASE_URL`, `API_BASE_URL_PRODUCTION` (CI/release only), `REQUEST_TIMEOUT_MS`, `HEADERS_TIMEOUT_MS`, `KEEP_ALIVE_TIMEOUT_MS`, `MAX_REQUEST_BYTES`, `TRUST_PROXY`, `TRUSTED_PROXY_IPS`.

### Authentication / authorization
`ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `ACCESS_TOKEN_ISSUER`, `ACCESS_TOKEN_AUDIENCE`, `RESET_TOKEN_TTL`, `RESET_TOKEN_DELIVERY_MODE`, `RESET_TOKEN_DELIVERY_URL`, `RESET_TOKEN_DELIVERY_SECRET`, `EXPOSE_RESET_TOKEN_IN_DEVELOPMENT`.

### CORS / rate limiting
`ALLOWED_CORS_ORIGINS`, `RATE_LIMIT_STORE`, `RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX`, `GENERAL_RATE_LIMIT_WINDOW_MS`, `GENERAL_RATE_LIMIT_MAX`, `HEALTH_RATE_LIMIT_WINDOW_MS`, `HEALTH_RATE_LIMIT_MAX`.

### Persistence / storage
`DATABASE_URL`, `PG_POOL_MAX`, `STORAGE_BACKEND`, `STORAGE_DIR`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, `S3_PREFIX`, `S3_SERVER_SIDE_ENCRYPTION`, `UPLOAD_INTENT_TTL_SECONDS`, `MAX_UPLOAD_BYTES`, `MAX_CONCURRENT_UPLOADS`.

### Payments
`PAYMENT_PROVIDER`, `PAYMENT_CURRENCY`, `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_PROVIDER_TOKEN`, `PAYMENT_PROVIDER_CREATE_URL`, `PAYMENT_PROVIDER_RELEASE_URL`, `PAYMENT_PROVIDER_REFUND_URL`, `PAYMENT_PROVIDER_TIMEOUT_MS`, `PAYMENT_PROVIDER_MAX_ATTEMPTS`, `PAYMENT_PROVIDER_RETRY_BASE_MS`, `PAYMENT_WEBHOOK_MAX_AGE_SECONDS`.

### Notifications / telemetry / alerts
`NOTIFICATION_PUSH_URL`, `NOTIFICATION_EMAIL_URL`, `NOTIFICATION_PROVIDER_TOKEN`, `NOTIFICATION_MAX_ATTEMPTS`, `NOTIFICATION_RETRY_BASE_MS`, `NOTIFICATION_DELIVERY_TIMEOUT_MS`, `METRICS_TOKEN`, `ALERT_WEBHOOK_URL`, `ALERT_WEBHOOK_TOKEN`, `ALERT_WEBHOOK_TIMEOUT_MS`.

### Workers / idempotency
`OUTBOX_POLL_MS`, `OUTBOX_WORKER_CONCURRENCY`, `OUTBOX_MAX_ATTEMPTS`, `OUTBOX_LEASE_SECONDS`, `MAX_IDEMPOTENCY_KEY_LENGTH`.

## Secret rules

Never commit real secret values. Production must reject placeholder authentication secrets, missing metrics token, missing payment/reset secrets, wildcard CORS, non-HTTPS external endpoints, non-PostgreSQL persistence, local storage, and simulator payments.

## Machine validation

Run:

```bash
cd backend
npm run check:config-contract
./scripts/validate-production-env.sh
```

The first command verifies repository consistency. The second validates the production-specific policy and requires real production variables in its calling environment.
