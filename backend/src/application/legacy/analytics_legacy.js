/** Legacy-only analytics aggregation adapter. */
export function createAnalyticsLegacy({ db }) {
  const crashSummary = (days) => ({ days, total: db.collection.crashReports.filter(x => Date.parse(x.occurredAt) >= Date.now() - days*86400000).length, fingerprints: new Set(db.collection.crashReports.map(x=>x.fingerprint)).size, top: [] });
  const analyticsSummary = (days) => ({ days, totalEvents: db.collection.analyticsEvents.filter(x => Date.parse(x.occurredAt) >= Date.now() - days*86400000).length, uniqueUsers: new Set(db.collection.analyticsEvents.map(x=>x.userId).filter(Boolean)).size, byEvent: [], funnel: {} });
  return { crashSummary, analyticsSummary };
}
