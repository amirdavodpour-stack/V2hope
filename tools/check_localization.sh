#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
import json
from pathlib import Path

base = Path('lib/l10n')
en = json.loads((base / 'app_en.arb').read_text())
fa = json.loads((base / 'app_fa.arb').read_text())
keys = lambda x: {k for k in x if not k.startswith('@') and not k.startswith('@@')}
en_keys, fa_keys = keys(en), keys(fa)
missing_fa = sorted(en_keys - fa_keys)
missing_en = sorted(fa_keys - en_keys)
if missing_fa or missing_en:
    print('Localization parity FAIL')
    if missing_fa: print('Missing fa:', ', '.join(missing_fa))
    if missing_en: print('Missing en:', ', '.join(missing_en))
    raise SystemExit(1)
print(f'Localization parity PASS: {len(en_keys)} shared message keys')
PY
