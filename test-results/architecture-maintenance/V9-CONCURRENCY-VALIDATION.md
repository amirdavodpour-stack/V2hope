# V9 Concurrency Validation — 2026-09-13

## Change
Employer-side application lifecycle mutations now lock the owning Job aggregate before locking the Job Application row. This serializes competing candidate lifecycle writes for the same Job and prevents successive `provider_id` overwrites caused by concurrent acceptance requests.

## Focused validation
- `application-concurrency-contract.test.mjs`: PASS
- `refund-idempotency-retry-contract.test.mjs`: PASS
- `payment-architecture-contract.test.mjs`: PASS
- `persistence-architecture-contract.test.mjs`: PASS
- Focused suite total: **11/11 PASS**
- `node --check backend/src/repository/applications.js`: PASS

## Integrity constraints
- No test threshold lowered.
- No test disabled or deleted.
- No production runtime gate bypassed.
- No local persistence path promoted into production.
