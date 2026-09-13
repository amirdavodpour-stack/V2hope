/**
 * Pure reconciliation helpers. These deliberately do not know about HTTP or DB.
 * They normalize amounts to fixed precision before comparing provider/internal data.
 */

function cents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function reconcileSettlement(internal, provider) {
  const issues = [];
  if (!internal) return {status:'MISSING_INTERNAL', issues:['INTERNAL_SETTLEMENT_MISSING']};
  if (!provider) return {status:'MISSING_PROVIDER', issues:['PROVIDER_SETTLEMENT_MISSING']};
  if (String(internal.paymentId) !== String(provider.paymentId)) issues.push('PAYMENT_ID_MISMATCH');
  if (cents(internal.amount) !== cents(provider.amount)) issues.push('AMOUNT_MISMATCH');
  if (String(internal.currency || '') !== String(provider.currency || '')) issues.push('CURRENCY_MISMATCH');
  if (String(internal.status || '').toUpperCase() !== String(provider.status || '').toUpperCase()) issues.push('STATUS_MISMATCH');
  if (provider.providerRef && internal.providerRef && String(provider.providerRef) !== String(internal.providerRef)) issues.push('PROVIDER_REF_MISMATCH');
  return {status: issues.length ? 'MISMATCH' : 'MATCH', issues};
}

export function reconcileBatch(internalRows, providerRows) {
  const internal = new Map((internalRows || []).map(row => [String(row.paymentId), row]));
  const provider = new Map((providerRows || []).map(row => [String(row.paymentId), row]));
  const ids = new Set([...internal.keys(), ...provider.keys()]);
  const results = [];
  for (const paymentId of ids) results.push({paymentId, ...reconcileSettlement(internal.get(paymentId), provider.get(paymentId))});
  const mismatches = results.filter(x => x.status !== 'MATCH');
  return {total:results.length, matched:results.length - mismatches.length, mismatches};
}
