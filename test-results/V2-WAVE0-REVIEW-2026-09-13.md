# HOPE V2 — Wave 0 Review & Hardening

## Baseline rule
V1/V19 remains frozen. No V1 refactor is permitted unless V2 exposes a verified regression or a P0/P1 defect.

## Review findings
- The first V2 foundation had shared visual tokens, but motion, touch-target, layer, and compact-layout contracts were underspecified.
- Shared headers could become horizontally constrained on compact screens when a trailing action was present.
- Composite premium surfaces lacked consistent semantic labeling rules.
- Hero imagery was not explicitly excluded from semantics when the surrounding hero already conveyed the meaning.
- Design contract coverage named the system primitives but did not enforce the stronger responsive/accessibility contract.

## Corrections applied
- Added `HopeV2Motion`, `HopeV2Touch`, and `HopeV2Layer` tokens.
- Corrected breakpoint semantics and added `isMedium`/`isWide` helpers.
- Made `PremiumHeader` and `PremiumSectionHeader` compact-safe.
- Added optional semantic labels to premium panels and heroes.
- Added minimum interactive sizing to premium search/action surfaces.
- Added compact hero sizing and excluded decorative imagery from the semantic tree.
- Added overflow-safe premium tags.
- Added the V2 design-system specification and strengthened the design contract test.
- Bumped package versions to `4.0.2+3` (mobile) and `4.0.2` (backend) after the core-surface migration wave..

## Verification
- `npm run test:fast`: **219/219 PASS**
- `npm run test:contract`: **74/74 PASS**
- `node --test tests/v2-design-contract.test.mjs`: **1/1 PASS**
- Full Flutter runtime build/device certification: **not claimed**; requires a Flutter/Android-capable runner.
- PostgreSQL/S3/provider/staging certification: **not claimed**; requires real infrastructure.

## Decision
Wave 0 is accepted as the V2 foundation. Next work must move forward into experience architecture and screen migration. Re-opening V1 is out of scope unless a regression is demonstrated.
