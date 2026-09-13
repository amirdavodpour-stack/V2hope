export const migration = {
  version: 3,
  name: 'payment_release_recovery',
  async up(client) {
    await client.query(`
      ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_chk;
      ALTER TABLE payments ADD CONSTRAINT payments_status_chk
        CHECK (status IN ('HOLD_PENDING','HOLD_FAILED','HELD','RELEASE_PENDING','RELEASE_FAILED','RELEASED','REFUND_PENDING','REFUNDED'));
    `);
  },
  async down(client) {
    await client.query(`
      -- Rollback must preserve the pre-migration state semantics without
      -- silently rewriting live payment state. RELEASE_FAILED is only
      -- introduced by this migration, so a safe rollback is allowed only
      -- when no rows are using it.
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM payments WHERE status='RELEASE_FAILED') THEN
          RAISE EXCEPTION 'Cannot rollback payment_release_recovery while RELEASE_FAILED rows exist' USING ERRCODE='55000';
        END IF;
      END $$;
      ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_chk;
      ALTER TABLE payments ADD CONSTRAINT payments_status_chk
        CHECK (status IN ('HOLD_PENDING','HOLD_FAILED','HELD','RELEASE_PENDING','RELEASED','REFUND_PENDING','REFUNDED'));
    `);
  },
};
