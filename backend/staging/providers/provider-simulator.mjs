import https from 'node:https';
import fs from 'node:fs';
import crypto from 'node:crypto';

const port = Number(process.env.PORT || 3443);
const cert = process.env.CERT_FILE || '/run/secrets/tls-cert.pem';
const key = process.env.KEY_FILE || '/run/secrets/tls-key.pem';
const state = new Map();
const acceptedTokens = new Set([
  process.env.PAYMENT_PROVIDER_TOKEN || 'local-staging-payment-token-0123456789',
  process.env.NOTIFICATION_PROVIDER_TOKEN || 'local-staging-notify-token-0123456789',
]);

function body(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 256 * 1024) reject(new Error('BODY_TOO_LARGE')); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
function json(res, status, payload) {
  res.writeHead(status, {'content-type':'application/json'});
  res.end(JSON.stringify(payload));
}
const server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, {error:'method_not_allowed'});
  const auth = String(req.headers.authorization || '');
  if (!acceptedTokens.has(auth.startsWith('Bearer ') ? auth.slice(7) : '')) return json(res, 401, {error:'unauthorized'});
  const raw = await body(req);
  let payload;
  try { payload = JSON.parse(raw || '{}'); } catch { return json(res, 400, {error:'invalid_json'}); }
  const idem = req.headers['idempotency-key'] || crypto.createHash('sha256').update(raw).digest('hex');
  if (state.has(idem)) return json(res, 200, state.get(idem));
  const path = new URL(req.url, 'https://localhost').pathname;
  let response;
  if (path.endsWith('/create')) response = {status:'HELD', providerRef:`sim-hold-${idem}`};
  else if (path.endsWith('/release')) response = {status:'RELEASED'};
  else if (path.endsWith('/refund')) response = {status:'REFUNDED', refundRef:`sim-refund-${idem}`};
  else if (path.endsWith('/push') || path.endsWith('/email')) response = {delivered:true};
  else return json(res, 404, {error:'not_found'});
  state.set(idem, response);
  return json(res, 200, response);
});
server.listen(port, '0.0.0.0');
