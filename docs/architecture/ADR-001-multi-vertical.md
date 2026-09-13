# ADR-001 — Multi-Vertical Data & Domain Model

- Status: Accepted
- Date: 2026-09-03
- Scope: architecture decision only; **no application code changed by this ADR**.

## 1. Context

HOPE Marketplace ships today as a single vertical ("jobs"): a listing
(`jobs`) owned by an employer, discovered through `categories`, competed for
via `offers` (missions) or `job_applications` (positions), and settled through
`payments` / `ledger_entries` / `settlements` / `refunds`.

The product direction is a multi-vertical platform (e.g. services, rentals,
goods, courses) where each vertical has its own listing attributes, its own
engagement object, and its own moderation/discovery rules, while sharing
identity, trust, payments, notifications and analytics.

The live jobs vertical must keep working unchanged during the transition
(standing rule 1).

## 2. Current state (verified against `backend/src/db/schema.js`)

### 2.1 `jobs` — every real column today

| Column | Type / constraint | Multi-vertical classification |
|---|---|---|
| `id` | UUID PK | core listing |
| `owner_id` | UUID NOT NULL → users(id) | core listing |
| `provider_id` | UUID NULL → users(id) | core listing (assigned counterparty) |
| `title` | TEXT NOT NULL | core listing |
| `description` | TEXT NOT NULL | core listing |
| `category_id` | UUID NOT NULL → categories(id) | core listing |
| `job_type` | TEXT NOT NULL | **vertical-specific (jobs)** |
| `budget_type` | TEXT NOT NULL | core pricing (rename-free, generalized) |
| `budget_min` | NUMERIC(18,2) NOT NULL CHECK > 0 | core pricing |
| `budget_max` | NUMERIC(18,2) NOT NULL CHECK ≥ budget_min | core pricing |
| `duration` | INTEGER NOT NULL CHECK > 0 | **vertical-specific (jobs)** |
| `acceptance_criteria` | TEXT NOT NULL | **vertical-specific (jobs)** |
| `status` | TEXT NOT NULL | core lifecycle |
| `city` | TEXT NULL | core listing (location) |
| `kind` | TEXT NOT NULL DEFAULT 'MISSION' | jobs sub-type (MISSION \| POSITION) |
| `visibility` | TEXT NOT NULL DEFAULT 'PUBLIC' | core listing |
| `schedule` | TEXT NULL | **vertical-specific (jobs/POSITION)** |
| `monthly_salary` | NUMERIC(18,2) NULL | **vertical-specific (jobs/POSITION)** |
| `application_deadline` | DATE NULL | **vertical-specific (jobs/POSITION)** |
| `created_at` | TIMESTAMPTZ NOT NULL | core |
| `updated_at` | TIMESTAMPTZ NOT NULL | core |
| `published_at` | TIMESTAMPTZ NULL | core |

Indexes: `jobs_owner_idx(owner_id)`, `jobs_status_idx(status)`,
`jobs_provider_idx(provider_id)`, `jobs_kind_idx(kind,visibility)`.

### 2.2 `categories` — every real column today

`id` UUID PK · `slug` TEXT UNIQUE NOT NULL · `name` TEXT NOT NULL ·
`name_en` TEXT NOT NULL DEFAULT '' · `description` TEXT NOT NULL DEFAULT '' ·
`parent_id` UUID NULL → categories(id) ON DELETE SET NULL ·
`sort_order` INTEGER NOT NULL DEFAULT 0 · `is_active` BOOLEAN NOT NULL DEFAULT TRUE ·
`created_at` TIMESTAMPTZ NOT NULL. Index: `categories_parent_idx(parent_id,sort_order)`.

Categories are already a self-referencing tree with no vertical dimension —
today the whole tree is implicitly the jobs taxonomy.

### 2.3 `job_applications` — every real column today

`id` UUID PK · `job_id` UUID NOT NULL → jobs(id) ON DELETE CASCADE ·
`candidate_id` UUID NOT NULL → users(id) ON DELETE CASCADE ·
`resume_text` TEXT NOT NULL · `skills` TEXT NOT NULL DEFAULT '' ·
`status` TEXT NOT NULL DEFAULT 'PENDING' · `created_at` TIMESTAMPTZ NOT NULL ·
`updated_at` TIMESTAMPTZ NOT NULL.
Partial unique index `job_applications_pending_uq(job_id,candidate_id) WHERE status IN ('PENDING','SELECTED')`.

`resume_text` and `skills` are jobs-only; the rest is a generic
"engagement request against a listing".

### 2.4 Adjacent tables that reference `jobs`

`offers.job_id`, `payments.job_id` (UNIQUE), `evidence.job_id`,
`trust_reports.entity_type IN ('USER','JOB')`. Each is a coupling point that a
second vertical would otherwise have to duplicate.

## 3. Decision

**D1 — Introduce a first-class `verticals` registry, not a table per vertical.**
A `verticals` row (`id`, `slug`, `name`, `name_en`, `is_active`, `sort_order`,
`config JSONB`) is the single source of truth for which verticals exist.

**D2 — Keep one shared listing table; do not fork `jobs` per vertical.**
`jobs` stays the physical listing table (renaming it would break production,
repository SQL, mappers and the Flutter client). It gains a nullable
`vertical_id` defaulting to the seeded `jobs` vertical. A later wave may add a
`listings` view alias; the physical table name is deliberately not changed in
the initial rollout.

**D3 — Vertical-specific attributes live in a validated `attributes JSONB`
column, not in new typed columns.**
Existing jobs-only columns (`job_type`, `duration`, `acceptance_criteria`,
`schedule`, `monthly_salary`, `application_deadline`) stay exactly as they are
for the jobs vertical — they are the jobs vertical's legacy attribute set. New
verticals put their attributes in `attributes`, validated server-side against a
per-vertical schema held in `verticals.config`.

**D4 — Categories become vertical-scoped.**
`categories` gains a nullable `vertical_id`; all existing rows are backfilled to
the jobs vertical. Category listing APIs filter by vertical, defaulting to jobs
when the caller sends none (backwards compatible).

**D5 — Engagement stays two-shaped, generalized by name only later.**
`offers` (priced bid) and `job_applications` (candidacy) already cover the two
engagement archetypes every planned vertical needs. New verticals reuse
`offers`; `job_applications` remains jobs-only. No rename in the initial rollout.

**D6 — Money, trust, notifications, analytics stay vertical-agnostic.**
`payments`, `ledger_entries`, `settlements`, `refunds`, `notifications`,
`analytics_events` keep referencing the listing id. `trust_reports.entity_type`
check constraint is the one place that must widen when a non-jobs entity type
appears; it should be widened when additional reportable entity types are introduced.

**D7 — Every schema change is additive and idempotent.**
`ADD COLUMN IF NOT EXISTS` + backfill + index, in `createSchema`, matching the
existing migration style in `backend/src/db/schema.js`. No destructive DDL, no
column renames, no dropped constraints in the initial rollout.

## 4. Target shape

```
verticals(id, slug UNIQUE, name, name_en, description, config JSONB,
          is_active, sort_order, created_at)

categories.vertical_id  UUID NULL -> verticals(id)      -- backfilled to 'jobs'
jobs.vertical_id        UUID NULL -> verticals(id)      -- backfilled to 'jobs'
jobs.attributes         JSONB NOT NULL DEFAULT '{}'     -- new verticals only

indexes: verticals_slug_uq, categories_vertical_idx(vertical_id,sort_order),
         jobs_vertical_idx(vertical_id,status)
```

## 5. Consequences

Positive: one query path, one payments path, one trust path across verticals;
zero-risk rollout for jobs (all new columns nullable/defaulted); taxonomy and
attribute rules become data, not code.

Negative / accepted: `jobs` keeps a jobs-flavoured name and six jobs-only
columns that other verticals leave NULL; `attributes` JSONB validation is
application-level, so schema drift is possible without disciplined per-vertical
schemas; a very high-volume future vertical may eventually justify partitioning
by `vertical_id`.

## 6. Rejected alternatives

1. **Table per vertical** — duplicates payments/trust/offer wiring N times.
2. **Rename `jobs` → `listings` now** — touches repository SQL, mappers, API
   contracts and the Flutter client simultaneously; violates standing rule 1.
3. **Typed columns per vertical on `jobs`** — unbounded column growth, mostly
   NULL, and every new vertical becomes a migration.
4. **EAV attribute table** — worst query ergonomics of the three, and Postgres
   JSONB with GIN indexing covers the same need.

## 7. Follow-ups

- Seed the `jobs` vertical row and backfill `vertical_id` where necessary.
- Wire per-vertical attribute validation into non-jobs listing writes.
- Widen `trust_reports.entity_type` when additional reportable entity types are introduced.
