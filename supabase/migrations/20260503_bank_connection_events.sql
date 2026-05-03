-- Audit log for bank connection lifecycle events. Append-only — no UPDATE
-- or DELETE allowed for any role except service_role. Used to:
--   * Detect unauthorized connection attempts (rate-limit signal)
--   * Show user a "recent activity" view in settings
--   * Trigger WA notifications on connect/disconnect

CREATE TABLE IF NOT EXISTS public.bank_connection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_id text,
  event_type text NOT NULL,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_connection_events_user_time
  ON public.bank_connection_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_connection_events_rate_limit
  ON public.bank_connection_events (user_id, event_type, created_at DESC);

ALTER TABLE public.bank_connection_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users see own events" ON public.bank_connection_events;
CREATE POLICY "users see own events"
  ON public.bank_connection_events FOR SELECT
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies → blocked for authenticated.
-- service_role bypasses RLS entirely.

REVOKE ALL ON public.bank_connection_events FROM authenticated;
GRANT SELECT (id, user_id, bank_id, event_type, details, ip_address, user_agent, created_at)
  ON public.bank_connection_events TO authenticated;

COMMENT ON TABLE public.bank_connection_events IS
  'Append-only audit log for bank connection lifecycle events.';
COMMENT ON COLUMN public.bank_connection_events.event_type IS
  'connect_attempt | connected | disconnected | sync_ok | sync_failed | paused | resumed | auto_disabled';

-- Add consecutive_failures counter to bank_connections so the scraper can
-- auto-pause after repeated login failures (prevents bank lockouts).
ALTER TABLE public.bank_connections
  ADD COLUMN IF NOT EXISTS consecutive_failures int NOT NULL DEFAULT 0;

GRANT SELECT (consecutive_failures) ON public.bank_connections TO authenticated;
