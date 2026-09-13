# HOPE Agent Resource Policy

This policy is part of the handoff contract.

## Required behavior

- Run `bash tools/ci-resource-guard.sh` before expensive mobile/Gradle work.
- Treat the guard as a fail-closed capacity check, not as a performance claim.
- Do not run multiple APK builds concurrently.
- Do not run a full backend suite and a Flutter/Gradle build concurrently on a constrained runner.
- Prefer `npm run test:fast` and targeted contract tests before expensive integration suites.
- Preserve raw logs for long-running operations.
- If a process appears hung, capture diagnostics before termination; do not silently retry forever.
- Use bounded retries only when the failure mode is explicitly retryable and the retry itself is part of the approved contract.
- Clean generated artifacts only after evidence has been copied to the evidence directory.
- Before packaging, remove host-local generated state (`.dart_tool`, `build`, Gradle caches, machine-specific `android/local.properties`) unless the file is explicitly part of release evidence.

## Environment thresholds

The default guard rejects an obviously under-provisioned runner below:

```text
RAM: 6144 MiB
free disk: 8192 MiB
CPU: 2 cores
```

These are resource-safety thresholds, not certification requirements and not claims about the performance of the application.
