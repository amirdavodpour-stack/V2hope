#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FEATURES=(
  "$ROOT/lib/features/home"
  "$ROOT/lib/features/admin"
  "$ROOT/lib/features/profile"
  "$ROOT/lib/features/notifications"
  "$ROOT/lib/features/marketplace/job_detail_page.dart"
)
for target in "${FEATURES[@]}"; do
  if grep -R -nE 'ApiClient|context\.read<ApiClient>|widget\.api' "$target" --include='*.dart' >/tmp/hope-arch-hit 2>/dev/null; then
    cat /tmp/hope-arch-hit
    echo "Architecture contract failed: feature UI directly depends on ApiClient: $target" >&2
    exit 1
  fi
done
if grep -R -nE 'FutureBuilder<dynamic>|Future<dynamic>' "$ROOT/lib/features/admin" "$ROOT/lib/features/marketplace/job_detail_page.dart" >/tmp/hope-dynamic-hit 2>/dev/null; then
  cat /tmp/hope-dynamic-hit
  echo "Architecture contract failed: untyped async UI boundary remains." >&2
  exit 1
fi
for f in "$ROOT/lib/core/admin/admin_repository.dart" "$ROOT/lib/core/marketplace/job_detail_repository.dart"; do
  test -f "$f"
done
printf '%s\n' 'Flutter architecture contract: PASS'
