# V2 Offline & Resilience

## Marketplace read policy

Marketplace opportunity lists and opportunity details use an `OfflineMarketplaceRepository` decorator over the normal API repository.

- Fresh cache window: 5 minutes.
- Stale fallback window: 24 hours.
- Stale data is only returned after the remote GET fails; successful network responses always refresh the cache.
- Cache keys include all query-shaping inputs so filtered results cannot collide.
- Malformed cache entries are deleted fail-closed.
- Create/publish mutations remain remote-only; publish invalidates the affected detail cache.

This is deliberately a bounded read cache, not an offline mutation queue. Payment, application, offer and other mutations continue to require their existing idempotency and server-side lifecycle guarantees.
