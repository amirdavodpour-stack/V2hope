export const migration = {
  version: 2,
  name: 'query_indexes',
  async up(client) {
    await client.query(`
      CREATE INDEX IF NOT EXISTS jobs_status_created_idx ON jobs(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS offers_provider_status_idx ON offers(provider_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS job_applications_candidate_status_idx ON job_applications(candidate_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS settlements_payment_status_idx ON settlements(payment_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS refunds_payment_status_idx ON refunds(payment_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx ON audit_logs(actor_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS analytics_events_session_idx ON analytics_events(session_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS crash_reports_user_created_idx ON crash_reports(user_id, created_at DESC);
    `);
  },
  async down(client) {
    await client.query(`
      DROP INDEX IF EXISTS jobs_status_created_idx;
      DROP INDEX IF EXISTS offers_provider_status_idx;
      DROP INDEX IF EXISTS job_applications_candidate_status_idx;
      DROP INDEX IF EXISTS settlements_payment_status_idx;
      DROP INDEX IF EXISTS refunds_payment_status_idx;
      DROP INDEX IF EXISTS audit_logs_actor_created_idx;
      DROP INDEX IF EXISTS analytics_events_session_idx;
      DROP INDEX IF EXISTS crash_reports_user_created_idx;
    `);
  },
};
