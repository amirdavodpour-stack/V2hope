import { requirePool } from './context.js';

function analyticsEventFromRow(r) {
  return {id:r.id,eventName:r.event_name,userId:r.user_id||null,anonymousId:r.anonymous_id||null,sessionId:r.session_id||null,appVersion:r.app_version||null,platform:r.platform||null,properties:r.properties||{},occurredAt:r.occurred_at?.toISOString?.() ?? r.occurred_at,createdAt:r.created_at?.toISOString?.() ?? r.created_at};
}

function crashFromRow(r) {
  return {id:r.id,userId:r.user_id||null,anonymousId:r.anonymous_id||null,appVersion:r.app_version||null,platform:r.platform||null,releaseChannel:r.release_channel||null,fingerprint:r.fingerprint,message:r.message,stack:r.stack||null,context:r.context||{},occurredAt:r.occurred_at?.toISOString?.() ?? r.occurred_at,createdAt:r.created_at?.toISOString?.() ?? r.created_at};
}

export async function insertAnalyticsEvent(event, dedupeKey = '') {
  const { rows } = await requirePool().query(
    `INSERT INTO analytics_events(id,event_name,user_id,anonymous_id,session_id,app_version,platform,properties,dedupe_key,occurred_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11) ON CONFLICT(dedupe_key) DO UPDATE SET dedupe_key=EXCLUDED.dedupe_key RETURNING *`,
    [event.id,event.eventName,event.userId,event.anonymousId,event.sessionId,event.appVersion,event.platform,JSON.stringify(event.properties||{}),dedupeKey||null,event.occurredAt,event.createdAt],
  );
  return { ...analyticsEventFromRow(rows[0]), created: rows[0].id === event.id };
}

export async function insertCrashReport(c) {
  const {rows}=await requirePool().query(
    `INSERT INTO crash_reports(id,user_id,anonymous_id,app_version,platform,release_channel,fingerprint,message,stack,context,occurred_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12) RETURNING *`,
    [c.id,c.userId,c.anonymousId,c.appVersion,c.platform,c.releaseChannel,c.fingerprint,c.message,c.stack,JSON.stringify(c.context||{}),c.occurredAt,c.createdAt],
  );
  return crashFromRow(rows[0]);
}

export async function getProductFunnelSummary(days=30) {
  const d=Math.min(Math.max(Number(days)||30,1),365);
  const {rows}=await requirePool().query(`
    WITH base AS (
      SELECT event_name, COUNT(*)::int AS events,
             COUNT(DISTINCT user_id)::int AS users,
             COUNT(DISTINCT anonymous_id)::int AS anonymous_users
      FROM analytics_events
      WHERE occurred_at >= NOW() - ($1::int * INTERVAL '1 day')
      GROUP BY event_name
    ),
    activity AS (
      SELECT COUNT(DISTINCT user_id) FILTER (WHERE occurred_at >= NOW() - INTERVAL '1 day')::int AS dau,
             COUNT(DISTINCT user_id) FILTER (WHERE occurred_at >= NOW() - INTERVAL '30 days')::int AS mau
      FROM analytics_events
      WHERE user_id IS NOT NULL AND occurred_at >= NOW() - INTERVAL '30 days'
    )
    SELECT jsonb_agg(to_jsonb(base) ORDER BY base.events DESC) AS events, (SELECT row_to_json(activity) FROM activity) AS activity
    FROM base
  `,[d]);
  const events=Array.isArray(rows[0]?.events)?rows[0].events:[];
  const byEvent=Object.fromEntries(events.map(r=>[r.event_name,{events:Number(r.events||0),users:Number(r.users||0),anonymousUsers:Number(r.anonymous_users||0)}]));
  const stageNames=['app_opened','signup_completed','profile_completed','search_viewed','opportunity_viewed','application_submitted','application_shortlisted','interview_scheduled','hire_completed','payment_completed'];
  const funnel=stageNames.map((name,index)=>{
    const cur=byEvent[name]||{events:0,users:0};
    const prev=index===0?null:(byEvent[stageNames[index-1]]||{users:0});
    return {eventName:name,events:cur.events,users:cur.users,conversionFromPrevious:prev&&prev.users?Number((cur.users/prev.users).toFixed(4)):null};
  });
  const activity=rows[0]?.activity||{dau:0,mau:0};
  return {days:d,totalEvents:events.reduce((a,r)=>a+Number(r.events||0),0),funnel,byEvent,dau:Number(activity.dau||0),mau:Number(activity.mau||0),dauMauRatio:activity.mau?Number((Number(activity.dau||0)/Number(activity.mau)).toFixed(4)):0};
}

export async function getAnalyticsSummary(days=30) {
  const d=Math.min(Math.max(Number(days)||30,1),365);
  const {rows}=await requirePool().query(`SELECT event_name,COUNT(*)::int AS count,COUNT(DISTINCT user_id)::int AS users,
    (SELECT COUNT(DISTINCT user_id)::int FROM analytics_events WHERE occurred_at >= NOW() - ($1::int * INTERVAL '1 day')) AS unique_users
    FROM analytics_events WHERE occurred_at >= NOW() - ($1::int * INTERVAL '1 day') GROUP BY event_name ORDER BY count DESC`,[d]);
  const funnelNames=['app_install','signup_completed','profile_completed','search_viewed','opportunity_viewed','application_submitted','application_shortlisted','interview_scheduled','hire_completed','payment_completed'];
  const funnel=Object.fromEntries(funnelNames.map(n=>[n,rows.find(r=>r.event_name===n)?.count||0]));
  return {days:d,totalEvents:rows.reduce((a,r)=>a+Number(r.count||0),0),uniqueUsers:Number(rows[0]?.unique_users||0),byEvent:rows.map(r=>({eventName:r.event_name,count:Number(r.count),users:Number(r.users)})),funnel};
}

export async function getCrashSummary(days=30) {
  const d=Math.min(Math.max(Number(days)||30,1),365);
  const {rows}=await requirePool().query(`SELECT fingerprint,COUNT(*)::int AS count,MAX(occurred_at) AS last_seen FROM crash_reports WHERE occurred_at >= NOW() - ($1::int * INTERVAL '1 day') GROUP BY fingerprint ORDER BY count DESC LIMIT 100`,[d]);
  const {rows:tot}=await requirePool().query(`SELECT COUNT(*)::int AS total,COUNT(DISTINCT fingerprint)::int AS fingerprints FROM crash_reports WHERE occurred_at >= NOW() - ($1::int * INTERVAL '1 day')`,[d]);
  return {days:d,total:Number(tot[0]?.total||0),fingerprints:Number(tot[0]?.fingerprints||0),top:rows.map(r=>({fingerprint:r.fingerprint,count:Number(r.count),lastSeen:r.last_seen?.toISOString?.()??r.last_seen}))};
}
