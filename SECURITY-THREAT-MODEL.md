# HOPE-V7 Security Threat Model

## Scope

This document describes the security model for the HOPE Marketplace backend,
Flutter client, payment/notification integrations, object storage, and
operational CI/runtime boundaries.

It is a living engineering document. Runtime certification evidence is kept
separately under `docs/audit/evidence/` and must come from real CI/staging or
device runs.

## Assets

| Asset | Security objective |
|---|---|
| User credentials and sessions | Confidentiality, integrity, revocation |
| Personal/profile data | Confidentiality, least-privilege access |
| Jobs, offers and application state | Integrity and authorization |
| Payment state and ledger records | Integrity, idempotency, non-repudiation |
| Webhook/provider credentials | Confidentiality and authenticity |
| Uploaded objects | Authorization, integrity, controlled access |
| Notifications/outbox state | Integrity, replay resistance, delivery correctness |
| Audit/telemetry data | Integrity, redaction, controlled access |
| Database and migration state | Integrity, consistency, recoverability |
| CI/release credentials | Confidentiality and supply-chain integrity |

## Trust boundaries

1. Flutter client ↔ HTTPS API.
2. API ↔ PostgreSQL persistence layer.
3. API ↔ payment provider/webhook boundary.
4. API ↔ notification provider endpoints.
5. API ↔ S3/R2 object storage.
6. GitHub Actions ↔ repository/deployment environments.
7. Local/test adapters ↔ production-oriented persistence interfaces.

Crossing a trust boundary requires explicit validation, authentication,
authorization, or provider verification as appropriate.

## Threats and mitigations

### Authentication and session abuse
Threats include credential theft, token replay, session fixation and
unauthorized account access.

Mitigations include authenticated API guards, refresh/session handling,
secure client-side token storage, password-reset flows, and authorization
contracts. The Flutter secure-store path is covered by dedicated regression
tests.

### Broken authorization / privilege escalation
Threats include horizontal access to another user's jobs or transactions and
vertical access to admin-only actions.

Mitigations include server-side authorization boundaries, documented
`AUTHORIZATION-MATRIX.md`, owner/admin checks in application flows, and
authorization/security contract tests. Client visibility checks are treated
as defense-in-depth, not the sole security boundary.

### Injection and malformed input
Threats include SQL/command/data injection and malformed API payloads.

Mitigations include validation layers, parameterized database access,
contract tests, and explicit failure-path tests.

### Payment integrity
Threats include duplicate settlement, forged webhooks, replayed events,
unauthorized refunds/releases, and client-side tampering.

Mitigations include server-side payment state transitions, idempotency
handling, signed webhook verification, ledger/state-machine boundaries,
policy tests, and provider contract tests. The bundled provider is a
simulator for local/test use; production requires the configured provider
boundary.

### Object storage abuse
Threats include unauthorized upload/download, path/key confusion, and
unverified completion callbacks.

Mitigations include storage-intent contracts, presigned upload/download
boundaries, completion verification, and provider-specific runtime
validation in staging.

### Notification abuse
Threats include forged dispatch, duplicate delivery, unsafe provider calls,
and silent queue failure.

Mitigations include durable outbox state, retry/failure handling,
provider contracts, and explicit failure-injection tests. Provider delivery
still requires runtime certification with real sandbox credentials.

### Privacy leakage
Threats include unnecessary PII exposure through APIs, telemetry or logs.

Mitigations include privacy/redaction modules, account export/delete
controls, opt-in telemetry, secret redaction rules, and security tests.
Credentials and provider secrets must never be committed to the repository.

### Supply-chain / CI compromise
Threats include dependency compromise, unpinned workflow actions, secret
leakage, and unsigned/unreviewed release changes.

Mitigations include dependency auditing, SBOM generation, workflow SHA
pinning checks, fail-closed release workflows, and externalized production
secrets. Runtime evidence must be attributable to real GitHub Actions runs.

### Persistence boundary / legacy fallback
Threats include accidentally routing a production PostgreSQL request
through a legacy local collection adapter.

Mitigations include explicit repository boundaries, PostgreSQL-specific
integration tests, persistence architecture contracts, and regression tests
for the production persistence boundary.

## Residual risks requiring runtime certification

The repository's static and contract security controls do not replace
runtime certification. The remaining runtime evidence requirements include:

- npm audit evidence attributable to a real GitHub Actions run;
- real provider sandbox verification;
- real S3/R2 lifecycle verification;
- Android/device security and integration certification;
- staging runtime checks;
- disaster-recovery runtime evidence.

These are intentionally not marked PASS without real runtime evidence.

## Security response principles

1. Fail closed when authentication, authorization, provider verification or
   required configuration is missing.
2. Never weaken a security control to satisfy a test threshold.
3. Never log or commit secrets.
4. Prefer isolated, disposable test environments for destructive/integrity
   testing.
5. Treat external runtime evidence as unproven until it is traceable to an
   actual CI/staging/device execution.

## Review status

This threat model documents the security architecture and residual runtime
risks. It does not claim that external/runtime certification has been
completed.

### Notification device token ownership
A device registration token is treated as an account-bound capability once enrolled. Registration cannot transfer an already-owned token to another user; PostgreSQL checks the existing row under `FOR UPDATE`, while the explicit legacy test runtime rejects cross-user rebinding. This prevents a caller holding a previously observed token string from hijacking notification delivery for another account.
