# HOPE-V7 Certification Gap Map

Session: `20260913T063720Z` (2026-09-13) — final pre-certification handoff.
Authoritative source: `backend/tools/90plus-score.mjs` (engine `evidence-derived-v2`), executed read-only this session
(`score_rc=0` log: `test-results/sessions/20260913T063720Z/scorecard-run.log`, per-domain detail: `scorecard-details.log`).
Result: `overallReadiness=91`, `minScore=69`, `allAtLeast90=false`. Thresholds were NOT modified.

## How the gate works (verbatim from the scoring engine)

- Every domain has static file/contract checks (`score = 100 * passed_weight / total_weight`).
- Each domain may declare **runtime-evidence gates**. A gate is **proven only** when
  `docs/audit/evidence/<gate>.json` exists, parses as JSON, has `gate == <gate>`,
  `result === "pass"` (exact string), a `logUrl` matching a real GitHub Actions run URL
  (`https://github.com/<owner>/<repo>/actions/runs/<id>[/job/<id>|/attempts/<n>]`), a parseable
  `ranAt` ISO timestamp, and age <= 90 days. Anything else fails closed to UNPROVEN.
- Each unproven gate **caps the domain at `GATE_CAP=85` minus `4 × (missingGates − 1)`**.
- `allAtLeast90` requires **every one of the 20 domains >= 90**; any domain capped at 85 (or lower) blocks it.
- Therefore: **no domain can reach 90 while any of its runtime gates is unproven — regardless of static score.**

Current evidence directory contains only `README.md`; **all 9 runtime gates are UNPROVEN (missing artifacts)**. Local static documentation gaps are now closed.

## Domain-by-domain gap map

| DOMAIN | SCORE / STATUS | REQUIRED CONDITION (from scoring code) | CURRENT BLOCKER | CAN RESOLVE LOCALLY? | NEXT ACTION |
|---|---|---|---|---|---|
| architecture | 100 PASS | static checks only | none | — | none |
| backend_api | 100 PASS | static checks only | none | — | none |
| database_integrity | 85 GATED | gate `postgres_runtime` = real PostgreSQL-backed suite run, evidence artifact | `postgres_runtime.json` missing (runner has no PostgreSQL — class D) | NO (needs PostgreSQL host, e.g. CI workflow) | Run `test:postgres:isolated` / postgres suites on a CI runner with PostgreSQL; emit evidence via `tools/write-evidence.mjs` |
| security | 85 GATED | static 100 after adding the required `SECURITY-THREAT-MODEL.md` + gate `npm_audit` | `npm_audit.json` missing — **audit itself revalidated PASS 0 vulnerabilities this session**, but evidence artifact requires a GitHub Actions logUrl, so it can only be emitted by a real CI run | PARTIALLY (add threat-model doc = +weight; evidence artifact = CI only) | Add `SECURITY-THREAT-MODEL.md`; run `security:audit` in CI and emit `npm_audit` evidence |
| authentication_authorization | 100 PASS | static checks only | none | — | none |
| payments_financial_integrity | 85 GATED | gate `provider_runtime` = real payment/notification provider delivery | no provider credentials (class C) | NO | CI/external provider run; emit `provider_runtime` evidence |
| storage | 85 GATED | gate `s3_runtime` = real object-storage lifecycle | no S3/R2 credentials (class C) | NO | Sandbox/real S3 integration run (`test:s3`), emit evidence |
| notifications_outbox | 85 GATED | gate `provider_runtime` | no provider credentials (class C) | NO | Same as payments (shared gate) |
| privacy | 100 PASS | static checks only | none | — | none |
| observability | 100 PASS | static checks only | none | — | none |
| mobile_flutter | 77 GATED | gates `flutter_toolchain` + `android_build` + `device_certification` | no Android SDK/adb/emulator; runner 1989 MiB < 6144 MiB guard floor (class E) | NO | Certified runner (>=6144 MiB, >=8192 MiB disk, 2 CPU): SDK 36 + JDK 17 + Flutter 3.47.2; debug build + instrumentation; emit 3 evidence artifacts |
| ux | 100 PASS | static checks only | none | — | none |
| accessibility | 100 PASS | static checks only | none | — | none |
| localization | 100 PASS | static checks only | none | — | none |
| testing | 100 PASS | static checks only | none | — | none |
| performance | 85 GATED | gate `perf_run` = performance run on target Node version | perf-smoke classified EXPECTED_RATE_LIMIT_POLICY_LIMIT; no sanctioned load-test identity/rate-limit test bucket exists → POLICY-LIMITED; 429s are policy behavior, 0x5xx | NO (must not alter rate limiter, must not exclude 429s) | Establish sanctioned load-test policy (dedicated test bucket/identity), then run perf on CI and emit `perf_run` evidence |
| ci_cd | 100 PASS | static checks only | none | — | none |
| disaster_recovery_resilience | 85 GATED | gate `dr_restore` = backup restore/chaos drill | drill evidence artifact absent (needs CI host with pg_dump/pg_restore — absent locally, class D) | NO | Run `dr-restore.yml` workflow; emit `dr_restore` evidence |
| maintainability | 100 PASS | static checks; no runtime gates | resolved: root `CHANGELOG.md` added | — | none |
| production_readiness | 69 GATED (5 gates) | gates `android_build` + `device_certification` + `postgres_runtime` + `dr_restore` + `npm_audit` | all five evidence artifacts missing | NO (all require CI/certified runner) | Aggregate: once the five upstream runs execute in CI with evidence emission, this domain's cap lifts |

## Score arithmetic (why 90 is unreachable without runtime runs)

- 10 domains are static-100 and PASS.
- 8 domains sit exactly at the `GATE_CAP=85` ceiling because ≥1 runtime gate is unproven: no static improvement can raise them above 85.
- `mobile_flutter` = 77 (3 missing gates: 85 − 4×2), `production_readiness` = 69 (5 missing gates: 85 − 4×4), `maintainability` = 75 (static only).
- `allAtLeast90=true` therefore requires evidence artifacts for **all 9 gates**: `flutter_toolchain`, `android_build`, `device_certification`, `postgres_runtime`, `s3_runtime`, `provider_runtime`, `dr_restore`, `perf_run`, `npm_audit`.

## Domain classification summary

- **PASS (100):** architecture, backend_api, authentication_authorization, privacy, observability, ux, accessibility, localization, testing, ci_cd
- **GATED / UNPROVEN (85):** database_integrity, security, payments_financial_integrity, storage, notifications_outbox, performance, disaster_recovery_resilience
- **GATED / UNPROVEN (<85):** mobile_flutter 77, production_readiness 69
- **STATIC / LOCAL-RESOLVABLE (75):** maintainability (missing `CHANGELOG.md`)
- **POLICY-LIMITED:** performance (rate-limit policy; EXPECTED_POLICY_LIMIT retained)

## Precondition classification of remaining work (per §4 of handoff)

| Capability | Class | Reason |
|---|---|---|
| Android SDK 36 / JDK 17 / Flutter 3.47.2 + instrumentation | **E** (resources: 1989 MiB RAM < 6144 MiB guard floor) | `ci-resource-guard.sh` rc=2 this session |
| Docker/containerized tests | **E/F** | no runtime present; constrained runner |
| S3/R2 integration | **C** | no credentials; must not invent |
| Staging runtime | **C/D** | `STAGING_BASE_URL` absent |
| npm audit evidence artifact | **CI-only** | evidence schema requires GitHub Actions logUrl (offline format check); the audit itself revalidated PASS this session |
| `CHANGELOG.md` for maintainability | **Local** | only immediately resolvable score item |

**Fastest path to `allAtLeast90`:** one certified CI/certified-runner pipeline that executes the 9 runtime gates and writes `docs/audit/evidence/<gate>.json` via `backend/tools/write-evidence.mjs`, plus adding `CHANGELOG.md` and `SECURITY-THREAT-MODEL.md`.


## Local closure performed in latest maintenance pass

- Added root `CHANGELOG.md`; maintainability static score is now PASS.
- Added root `SECURITY-THREAT-MODEL.md`; the security static documentation check is now PASS. The security domain remains capped until the CI-traceable `npm_audit` runtime evidence artifact exists.
- Added/retained read-only runtime inventory and status-integrity tooling. No synthetic runtime evidence was created.
