import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCandidateProfile, scoreRecommendation, evaluateRecommendationRanking, RECOMMENDATION_WEIGHTS, RECOMMENDATION_VERSION } from '../src/recommendation.js';

test('recommendation weights are explicit and sum to 1', () => {
  assert.equal(Object.values(RECOMMENDATION_WEIGHTS).reduce((a,b)=>a+b,0), 1);
});

test('candidate profile learns skills, categories, cities and salary from applications', () => {
  const p=buildCandidateProfile([{skills:'Flutter, Dart, mobile',categoryId:'tech',jobCity:'تهران',jobKind:'JOB',monthlySalary:'50000'},{skills:'Dart UI',categoryId:'tech',jobCity:'تهران',jobKind:'JOB',monthlySalary:'60000'}]);
  assert.ok(p.skills.has('dart')); assert.deepEqual(p.topCategories,['tech']); assert.deepEqual(p.topCities,['تهران']); assert.equal(p.salaryMin,50000); assert.equal(p.salaryMax,60000);
});

test('personalized scoring rewards skill/category/location fit and exposes components', () => {
  const p=buildCandidateProfile([{skills:'Flutter Dart mobile',categoryId:'tech',jobCity:'تهران',jobKind:'JOB',monthlySalary:'50000'}]);
  const score=scoreRecommendation({title:'Flutter mobile engineer',description:'Dart app',categoryId:'tech',city:'تهران',kind:'JOB',monthlySalary:52000},p,{city:'تهران'});
  assert.ok(score.score>60); assert.ok(score.reasons.includes('SKILL_MATCH')); assert.ok(score.reasons.includes('CATEGORY_MATCH')); assert.ok(score.reasons.includes('WORK_MODE_MATCH') || score.reasons.includes('SALARY_FIT')); assert.equal(Object.keys(score.componentScores).length,9);
});


test('recommendation output carries a stable version and bounded components', () => {
  const p=buildCandidateProfile([]);
  const result=scoreRecommendation({title:'General',description:'',categoryId:'tech',city:'تهران',kind:'JOB'},p,{city:'تهران'});
  assert.equal(result.version, RECOMMENDATION_VERSION);
  for (const value of Object.values(result.componentScores)) assert.ok(value >= 0 && value <= 100);
});

test('recommendation ranking evaluator reports precision, recall and ndcg', () => {
  const result=evaluateRecommendationRanking([
    {id:'1',relevant:true,recommendationReasons:['CATEGORY_MATCH']},
    {id:'2',relevant:false,recommendationReasons:['GENERAL_MATCH']},
    {id:'3',relevant:true,recommendationReasons:['SKILL_MATCH']},
  ], item => item.relevant, 3);
  assert.equal(result.hits,2);
  assert.equal(result.totalRelevant,2);
  assert.equal(result.precisionAtK,0.6667);
  assert.equal(result.recallAtK,1);
  assert.ok(result.ndcgAtK > 0.8);
  assert.equal(result.reasonCoverage,1);
});


test("freshness is a scored recommendation component and older jobs score lower", () => {
  const p=buildCandidateProfile([{skills:"Flutter",categoryId:"tech",jobCity:"تهران",jobKind:"JOB",monthlySalary:50000}]);
  const now=new Date();
  const fresh=scoreRecommendation({title:"Flutter",categoryId:"tech",city:"تهران",kind:"JOB",monthlySalary:50000,updatedAt:now.toISOString()},p,{city:"تهران"});
  const old=scoreRecommendation({title:"Flutter",categoryId:"tech",city:"تهران",kind:"JOB",monthlySalary:50000,updatedAt:new Date(now.getTime()-90*86400000).toISOString()},p,{city:"تهران"});
  assert.ok(fresh.componentScores.freshness > old.componentScores.freshness);
  assert.ok(fresh.score > old.score);
});

test('candidate profile preserves work-mode preference and job skill arrays affect fit', () => {
  const p = buildCandidateProfile([
    {skills:'Flutter', categoryId:'tech', jobCity:'Tehran', jobKind:'JOB', workMode:'REMOTE'},
    {skills:'Dart', categoryId:'tech', jobCity:'Tehran', jobKind:'JOB', workMode:'REMOTE'},
  ]);
  assert.ok(p.workModes instanceof Map);
  assert.equal(p.workModes.get('REMOTE'), 2);
  const remote = scoreRecommendation({title:'Developer',description:'',skills:['Flutter'],categoryId:'tech',city:'Tehran',kind:'JOB',workMode:'REMOTE'}, p, {city:'Tehran'});
  const office = scoreRecommendation({title:'Developer',description:'',skills:['Flutter'],categoryId:'tech',city:'Tehran',kind:'JOB',workMode:'ONSITE'}, p, {city:'Tehran'});
  assert.equal(remote.componentScores.workMode, 100);
  assert.ok(remote.score > office.score);
});
