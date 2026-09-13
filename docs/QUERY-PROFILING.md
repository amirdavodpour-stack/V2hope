# Reading EXPLAIN ANALYZE and finding real bottlenecks

This isn't a generic Postgres tutorial -- every example below is a real
query from `backend/src/repository.js` and `backend/src/db.js`, so you can
run it against your own database and see the actual plan.

**Limitation up front:** this sandbox has no live Postgres, so nothing in
this document was actually run here -- it's a guide for you to run
locally, not a report of results. Treat any specific numbers below as
illustrative ("a plan like this"), not measured.

## The habit: don't guess, ask the planner

`EXPLAIN` shows what Postgres *plans* to do. `EXPLAIN ANALYZE` actually runs
the query and shows what it *really did* -- real row counts, real timing,
per-node. Always use `ANALYZE` when you're chasing a real slowdown; `EXPLAIN`
alone can be wrong once your table's row counts and value distributions
diverge from what the planner's statistics assumed.

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM payments WHERE job_id = '...';
```
`BUFFERS` adds cache-hit vs. disk-read counts per node -- often the real
story ("fast" query, but every run hits disk because it's never cached).

## Worked example 1: a query that's already fast, and how to confirm it

`findPaymentByJob` (repository.js) runs:
```sql
SELECT * FROM payments WHERE job_id = $1;
```
`payments.job_id` is declared `UNIQUE` in the table definition itself
(`db.js`):
```sql
job_id UUID NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE
```
**A `UNIQUE` (or `PRIMARY KEY`) column constraint silently creates an index**
-- there's no separate `CREATE UNIQUE INDEX` line for it anywhere in
`db.js`. This is exactly the kind of thing that's easy to miss when
auditing a schema: grepping only for `CREATE INDEX` undercounts your real
index coverage. (This document's first draft claimed `payments.job_id` had
no index, based on exactly that grep-only mistake -- caught by checking
`\d payments` / the inline constraints before treating it as a real
finding. Worth internalizing: verify with the tool, not with grep.)

To confirm any column's index coverage from psql directly, don't grep the
schema file -- ask Postgres:
```sql
\d payments
-- or, everything indexing a given table:
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'payments';
```
Then confirm the planner actually uses it:
```
EXPLAIN ANALYZE SELECT * FROM payments WHERE job_id = 'some-real-uuid';
```
Expect `Index Scan using payments_job_id_key` (or similar), not
`Seq Scan on payments`. If you ever see a sequential scan on a column you
believe is indexed, the two most common causes are: (a) the table is small
enough that the planner correctly decides a seq scan is cheaper anyway
(this is *correct behavior*, not a bug -- don't "fix" it), or (b) a type
mismatch in the query is preventing index usage (e.g. comparing a `UUID`
column against a plain string literal that hasn't been cast, in some
query-builder-generated SQL -- not a risk here since every query in this
codebase is hand-written with typed parameters, but a common trap
elsewhere).

## Worked example 2: a query worth watching as data grows

`listJobViews` (repository.js), used by the public job listing:
```sql
SELECT j.*, c.name AS category_name, ...
  FROM jobs j
  JOIN categories c ON c.id = j.category_id
  JOIN users ou ON ou.id = j.owner_id
  LEFT JOIN users pu ON pu.id = j.provider_id
  LEFT JOIN offers o ON o.job_id = j.id
 WHERE j.status = $1 AND (j.owner_id = $2 OR j.provider_id = $2)
 GROUP BY j.id, c.name, ou.display_name, ou.role, pu.display_name, pu.role
```
`jobs` has three separate single-column indexes: `jobs_status_idx`,
`jobs_owner_idx`, `jobs_provider_idx` (`db.js`). Individually they're each
fine for `WHERE status = $1` or `WHERE owner_id = $2` alone. But this query
combines a status filter *AND*-ed with an *OR* across two other indexed
columns -- and whether Postgres combines three single-column indexes
efficiently here (via a `BitmapAnd`/`BitmapOr`) instead of picking just one
and filtering the rest in memory depends on your actual data distribution
(how selective `status='PUBLISHED'` is once you have thousands of jobs).
This is exactly the kind of query where reading the plan matters more than
reading the schema: the indexes existing doesn't guarantee they're combined
well for this specific shape.

To check for real, once you have realistic data volume (a handful of test
rows won't tell you anything -- the planner will correctly seq-scan a
9-row table regardless of indexes, which is *correct*, not evidence of a
missing index):
```sql
EXPLAIN ANALYZE
SELECT j.*, c.name FROM jobs j
  JOIN categories c ON c.id = j.category_id
 WHERE j.status = 'PUBLISHED' AND (j.owner_id = 'some-uuid' OR j.provider_id = 'some-uuid');
```
Look at the top-level node's `actual time` and compare it to the number of
rows scanned lower in the tree vs. rows actually returned -- a huge gap
(scanning 50,000 rows to return 3) is the signal to act on, not the
presence or absence of an index by itself.

## `pg_stat_statements`: finding slow queries without reading code first

Everything above assumes you already know which query to look at.
`pg_stat_statements` (a standard Postgres extension) removes that
assumption -- it tracks every query the database runs and aggregates
timing, so you find the slow query first, then go read the code that
issued it (the reverse of how this project's queries were reviewed, which
was necessarily code-first since no live database was available here).

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements; -- once, as superuser
SELECT query, calls, mean_exec_time, total_exec_time
  FROM pg_stat_statements
 ORDER BY total_exec_time DESC
 LIMIT 20;
```
`total_exec_time` (not `mean_exec_time`) is usually the more actionable
sort key: a query that's individually fast but called 100,000 times can
cost more in aggregate than a rare slow one. This is precisely the shape
the `jobView()` N+1 fix (see the perf-review history for this project)
would have shown up as immediately -- many fast, cheap `getUserById` calls
adding up to real total cost -- versus a single obviously-slow query that
manual code review might catch by inspection alone.

## Applying this to HOPE specifically

- Run these against a copy of production data volume, not an empty dev
  database -- an empty or near-empty table makes every index look
  unnecessary and every seq scan look free, which is backwards.
- Re-run `EXPLAIN ANALYZE` on `listJobViews` and `listMyJobViews` after
  the N+1 fix from the earlier code-level review (see git history / prior
  session notes) -- confirm the *count* of queries per request dropped as
  expected, not just that the code reads differently.
- `npm run test:perf` (`tests/perf-health.test.mjs`) checks that the
  health endpoint stays responsive under concurrent load, but it doesn't
  profile query plans -- these are complementary, not the same signal.
  Consider adding a query-plan regression check (comparing `EXPLAIN`
  output, not `EXPLAIN ANALYZE` timings which are inherently noisy, across
  CI runs) if a specific query's plan ever needs to be pinned.
