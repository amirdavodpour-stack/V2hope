import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePaymentBreakdown, fundingJournal, releaseJournal, payoutJournal, refundJournal, assertBalanced } from '../src/financial.js';
import { buildCandidateProfile, scoreRecommendation, evaluateRecommendationRanking, RECOMMENDATION_WEIGHTS } from '../src/recommendation.js';

function rand(n) { return Math.floor(Math.random() * n) + 1; }

test('financial parser rejects zero, negative, excessive precision, scientific notation, and NaN-like values', () => {
  for (const value of ['0', '0.00', '-1', '1.001', '1e3', 'NaN', 'Infinity', '']) {
    assert.throws(() => calculatePaymentBreakdown('MISSION', value), /INVALID_AMOUNT/);
  }
});

test('financial journals balance for a deterministic corpus of valid cent values', () => {
  for (let i = 0; i < 100; i += 1) {
    const cents = rand(10_000_000);
    const amount = (cents / 100).toFixed(2);
    const b = calculatePaymentBreakdown(i % 2 ? 'JOB' : 'MISSION', amount);
    for (const journal of [fundingJournal(b), releaseJournal(b), payoutJournal(b), refundJournal(b)]) assert.equal(assertBalanced(journal), true);
    assert.ok(b.providerPayout >= 0);
    assert.ok(b.employerCharge >= b.baseAmount);
  }
});

test('recommendation weight table is a closed probability mass and scores remain bounded', () => {
  const total = Object.values(RECOMMENDATION_WEIGHTS).reduce((sum, value) => sum + value, 0);
  assert.equal(Number(total.toFixed(10)), 1);
  const profile = buildCandidateProfile([
    {skills: 'Flutter Dart', categoryId: 'c1', jobCity: 'Tehran', jobKind: 'JOB', workMode: 'REMOTE', monthlySalary: 1000},
    {skills: 'Dart APIs', categoryId: 'c1', jobCity: 'Tehran', jobKind: 'JOB', workMode: 'REMOTE', monthlySalary: 1200},
  ]);
  const job = {title: 'Flutter developer', description: 'Dart APIs', categoryId: 'c1', city: 'Tehran', kind: 'JOB', workMode: 'REMOTE', salaryMin: 900, salaryMax: 1500};
  const score = scoreRecommendation(job, profile, {});
  assert.ok(Number.isFinite(score.score));
  assert.ok(score.score >= 0 && score.score <= 100);
});

test('candidate profile is stable when duplicate and empty interactions are introduced', () => {
  const base = buildCandidateProfile([{skills: 'Dart Flutter', categoryId: 'c1', jobCity: 'Tehran', jobKind: 'JOB'}]);
  const noisy = buildCandidateProfile([{skills: 'Dart Flutter', categoryId: 'c1', jobCity: 'Tehran', jobKind: 'JOB'}, {}, {skills: ''}]);
  assert.deepEqual([...base.skills].sort(), [...noisy.skills].sort());
  assert.deepEqual(base.topCategories, noisy.topCategories);
  assert.deepEqual(base.topCities, noisy.topCities);
});

test('ranking evaluation returns deterministic top-level metrics for a fixed corpus', () => {
  const profile = buildCandidateProfile([{skills: 'python data', categoryId: 'data', jobCity: 'Tehran', jobKind: 'JOB'}]);
  const jobs = [
    {id: 'j1', title: 'Python Data', description: 'python data', categoryId: 'data', city: 'Tehran'},
    {id: 'j2', title: 'Design', description: 'figma design', categoryId: 'design', city: 'Shiraz'},
  ];
  const ranked = jobs.map((job) => ({...scoreRecommendation(job, profile, {}), ...job}));
  const result = evaluateRecommendationRanking(ranked, (item) => item.categoryId === 'data', 2);
  assert.deepEqual(Object.keys(result).sort(), ['hits', 'k', 'ndcgAtK', 'precisionAtK', 'reasonCoverage', 'recallAtK', 'totalRelevant'].sort());
  assert.equal(result.k, 2);
  assert.equal(result.hits, 1);
  assert.equal(result.precisionAtK, 0.5);
  assert.ok(result.ndcgAtK >= 0 && result.ndcgAtK <= 1);
});
