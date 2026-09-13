import { HttpError } from '../api/http_error.js';

// Pure geographic helpers for the recommendation route. Kept free of DI and
// framework state so they can be unit-tested in isolation.
export const CITY_COORDS = {
  'تهران':[35.6892,51.3890], 'مشهد':[36.2605,59.6168], 'اصفهان':[32.6546,51.6680],
  'شیراز':[29.5918,52.5837], 'تبریز':[38.0962,46.2738], 'کرج':[35.8400,50.9391],
  'قم':[34.6416,50.8746], 'اهواز':[31.3183,48.6706], 'رشت':[37.2808,49.5832],
  'کرمانشاه':[34.3142,47.0650], 'ارومیه':[37.5527,45.0761], 'یزد':[31.8974,54.3569],
  'کرمان':[30.2839,57.0834], 'ساری':[36.5659,53.0586], 'بندرعباس':[27.1832,56.2666],
  'همدان':[34.7988,48.5150],
};

export function haversineKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const a1 = lat1 * rad, a2 = lat2 * rad;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const h = Math.sin(dLat/2)**2 + Math.cos(a1) * Math.cos(a2) * Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1-h)));
}

export function parseCoordinate(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new HttpError(400, 'INVALID_COORDINATE', `${field} must be numeric`);
  const limit = field === 'lat' ? 90 : field === 'lng' ? 180 : null;
  if (limit !== null && Math.abs(n) > limit) {
    throw new HttpError(400, 'INVALID_COORDINATE', `${field} is out of range`);
  }
  return n;
}
