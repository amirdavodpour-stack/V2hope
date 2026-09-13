import { getPool } from '../db.js';

export function requirePool() {
  const pool = getPool();
  if (!pool) throw new Error('SQL repository requires PostgreSQL');
  return pool;
}
