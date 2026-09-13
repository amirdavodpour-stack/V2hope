import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname, '..', 'lib');

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, files);
    else if (p.endsWith('.dart')) files.push(p);
  }
  return files;
}

const dartFiles = walk(root);
const text = dartFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

test('mobile UI honors bidirectional layout, accessibility semantics and localized copy contracts', () => {
  if (text.includes("textDirection: TextDirection.rtl")) {
    assert.match(text, /Localizations\.localeOf\(context\)\.languageCode == 'en'/, 'unconditional RTL directionality detected');
  }
  assert.match(text, /Semantics\(/, 'accessibility semantics contracts missing');
  assert.match(text, /MergeSemantics\(/, 'accessibility semantics contracts missing');
  assert.match(text, /SafeArea\(/, 'SafeArea contract missing');
  assert.match(text, /TextDirection\.ltr/, 'LTR contract missing');
  assert.match(text, /TextDirection\.rtl/, 'RTL contract missing');
  assert.match(text, /HopeCopy\.of\(context\)\.copy_search_dd58413/, 'SearchField locale-aware hint contract missing');
  assert.match(text, /Icons\.arrow_back_rounded/, 'bidirectional back navigation icon missing');
  assert.match(text, /Icons\.arrow_forward_rounded/, 'bidirectional forward navigation icon missing');
  assert.match(text, /HopeCopy\.of\(context\)\.copy_back_6e09f79/, 'localized back tooltip contract missing');
});

test('required ARB localization files are present', () => {
  const l10nRoot = path.join(root, 'l10n');
  assert.ok(fs.existsSync(path.join(l10nRoot, 'app_fa.arb')), 'app_fa.arb missing');
  assert.ok(fs.existsSync(path.join(l10nRoot, 'app_en.arb')), 'app_en.arb missing');
});
