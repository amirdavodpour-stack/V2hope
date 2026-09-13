import { config } from '../config.js';

const pg = config.databaseUrl ? await import('pg') : null;
const Pool = pg?.default?.Pool || pg?.Pool || null;

export const pool = config.databaseUrl
  ? new Pool({
      connectionString: config.databaseUrl,
      max: Number(config.pgPoolMax || 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: Math.min(Number(config.requestTimeoutMs || 15000), 5000),
      maxUses: 10000,
    })
  : null;

export function getPool() {
  return pool;
}

export async function withSqlTransaction(fn) {
  if (!pool) return fn(null);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function databaseHealth() {
  if (!pool) return { mode: 'file', status: 'ok' };
  const started = process.hrtime.bigint();
  try {
    const result = await pool.query({
      text: 'SELECT current_database() AS database',
      values: [],
      query_timeout: 2000,
    });
    const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
    return {
      mode: 'postgres',
      status: 'ok',
      database: result.rows[0].database,
      latencyMs: Number(latencyMs.toFixed(2)),
    };
  } catch (error) {
    const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
    return {
      mode: 'postgres',
      status: 'down',
      latencyMs: Number(latencyMs.toFixed(2)),
      errorCode: error?.code || 'DB_UNAVAILABLE',
    };
  }
}

export async function closePool() {
  if (pool) await pool.end();
}
