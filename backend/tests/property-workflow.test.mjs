import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, assertTransition, JOB_STATES } from '../src/workflow.js';
import { makeRng } from './lib/pbt.mjs';

const STATES = Object.values(JOB_STATES);

// The job lifecycle is a strict pipeline (with two small branches: ASSIGNED
// vs FUNDED after PUBLISHED, and COMPLETED vs UNDER_REVIEW after DELIVERED).
// This ordering encodes "how far along the pipeline" each state is. It is
// itself a *test fixture*, independent of workflow.js's own transition
// table, so this test can catch a future contributor accidentally wiring a
// backward or self-referential edge into that table without also having to
// duplicate the table verbatim (which would just test the code against
// itself).
const PIPELINE_ORDER = {
  DRAFT: 0, PUBLISHED: 1, ASSIGNED: 2, FUNDED: 3, IN_PROGRESS: 4,
  DELIVERED: 5, UNDER_REVIEW: 6, COMPLETED: 7, SETTLED: 8,
};

test('every state pair: transitions never move backward in the pipeline', () => {
  for (const from of STATES) {
    for (const to of STATES) {
      if (canTransition(from, to)) {
        assert.ok(
          PIPELINE_ORDER[to] > PIPELINE_ORDER[from],
          `${from} -> ${to} is allowed but does not move forward in the pipeline`
        );
      }
    }
  }
});

test('every state pair: no state can transition to itself', () => {
  for (const s of STATES) {
    assert.equal(canTransition(s, s), false, `${s} -> ${s} should never be allowed`);
  }
});

test('SETTLED is terminal: no outgoing transitions', () => {
  for (const to of STATES) {
    assert.equal(canTransition('SETTLED', to), false);
  }
});

test('DRAFT is the only unreachable-from-elsewhere entry point', () => {
  for (const from of STATES) {
    if (from === 'DRAFT') continue;
    assert.equal(canTransition(from, 'DRAFT'), false, `${from} -> DRAFT should never be allowed`);
  }
});

test('property: assertTransition throws iff none of the allowed targets are reachable from "from"', () => {
  const rng = makeRng(20260827);
  const randomTargetList = () => {
    const n = rng.int(1, 3);
    return Array.from({ length: n }, () => rng.pick(STATES));
  };
  for (let i = 0; i < 300; i++) {
    const from = rng.pick(STATES);
    const targets = randomTargetList();
    const shouldSucceed = targets.some((t) => canTransition(from, t));
    if (shouldSucceed) {
      assert.doesNotThrow(() => assertTransition(from, targets), `seed=${rng.seed} from=${from} targets=${targets}`);
    } else {
      assert.throws(() => assertTransition(from, targets), /INVALID_JOB_STATE|Invalid job state/, `seed=${rng.seed} from=${from} targets=${targets}`);
    }
  }
});

test('property: canTransition never throws regardless of input shape (fuzzed garbage states)', () => {
  const rng = makeRng(998877);
  const garbage = [null, undefined, '', 0, {}, [], 'DRAFT ', 'draft', Symbol('x'), 12345, () => {}];
  for (let i = 0; i < 200; i++) {
    const from = rng.pick([...STATES, ...garbage]);
    const to = rng.pick([...STATES, ...garbage]);
    assert.doesNotThrow(() => canTransition(from, to), `seed=${rng.seed} from=${String(from)} to=${String(to)}`);
  }
});
