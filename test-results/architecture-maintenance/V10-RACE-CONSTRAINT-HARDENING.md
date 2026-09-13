# V10 Race/Constraint Hardening

Scope: eliminate application-level check-then-insert race exposure for pending Offers and Job Applications.

Evidence:
- `offers_pending_provider_uq` partial unique index on `(job_id, provider_id)` for `PENDING`.
- `job_applications_pending_uq` partial unique index on `(job_id, candidate_id)` for `PENDING` / `SELECTED`.
- Repository translates PostgreSQL `23505` for those constraints into stable domain errors.
- Routes translate those domain errors into HTTP 409 responses.
- Focused suite: 36/36 PASS.

Limitations:
- This turn did not claim PostgreSQL live integration, Flutter runtime validation, Android emulator validation, S3 validation, Docker validation, or staging validation.
