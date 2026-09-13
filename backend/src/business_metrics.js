export const FUNNEL_EVENTS = Object.freeze([
  'app_opened','signup_completed','profile_completed','search_viewed',
  'opportunity_viewed','application_submitted','application_shortlisted',
  'interview_scheduled','hire_completed','payment_completed'
]);

export function businessHealth({ requests = 0, errors5xx = 0, requestDurationBuckets = {} } = {}) {
  const errorRate5xx = requests ? errors5xx / requests : 0;
  const total = Object.values(requestDurationBuckets).reduce((a, v) => a + Number(v || 0), 0);
  const slow = Number(requestDurationBuckets.gte500 || 0);
  const slowRate = total ? slow / total : 0;
  const alerts = [];
  if (errorRate5xx >= 0.02) alerts.push({ code:'HTTP_5XX_RATE_HIGH', severity:'critical', value:Number(errorRate5xx.toFixed(4)), threshold:0.02 });
  else if (errorRate5xx >= 0.01) alerts.push({ code:'HTTP_5XX_RATE_ELEVATED', severity:'warning', value:Number(errorRate5xx.toFixed(4)), threshold:0.01 });
  if (slowRate >= 0.20) alerts.push({ code:'SLOW_REQUEST_RATE_HIGH', severity:'warning', value:Number(slowRate.toFixed(4)), threshold:0.20 });
  return { errorRate5xx:Number(errorRate5xx.toFixed(4)), slowRequestRate:Number(slowRate.toFixed(4)), alerts: alerts.filter(Boolean) };
}
