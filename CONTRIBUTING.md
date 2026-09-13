# Contributing to HOPE

## Before opening a change

- Read `README.md` and the relevant files under `docs/`.
- Keep production behavior fail-closed for authentication, authorization, payments, storage, and release certification.
- Do not commit secrets, production credentials, signing keys, local `.env` files, build output, or generated runtime state.

## Required local checks

From `backend/`:

```bash
npm ci
npm run check
npm run test:offline
```

For changes that affect a specific integration, also run the matching integration or contract test listed in `backend/package.json`.

For Flutter changes:

```bash
flutter pub get
flutter analyze
flutter test
```

If you add, remove, or change the version constraint of any dependency in
`pubspec.yaml`, `flutter pub get` will update `pubspec.lock` — **commit that
updated `pubspec.lock` in the same change.** CI enforces this with
`tools/verify-pubspec-lock-fresh.sh`, which fails the build if `pubspec.lock`
is missing an entry for a direct dependency or if `flutter pub get` would
change it. A lock file that drifts from `pubspec.yaml` silently loses the
reproducible-build guarantee for the affected packages.

## Pull requests

Describe the behavior changed, the tests executed, and any environment-dependent evidence that could not be collected locally. Do not claim staging, device, payment-provider, S3, or disaster-recovery certification unless the corresponding workflow produced evidence.
