export async function createSchema(client) {
  await client.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE TABLE IF NOT EXISTS rate_limit_windows (
      key TEXT PRIMARY KEY, window_started_at TIMESTAMPTZ NOT NULL, request_count INTEGER NOT NULL CHECK(request_count > 0)
    );
    CREATE INDEX IF NOT EXISTS rate_limit_windows_started_idx ON rate_limit_windows(window_started_at);
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER', status TEXT NOT NULL DEFAULT 'ACTIVE', session_version INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS providers (
      id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, provider_type TEXT NOT NULL,
      capacity TEXT NOT NULL, verification_status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
      UNIQUE(user_id)
    );
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, family_id UUID NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ NULL, replaced_by TEXT NULL
    );
    CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens(user_id);
    CREATE TABLE IF NOT EXISTS reset_tokens (
      id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, family_id UUID NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ NULL, created_at TIMESTAMPTZ NOT NULL
    );
    DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='reset_tokens') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reset_tokens' AND column_name='family_id') THEN ALTER TABLE reset_tokens ADD COLUMN family_id UUID; UPDATE reset_tokens SET family_id=gen_random_uuid() WHERE family_id IS NULL; ALTER TABLE reset_tokens ALTER COLUMN family_id SET NOT NULL; END IF; END $$;
    CREATE TABLE IF NOT EXISTS verticals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, name_en TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '', config JSONB NOT NULL DEFAULT '{}'::jsonb, is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE verticals ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE verticals ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE verticals ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
    CREATE UNIQUE INDEX IF NOT EXISTS verticals_slug_uq ON verticals(slug);
    CREATE INDEX IF NOT EXISTS verticals_active_idx ON verticals(is_active,sort_order);
    INSERT INTO verticals(id,slug,name,name_en,description,config,is_active,sort_order,created_at)
      VALUES(gen_random_uuid(),'jobs','Jobs','Jobs','Default HOPE jobs vertical (missions and positions).','{}'::jsonb,TRUE,0,NOW())
      ON CONFLICT (slug) DO NOTHING;
    CREATE TABLE IF NOT EXISTS categories (
      id UUID PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, name_en TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '', parent_id UUID NULL REFERENCES categories(id) ON DELETE SET NULL,
      sort_order INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL
    );
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_en TEXT NOT NULL DEFAULT '';
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id UUID NULL REFERENCES categories(id) ON DELETE SET NULL;
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
    CREATE INDEX IF NOT EXISTS categories_parent_idx ON categories(parent_id,sort_order);
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS vertical_id UUID NULL REFERENCES verticals(id) ON DELETE SET NULL;
    UPDATE categories SET vertical_id=(SELECT id FROM verticals WHERE slug='jobs') WHERE vertical_id IS NULL;
    CREATE INDEX IF NOT EXISTS categories_vertical_idx ON categories(vertical_id,sort_order);

    CREATE TABLE IF NOT EXISTS jobs (
      id UUID PRIMARY KEY, owner_id UUID NOT NULL REFERENCES users(id), provider_id UUID NULL REFERENCES users(id),
      title TEXT NOT NULL, description TEXT NOT NULL, category_id UUID NOT NULL REFERENCES categories(id), job_type TEXT NOT NULL,
      budget_type TEXT NOT NULL, budget_min NUMERIC(18,2) NOT NULL CHECK(budget_min > 0), budget_max NUMERIC(18,2) NOT NULL CHECK(budget_max >= budget_min),
      duration INTEGER NOT NULL CHECK(duration > 0), acceptance_criteria TEXT NOT NULL, status TEXT NOT NULL,
      city TEXT NULL, kind TEXT NOT NULL DEFAULT 'MISSION', visibility TEXT NOT NULL DEFAULT 'PUBLIC', schedule TEXT NULL, monthly_salary NUMERIC(18,2) NULL, application_deadline DATE NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL, published_at TIMESTAMPTZ NULL
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'MISSION';
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'PUBLIC';
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS schedule TEXT NULL;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(18,2) NULL;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_deadline DATE NULL;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS vertical_id UUID NULL REFERENCES verticals(id) ON DELETE SET NULL;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;
    UPDATE jobs SET vertical_id=(SELECT id FROM verticals WHERE slug='jobs') WHERE vertical_id IS NULL;
    CREATE INDEX IF NOT EXISTS jobs_vertical_idx ON jobs(vertical_id,status);
    CREATE INDEX IF NOT EXISTS jobs_owner_idx ON jobs(owner_id); CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status); CREATE INDEX IF NOT EXISTS jobs_provider_idx ON jobs(provider_id); CREATE INDEX IF NOT EXISTS jobs_kind_idx ON jobs(kind,visibility);
    CREATE TABLE IF NOT EXISTS offers (
      id UUID PRIMARY KEY, job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, provider_id UUID NOT NULL REFERENCES users(id),
      price NUMERIC(18,2) NOT NULL CHECK(price > 0), message TEXT NOT NULL, status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS offers_job_idx ON offers(job_id); CREATE UNIQUE INDEX IF NOT EXISTS offers_pending_provider_uq ON offers(job_id, provider_id) WHERE status='PENDING';
    CREATE TABLE IF NOT EXISTS job_applications (id UUID PRIMARY KEY, job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, resume_text TEXT NOT NULL, skills TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'PENDING', created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS job_applications_pending_uq ON job_applications(job_id,candidate_id) WHERE status IN ('PENDING','SELECTED');
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY, job_id UUID NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE, payer_id UUID NOT NULL REFERENCES users(id),
      payee_id UUID NOT NULL REFERENCES users(id), amount NUMERIC(18,2) NOT NULL CHECK(amount > 0), status TEXT NOT NULL,
      provider_ref TEXT NOT NULL UNIQUE, idempotency_key TEXT NULL,
      base_amount NUMERIC(18,2) NOT NULL DEFAULT 0, employer_fee NUMERIC(18,2) NOT NULL DEFAULT 0, worker_fee NUMERIC(18,2) NOT NULL DEFAULT 0,
      platform_fee NUMERIC(18,2) NOT NULL DEFAULT 0, employer_charge NUMERIC(18,2) NOT NULL DEFAULT 0, provider_payout NUMERIC(18,2) NOT NULL DEFAULT 0,
      fee_policy_version TEXT NOT NULL DEFAULT 'legacy', currency TEXT NOT NULL DEFAULT 'USD', created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
    );
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS base_amount NUMERIC(18,2) NOT NULL DEFAULT 0;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS employer_fee NUMERIC(18,2) NOT NULL DEFAULT 0;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS worker_fee NUMERIC(18,2) NOT NULL DEFAULT 0;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(18,2) NOT NULL DEFAULT 0;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS employer_charge NUMERIC(18,2) NOT NULL DEFAULT 0;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_payout NUMERIC(18,2) NOT NULL DEFAULT 0;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS fee_policy_version TEXT NOT NULL DEFAULT 'legacy';
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
    CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_uq ON payments(payer_id,idempotency_key) WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='payments_status_chk') THEN
        ALTER TABLE payments ADD CONSTRAINT payments_status_chk CHECK (status IN ('HOLD_PENDING','HOLD_FAILED','HELD','RELEASE_PENDING','RELEASE_FAILED','RELEASED','REFUND_PENDING','REFUNDED'));
      END IF;
    END $$;
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id UUID PRIMARY KEY, journal_id UUID NOT NULL, reference_type TEXT NOT NULL, reference_id UUID NOT NULL, account TEXT NOT NULL,
      debit NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(debit >= 0), credit NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(credit >= 0),
      currency TEXT NOT NULL DEFAULT 'USD', created_at TIMESTAMPTZ NOT NULL, CHECK((debit = 0 AND credit > 0) OR (credit = 0 AND debit > 0))
    );
    CREATE INDEX IF NOT EXISTS ledger_reference_idx ON ledger_entries(reference_type,reference_id,created_at);
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ledger_entry_nonnegative_chk') THEN
        ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entry_nonnegative_chk CHECK (debit >= 0 AND credit >= 0);
      END IF;
    END $$;
    CREATE OR REPLACE FUNCTION hope_assert_ledger_journal_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE total_debit NUMERIC(18,2); total_credit NUMERIC(18,2); journal_uuid UUID;
    BEGIN
      journal_uuid := COALESCE(NEW.journal_id, OLD.journal_id);
      SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0) INTO total_debit,total_credit FROM ledger_entries WHERE journal_id=journal_uuid;
      IF total_debit <> total_credit THEN
        RAISE EXCEPTION 'ledger journal % is unbalanced: debit %, credit %', journal_uuid,total_debit,total_credit USING ERRCODE='23514';
      END IF;
      RETURN COALESCE(NEW, OLD);
    END $$;
    DROP TRIGGER IF EXISTS ledger_journal_balance_deferred ON ledger_entries;
    CREATE CONSTRAINT TRIGGER ledger_journal_balance_deferred
      AFTER INSERT OR UPDATE OF debit,credit,journal_id OR DELETE ON ledger_entries
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hope_assert_ledger_journal_balanced();
    CREATE TABLE IF NOT EXISTS settlements (
      id UUID PRIMARY KEY, payment_id UUID NOT NULL UNIQUE REFERENCES payments(id) ON DELETE CASCADE, provider_ref TEXT NOT NULL UNIQUE,
      amount NUMERIC(18,2) NOT NULL CHECK(amount > 0), currency TEXT NOT NULL DEFAULT 'USD', status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS refunds (
      id UUID PRIMARY KEY, payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE, amount NUMERIC(18,2) NOT NULL CHECK(amount > 0),
      status TEXT NOT NULL, provider_ref TEXT NULL UNIQUE, idempotency_key TEXT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS refunds_idempotency_uq ON refunds(payment_id,idempotency_key) WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='refunds_status_chk') THEN
        ALTER TABLE refunds ADD CONSTRAINT refunds_status_chk CHECK (status IN ('PENDING','REFUNDED','FAILED'));
      END IF;
    END $$;
    CREATE TABLE IF NOT EXISTS payment_webhook_events (
      id UUID PRIMARY KEY, event_id TEXT NOT NULL UNIQUE, event_type TEXT NOT NULL, payment_id UUID NULL REFERENCES payments(id) ON DELETE SET NULL,
      provider_ref TEXT NULL, payload JSONB NOT NULL DEFAULT '{}'::jsonb, processed_at TIMESTAMPTZ NULL, created_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS payment_webhook_payment_idx ON payment_webhook_events(payment_id,created_at);
    CREATE TABLE IF NOT EXISTS evidence (
      id UUID PRIMARY KEY, job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, submitted_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      uri TEXT NOT NULL, notes TEXT NOT NULL, type TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS uploads (
      id UUID PRIMARY KEY, storage_key TEXT NOT NULL UNIQUE, uploaded_by UUID NULL REFERENCES users(id) ON DELETE SET NULL, content_type TEXT NOT NULL,
      size INTEGER NOT NULL CHECK(size > 0), created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS upload_intents (
      id UUID PRIMARY KEY, storage_key TEXT NOT NULL UNIQUE, uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content_type TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS upload_intents_user_idx ON upload_intents(uploaded_by);
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}'::jsonb,
      read_at TIMESTAMPTZ NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id,read_at,created_at DESC);
    CREATE TABLE IF NOT EXISTS notification_preferences (
      id UUID PRIMARY KEY, user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      in_app BOOLEAN NOT NULL DEFAULT TRUE, push BOOLEAN NOT NULL DEFAULT TRUE, email BOOLEAN NOT NULL DEFAULT TRUE,
      job_alerts BOOLEAN NOT NULL DEFAULT TRUE, application_updates BOOLEAN NOT NULL DEFAULT TRUE,
      payment_updates BOOLEAN NOT NULL DEFAULT TRUE, marketing BOOLEAN NOT NULL DEFAULT FALSE, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS notification_devices (
      id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform TEXT NOT NULL CHECK(platform IN ('ANDROID','IOS','WEB')), token TEXT NOT NULL UNIQUE,
      enabled BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS notification_devices_user_idx ON notification_devices(user_id,enabled);
    CREATE TABLE IF NOT EXISTS analytics_events (
      id UUID PRIMARY KEY, event_name TEXT NOT NULL, user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      anonymous_id TEXT NULL, session_id TEXT NULL, app_version TEXT NULL, platform TEXT NULL,
      properties JSONB NOT NULL DEFAULT '{}'::jsonb, dedupe_key TEXT NULL UNIQUE, occurred_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS analytics_events_name_idx ON analytics_events(event_name,occurred_at DESC);
    CREATE INDEX IF NOT EXISTS analytics_events_user_idx ON analytics_events(user_id,occurred_at DESC);
    CREATE TABLE IF NOT EXISTS crash_reports (
      id UUID PRIMARY KEY, user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL, anonymous_id TEXT NULL,
      app_version TEXT NULL, platform TEXT NULL, release_channel TEXT NULL, fingerprint TEXT NOT NULL,
      message TEXT NOT NULL, stack TEXT NULL, context JSONB NOT NULL DEFAULT '{}'::jsonb,
      occurred_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS crash_reports_fp_idx ON crash_reports(fingerprint,occurred_at DESC);
    CREATE INDEX IF NOT EXISTS crash_reports_created_idx ON crash_reports(created_at DESC);
    CREATE TABLE IF NOT EXISTS trust_reports (id UUID PRIMARY KEY, reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, entity_type TEXT NOT NULL CHECK(entity_type IN ('USER','JOB')), entity_id UUID NOT NULL, reason TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','REVIEWING','RESOLVED','DISMISSED')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE INDEX IF NOT EXISTS trust_reports_status_idx ON trust_reports(status,created_at DESC); CREATE INDEX IF NOT EXISTS trust_reports_entity_idx ON trust_reports(entity_type,entity_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY, action TEXT NOT NULL, actor_id UUID NULL REFERENCES users(id) ON DELETE SET NULL, entity_type TEXT NOT NULL,
      entity_id UUID NULL, meta JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL
    );
    ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS family_id UUID;
    UPDATE refresh_tokens SET family_id = id WHERE family_id IS NULL;
    ALTER TABLE refresh_tokens ALTER COLUMN family_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS refresh_tokens_family_idx ON refresh_tokens(family_id);
    CREATE TABLE IF NOT EXISTS hope_meta (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS outbox_events (
      id UUID PRIMARY KEY,
      event_type TEXT NOT NULL,
      aggregate_type TEXT NOT NULL,
      aggregate_id UUID NULL,
      dedupe_key TEXT NULL UNIQUE,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','DONE','FAILED')),
      attempts INTEGER NOT NULL DEFAULT 0,
      available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      locked_at TIMESTAMPTZ NULL,
      lease_token UUID NULL,
      last_error TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ NULL
    );
    ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS lease_token UUID NULL;
    CREATE INDEX IF NOT EXISTS outbox_pending_idx ON outbox_events(status,available_at,created_at);
    CREATE INDEX IF NOT EXISTS outbox_processing_lease_idx ON outbox_events(status,locked_at) WHERE status='PROCESSING';
  `);
}

