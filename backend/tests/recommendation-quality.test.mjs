import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCandidateProfile, scoreRecommendation } from '../src/recommendation.js';

test('recommendation rewards fresh matching jobs and exposes components', () => {
  const profile=buildCandidateProfile([{skills:'Flutter Dart',categoryId:'tech',jobCity:'تهران',jobKind:'JOB',monthlySalary:50000}]);
  const result=scoreRecommendation({title:'Flutter engineer',description:'Dart',categoryId:'tech',city:'تهران',kind:'JOB',monthlySalary:51000,updatedAt:new Date().toISOString()},profile,{city:'تهران',seenCategories:new Set()});
  assert.ok(result.score >= 70);
  assert.equal(Object.keys(result.componentScores).length, 9);
});

test('repeated category is penalized for diversity', () => {
  const profile=buildCandidateProfile([]);
  const fresh=new Date().toISOString();
  const first=scoreRecommendation({title:'General',categoryId:'tech',city:'تهران',updatedAt:fresh},profile,{seenCategories:new Set(),city:'تهران'});
  const repeated=scoreRecommendation({title:'General',categoryId:'tech',city:'تهران',updatedAt:fresh},profile,{seenCategories:new Set(['tech']),city:'تهران'});
  assert.ok(repeated.score < first.score);
});
