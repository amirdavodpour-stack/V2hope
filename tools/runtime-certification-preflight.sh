#!/usr/bin/env bash
set -euo pipefail

required=()
missing=()
check_cmd() {
  local name="$1" cmd="$2"
  if command -v "$cmd" >/dev/null 2>&1; then
    printf '%s\t%s\n' "$name" "$(command -v "$cmd")"
  else
    missing+=("$name")
  fi
}

check_cmd node node
check_cmd npm npm
check_cmd docker docker
check_cmd adb adb
check_cmd java java
check_cmd javac javac
check_cmd flutter flutter
check_cmd psql psql
check_cmd pg_dump pg_dump
check_cmd pg_restore pg_restore

node_major="$(node -p "process.versions.node.split('.')[0]")"
if [ "$node_major" != "24" ]; then
  missing+=("node24")
fi

if command -v flutter >/dev/null 2>&1; then
  flutter_version="$(flutter --version 2>/dev/null | sed -n '1s/Flutter \([^ ]*\).*/\1/p' || true)"
  printf '%s\t%s\n' "flutter-version" "${flutter_version:-unknown}"
  if [ "$flutter_version" != "3.47.2" ]; then missing+=("flutter3.47.2"); fi
fi

if command -v java >/dev/null 2>&1; then
  java_major="$(java -version 2>&1 | sed -n 's/.*version "\([0-9]*\)\..*/\1/p' | head -1)"
  if [ "$java_major" != "17" ]; then missing+=("java17"); fi
fi
if command -v javac >/dev/null 2>&1; then
  javac_major="$(javac -version 2>&1 | sed -n 's/.* \([0-9]*\)\..*/\1/p' | head -1)"
  if [ "$javac_major" != "17" ]; then missing+=("javac17"); fi
fi

if ((${#missing[@]} > 0)); then
  printf 'RUNTIME_PREFLIGHT_FAIL\nmissing=%s\n' "$(IFS=,; echo "${missing[*]}")" >&2
  exit 2
fi

printf 'RUNTIME_PREFLIGHT_PASS\nnode=%s\n' "$(node -v)"
