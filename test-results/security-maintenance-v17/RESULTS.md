# V17 Security / Financial Maintenance Evidence

Date: 2026-09-13

## Focused validation
- Admin/security/upload/auth suite: 19/19 PASS
- Contract suite: 74/74 PASS
- Modified-file `node --check`: PASS

## Changes
- Admin financial summary now crosses the application boundary through the payment use-case.
- Admin job deletion is fail-closed when financial records exist.
- `RELEASE_FAILED` is included in financial pending counts.

## Environment limitation
The project requires Node >=24 <25. The current maintenance container provides Node 22, so this evidence is not production runtime certification.
