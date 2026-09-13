# Architecture Refactor Maintenance — 2026-09-13

## Scope
Additive, behavior-preserving layering between mobile/frontend and backend.

## Implemented
- Backend API request context and stable error envelope.
- Backend domain state-machine primitives for Job and Payment lifecycles.
- Backend repository/provider capability ports.
- Backend application use cases for jobs, applications, payments, and admin mutations.
- Production PostgreSQL payment/job/application/admin mutation paths wired through application use cases where applicable.
- Flutter application/use-case boundary and registry.
- Flutter authentication, job, transaction, create-opportunity, job-detail and admin mutations routed through explicit use cases.
- Architecture documentation and contract coverage.

## Explicit non-goals
- No microservice split.
- No mandatory Redis introduction.
- No distributed event bus introduction.
- No threshold changes.
- No deletion or weakening of existing tests.

## Validation
- Node syntax checks on all modified backend files: PASS.
- Application/domain/infrastructure architecture contract: PASS.
- Payment architecture contract: PASS.
- Persistence architecture contract: PASS.
- Existing application source behavior outside the explicitly wired boundaries is intentionally preserved.

## Remaining migration surface
Legacy/file-mode fallback branches remain for explicit test/local runtime compatibility. They are not production persistence paths and remain protected by existing persistence contracts.


### Follow-up architecture hardening — composition safety

- Moved repository-port/use-case composition before route factories in `backend/src/app.js` so `adminUseCases` cannot be referenced before initialization.
- Injected `paymentUseCases` into `createPaymentRoutes`; the route factory already consumed this dependency, so omission at the composition root was a real wiring defect.
- Added an application-layer contract covering both ordering and payment-use-case injection.
- Validation: application-layer contract suite 3/3 PASS; `node --check backend/src/app.js` PASS.
