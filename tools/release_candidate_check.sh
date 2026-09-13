#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0
blocked=0
export RELEASE_STATUS='VALIDATION-INCOMPLETE'

run_gate() {
  local name="$1"; shift
  printf '\n== %s ==\n' "$name"
  if "$@"; then
    pass=$((pass+1))
    printf 'PASS: %s\n' "$name"
  else
    printf 'FAIL: %s\n' "$name" >&2
    exit 1
  fi
}

run_gate 'Static audit' bash tools/static_audit.sh
run_gate 'Configuration contract' bash -lc 'cd backend && npm run check:config-contract'
run_gate 'Build/release contract' bash -lc 'bash tools/android-release-contract.sh && bash tools/android-runtime-cert-contract.sh'
run_gate 'SBOM regeneration contract' bash -lc 'cd backend && npm run sbom && node --test tests/sbom-contract.test.mjs'
run_gate 'Localization gate' bash tools/check_localization_wave9.sh
run_gate 'UX gate' bash tools/check_ux_wave8.sh
run_gate 'Backend all checks' bash -lc 'cd backend && npm run check:all'
run_gate 'Backend product requirements' bash -lc 'cd backend && npm run test:product'
run_gate 'Payment concurrency and idempotency E2E' bash -lc 'cd backend && npm run test:payment-e2e'
run_gate 'Backend performance smoke' bash -lc 'cd backend && npm run test:perf'
run_gate 'Backend concurrent load smoke' bash -lc 'cd backend && npm run test:load:smoke'
run_gate 'Webhook payment provider integration' bash -lc 'cd backend && npm run test:provider'
run_gate 'Operations contracts' bash -lc 'cd backend && node --test tests/operations-contract.test.mjs'
run_gate 'Release certification policy documented' bash -lc 'grep -q '\''External evidence required before production certification'\'' RELEASE-CHECKLIST.md'

if [ "${RUN_SECURITY_AUDIT:-0}" = '1' ]; then
  run_gate 'Dependency security audit' bash -lc 'cd backend && npm audit --audit-level=high'
else
  blocked=$((blocked+1))
  printf 'BLOCKED: dependency security audit skipped locally; set RUN_SECURITY_AUDIT=1 in a networked environment.\n'
fi

printf '\n== External verification availability ==\n'
if [ "${RUN_PRODUCTION_ENV_GATE:-0}" = '1' ]; then
  run_gate 'Production environment contract' bash -lc 'cd backend && ./scripts/validate-production-env.sh'
else
  printf 'INFO: Production environment gate skipped locally; CI release validates real production variables before build.\n'
fi

if command -v flutter >/dev/null 2>&1; then
  run_gate 'Flutter analyze' flutter analyze
  run_gate 'Flutter tests' flutter test
else
  blocked=$((blocked+1))
  printf 'BLOCKED: Flutter SDK not installed; analyze/test/build must run in CI or a device-capable environment.\n'
fi

if command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    run_gate 'Docker compose config' docker compose config -q
  else
    blocked=$((blocked+1))
    printf 'BLOCKED: docker compose plugin unavailable.\n'
  fi
else
  blocked=$((blocked+1))
  printf 'BLOCKED: Docker not installed; staging container boot cannot be verified here.\n'
fi

printf '\nRelease Candidate result\n------------------------\n'
printf 'Gates passed: %s\n' "$pass"
printf 'External checks blocked: %s\n' "$blocked"
export RELEASE_GATES_PASSED="$pass"
export RELEASE_GATES_BLOCKED="$blocked"
if (( blocked > 0 )); then
  export RELEASE_STATUS='VALIDATION-INCOMPLETE'
  node tools/release_evidence.mjs
  printf 'STATUS: VALIDATION-INCOMPLETE\n'
  exit 2
fi
export RELEASE_STATUS='RELEASE-CANDIDATE'
node tools/release_evidence.mjs
printf 'STATUS: RELEASE-CANDIDATE\n'
