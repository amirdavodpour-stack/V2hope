# HOPE-V7 Security/Consistency Hardening V15

## Changes
- Bind signed payment webhook `eventId` header to the JSON body `eventId`.
- Require provider reference for hold/release webhook events.
- Reject webhook events for unknown payments transactionally so the provider can retry.
- Reject provider-reference mismatches for non-refund webhooks.
- Allow a valid `PAYMENT_RELEASED` webhook to reconcile both `RELEASE_PENDING` and `RELEASE_FAILED`.
- Make payment release migration rollback fail closed when live `RELEASE_FAILED` rows exist; never rewrite financial state during rollback.

## Validation
- Focused security/payment suite: 12/12 PASS.
- Broad suite was not accepted as a clean certification run because an unrelated `vertical-registry-contract.test.mjs` cleanup race produced an ENOENT after test completion and the broad run timed out.
- Runtime certification remains environment-gated by the repository Node requirement (Node >=24 <25).
