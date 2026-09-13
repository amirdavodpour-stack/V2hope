import crypto from 'node:crypto';
import { URL } from 'node:url';

export function createNotificationRoutes({ authUser, repo, legacy, readBody, sendJson, HttpError, requireFields, enumField, textField }) {
  return async function notificationRoutes(req, res, parts) {
    const me = await authUser(req);
    if (req.method === 'GET' && parts.length === 1) {
      const limit = Math.min(Math.max(Number(new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams.get('limit') || 50), 1), 100);
      const offset = Math.max(Number(new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams.get('offset') || 0), 0);
      const items = process.env.DATABASE_URL ? await repo.listNotifications(me.id, limit, offset) : legacy.listNotifications(me.id, limit, offset);
      const unreadCount = process.env.DATABASE_URL ? await repo.countUnreadNotifications(me.id) : legacy.countUnreadNotifications(me.id);
      return sendJson(res, 200, { items, unreadCount });
    }
    if (req.method === 'POST' && parts[1] && parts[2] === 'read') {
      const item = process.env.DATABASE_URL ? await repo.markNotificationRead(parts[1], me.id) : await legacy.markNotificationRead(parts[1], me.id);
      if (!item) throw new HttpError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
      return sendJson(res, 200, item);
    }
    if (req.method === 'POST' && parts[1] === 'read-all') return sendJson(res,200,process.env.DATABASE_URL ? await repo.markAllNotificationsRead(me.id) : await legacy.markAllNotificationsRead(me.id));
    if (req.method === 'GET' && parts[1] === 'preferences') return sendJson(res,200,process.env.DATABASE_URL ? await repo.getNotificationPreferences(me.id) : legacy.localPreferences(me.id));
    if (req.method === 'PUT' && parts[1] === 'preferences') {
      const body=await readBody(req); const patch={}; for(const key of ['inApp','push','email','jobAlerts','applicationUpdates','paymentUpdates','marketing']) if(key in body) patch[key]=Boolean(body[key]);
      if (!Object.keys(patch).length) throw new HttpError(400,'INVALID_PREFERENCES','At least one preference is required');
      return sendJson(res,200,process.env.DATABASE_URL ? await repo.updateNotificationPreferences(me.id,patch) : await legacy.updatePreferences(me.id,patch));
    }
    if (req.method === 'POST' && parts[1] === 'devices') {
      const body=await readBody(req); requireFields(body,['platform','token']);
      const platform=enumField(body.platform,new Set(['ANDROID','IOS','WEB']),'platform'); const token=textField(body.token,'token',{min:10,max:2048,required:true});
      try { return sendJson(res,200,process.env.DATABASE_URL ? await repo.registerNotificationDevice({id:crypto.randomUUID(),userId:me.id,platform,token,enabled:true}) : await legacy.registerNotificationDevice({userId:me.id,platform,token})); }
      catch (error) { if(error?.code==='NOTIFICATION_DEVICE_OWNERSHIP') throw new HttpError(403,'FORBIDDEN','Notification device token belongs to another user'); throw error; }
    }
    if (req.method === 'GET' && parts[1] === 'devices') return sendJson(res,200,{items:process.env.DATABASE_URL ? await repo.listNotificationDevices(me.id) : legacy.listNotificationDevices(me.id)});
    if (req.method === 'DELETE' && parts[1] === 'devices' && parts[2]) {
      const id=parts[2]; const device=process.env.DATABASE_URL ? await repo.disableNotificationDevice(id,me.id) : await legacy.disableNotificationDevice(id,me.id);
      if(!device) throw new HttpError(404,'NOTIFICATION_DEVICE_NOT_FOUND','Notification device not found');
      return sendJson(res,200,{disabled:true,id:device.id});
    }
    throw new HttpError(404,'NOT_FOUND','Notification route not found');
  };
}
