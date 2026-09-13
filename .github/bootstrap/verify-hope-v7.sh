#!/usr/bin/env bash

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "============================================"
echo "HOPE-V7 STRUCTURE VERIFICATION"
echo "============================================"
echo

required_files=(
  "AGENT-HANDOFF-PROMPT.md"
  "AGENT-RESOURCE-POLICY.md"
  "backend/package.json"
  "backend/package-lock.json"
  ".github/workflows/main.yml"
  ".github/workflows/staging-certification.yml"
  ".github/workflows/production-release.yml"
  "tools/staging-operational-gate.mjs"
)

for file in "${required_files[@]}"; do
  if [[ -f "$file" ]]; then
    echo "PASS: $file"
  else
    echo "FAIL: missing $file"
    exit 1
  fi
done

echo
echo "Checking Node..."

node --version
npm --version

echo
echo "Checking operational gate syntax..."

node --check tools/staging-operational-gate.mjs

echo
echo "Checking backend package installation..."

if [[ -f "backend/package.json" ]]; then
  (
    cd backend
    npm ci --ignore-scripts
  )
fi

echo
echo "============================================"
echo "HOPE-V7 BOOTSTRAP VERIFICATION PASSED"
echo "============================================"
