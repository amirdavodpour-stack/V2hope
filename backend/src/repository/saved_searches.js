import crypto from 'node:crypto';
import { requirePool } from './context.js';

const fromRow = (r) => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  query: r.query || '',
  kind: r.kind || 'ALL',
  visibility: r.visibility || 'ALL',
  city: r.city || 'AUTO',
  category: r.category || 'ALL',
  updatedAt: r.updated_at?.toISOString?.() ?? r.updated_at,
  createdAt: r.created_at?.toISOString?.() ?? r.created_at,
});

export async function listSavedSearches(userId) {
  const { rows } = await requirePool().query(
    `SELECT * FROM saved_searches WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 20`,
    [userId],
  );
  return rows.map(fromRow);
}

export async function upsertSavedSearch(userId, search) {
  const id = search.id || crypto.randomUUID();
  const { rows } = await requirePool().query(
    `INSERT INTO saved_searches(id,user_id,name,query,kind,visibility,city,category,updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW())
     ON CONFLICT(user_id, lower(name)) DO UPDATE SET
       query=EXCLUDED.query, kind=EXCLUDED.kind, visibility=EXCLUDED.visibility,
       city=EXCLUDED.city, category=EXCLUDED.category, updated_at=NOW()
     RETURNING *`,
    [id,userId,String(search.name).trim(),search.query||'',search.kind||'ALL',search.visibility||'ALL',search.city||'AUTO',search.category||'ALL'],
  );
  await requirePool().query(`
    DELETE FROM saved_searches
    WHERE user_id=$1 AND id NOT IN (
      SELECT id FROM saved_searches WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 20
    )`, [userId]);
  return fromRow(rows[0]);
}

export async function deleteSavedSearch(userId, id) {
  const { rowCount } = await requirePool().query(
    `DELETE FROM saved_searches WHERE id=$1 AND user_id=$2`, [id,userId],
  );
  return { deleted: rowCount > 0, id };
}
