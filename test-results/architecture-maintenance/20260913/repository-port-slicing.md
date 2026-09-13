# Repository Port Slicing — Architecture Maintenance

Change: introduced `backend/src/application/ports/repository_ports.js` and wired the composition root to inject capability-specific repository slices into application use cases.

Purpose: application use cases must depend on only the persistence capabilities they require, rather than the entire repository facade.

Behavior: no route/API contract or persistence behavior intentionally changed.

Validation performed:
- `node --check backend/src/application/ports/repository_ports.js` PASS
- `node --check backend/src/app.js` PASS
- `node --test backend/tests/repository-port-slices.test.mjs` PASS (1/1)

Additional architecture suites were not claimed as executed unless explicitly run in this session.
