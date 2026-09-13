# Staging provider simulator

Deterministic HTTPS sandbox for staging-only payment and notification flows. It is intentionally not used by production.

Endpoints:
- POST /create -> HELD + providerRef
- POST /release -> RELEASED
- POST /refund -> REFUNDED + refundRef
- POST /push -> delivered
- POST /email -> delivered

The simulator persists idempotency responses in-memory for the lifetime of the container so repeated requests are deterministic within a staging run.
