from pathlib import Path
import re, json, hashlib
root=Path(__file__).resolve().parents[1]
files=list((root/'lib').rglob('*.dart'))
pat=re.compile(r"tx\(context,\s*'((?:\\'|[^'])*)',\s*'((?:\\'|[^'])*)'\)")
items={}
def unesc(s):
    return s.replace("\\'", "'").replace('\\\\','\\')
def key_for(en, fa):
    base=re.sub(r'[^a-z0-9]+','_',en.lower()).strip('_')[:42] or 'copy'
    digest=hashlib.sha1((fa+'\0'+en).encode()).hexdigest()[:7]
    return f'copy_{base}_{digest}'
for f in files:
    text=f.read_text()
    for m in pat.finditer(text):
        fa,en=unesc(m.group(1)),unesc(m.group(2))
        k=key_for(en,fa)
        items[(fa,en)]=k
print('unique',len(items))
# Load ARBs preserving simple formatting by json rewrite (acceptable localization files)
for locale in ['fa','en']:
    p=root/f'lib/l10n/app_{locale}.arb'
    data=json.loads(p.read_text())
    for (fa,en),k in sorted(items.items(), key=lambda x:x[1]):
        data[k]= fa if locale=='fa' else en
        data[f'@{k}']={'description': 'Wave 9 UI copy migrated from manual bilingual text.'}
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
# Helper wrapper with generated getters
helper=root/'lib/core/ui/hope_l10n.dart'
lines=["import 'package:flutter/widgets.dart';", "import '../../l10n/generated/app_localizations.dart';", '', 'class HopeCopy {', '  const HopeCopy._(this.value);', '  final AppLocalizations value;', '', '  factory HopeCopy.of(BuildContext context) => HopeCopy._(AppLocalizations.of(context)!);']
for (fa,en),k in sorted(items.items(), key=lambda x:x[1]):
    lines.append(f'  String get {k} => value.{k};')
lines.append('}')
helper.write_text('\n'.join(lines)+'\n')
# replace calls and add import where needed
for f in files:
    text=f.read_text()
    if 'tx(context' not in text: continue
    orig=text
    def repl(m):
        fa,en=unesc(m.group(1)),unesc(m.group(2)); return f"HopeCopy.of(context).{items[(fa,en)]}"
    text=pat.sub(repl,text)
    if text!=orig and 'hope_l10n.dart' not in text:
        # insert next to core/ui imports or after flutter import
        if "package:flutter" in text:
            idx=text.find('\n', text.find("import 'package:flutter"))
            text=text[:idx+1]+"import '../../core/ui/hope_l10n.dart';\n"+text[idx+1:]
        else:
            text="import '../core/ui/hope_l10n.dart';\n"+text
    f.write_text(text)
# copy.dart keep only dynamic helpers but eliminate tx manual implementation
copy=root/'lib/core/ui/copy.dart'
copy.write_text("""import 'package:flutter/material.dart';\nimport 'hope_l10n.dart';\n\nString moneyLabel(BuildContext context, Object value) =>\n    Localizations.localeOf(context).languageCode == 'en' ? '$value IRR' : '${value} تومان';\n\nString opportunityKindLabel(BuildContext context, String? value) => switch ((value ?? '').toUpperCase()) {\n  'MISSION' => HopeCopy.of(context).copy_mission_d3f14d9,\n  'JOB' => HopeCopy.of(context).copy_job_6e6f3a1,\n  _ => HopeCopy.of(context).copy_opportunity_89a3a55,\n};\n\nString opportunityVisibilityLabel(BuildContext context, String? value) => switch ((value ?? '').toUpperCase()) {\n  'SPECIALIZED' => HopeCopy.of(context).copy_specialized_19f9d0a,\n  _ => HopeCopy.of(context).copy_public_7d1f99d,\n};\n""")
