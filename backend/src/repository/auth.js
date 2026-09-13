import { withSqlTransaction } from '../db.js';
import { requirePool } from './context.js';
import { userFromRow } from './mappers.js';

const userSelect = `id,email,password_hash,password_hash AS "passwordHash",display_name AS "displayName",role,status,session_version,created_at AS "createdAt"`;
export async function insertRefreshToken(token) {
  const { rows } = await requirePool().query(`INSERT INTO refresh_tokens(id,user_id,token_hash,family_id,expires_at,created_at,revoked_at,replaced_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [token.id,token.userId,token.tokenHash,token.familyId,token.expiresAt,token.createdAt,token.revokedAt,token.replacedBy]);
  return { id:rows[0].id, userId:rows[0].user_id, tokenHash:rows[0].token_hash, familyId:rows[0].family_id, expiresAt:rows[0].expires_at?.toISOString?.() ?? rows[0].expires_at, createdAt:rows[0].created_at?.toISOString?.() ?? rows[0].created_at, revokedAt:rows[0].revoked_at ? (rows[0].revoked_at.toISOString?.() ?? rows[0].revoked_at) : null, replacedBy:rows[0].replaced_by };
}
export async function findRefreshTokenByHash(tokenHash) {
  const { rows } = await requirePool().query(`SELECT * FROM refresh_tokens WHERE token_hash=$1`, [tokenHash]);
  const r=rows[0];
  return r ? { id:r.id,userId:r.user_id,tokenHash:r.token_hash,familyId:r.family_id,expiresAt:r.expires_at?.toISOString?.() ?? r.expires_at,createdAt:r.created_at?.toISOString?.() ?? r.created_at,revokedAt:r.revoked_at ? (r.revoked_at.toISOString?.() ?? r.revoked_at) : null,replacedBy:r.replaced_by } : null;
}
export async function rotateRefreshToken(oldHash, nextToken, familyId) {
  return withSqlTransaction(async (client)=>{
    const {rows}=await client.query(`SELECT * FROM refresh_tokens WHERE token_hash=$1 FOR UPDATE`,[oldHash]);
    const r=rows[0];
    if(!r) return {kind:'invalid'};
    if(r.revoked_at){
      await client.query(`UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,NOW()) WHERE family_id=$1 AND revoked_at IS NULL`,[r.family_id]);
      return {kind:'reuse'};
    }
    if(new Date(r.expires_at).getTime()<=Date.now()) return {kind:'invalid'};
    const {rows:users}=await client.query(`SELECT ${userSelect} FROM users WHERE id=$1`,[r.user_id]);
    const user=users[0]?userFromRow(users[0]):null;
    if(!user) return {kind:'invalid'};
    await client.query(`UPDATE refresh_tokens SET revoked_at=NOW(), replaced_by=$2 WHERE id=$1`,[r.id,nextToken.tokenHash]);
    const {rows:created}=await client.query(`INSERT INTO refresh_tokens(id,user_id,token_hash,family_id,expires_at,created_at,revoked_at,replaced_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[nextToken.id,user.id,nextToken.tokenHash,familyId,nextToken.expiresAt,nextToken.createdAt,null,null]);
    return {kind:'ok',user,token:{id:created[0].id,userId:created[0].user_id,tokenHash:created[0].token_hash,familyId:created[0].family_id,expiresAt:created[0].expires_at?.toISOString?.() ?? created[0].expires_at,createdAt:created[0].created_at?.toISOString?.() ?? created[0].created_at,revokedAt:null,replacedBy:null}};
  });
}
export async function revokeRefreshFamily(familyId) {
  await requirePool().query(`UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,NOW()) WHERE family_id=$1 AND revoked_at IS NULL`,[familyId]);
}
export async function updatePasswordHash(userId, passwordHash) {
  const { rows } = await requirePool().query(`UPDATE users SET password_hash=$2 WHERE id=$1 RETURNING id`, [userId, passwordHash]);
  return Boolean(rows[0]);
}
export async function bumpUserSessionVersion(userId) {
  const { rows } = await requirePool().query(`UPDATE users SET session_version=session_version+1 WHERE id=$1 RETURNING session_version`, [userId]);
  return rows[0] ? Number(rows[0].session_version) : null;
}

export async function revokeUserRefreshTokens(userId) {
  await requirePool().query(`UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=$1 AND revoked_at IS NULL`,[userId]);
}
export async function insertResetToken(token) {
  const {rows}=await requirePool().query(`INSERT INTO reset_tokens(id,user_id,token_hash,family_id,expires_at,used_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[token.id,token.userId,token.tokenHash,token.familyId,token.expiresAt,null,token.createdAt]);
  return rows[0];
}
export async function findResetTokenForUse(tokenHash) {
  return withSqlTransaction(async(client)=>{
    const {rows}=await client.query(`SELECT * FROM reset_tokens WHERE token_hash=$1 FOR UPDATE`,[tokenHash]);
    const r=rows[0]; if(!r || r.used_at || new Date(r.expires_at).getTime()<=Date.now()) return null;
    const {rows:u}=await client.query(`SELECT ${userSelect} FROM users WHERE id=$1`,[r.user_id]);
    return u[0]?{token:{id:r.id,userId:r.user_id,tokenHash:r.token_hash,expiresAt:r.expires_at?.toISOString?.() ?? r.expires_at,familyId:r.family_id},user:userFromRow(u[0])}:null;
  });
}
export async function consumeResetTokenAndChangePassword(tokenId,userId,passwordHash) {
  return withSqlTransaction(async(client)=>{
    const {rows}=await client.query(`UPDATE reset_tokens SET used_at=NOW() WHERE id=$1 AND user_id=$2 AND used_at IS NULL RETURNING id`,[tokenId,userId]);
    if(!rows[0]) return false;
    await client.query(`UPDATE users SET password_hash=$2,session_version=session_version+1 WHERE id=$1`,[userId,passwordHash]);
    await client.query(`UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=$1 AND revoked_at IS NULL`,[userId]);
    return true;
  });
}
export async function findProviderByUserId(userId) {
  const {rows}=await requirePool().query(`SELECT * FROM providers WHERE user_id=$1`,[userId]);
  const r=rows[0]; return r?{id:r.id,userId:r.user_id,providerType:r.provider_type,capacity:r.capacity,verificationStatus:r.verification_status,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at}:null;
}
export async function upsertProvider(provider) {
  const {rows}=await requirePool().query(`INSERT INTO providers(id,user_id,provider_type,capacity,verification_status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id) DO UPDATE SET provider_type=EXCLUDED.provider_type,capacity=EXCLUDED.capacity,verification_status=EXCLUDED.verification_status,updated_at=EXCLUDED.updated_at RETURNING *`,[provider.id,provider.userId,provider.providerType,provider.capacity,provider.verificationStatus,provider.createdAt,provider.updatedAt]);
  const r=rows[0]; return {id:r.id,userId:r.user_id,providerType:r.provider_type,capacity:r.capacity,verificationStatus:r.verification_status,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at};
}
