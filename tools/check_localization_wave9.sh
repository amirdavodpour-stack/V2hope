#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
import json,re
from pathlib import Path
root=Path('.')
en=json.loads((root/'lib/l10n/app_en.arb').read_text()); fa=json.loads((root/'lib/l10n/app_fa.arb').read_text())
keys=lambda d:{k for k in d if not k.startswith('@') and k!='@@locale'}
ek,fk=keys(en),keys(fa)
assert ek==fk, f'ARB key mismatch: en-only={ek-fk}, fa-only={fk-ek}'
helper_raw=(root/'lib/core/ui/hope_l10n.dart').read_text()
# dart format wraps long getter/method signatures onto a second line, so
# collapse all whitespace runs (including newlines) to a single space before
# matching -- otherwise every wrapped accessor is a false "missing" report.
helper=re.sub(r'\s+',' ',helper_raw)
getters=set(re.findall(r'String get (\w+) => value\.\1;',helper))
parametric=set(re.findall(r'String (\w+)\([^)]*\) => (?:this\.)?value\.\1\([^)]*\);',helper))
assert ek <= (getters | parametric), f'Missing helper accessors: {sorted(ek-(getters|parametric))[:10]}'
for f in (root/'lib').rglob('*.dart'):
    if f == root/'lib/core/ui/copy.dart': continue
    t=f.read_text()
    assert 'tx(context' not in t, f'Manual tx() remains in {f}'
print(f'PASS: {len(ek)} ARB keys, parity OK, helper accessors complete, manual tx() eliminated.')
PY
