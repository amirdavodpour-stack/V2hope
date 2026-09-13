const TOKEN_RE = /[\p{L}\p{N}]+/gu;

export const RECOMMENDATION_VERSION = '2.3';

export const RECOMMENDATION_WEIGHTS = Object.freeze({
  skills: 0.20,
  category: 0.15,
  experience: 0.15,
  location: 0.10,
  workMode: 0.10,
  salary: 0.10,
  preference: 0.10,
  behavior: 0.05,
  freshness: 0.05,
});

const RECENCY_DECAY_DAYS = 90;

function recencyScore(value) {
  if (!value) return .5;
  const ageMs = Date.now() - Date.parse(value);
  if (!Number.isFinite(ageMs) || ageMs <= 0) return 1;
  const days = ageMs / 86400000;
  return Math.exp(-days / RECENCY_DECAY_DAYS);
}

function diversityPenalty(job, seen = new Set()) {
  const key = String(job.categoryId || job.category || 'unknown');
  return seen.has(key) ? 0.85 : 1;
}

function tokens(value) {
  return new Set((String(value || '').toLocaleLowerCase().match(TOKEN_RE) || []).filter(t => t.length >= 2));
}
function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let hit = 0; for (const x of a) if (b.has(x)) hit++;
  return Math.min(1, hit / Math.max(1, Math.min(a.size, 8)));
}
function clamp01(n) { return Math.max(0, Math.min(1, Number(n) || 0)); }

export function buildCandidateProfile(applications = []) {
  const skills = new Set();
  const categories = new Map();
  const cities = new Map();
  const kinds = new Map();
  const workModes = new Map();
  let salaryMin = null;
  let salaryMax = null;
  let total = 0;
  for (const a of applications) {
    total++;
    for (const t of tokens(a.skills)) skills.add(t);
    if (a.categoryId) categories.set(String(a.categoryId), (categories.get(String(a.categoryId)) || 0) + 1);
    if (a.jobCity) cities.set(String(a.jobCity), (cities.get(String(a.jobCity)) || 0) + 1);
    if (a.jobKind) kinds.set(String(a.jobKind), (kinds.get(String(a.jobKind)) || 0) + 1);
    if (a.workMode) workModes.set(String(a.workMode), (workModes.get(String(a.workMode)) || 0) + 1);
    const s = Number(a.monthlySalary);
    if (Number.isFinite(s) && s > 0) { salaryMin = salaryMin == null ? s : Math.min(salaryMin, s); salaryMax = salaryMax == null ? s : Math.max(salaryMax, s); }
  }
  const top = map => [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(x=>x[0]);
  return { skills, categories, cities, kinds, workModes, topCategories:top(categories), topCities:top(cities), topKinds:top(kinds), topWorkModes:top(workModes), salaryMin, salaryMax, interactionCount:total };
}

export function scoreRecommendation(job, profile, context = {}) {
  const reasons = [];
  const rawJobSkills = Array.isArray(job.skills) ? job.skills.join(' ') : (job.skills || job.attributes?.skills || '');
  const jobText = tokens(`${job.title || ''} ${job.description || ''} ${job.acceptanceCriteria || ''} ${rawJobSkills}`);
  const skillScore = overlap(profile?.skills || new Set(), jobText);
  let categoryScore = 0;
  if (job.categoryId && profile?.categories?.has(String(job.categoryId))) categoryScore = 1;
  let experienceScore = 0;
  const experienceTokens = tokens(job.experience || job.providerExperience || '');
  experienceScore = experienceTokens.size && profile?.skills ? overlap(profile.skills, experienceTokens) : 0;
  let locationScore = 0;
  let distanceKm = null;
  if (context.lat != null && context.lng != null && context.cityCoords?.[job.city]) {
    distanceKm = context.distanceFn(context.lat, context.lng, context.cityCoords[job.city][0], context.cityCoords[job.city][1]);
    locationScore = distanceKm <= 5 ? 1 : distanceKm <= 20 ? .85 : distanceKm <= 60 ? .60 : distanceKm <= 150 ? .25 : 0;
  } else if (context.city && job.city === context.city) locationScore = 1;
  else if (job.city === 'آنلاین') locationScore = .55;
  const preferredModes = profile?.workModes instanceof Map ? [...profile.workModes.keys()] : (Array.isArray(profile?.workModes) ? profile.workModes : []);
  const workModeScore = job.workMode ? (preferredModes.includes(String(job.workMode)) ? 1 : 0) : (job.city === 'آنلاین' ? .55 : .4);
  let salaryScore = .5;
  const budget = Number(job.monthlySalary || job.budgetMax || 0);
  if (budget > 0 && profile?.salaryMin != null) {
    const center = (profile.salaryMin + profile.salaryMax) / 2;
    salaryScore = 1 - Math.min(1, Math.abs(budget - center) / Math.max(center, 1));
  }
  const kindScore = profile?.kinds?.has(String(job.kind || 'JOB')) ? 1 : .5;
  const preferenceScore = context.categoryId && String(job.categoryId) === String(context.categoryId) ? 1 : categoryScore;
  const behaviorScore = Math.min(1, Number(profile?.interactionCount || 0) / 10) * .5 + kindScore * .5;
  const freshnessScore = recencyScore(job.updatedAt || job.publishedAt || job.createdAt);
  const diversityMultiplier = diversityPenalty(job, context.seenCategories);
  const scores = { skills:skillScore, category:categoryScore, experience:experienceScore, location:locationScore, workMode:workModeScore, salary:salaryScore, preference:preferenceScore, behavior:behaviorScore, freshness:freshnessScore };
  let score = Object.entries(RECOMMENDATION_WEIGHTS).reduce((sum,[k,w])=>sum+scores[k]*w,0) * 100 * diversityMultiplier;
  if (skillScore >= .5) reasons.push('SKILL_MATCH');
  if (categoryScore >= 1) reasons.push('CATEGORY_MATCH');
  if (locationScore >= .85) reasons.push(distanceKm != null && distanceKm <= 5 ? 'VERY_NEAR' : 'NEARBY');
  else if (job.city === 'آنلاین' && locationScore > 0) reasons.push('REMOTE');
  if (workModeScore >= .9) reasons.push('WORK_MODE_MATCH');
  if (salaryScore >= .8) reasons.push('SALARY_FIT');
  if (behaviorScore >= .7) reasons.push('BEHAVIOR_MATCH');
  if (preferenceScore >= .9 && categoryScore < 1) reasons.push('PREFERENCE_MATCH');
  if (!reasons.length) reasons.push('GENERAL_MATCH');
  const componentScores = {...Object.fromEntries(Object.entries(scores).map(([k,v])=>[k,Number((v*100).toFixed(1))]))};
  const scoreByComponents = Object.entries(RECOMMENDATION_WEIGHTS).reduce((sum,[k,w])=>sum + componentScores[k] * w, 0) * diversityMultiplier;
  if (Math.abs(score - scoreByComponents) > 0.05) throw new Error('Recommendation score invariant violated');
  return { version: RECOMMENDATION_VERSION, score:Number(score.toFixed(2)), distanceKm:distanceKm == null ? null : Number(distanceKm.toFixed(1)), reasons, componentScores };
}

export function evaluateRecommendationRanking(items = [], relevantFn = () => false, k = 10) {
  const top = items.slice(0, Math.max(1, Number(k) || 10));
  const relevant = top.map(relevantFn);
  const hits = relevant.filter(Boolean).length;
  const precisionAtK = Number((hits / Math.max(1, top.length)).toFixed(4));
  const totalRelevant = items.filter(relevantFn).length;
  const recallAtK = Number((hits / Math.max(1, totalRelevant)).toFixed(4));
  let dcg = 0;
  for (let i = 0; i < relevant.length; i++) if (relevant[i]) dcg += 1 / Math.log2(i + 2);
  const idealN = Math.min(top.length, totalRelevant);
  let idcg = 0;
  for (let i = 0; i < idealN; i++) idcg += 1 / Math.log2(i + 2);
  const ndcgAtK = Number((idcg ? dcg / idcg : 1).toFixed(4));
  const reasonCoverage = Number((top.filter(x => Array.isArray(x.recommendationReasons) && x.recommendationReasons.length > 0).length / Math.max(1, top.length)).toFixed(4));
  return { k: Math.max(1, Number(k) || 10), hits, totalRelevant, precisionAtK, recallAtK, ndcgAtK, reasonCoverage };
}
