export const migration = {
  version: 4,
  name: 'saved_searches',
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_searches (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        query TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL DEFAULT 'ALL',
        visibility TEXT NOT NULL DEFAULT 'ALL',
        city TEXT NOT NULL DEFAULT 'AUTO',
        category TEXT NOT NULL DEFAULT 'ALL',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS saved_searches_user_name_uq
        ON saved_searches(user_id, lower(name));
      CREATE INDEX IF NOT EXISTS saved_searches_user_updated_idx
        ON saved_searches(user_id, updated_at DESC);
    `);
  },
  async down(client) {
    await client.query('DROP TABLE IF EXISTS saved_searches');
  },
};
