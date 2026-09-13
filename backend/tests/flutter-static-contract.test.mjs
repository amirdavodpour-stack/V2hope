import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('transaction UI catch blocks bind errors before formatting them', () => {
  const source = fs.readFileSync(path.join(root, 'lib/features/transactions/transaction_page.dart'), 'utf8');
  const blocks = [...source.matchAll(/catch \(([^)]+)\) \{([\s\S]*?)(?:\n    \}|\n  \})/g)];
  const relevant = blocks.filter(([, name, body]) => body.includes('apiErrorMessage('));
  assert.ok(relevant.length >= 2);
  for (const [, name, body] of relevant) assert.match(body, new RegExp(`apiErrorMessage\\(${name}\\b`));
});
