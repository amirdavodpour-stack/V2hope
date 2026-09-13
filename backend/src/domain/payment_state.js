import { assertTransition } from './state_machine.js';

export const PAYMENT_TRANSITIONS = Object.freeze({
  HOLD_PENDING: ['HELD', 'HOLD_FAILED'],
  HELD: ['RELEASE_PENDING', 'REFUNDED'],
  RELEASE_PENDING: ['RELEASED', 'RELEASE_FAILED'],
  RELEASE_FAILED: ['RELEASE_PENDING'],
  RELEASED: [],
  REFUNDED: [],
  HOLD_FAILED: ['HOLD_PENDING'],
});

export function assertPaymentTransition(current, next) {
  return assertTransition({ entity: 'PAYMENT', current, next, transitions: PAYMENT_TRANSITIONS });
}
