#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-${STAGING_API_BASE_URL:-}}"
[ -n "$API_BASE_URL" ] || { echo 'API_BASE_URL or STAGING_API_BASE_URL is required.' >&2; exit 1; }
[[ "$API_BASE_URL" == https://* ]] || { echo 'Android runtime certification requires HTTPS.' >&2; exit 1; }

printf '%s\n' "$API_BASE_URL" | grep -Eq '^https://[^[:space:]]+$' || {
  echo 'API_BASE_URL contains whitespace or is malformed.' >&2
  exit 1
}

echo 'PASS: Android runtime certification endpoint contract'
