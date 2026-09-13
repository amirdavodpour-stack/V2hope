/** Legacy-only notification persistence adapter. */
export function createNotificationLegacy({ db, now }) {
  const localPreferences = (userId) => {
    let p = db.collection.notificationPreferences.find(x => x.userId === userId);
    if (!p) {
      p = db.insert('notificationPreferences', { id: db.id(), userId, inApp: true, push: true, email: true, jobAlerts: true, applicationUpdates: true, paymentUpdates: true, marketing: false, updatedAt: now() });
      db.touch('notificationPreferences');
    }
    return p;
  };
  const listNotifications = (userId, limit=50, offset=0) => db.collection.notifications.filter(n => n.userId===userId).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(offset, offset+limit);
  const countUnreadNotifications = (userId) => db.collection.notifications.filter(n=>n.userId===userId&&!n.readAt).length;
  const markNotificationRead = async (id,userId) => { const n=db.collection.notifications.find(x=>x.id===id&&x.userId===userId); if(n){n.readAt=now();db.touch('notifications');await db.save();} return n || null; };
  const markAllNotificationsRead = async (userId) => { const items=db.collection.notifications.filter(n=>n.userId===userId&&!n.readAt); for(const n of items)n.readAt=now(); if(items.length){db.touch('notifications');await db.save();} return {updated:items.length}; };
  const updatePreferences = async (userId, patch) => { const p=localPreferences(userId); Object.assign(p,patch,{updatedAt:now()}); db.touch('notificationPreferences'); await db.save(); return p; };
  const registerNotificationDevice = async ({userId,platform,token}) => { let d=db.collection.notificationDevices.find(x=>x.token===token); if(d){if(d.userId!==userId){const e=new Error('Notification device token belongs to another user');e.code='NOTIFICATION_DEVICE_OWNERSHIP';throw e;} d.platform=platform;d.enabled=true;d.updatedAt=now();} else d=db.insert('notificationDevices',{id:db.id(),userId,platform,token,enabled:true,createdAt:now(),updatedAt:now()}); db.touch('notificationDevices');await db.save();return d; };
  const listNotificationDevices = (userId) => db.collection.notificationDevices.filter(x=>x.userId===userId&&x.enabled).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const disableNotificationDevice = async (id,userId) => { const d=db.collection.notificationDevices.find(x=>x.id===id&&x.userId===userId); if(!d)return null; d.enabled=false;d.updatedAt=now();db.touch('notificationDevices');await db.save();return d; };
  return { localPreferences, listNotifications, countUnreadNotifications, markNotificationRead, markAllNotificationsRead, updatePreferences, registerNotificationDevice, listNotificationDevices, disableNotificationDevice };
}
