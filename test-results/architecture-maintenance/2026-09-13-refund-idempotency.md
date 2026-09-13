# Refund Idempotency Consistency Maintenance

Date: 2026-09-13

## Change
Terminal provider failure previously left the refund row as `FAILED` while a repeated request with the same idempotency key returned that dead row. The PostgreSQL repository now reopens the existing refund as `PENDING`, clears the stale provider reference, restores payment processing to `REFUND_PENDING`, and reuses the payment-scoped outbox dedupe key.

## Safety
- The job row is locked before mutation.
- The payment row is locked before mutation.
- The refund row is locked when the idempotency key is present.
- No second financial operation is created for the same semantic idempotency key.
- Terminal outbox failure restores payment status to `HELD`, making the retry state valid.

## Validation
- `node --check backend/src/repository/payment_refunds.js` — PASS
- `node --test backend/tests/refund-idempotency-retry-contract.test.mjs` — 2/2 PASS
