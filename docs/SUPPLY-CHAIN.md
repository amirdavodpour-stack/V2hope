# Supply-chain hygiene (SBOM + dependency audit)

## What's here
- `backend/sbom.json` -- a CycloneDX 1.5 Software Bill of Materials listing
  every *direct* dependency HOPE's backend ships with, and their pinned
  versions.
- `backend/tools/generate-sbom.mjs` -- regenerates it. Zero external
  dependencies (only `node:fs`/`node:crypto`), so it always runs, even
  offline, before `npm ci`, or in a locked-down CI sandbox.
- `backend/tests/sbom-contract.test.mjs` -- fails the build if `sbom.json`
  drifts out of sync with `package.json`. This is what makes the SBOM worth
  having: a bill of materials nobody keeps updated is worse than none, because
  it creates false confidence.

## Why this exists
On 2026-08-27 a review of this codebase found 12 declared dependencies
(`express`, `helmet`, `cors`, `bcryptjs`, `jsonwebtoken`, `multer`, `zod`,
`uuid`, `dotenv`, `express-rate-limit`, `pg-mem`, `supertest`) that were never
actually imported anywhere in `src/` or `tests/` -- confirmed by grepping the
entire codebase for each package name before removing them. They were almost
certainly leftovers from an earlier version of the code that has since been
hand-rolled (manual JWT, manual CORS headers, manual multipart parsing) with
nobody going back to prune `package.json`. This is exactly the failure mode
an SBOM + periodic audit habit catches early, before it's 12 packages deep.

## Regenerating the SBOM
```
cd backend
npm run sbom
```
Run this any time `package.json`'s dependencies change. `npm run check:all`
will fail if you forget.

## Limitation: direct dependencies only
`generate-sbom.mjs` lists direct dependencies, not the full transitive tree
(e.g. everything `pg` itself pulls in). It's deliberately dependency-free so
it works offline. Once you have real network/npm access, generate a complete
transitive-tree SBOM with a real tool and treat `sbom.json` here as the fast,
offline-safe baseline check rather than the sole source of truth:
```
npx @cyclonedx/cyclonedx-npm --output-file sbom-full.json
```

## Recurring habit, not a one-time task
- `npm run security:audit` (already wired to `npm audit --audit-level=high`)
  -- run this periodically, not just at release time. Vulnerabilities get
  disclosed in already-shipped dependencies constantly; a clean audit today
  says nothing about next month.
- `npm outdated` -- separate from security audit. A dependency can have zero
  known vulnerabilities and still be 3 major versions behind, which is its
  own risk (unmaintained, no one left triaging its issues).
- Before adding *any* new dependency, ask: does this duplicate something the
  hand-rolled code already does? (This codebase's answer has been "yes" 12
  times so far.)
