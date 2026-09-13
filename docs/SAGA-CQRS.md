# Saga & CQRS: a worked example on HOPE's fund/release flow

This is a *scoped example*, not a proposal to rewrite the payment system.
HOPE is currently one backend service with one database -- a full Saga
implementation (which exists to coordinate transactions *across* services)
would be over-engineering here. What's below does two things instead:
(1) shows that the outbox pattern already in this codebase is, in miniature,
the same idea a Saga solves, so you can recognize the pattern when you see
it elsewhere; (2) sketches what it would grow into if payments became a
separate service, so the shape is familiar when that day comes.

## What a Saga solves

A single database transaction can't span two services. If "fund a job"
meant (1) call an external payment processor and (2) update your own
`jobs`/`payments` tables, a plain transaction can't wrap both -- the payment
processor isn't your database. A Saga replaces one big transaction with a
sequence of local transactions, each with a defined **compensating action**
if a later step fails, so the overall system reaches a consistent state
even though no single lock ever covered the whole operation.

## HOPE's fund flow, read as a two-step saga

Look at `fundJobAtomic` + the outbox worker + `failOutboxEvent`
(`repository.js`, `outbox_worker.js`) as a state machine:

```
Step 1 (local transaction, fundJobAtomic):
  payments row created, status = HOLD_PENDING
  outbox_events row created, status = PENDING
  jobs.status -> FUNDED
  [COMMIT -- this step is fully durable even if step 2 never runs]

Step 2 (outbox worker, processPaymentCreateHoldNow, asynchronous):
  call paymentProvider.createHold(...)
    success -> payments.status = HELD               (forward path)
    failure, retries exhausted -> payments.status = HOLD_FAILED   (compensation)
```

`HOLD_FAILED` **is the compensating action** -- it's what the system does
instead of the payment succeeding, so a job never sits silently "FUNDED"
with money that was never actually held. And the fund route already
handles resuming from that compensated state: re-funding a job whose
payment is `HOLD_FAILED` re-enters the same flow (`fundJobAtomic`'s
`existing.status === 'HOLD_FAILED'` branch) instead of creating a second
payment.

This is exactly the Saga pattern's core idea -- durable step, async
continuation, explicit compensation on failure -- just not named that in
this codebase, and not (yet) needed to span an actual second service. The
release flow (`enqueuePaymentRelease` + `PAYMENT_RELEASE` outbox event)
follows the identical shape.

## If payments became a separate service: orchestration vs. choreography

Two ways to extend the above once `paymentProvider` isn't a local module
call but a real network call to a separate Payments service:

**Orchestration** (a central coordinator owns the sequence): the API
service would own a `FundJobSaga` that explicitly calls
`PaymentsService.createHold()`, waits for a durable confirmation (webhook
or polling), and on failure explicitly calls a compensating
`JobsService.revertToPublished()`. This is a direct extension of what
`outbox_worker.js` already does -- it already IS the orchestrator, just
for in-process calls instead of network ones. Pros: the whole flow is
readable in one place. Cons: the orchestrator becomes a single thing every
step depends on.

**Choreography** (each service reacts to events, no central coordinator):
`JobFunded` event published -> Payments service consumes it, attempts the
hold, publishes either `PaymentHeld` or `PaymentHoldFailed` -> Jobs service
consumes *that* and updates its own state accordingly. This is a natural
extension of the outbox table itself: instead of `outbox_worker.js`
calling `paymentProvider` directly in-process, it would publish
`PAYMENT_CREATE_HOLD` to a real message broker, and a separate Payments
service would consume it and publish its own outbox event back. Pros: no
single coordinator; each service only needs to know its own reactions.
Cons: the overall flow is no longer readable in one file -- you have to
trace it across services' event handlers.

For a payments-integrity-critical flow like this one, orchestration is
usually the safer starting choice: a saga that can partially fail and lose
track of "what step were we on" is a worse failure mode for money movement
than a slightly more coupled coordinator. HOPE's current design (a
coordinator that happens to run in-process) is consistent with that
instinct.

## CQRS: separating the read model from the write model

`jobView()` (`app.js`) does both jobs: it's the shape returned after a
*write* (publish, accept, fund, ...) and the shape used for *listing*
reads. That's fine at HOPE's current scale, and CQRS is a scale-driven
pattern -- it doesn't earn its complexity until the read and write shapes
or their load profiles genuinely diverge. But it's worth recognizing where
they already have started to: the two listing routes
(`repo.listJobViews`/`listMyJobViews`) already build a *different*, wider
joined shape (owner/provider/category/offer-count precomputed) than a
single job's write-path view needs. That's the seed of a read model.

If job listings became a real bottleneck under load (verify with
`pg_stat_statements` per `docs/QUERY-PROFILING.md` before assuming this --
don't build this speculatively), the CQRS move would be:

```sql
-- A denormalized projection, updated by triggers or by the same outbox
-- mechanism already in this codebase (a JOB_STATE_CHANGED event that a
-- projector consumes and upserts into this table).
CREATE TABLE job_listing_view (
  job_id UUID PRIMARY KEY REFERENCES jobs(id),
  status TEXT NOT NULL,
  owner_id UUID NOT NULL,
  provider_id UUID,
  category_name TEXT NOT NULL,
  owner_display_name TEXT NOT NULL,
  provider_display_name TEXT,
  offer_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX job_listing_view_status_idx ON job_listing_view(status);
```
Reads hit this flat table directly -- no joins, no `GROUP BY`, no `COUNT`.
Writes (publish/accept/fund/...) keep using the normalized `jobs` table as
the source of truth as they do today, and additionally upsert into
`job_listing_view` (synchronously in the same transaction for strong
consistency, or via the outbox for eventual consistency -- the outbox
machinery already in this codebase makes the eventual-consistency version
a small addition, not a new pattern).

The trade this introduces: listing reads become eventually consistent with
writes if done via outbox (a job's status might briefly show stale in a
list right after a write, self-correcting once the projector catches up).
That trade needs to be a deliberate choice made under real measured load,
not applied preemptively -- exactly the same discipline this codebase
already shows in `proguard-rules.pro`'s "add rules only when a release
build demonstrates a verified need."
