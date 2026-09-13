import { initDatabase, seedBaseData, db } from './db.js';

await initDatabase();
await seedBaseData();
await db.flush();
console.log('HOPE seed data initialized.');
await db.close();
