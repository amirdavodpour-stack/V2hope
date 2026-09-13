import { config } from './config.js';
import { claimOutboxEvent } from './repository.js';
import { processOutboxEvent } from './outbox_handlers.js';

let stopped = false;
let workers = [];
let generation = 0;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processOne() {
  if (stopped) return false;
  const event = await claimOutboxEvent(config.outboxLeaseSeconds);
  if (!event) return false;
  await processOutboxEvent(event);
  return true;
}

async function workerLoop(workerGeneration) {
  while (!stopped && generation === workerGeneration) {
    try {
      await processOne();
    } catch (error) {
      console.error('[outbox] worker error:', error.message);
    }
    if (!stopped && generation === workerGeneration) await delay(config.outboxPollMs);
  }
}

export function startOutboxWorker() {
  if (!process.env.DATABASE_URL) return { stop() {} };
  stopped = false;
  generation += 1;
  const currentGeneration = generation;
  workers = Array.from({ length: config.outboxWorkerConcurrency }, () => workerLoop(currentGeneration));
  return {
    stop() {
      stopped = true;
      generation += 1;
      workers = [];
    },
  };
}

export async function processPaymentReleaseNow() { return processOne(); }
export async function processPaymentCreateHoldNow() { return processOne(); }
export async function processPaymentRefundNow() { return processOne(); }
