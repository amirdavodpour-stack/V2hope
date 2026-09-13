#!/usr/bin/env sh
set -eu

if [ "${NODE_ENV:-}" = "production" ]; then
  /app/scripts/validate-production-env.sh
fi

exec "$@"
