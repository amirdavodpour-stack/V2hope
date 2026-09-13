import { notifyUserLegacy } from './legacy/notifications_legacy.js';
import * as repo from './repository.js';

export const NOTIFICATION_TYPES = Object.freeze({
  JOB_APPLICATION_RECEIVED: 'JOB_APPLICATION_RECEIVED',
  APPLICATION_SHORTLISTED: 'APPLICATION_SHORTLISTED',
  APPLICATION_FORWARDED: 'APPLICATION_FORWARDED',
  INTERVIEW_SCHEDULED: 'INTERVIEW_SCHEDULED',
  OFFER_RECEIVED: 'OFFER_RECEIVED',
  APPLICATION_ACCEPTED: 'APPLICATION_ACCEPTED',
  APPLICATION_REJECTED: 'APPLICATION_REJECTED',
  APPLICATION_WITHDRAWN: 'APPLICATION_WITHDRAWN',
  PAYMENT_UPDATE: 'PAYMENT_UPDATE',
  MISSION_UPDATE: 'MISSION_UPDATE',
});

export async function notifyUser({ userId, type, title, body, data = {}, dedupeKey = null, channels = ['IN_APP'] }) {
  if (!userId) return { created: false, reason: 'NO_RECIPIENT' };
  if (process.env.DATABASE_URL) {
    return repo.queueNotification({ userId, type, title, body, data, dedupeKey, channels });
  }
  return notifyUserLegacy({ userId, type, title, body, data, dedupeKey, channels });
}
