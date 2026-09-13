import crypto from 'node:crypto';
import { withSqlTransaction } from '../db.js';
import { requirePool } from './context.js';

const notificationFromRow = (r) => ({
  id: r.id,
  userId: r.user_id,
  type: r.type,
  title: r.title,
  body: r.body,
  data: r.data || {},
  readAt: r.read_at ? (r.read_at.toISOString?.() ?? r.read_at) : null,
  createdAt: r.created_at?.toISOString?.() ?? r.created_at,
});

export async function ensureNotificationPreferences(userId) {
  const { rows } = await requirePool().query(`
    INSERT INTO notification_preferences(id,user_id) VALUES(gen_random_uuid(),$1)
    ON CONFLICT(user_id) DO UPDATE SET user_id=EXCLUDED.user_id
    RETURNING id,user_id,in_app,push,email,job_alerts,application_updates,payment_updates,marketing,updated_at
  `, [userId]);
  const r = rows[0];
  return {
    id:r.id,userId:r.user_id,inApp:r.in_app,push:r.push,email:r.email,jobAlerts:r.job_alerts,
    applicationUpdates:r.application_updates,paymentUpdates:r.payment_updates,marketing:r.marketing,
    updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at,
  };
}

export async function getNotificationPreferences(userId) { return ensureNotificationPreferences(userId); }

export async function updateNotificationPreferences(userId, patch) {
  const current = await ensureNotificationPreferences(userId);
  const next = {...current, ...patch};
  const { rows } = await requirePool().query(
    `UPDATE notification_preferences SET in_app=$2,push=$3,email=$4,job_alerts=$5,application_updates=$6,payment_updates=$7,marketing=$8,updated_at=NOW() WHERE user_id=$1 RETURNING id,user_id,in_app,push,email,job_alerts,application_updates,payment_updates,marketing,updated_at`,
    [userId,!!next.inApp,!!next.push,!!next.email,!!next.jobAlerts,!!next.applicationUpdates,!!next.paymentUpdates,!!next.marketing],
  );
  return ensureNotificationPreferencesFromRow(rows[0]);
}

function ensureNotificationPreferencesFromRow(r) {
  return {
    id:r.id,userId:r.user_id,inApp:r.in_app,push:r.push,email:r.email,jobAlerts:r.job_alerts,
    applicationUpdates:r.application_updates,paymentUpdates:r.payment_updates,marketing:r.marketing,
    updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at,
  };
}

export async function listNotifications(userId, limit=50, offset=0) {
  const {rows} = await requirePool().query(
    `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [userId,Math.min(Math.max(Number(limit)||50,1),100),Math.max(Number(offset)||0,0)],
  );
  return rows.map(notificationFromRow);
}

export async function markNotificationRead(id,userId) {
  const {rows} = await requirePool().query(
    `UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=$1 AND user_id=$2 RETURNING *`,
    [id,userId],
  );
  return rows[0] ? notificationFromRow(rows[0]) : null;
}

export async function markAllNotificationsRead(userId) {
  const {rowCount}=await requirePool().query(
    `UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=$1 AND read_at IS NULL`, [userId],
  );
  return {updated:rowCount};
}

export async function countUnreadNotifications(userId) {
  const {rows}=await requirePool().query(
    `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id=$1 AND read_at IS NULL`, [userId],
  );
  return Number(rows[0]?.count||0);
}

export async function registerNotificationDevice({id,userId,platform,token,enabled=true}) {
  return withSqlTransaction(async(client)=>{
    const {rows:existingRows}=await client.query(`SELECT * FROM notification_devices WHERE token=$1 FOR UPDATE`,[token]);
    const existing=existingRows[0];
    if(existing && existing.user_id !== userId){
      const error=new Error('Notification device token belongs to another user');
      error.code='NOTIFICATION_DEVICE_OWNERSHIP';
      throw error;
    }
    const {rows}=existing
      ? await client.query(`UPDATE notification_devices SET platform=$2,enabled=$3,updated_at=NOW() WHERE id=$1 RETURNING *`,[existing.id,platform,enabled])
      : await client.query(`INSERT INTO notification_devices(id,user_id,platform,token,enabled) VALUES($1,$2,$3,$4,$5) RETURNING *`,[id,userId,platform,token,enabled]);
    const r=rows[0];
    return {id:r.id,userId:r.user_id,platform:r.platform,token:r.token,enabled:r.enabled,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at};
  });
}

export async function listNotificationDevices(userId) {
  const {rows}=await requirePool().query(
    `SELECT id,user_id,platform,token,enabled,created_at,updated_at FROM notification_devices WHERE user_id=$1 AND enabled=true ORDER BY updated_at DESC`, [userId],
  );
  return rows.map(r=>({id:r.id,userId:r.user_id,platform:r.platform,token:r.token,enabled:r.enabled,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at}));
}

export async function getUserEmail(userId) {
  const {rows}=await requirePool().query(`SELECT email FROM users WHERE id=$1 LIMIT 1`,[userId]);
  return rows[0]?.email || null;
}

export async function disableNotificationDevice(id,userId) {
  const {rows}=await requirePool().query(`UPDATE notification_devices SET enabled=false,updated_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *`,[id,userId]);
  const r=rows[0];
  return r?{id:r.id,userId:r.user_id,platform:r.platform,token:r.token,enabled:r.enabled,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at}:null;
}

export async function queueNotification({userId,type,title,body,data={},dedupeKey=null,channels=['IN_APP']}) {
  const id=crypto.randomUUID();
  return withSqlTransaction(async(client)=>{
    if(dedupeKey){
      const {rows:existing}=await client.query(`SELECT * FROM notifications WHERE user_id=$1 AND (data->>'dedupeKey')=$2 ORDER BY created_at DESC LIMIT 1`,[userId,dedupeKey]);
      if(existing[0]) return {notification:notificationFromRow(existing[0]),created:false};
    }
    const payload={...data,dedupeKey:dedupeKey||undefined,channels};
    const {rows}=await client.query(`INSERT INTO notifications(id,user_id,type,title,body,data,created_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,NOW()) RETURNING *`,[id,userId,type,title,body,JSON.stringify(payload)]);
    const notifyChannels=Array.from(new Set(channels));
    for(const ch of notifyChannels.filter(Boolean)){
      const eventId=crypto.randomUUID();
      await client.query(`INSERT INTO outbox_events(id,event_type,aggregate_type,aggregate_id,dedupe_key,payload,status,attempts,available_at,created_at) VALUES($1,'NOTIFICATION_DISPATCH','notification',$2,$3,$4::jsonb,'PENDING',0,NOW(),NOW()) ON CONFLICT(dedupe_key) DO NOTHING`,[eventId,id,`NOTIFICATION:${id}:${ch}`,JSON.stringify({notificationId:id,userId,type,channel:ch,title,body,data})]);
    }
    return {notification:notificationFromRow(rows[0]),created:true};
  });
}
