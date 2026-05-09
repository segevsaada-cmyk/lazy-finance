-- Lazy Finance — generic security event log.
--
-- Why: today only bank_connection_events is audited. We need a generic
-- forensic trail for: failed logins (post-deploy), role changes, mass
-- deletes, admin actions, AI budget exhaustion, prompt-injection blocks.
-- This table is service-role only — clients can never read or write it.
-- The /admin page can SELECT via the admin-users edge function (which
-- already runs on service-role) if we ever want a UI for it.

CREATE TABLE IF NOT EXISTS public.security_events (
  id            bigserial PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type    text NOT NULL,
  -- ip_address: opaque string (IPv4 / IPv6). Stored for forensics, never
  -- shown back to the user.
  ip_address    text,
  user_agent    text,
  details       jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_user_time
  ON public.security_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type_time
  ON public.security_events (event_type, created_at DESC);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
-- No client-facing policies. Service-role bypasses RLS on writes; reads
-- only happen from server-side admin tooling.

REVOKE ALL ON public.security_events FROM authenticated, anon;

-- Append-only convenience function callable from server endpoints. Never
-- raises (so a logging hiccup can't take down the calling endpoint).
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_user_id uuid,
  p_event_type text,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_events(user_id, event_type, ip_address, user_agent, details)
  VALUES (p_user_id, p_event_type, p_ip, p_user_agent, p_details);
EXCEPTION WHEN OTHERS THEN
  -- Swallow logging errors; don't propagate to the caller.
  NULL;
END;
$$;

-- Convenience cleanup — keep 365 days, drop older. The /admin page
-- doesn't need a forever audit trail; storage cost stays bounded.
CREATE OR REPLACE FUNCTION public.cleanup_security_events()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM public.security_events WHERE created_at < now() - interval '365 days';
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Immutable terms-acceptance history (B6 from IDEAS.md). The user_settings
-- row only carries the latest acceptance, which is bad for evidentiary value.
-- This append-only table records every acceptance.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.terms_acceptances (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version     text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address  text,
  user_agent  text
);

CREATE INDEX IF NOT EXISTS idx_terms_acceptances_user
  ON public.terms_acceptances (user_id, accepted_at DESC);

ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users see own acceptances" ON public.terms_acceptances;
CREATE POLICY "users see own acceptances" ON public.terms_acceptances
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "users insert own acceptance" ON public.terms_acceptances;
CREATE POLICY "users insert own acceptance" ON public.terms_acceptances
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
-- No UPDATE or DELETE policies — this table is append-only.
