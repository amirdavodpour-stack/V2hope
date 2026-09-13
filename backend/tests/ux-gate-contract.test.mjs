// Regression guard for the UX Wave 8 gate (tools/check_ux_wave8.sh).
//
// The gate verifies that the home feature actually renders its responsive
// wrapper. The responsive usage lives in lib/features/home/home_widgets.part.dart
// (home_page.dart only imports the part), so the rule must point at the real
// usage site. This test pins that the gate (a) is executable, (b) references
// the part file, and (c) passes against the current tree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('UX gate script is executable and points at the real responsive usage', () => {
  const script = path.join(root, 'tools', 'check_ux_wave8.sh');
  const stat = fs.statSync(script);
  assert.equal((stat.mode & 0o111) !== 0, true);
  const body = fs.readFileSync(script, 'utf8');
  assert.match(
    body,
    /lib\/features\/home\/home_widgets\.part\.dart:HopeResponsive\(/,
    'the gate must check the part file where HopeResponsive is actually used',
  );
});

test('UX gate passes against the current tree', () => {
  const out = execFileSync('bash', [path.join(root, 'tools', 'check_ux_wave8.sh')], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.match(out, /UX Wave 8 contract PASS/);
});
