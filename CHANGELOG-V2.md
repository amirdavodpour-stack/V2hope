## 4.0.16+15 — offline convergence hardening

- Durable pending saved-search upserts and deletion tombstones for offline convergence.
- Pending mutations flush before remote read reconciliation when authenticated.
- Contract coverage added for offline sync convergence semantics.

## 4.0.15+14 — cross-device saved-search sync

- Added authenticated saved-search persistence with local-first offline fallback.
- Added PostgreSQL migration and user-isolated CRUD endpoints.
- Added typed mobile sync adapter and Fast-suite coverage.

## 4.0.14+13 — offline-first marketplace reads

- Added bounded offline-first caching for marketplace opportunity lists and details.
- Fresh cache is short-lived; stale cache is bounded to 24 hours and only used after a failed network read.
- Mutations remain remote-only and publishing invalidates the affected detail cache.
- Restored CI workflows into the release artifact so static certification contracts remain executable from the delivered ZIP.

## 4.0.12+11 — resilience and telemetry hardening
- Bounded retry policy for idempotent mobile GET requests on transient transport/status failures.
- Removed stale historical telemetry/about-page version fallbacks; production builds must inject `HOPE_VERSION`.
- Added Wave 13 resilience contract coverage.

## 4.0.11+9 — Notification control surface

- Added typed notification preference DTOs and repository operations.
- Added ApplicationRegistry/use-case wiring for notification preferences.
- Added Premium notification settings surface for in-app, push, email, application, payment, and marketing preferences.
- Preserved server-side preference enforcement and user isolation.

## 4.0.8+7 — Trust signals and profile maturity

- Added privacy-preserving public trust signals to the provider profile: verification state, completed work count, active work count, and member-since metadata.
- Kept raw trust/moderation reports private and explicitly outside recommendation penalties.
- Added typed mobile parsing and Premium profile presentation for trust signals.
- Hardened V2 design contract coverage for the trust-signal wiring.

## 4.0.6 — Premium lifecycle hardening

- Added reusable Premium project lifecycle timeline to activity surfaces.
- Added typed `HopeOffer` end-to-end so offer submission preserves server response/status.
- Kept ApplicationRegistry/use-case dependency direction intact.

## 4.0.4 — Discovery hardening

- Forward advanced Explore filters through the application repository boundary.
- Keep client-side filtering as a defensive second layer.
- Add a fast-suite contract protecting the query forwarding surface.


## 4.0.3
- Added typed recommendation explainability fields to `HopeJob` and surfaced localized “why this match” tags on Premium job cards.
- Hardened release documentation version checks to derive the semantic version from `pubspec.yaml`.
# HOPE V2 Changelog

## 4.0.17 — migration-contract hardening

- Extended `check:migrations` to syntax-check every committed migration, including `004_saved_searches.js`.
- Added a regression contract proving the migration checker stays aligned with the migration directory.
- Revalidated fast, contract, product, backup, staging-contract, release-evidence, E2E, failure-injection, full backend and coverage gates.

## 4.0.2+3 — Core Surface Premium Migration

- Migrated Profile, Transactions, Notifications and Admin to the shared Premium page frame and surface primitives.
- Preserved existing repositories, controllers, actions and localized copy; the change is presentation-layer focused.
- Extended the V2 design contract so these core screens cannot silently regress to standalone styling.

## 4.0.1+2 — Premium Foundation Hardening

- Reviewed the first premium foundation before advancing to additional screens.
- Added explicit motion, touch-target and UI-layer tokens.
- Hardened compact-width behavior for headers, heroes, section actions and tags.
- Added semantic labeling rules and decorative-image exclusions for composite premium surfaces.
- Strengthened the V2 design contract and added the formal Premium Max specification.

## 4.0.0+1 — Premium Foundation Wave

- Introduced the HOPE V2 design token system.
- Introduced reusable premium UI primitives.
- Rebuilt the Home experience around a premium hero, adaptive stats and clearer information hierarchy.
- Upgraded Explore filtering into a structured premium panel.
- Upgraded Job cards for stronger visual hierarchy, metadata scanning and action affordance.
- Added V2 design contract coverage to the backend fast suite.
- Preserved V1 as the frozen foundation.

## 4.0.7 — Saved Search persistence
- Added bounded local saved-search persistence with corrupt-payload recovery.
- Added save/restore/delete controls to Discovery.
- Added repository-boundary contract coverage.

## 4.0.9 — Payment UX hardening

- Added reusable Premium payment summary with participant-safe status, amount and fee breakdown display.
- Made mobile funding idempotency key stable per job/controller so transport retries can return the original payment instead of creating a new request identity.
- Kept runtime/provider certification fail-closed.

- V2.11 state-driven notification actions and typed application status labels added; notification cards can deep-open published jobs and preserve read-state semantics.

- Wave 12: actionable lifecycle notifications, typed application status semantics, and direct payment/job navigation.

## Wave 17 — persistence boundary hardening (4.0.20)

- Added an explicit production-persistence boundary regression suite covering auth, notifications, saved searches, analytics, storage, account privacy, offers, applications and payments.
- The guard fails closed if a PostgreSQL branch directly touches `db.collection`, while preserving the explicit file-backed test runtime.
- Added repository-boundary assertions for the saved-search, notification and analytics route families.
- Fast-suite coverage now includes the new persistence boundary contract.
- Version bumped to `4.0.20+19` / backend `4.0.20`.
