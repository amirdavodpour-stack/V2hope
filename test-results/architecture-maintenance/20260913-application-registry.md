# Application Registry Continuation — 2026-09-13

Scope: move notification feature operations through the Flutter application/use-case boundary.

Changes:
- Added notification, profile, and auth use-case types to `lib/core/application/use_cases.dart`.
- Added corresponding dependencies/getters to `ApplicationRegistry`.
- Wired `main.dart` to provide the existing repository implementations to the registry.
- Migrated `NotificationsPage` from direct `NotificationRepository` access to `ApplicationRegistry` use-cases.
- Added an architecture contract covering the new wiring.

Validation:
- `backend/tests/flutter-architecture-contract.test.mjs`: 5/5 PASS.
- No production API shape, business rule, or persistence behavior was changed.
- Full Flutter runtime validation remains for the qualified runner because Flutter SDK is unavailable in this maintenance environment.
