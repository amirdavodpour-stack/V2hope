# Flutter Application Boundary — V5

## Scope
Moved high-traffic Flutter page-level data access through `ApplicationRegistry` without changing public constructor compatibility.

## Changes
- Added `ListCategoriesUseCase`.
- Added `ListOpportunitiesUseCase`.
- Added `RequestPasswordResetUseCase`.
- Added `ListMyJobsUseCase`.
- Exposed those use cases through `ApplicationRegistry`.
- Jobs page now uses `ApplicationRegistry` for category/opportunity reads.
- Password reset page now uses `ApplicationRegistry` for password-reset requests.
- Transactions page now uses `ApplicationRegistry` for `listMyJobs()` while retaining its `TransactionRepository` constructor parameter for compatibility.

## Validation
- Flutter boundary contract: 2/2 PASS.
- Structural Dart brace checks: PASS.
- New/affected JS contract syntax: PASS.
- No production API contract intentionally changed.
- Flutter runtime tests were not executed in this environment because Flutter SDK is unavailable.
