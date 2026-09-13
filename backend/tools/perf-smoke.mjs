#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const majorNodeVersion = Number(process.versions.node.split('.')[0]);
if (majorNodeVersion < 24) throw new Error(`Node 24+ required for performance certification; found ${process.versions.node}`);

const baseUrl = String(process.env.PERF_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const totalRequests = positiveInt(process.env.PERF_REQUESTS, 500);
const concurrency = positiveInt(process.env.PERF_CONCURRENCY, 50);
const p95BudgetMs = nonNegativeInt(process.env.PERF_P95_BUDGET_MS, 1000);
const p99BudgetMs = nonNegativeInt(process.env.PERF_P99_BUDGET_MS, 2000);
const max5xxRate = boundedNumber(process.env.PERF_MAX_5XX_RATE, 0.01, 0, 1);
const output = process.env.PERF_OUTPUT || path.resolve(process.cwd(), 'artifacts/perf/perf-smoke.json');
const endpoints = String(process.env.PERF_ENDPOINTS || '/live,/health,/api/v1/jobs').split(',').map((value) => value.trim()).filter(Boolean);
const minSuccessRate = boundedNumber(process.env.PERF_MIN_SUCCESS_RATE, 0.995, 0, 1);
if (!endpoints.length) throw new Error('PERF_ENDPOINTS must contain at least one endpoint');

function positiveInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}
function nonNegativeInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}
function boundedNumber(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}
function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[idx];
}

async function run() {
  const startedAt = new Date().toISOString();
  const latencies = [];
  let next = 0;
  let completed = 0;
  let ok = 0;
  let degraded = 0;
  let errors5xx = 0;
  let errors4xx = 0;
  const errors = [];

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= totalRequests) return;
      const endpoint = endpoints[index % endpoints.length];
      const t = performance.now();
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, { headers: { 'Cache-Control': 'no-cache' } });
        const latencyMs = performance.now() - t;
        latencies.push(latencyMs);
        completed += 1;
        if (response.status >= 500) errors5xx += 1;
        else if (response.status >= 400) errors4xx += 1;
        else if (response.status === 200) ok += 1;
        else degraded += 1;
      } catch (error) {
        const latencyMs = performance.now() - t;
        latencies.push(latencyMs);
        completed += 1;
        errors5xx += 1;
        if (errors.length < 20) errors.push({ endpoint, message: error?.message || String(error) });
      }
    }
  }

  const batchStarted = performance.now();
  await Promise.all(Array.from({ length: Math.min(concurrency, totalRequests) }, () => worker()));
  const elapsedMs = performance.now() - batchStarted;
  const p50 = percentile(latencies, 0.50);
  const p95 = percentile(latencies, 0.95);
  const p99 = percentile(latencies, 0.99);
  const rps = elapsedMs > 0 ? (completed / elapsedMs) * 1000 : 0;
  const errorRate5xx = completed ? errors5xx / completed : 1;
  const requireAllOk = String(process.env.PERF_REQUIRE_ALL_OK || '0') === '1';
  const successRate = completed ? ok / completed : 0;
  const passed = completed === totalRequests && p95 <= p95BudgetMs && p99 <= p99BudgetMs && errorRate5xx <= max5xxRate && successRate >= minSuccessRate && (!requireAllOk || errors4xx === 0 && degraded === 0 && errors5xx === 0);

  const report = {
    schemaVersion: 1,
    startedAt,
    finishedAt: new Date().toISOString(),
    target: baseUrl,
    workload: { totalRequests, concurrency, endpoints },
    thresholds: { p95BudgetMs, p99BudgetMs, max5xxRate, minSuccessRate, requireAllOk },
    results: {
      completed,
      ok,
      degraded,
      errors4xx,
      errors5xx,
      errorRate5xx: Number(errorRate5xx.toFixed(6)),
      successRate: Number(successRate.toFixed(6)),
      elapsedMs: Number(elapsedMs.toFixed(2)),
      requestsPerSecond: Number(rps.toFixed(2)),
      latencyMs: {
        p50: Number(p50.toFixed(2)),
        p95: Number(p95.toFixed(2)),
        p99: Number(p99.toFixed(2)),
        max: Number(Math.max(...latencies, 0).toFixed(2)),
      },
    },
    passed,
    errors,
  };

  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  if (!passed) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
