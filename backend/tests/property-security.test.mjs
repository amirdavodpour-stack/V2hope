import test from 'node:test';
import assert from 'node:assert/strict';
import { signAccessToken, verifyAccessToken, hashPassword, verifyPassword } from '../src/security.js';
import { requestId } from '../src/observability.js';
import { makeRng, randomString, randomInt } from './lib/pbt.mjs';

test('property: JWT round-trips for any subject/secret/ttl (sign then verify recovers the same claims)', () => {
  const rng = makeRng(2026827);
  for (let i = 0; i < 300; i++) {
    const sub = randomString(rng, { minLen: 1, maxLen: 40 });
    const secret = randomString(rng, { minLen: 1, maxLen: 40 });
    const ttl = randomInt(rng, 1, 100000);
    const token = signAccessToken({ sub }, secret, ttl);
    const claims = verifyAccessToken(token, secret);
    assert.equal(claims.sub, sub, `seed=${rng.seed} i=${i}`);
  }
});

test('property: JWT verification rejects the wrong secret for any payload', () => {
  const rng = makeRng(555111);
  for (let i = 0; i < 200; i++) {
    const sub = randomString(rng, { minLen: 1, maxLen: 20 });
    const secretA = randomString(rng, { minLen: 1, maxLen: 20 });
    let secretB = randomString(rng, { minLen: 1, maxLen: 20 });
    if (secretB === secretA) secretB += 'x'; // guarantee distinct secrets
    const token = signAccessToken({ sub }, secretA, 3600);
    assert.throws(() => verifyAccessToken(token, secretB), `seed=${rng.seed} i=${i}`);
  }
});

test('property: flipping any single character of a valid token breaks verification', () => {
  const rng = makeRng(90210);
  const secret = 'fixed-secret-for-this-property';
  for (let i = 0; i < 150; i++) {
    const sub = randomString(rng, { minLen: 1, maxLen: 20, charset: 'abcdefghij' });
    const token = signAccessToken({ sub }, secret, 3600);
    const pos = rng.int(0, token.length - 1);
    const chars = token.split('');
    // Flip to a character guaranteed different from the original, staying
    // within base64url's alphabet (so we're testing "wrong content", not
    // "malformed base64" -- a stricter, more meaningful property).
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let replacement = chars[pos];
    while (replacement === chars[pos]) replacement = alphabet[rng.int(0, alphabet.length - 1)];
    if (chars[pos] === '.') continue; // don't corrupt the JWT's own separators
    chars[pos] = replacement;
    const tampered = chars.join('');
    assert.throws(() => verifyAccessToken(tampered, secret), `seed=${rng.seed} i=${i} pos=${pos}`);
  }
});

test('property: requestId() output always matches the safe id pattern, for any header input', () => {
  const rng = makeRng(424242);
  const pattern = /^[A-Za-z0-9._:-]{1,128}$/;
  for (let i = 0; i < 300; i++) {
    const headerValue = rng.bool() ? randomString(rng, { minLen: 0, maxLen: 300 }) : undefined;
    const id = requestId({ headers: { 'x-request-id': headerValue } });
    assert.match(id, pattern, `seed=${rng.seed} i=${i} header=${JSON.stringify(headerValue)}`);
  }
});

test('property: requestId() passes through any already-safe id unchanged', () => {
  const rng = makeRng(13579);
  const safeCharset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._:-';
  for (let i = 0; i < 100; i++) {
    const safeId = randomString(rng, { minLen: 1, maxLen: 128, charset: safeCharset });
    const id = requestId({ headers: { 'x-request-id': safeId } });
    assert.equal(id, safeId, `seed=${rng.seed} i=${i}`);
  }
});

// PBKDF2 is deliberately expensive (310k rounds), so this property runs far
// fewer iterations than the others above -- enough to be a meaningful fuzz,
// not so many that the suite becomes slow to run routinely.
test('property: password hash round-trips, and never verifies against a different random password', async () => {
  const rng = makeRng(778899);
  for (let i = 0; i < 5; i++) {
    const password = randomString(rng, { minLen: 1, maxLen: 30 });
    let other = randomString(rng, { minLen: 1, maxLen: 30 });
    if (other === password) other += '!';
    const hash = await hashPassword(password);
    assert.equal(await verifyPassword(password, hash), true, `seed=${rng.seed} i=${i}`);
    assert.equal(await verifyPassword(other, hash), false, `seed=${rng.seed} i=${i}`);
  }
});
