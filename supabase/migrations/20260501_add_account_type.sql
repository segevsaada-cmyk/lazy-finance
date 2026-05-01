-- Add account_type column to transactions: distinguishes private (פרטי) and business (עסקי) accounts.
-- Default 'private' so existing rows are backfilled and the column is non-null.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'private'
    CHECK (account_type IN ('private', 'business'));

CREATE INDEX IF NOT EXISTS idx_transactions_user_account
  ON transactions (user_id, account_type, date DESC);

COMMENT ON COLUMN transactions.account_type IS 'private = חשבון פרטי, business = חשבון עסקי';
