import { getPool, closePool } from './db/runtime.js';
import { runMigrations, migrationStatus, rollbackLastMigration } from './db/migrations.js';

if (!getPool()) throw new Error('DATABASE_URL is required for migrations');

const pool = getPool();
const client = await pool.connect();
try {
  const command = process.argv[2] || 'up';
  if (command === 'up') {
    const status = await runMigrations(client);
    for (const row of status) console.log(`${row.version}	${row.name}	${row.state}`);
  } else if (command === 'status') {
    const status = await migrationStatus(client);
    for (const row of status) console.log(`${row.version}	${row.name}	${row.state}`);
    if (status.some((row) => row.state === 'drifted')) process.exitCode = 2;
  } else if (command === 'down') {
    const row = await rollbackLastMigration(client);
    console.log(row ? `Rolled back ${row.version}_${row.name}` : 'No applied migrations');
  } else {
    throw new Error(`Unknown migration command: ${command}. Use up, status, or down.`);
  }
} finally {
  client.release();
  await closePool();
}
