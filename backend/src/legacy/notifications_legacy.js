import { db } from '../db.js';
function localPrefs(userId) {
  let p = db.collection.notificationPreferences.find(x => x.userId === userId);
  if (!p) { p = { id: db.id(), userId, inApp: true, push: true, email: true, jobAlerts: true, applicationUpdates: true, paymentUpdates: true, marketing: false, updatedAt: new Date().toISOString() }; db.insert('notificationPreferences', p); }
  return p;
}
export async function notifyUserLegacy({ userId, type, title, body, data = {}, dedupeKey = null, channels = ['IN_APP'] }) {
  const prefs = localPrefs(userId);
  const allowed = channels.filter(channel => channel === 'IN_APP' ? prefs.inApp : channel === 'PUSH' ? prefs.push : channel === 'EMAIL' ? prefs.email : false);
  if (!allowed.length) return { created: false, reason: 'CHANNEL_DISABLED' };
  const duplicate = dedupeKey && db.collection.notifications.find(n => n.userId === userId && n.data?.dedupeKey === dedupeKey);
  if (duplicate) return { notification: duplicate, created: false };
  const notification = db.insert('notifications', { id: db.id(), userId, type, title, body, data: { ...data, dedupeKey, channels: allowed }, readAt: null, createdAt: new Date().toISOString() });
  db.touch('notifications'); await db.save();
  return { notification, created: true };
}
