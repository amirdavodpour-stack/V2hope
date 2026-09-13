// Minimal, dependency-free property-based testing harness.
//
// Why hand-rolled instead of fast-check: this sandbox has no network access
// to install packages, and fast-check (or any PBT library) needs npm. This
// harness covers the core idea -- generate many random inputs, check an
// invariant holds for all of them, fail with a reproducible seed when it
// doesn't -- without needing to install anything. It intentionally skips
// fast-check's fancier features (automatic shrinking to a minimal
// counterexample, typed arbitraries); on failure it reports the seed and
// the exact failing input instead, which is enough to reproduce and debug.
//
// Swap this for fast-check once real npm access exists: `forAll` maps
// directly onto `fc.assert(fc.property(...))`, and the generators below
// map onto `fc.string()`/`fc.integer()`/etc.

function mulberry32(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0) {
  const next = mulberry32(seed);
  return {
    seed,
    next,
    int(min, max) { return min + Math.floor(next() * (max - min + 1)); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    bool() { return next() < 0.5; },
  };
}

const DEFAULT_CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !@#$%^&*()_+-=[]{}|;:\'",.<>?/~`\\\n\t\u0000\u0001\u200b\u{1F600}';

export function randomString(rng, { minLen = 0, maxLen = 24, charset = DEFAULT_CHARSET } = {}) {
  const chars = [...charset];
  const len = rng.int(minLen, maxLen);
  let out = '';
  for (let i = 0; i < len; i++) out += rng.pick(chars);
  return out;
}

export function randomInt(rng, min = -1000, max = 1000) { return rng.int(min, max); }

// Runs `predicate` against `runs` generated inputs. `predicate` should
// return `true` on success, or a string/false describing the failure.
// Throws with the seed and failing input on the first failure so a run can
// be reproduced exactly by hardcoding that seed.
export function forAll(rng, gen, predicate, { runs = 200, label = 'property' } = {}) {
  for (let i = 0; i < runs; i++) {
    const input = gen(rng);
    const result = predicate(input);
    if (result !== true) {
      const reason = typeof result === 'string' ? result : 'predicate returned falsy';
      throw new Error(
        `Property "${label}" failed on run ${i + 1}/${runs} (seed=${rng.seed}) ` +
        `-- reproduce with makeRng(${rng.seed}). Input: ${JSON.stringify(input)}. Reason: ${reason}`
      );
    }
  }
}
