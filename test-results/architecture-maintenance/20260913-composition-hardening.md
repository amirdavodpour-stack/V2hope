# Composition Hardening — 2026-09-13

## Scope
Follow-up validation after the application/domain/infrastructure refactor.

## Findings

### AR-02 — Admin use-case temporal-dead-zone wiring
`backend/src/app.js` constructed `adminRoutes` before `adminUseCases` was initialized. The route factory received the lexical binding before initialization, creating a temporal-dead-zone runtime hazard.

**Fix:** repository ports and all use-cases are now composed before dependent route factories are constructed.

### AR-03 — Payment use-case injection omission
`createPaymentRoutes()` already required and invoked `paymentUseCases`, but the application composition root did not inject it.

**Fix:** `paymentUseCases` is explicitly provided to `createPaymentRoutes()` from the composed repository ports.

## Validation
- `node --check backend/src/app.js` — PASS
- `application-layer-contract.test.mjs` — 2/2 PASS
- static composition wiring check — PASS

No production behavior was intentionally changed; the changes correct dependency wiring introduced by the architecture layer.
