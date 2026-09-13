import { db } from '../db.js';
export function recordAnalyticsEventLegacy(event, dedupeKey = '') {
  if (dedupeKey && db.collection.analyticsEvents.some(x => x.dedupeKey === dedupeKey)) return { ...db.collection.analyticsEvents.find(x => x.dedupeKey === dedupeKey), created: false };
  event.dedupeKey = dedupeKey || null; db.insert('analyticsEvents', event); return { ...event, created: true };
}
export function recordCrashLegacy(crash) { db.insert('crashReports', crash); return crash; }
export function localProductFunnelSummaryLegacy(days = 30) {
  const d = Math.min(Math.max(Number(days) || 30, 1), 365), cutoff = Date.now() - d * 86400000;
  const rows = db.collection.analyticsEvents.filter(x => Date.parse(x.occurredAt) >= cutoff);
  const names = ['app_opened','signup_completed','profile_completed','search_viewed','opportunity_viewed','application_submitted','application_shortlisted','interview_scheduled','hire_completed','payment_completed'];
  const byEvent = {};
  for (const name of names) { const items = rows.filter(x => x.eventName === name); byEvent[name] = {events: items.length, users: new Set(items.map(x => x.userId).filter(Boolean)).size, anonymousUsers: new Set(items.map(x => x.anonymousId).filter(Boolean)).size}; }
  const funnel = names.map((name,i) => { const cur=byEvent[name], prev=i?byEvent[names[i-1]]:null; return {eventName:name,...cur,conversionFromPrevious:prev?.users?Number((cur.users/prev.users).toFixed(4)):null}; });
  const now=Date.now(), dau=new Set(db.collection.analyticsEvents.filter(x=>x.userId&&Date.parse(x.occurredAt)>=now-86400000).map(x=>x.userId)).size, mau=new Set(db.collection.analyticsEvents.filter(x=>x.userId&&Date.parse(x.occurredAt)>=now-30*86400000).map(x=>x.userId)).size;
  return {days:d,totalEvents:rows.length,funnel,byEvent,dau,mau,dauMauRatio:mau?Number((dau/mau).toFixed(4)):0};
}
