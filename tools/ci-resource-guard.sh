#!/usr/bin/env bash
set -euo pipefail

# Resource guard for expensive CI/mobile work. It is deliberately dynamic:
# it measures the runner instead of assuming a fixed machine size.
# FAIL-CLOSED only when the machine is clearly too small to run the approved
# certification workload. Otherwise it exports conservative settings.

MIN_RAM_MB="${HOPE_MIN_RAM_MB:-6144}"
MIN_DISK_MB="${HOPE_MIN_DISK_MB:-8192}"
MIN_CPU="${HOPE_MIN_CPU:-2}"

read_mem_mb() {
  if [ -r /sys/fs/cgroup/memory.max ]; then
    local raw
    raw="$(cat /sys/fs/cgroup/memory.max)"
    if [ "$raw" != "max" ] && [ -n "$raw" ]; then
      awk -v b="$raw" 'BEGIN { printf "%d", b/1024/1024 }'
      return
    fi
  fi
  awk '/MemTotal:/ {printf "%d", $2/1024; exit}' /proc/meminfo
}

TOTAL_RAM_MB="$(read_mem_mb)"
CPU_COUNT="$(nproc 2>/dev/null || getconf _NPROCESSORS_ONLN 2>/dev/null || echo 1)"
DISK_FREE_MB="$(df -Pm . | awk 'NR==2 {print $4}')"

printf 'RESOURCE_GUARD\tram_mb=%s\tcpu=%s\tdisk_free_mb=%s\n' "$TOTAL_RAM_MB" "$CPU_COUNT" "$DISK_FREE_MB"

if [ "$TOTAL_RAM_MB" -lt "$MIN_RAM_MB" ]; then
  echo "RESOURCE_GUARD_FAIL: at least ${MIN_RAM_MB} MiB RAM is required; found ${TOTAL_RAM_MB} MiB." >&2
  exit 2
fi
if [ "$DISK_FREE_MB" -lt "$MIN_DISK_MB" ]; then
  echo "RESOURCE_GUARD_FAIL: at least ${MIN_DISK_MB} MiB free disk is required; found ${DISK_FREE_MB} MiB." >&2
  exit 2
fi
if [ "$CPU_COUNT" -lt "$MIN_CPU" ]; then
  echo "RESOURCE_GUARD_FAIL: at least ${MIN_CPU} CPUs are required; found ${CPU_COUNT}." >&2
  exit 2
fi

# Keep parallelism conservative. Heavy Gradle/Flutter work is the dominant
# memory consumer; one or two workers is enough for deterministic CI.
if [ "$CPU_COUNT" -ge 4 ]; then
  WORKERS=2
else
  WORKERS=1
fi

# Cap Gradle JVM around one quarter of available RAM, but keep enough memory
# for Flutter/Dart, adb/emulator, and the OS. Never exceed 3072 MiB.
HEAP_MB=$((TOTAL_RAM_MB / 4))
[ "$HEAP_MB" -lt 1024 ] && HEAP_MB=1024
[ "$HEAP_MB" -gt 3072 ] && HEAP_MB=3072

export GRADLE_WORKER_MAX="$WORKERS"
export GRADLE_OPTS="${GRADLE_OPTS:--Dorg.gradle.daemon=false -Dorg.gradle.caching=false -Dorg.gradle.configuration-cache=false -Dorg.gradle.vfs.watch=false -Dorg.gradle.parallel=false} -Dorg.gradle.workers.max=${WORKERS} -Xmx${HEAP_MB}m"
export ORG_GRADLE_PROJECT_orgGradleJvmargs="-Xmx${HEAP_MB}m -XX:MaxMetaspaceSize=512m"

if [ -n "${GITHUB_ENV:-}" ]; then
  {
    printf 'GRADLE_WORKER_MAX=%s\n' "$GRADLE_WORKER_MAX"
    printf 'GRADLE_OPTS=%s\n' "$GRADLE_OPTS"
    printf 'ORG_GRADLE_PROJECT_orgGradleJvmargs=%s\n' "$ORG_GRADLE_PROJECT_orgGradleJvmargs"
    printf 'HOPE_RESOURCE_RAM_MB=%s\n' "$TOTAL_RAM_MB"
    printf 'HOPE_RESOURCE_CPU=%s\n' "$CPU_COUNT"
    printf 'HOPE_RESOURCE_DISK_FREE_MB=%s\n' "$DISK_FREE_MB"
  } >> "$GITHUB_ENV"
fi

printf 'RESOURCE_GUARD_PASS\tworkers=%s\tgradle_heap_mb=%s\n' "$WORKERS" "$HEAP_MB"
