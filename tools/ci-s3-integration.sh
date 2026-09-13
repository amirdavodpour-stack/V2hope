#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT/backend"
NAME="hope-ci-minio"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cleanup
docker run -d --name "$NAME" \
  -p 127.0.0.1:9000:9000 \
  -p 127.0.0.1:9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio:RELEASE.2025-04-22T22-12-26Z server /data --console-address ':9001' >/dev/null

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:9000/minio/health/live >/dev/null 2>&1; then
    export S3_INTEGRATION=1
    export S3_ENDPOINT=http://127.0.0.1:9000
    export S3_BUCKET=hope-ci
    export AWS_ACCESS_KEY_ID=minioadmin
    export AWS_SECRET_ACCESS_KEY=minioadmin
    npm run test:s3
    exit $?
  fi
  sleep 2
done

echo 'MinIO did not become healthy in time.' >&2
exit 1
