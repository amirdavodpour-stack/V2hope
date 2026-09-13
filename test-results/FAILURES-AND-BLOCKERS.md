# Failures and Blockers - session 20260913T063720Z (final pre-certification)

## TRUE FAILURES (current)
1. **Performance success-rate gate** - EXPECTED_POLICY_LIMIT. 429s arise from the fixed per-key rate-limit policy; 0x5xx; p95 within budget. No production rate limiter modified. (Prior evidence retained; not re-run per zero-duplicate rule; no sanctioned load-test mechanism found in the repository this session.)
2. **score:90plus readiness gate** - overallReadiness 91, allAtLeast90=false, minScore=69. All gating conditions mapped per-domain in `test-results/CERTIFICATION-GAP-MAP.md` (8 domains pinned at the GATE_CAP=85 ceiling by unproven runtime-evidence gates; mobile_flutter 77; production_readiness 69; maintainability 75 static).

## RESOLVED THIS SESSION
- **npm audit revalidation** - RESOLVED: previous sessions were blocked by registry DNS (EAI_AGAIN). This session `npm audit --audit-level=high` executed against registry.npmjs.org -> **found 0 vulnerabilities, rc=0**. Evidence: `test-results/sessions/20260913T063720Z/npm-audit-rc.txt`. Note: the scorecard's `npm_audit` runtime gate still requires a GitHub Actions evidence artifact (logUrl schema), so the gate remains UNPROVEN until a CI run emits it.

## BLOCKERS (infrastructure - probed this session with official tooling; class C/D/E/F)
- Certified runner: `tools/ci-resource-guard.sh` rc=2 - RAM 1989 MiB < 6144 MiB floor (class E). Blocks Android certification work by project policy.
- Android SDK / adb / emulator absent, ANDROID_HOME unset (class E while RAM floor unmet) -> Android gradle + device instrumentation BLOCKED.
- Docker absent; no podman/containerd/nerdctl found (class E/F) -> containerized topologies BLOCKED.
- S3/R2 credentials absent (S3_INTEGRATION/S3_ENDPOINT unset; class C) -> s3-integration BLOCKED; credentials not invented.
- STAGING_BASE_URL absent (class C/D) -> staging runtime gates BLOCKED.
- Local PostgreSQL absent (psql/initdb/pg_ctl not found on this host; class D) -> postgres_runtime/dr_restore evidence gates require a CI host.

## NOT RE-RUN BY DESIGN (zero-duplicate rule; verified state in CURRENT_BASELINE.csv)
backend fast 217/217, contract 71/71, full 524/529, coverage 81.21/70.87/74.02, postgres isolated 3x4/4, DR drill, payments, notifications, agent handoff 6/6, persistence boundary 2/2, executable permissions 27/27, flutter 414/414 + analyze 0 + coverage 78.26%, perf-smoke (policy-limited).
