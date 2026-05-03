-- Per-user bank connections. Stores encrypted credentials so the scraper
-- can run on behalf of any user, not just one hardcoded env-var account.
--
-- Security model:
--   * credentials_encrypted holds AES-256-GCM ciphertext (base64). The key
--     (BANK_CRED_KEY) lives only in the connect-bank edge function and the
--     scraper env. The Postgres role `authenticated` is REVOKEd from this
--     column, so even a leaked anon/auth JWT cannot read ciphertext.
--   * Writes (INSERT/UPDATE/DELETE of credentials) go through the edge
--     function with service_role. Users CAN delete their own row (to
--     disconnect) and CAN read non-secret status fields.

CREATE TABLE IF NOT EXISTS public.bank_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_id text NOT NULL,
  display_name text,
  credentials_encrypted text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_sync_status text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, bank_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_connections_active
  ON public.bank_connections (is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_bank_connections_user
  ON public.bank_connections (user_id);

ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;

-- Users may SELECT their own row, but the column grant below removes
-- their access to credentials_encrypted entirely.
DROP POLICY IF EXISTS "users select own bank connections" ON public.bank_connections;
CREATE POLICY "users select own bank connections"
  ON public.bank_connections FOR SELECT
  USING (user_id = auth.uid());

-- Users may DELETE their own connection (disconnect bank).
DROP POLICY IF EXISTS "users delete own bank connections" ON public.bank_connections;
CREATE POLICY "users delete own bank connections"
  ON public.bank_connections FOR DELETE
  USING (user_id = auth.uid());

-- Users may toggle is_active on their own row (pause sync without deleting creds).
DROP POLICY IF EXISTS "users toggle own bank active" ON public.bank_connections;
CREATE POLICY "users toggle own bank active"
  ON public.bank_connections FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- INSERT is intentionally restricted to service_role (edge function).
-- No INSERT policy → blocked for authenticated users.

-- Column-level: hide ciphertext from authenticated. service_role bypasses RLS
-- and column grants entirely.
REVOKE ALL ON public.bank_connections FROM authenticated;
GRANT SELECT (id, user_id, bank_id, display_name, is_active, last_sync_at, last_sync_status, last_error, created_at, updated_at)
  ON public.bank_connections TO authenticated;
GRANT UPDATE (is_active, updated_at) ON public.bank_connections TO authenticated;
GRANT DELETE ON public.bank_connections TO authenticated;

-- Block UPDATE on credential or user_id columns from authenticated, even if
-- the policy allowed it (defence in depth).
CREATE OR REPLACE FUNCTION public.bank_connections_block_user_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF NEW.credentials_encrypted IS DISTINCT FROM OLD.credentials_encrypted
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.bank_id IS DISTINCT FROM OLD.bank_id THEN
      RAISE EXCEPTION 'credentials, user_id, bank_id are read-only to clients'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bank_connections_block_user_writes ON public.bank_connections;
CREATE TRIGGER bank_connections_block_user_writes
  BEFORE UPDATE ON public.bank_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.bank_connections_block_user_writes();

COMMENT ON TABLE public.bank_connections IS
  'Per-user encrypted bank credentials for the daily scraper. Writes only via connect-bank edge function.';
COMMENT ON COLUMN public.bank_connections.credentials_encrypted IS
  'AES-256-GCM ciphertext, format: base64(iv12) || ":" || base64(ciphertext+tag16). Key = BANK_CRED_KEY env.';
