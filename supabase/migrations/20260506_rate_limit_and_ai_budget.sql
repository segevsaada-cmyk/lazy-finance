-- Lazy Finance — rate-limiter + per-user AI token budget.
--
-- Why: /api/advisor calls Anthropic (Claude). Without a cap, a compromised
-- account or an unauthenticated abuser could rack up thousands of dollars
-- in API spend. /api/login-by-phone is brute-forceable. /api/categorize
-- is cheap but still trivially DoS-able. This migration adds a generic
-- key→count rate limiter and a per-user daily token bucket.
--
-- Both tables are service-role only (no RLS-readable client paths).

-- =========================================================================
-- 1. Generic rate-limit buckets (sliding fixed-window).
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  bucket_key    text        NOT NULL,
  bucket_window timestamptz NOT NULL,
  count         int         NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, bucket_window)
);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
-- No client policies: only service-role (which bypasses RLS) ever touches this.

-- Atomic bump. Returns whether the call is allowed and the current usage.
CREATE OR REPLACE FUNCTION public.bump_rate_limit(
  p_key text,
  p_max int,
  p_window_seconds int DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window timestamptz;
  v_count  int;
BEGIN
  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  INSERT INTO public.rate_limit_buckets(bucket_key, bucket_window, count)
  VALUES (p_key, v_window, 1)
  ON CONFLICT (bucket_key, bucket_window) DO UPDATE
    SET count = public.rate_limit_buckets.count + 1
  RETURNING count INTO v_count;

  RETURN jsonb_build_object(
    'allowed', v_count <= p_max,
    'count',   v_count,
    'limit',   p_max,
    'reset_at', v_window + (p_window_seconds || ' seconds')::interval
  );
END;
$$;

-- =========================================================================
-- 2. Per-user daily AI token budget.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.ai_usage_buckets (
  user_id     uuid NOT NULL,
  day         date NOT NULL,
  tokens_used int  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.ai_usage_buckets ENABLE ROW LEVEL SECURITY;
-- Owner read so users can see their own usage if we ever expose it.
DROP POLICY IF EXISTS "ai_usage_owner_select" ON public.ai_usage_buckets;
CREATE POLICY "ai_usage_owner_select" ON public.ai_usage_buckets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.check_ai_budget(p_user_id uuid, p_max_tokens int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used int;
BEGIN
  SELECT COALESCE(tokens_used, 0) INTO v_used
  FROM public.ai_usage_buckets
  WHERE user_id = p_user_id AND day = current_date;
  v_used := COALESCE(v_used, 0);
  RETURN jsonb_build_object(
    'used',    v_used,
    'limit',   p_max_tokens,
    'allowed', v_used < p_max_tokens
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_ai_tokens(p_user_id uuid, p_tokens int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tokens <= 0 THEN RETURN; END IF;
  INSERT INTO public.ai_usage_buckets(user_id, day, tokens_used)
  VALUES (p_user_id, current_date, p_tokens)
  ON CONFLICT (user_id, day) DO UPDATE
    SET tokens_used = public.ai_usage_buckets.tokens_used + p_tokens;
END;
$$;

-- =========================================================================
-- 3. Periodic cleanup so the bucket table doesn't grow unbounded.
-- Drop windows older than a day; usage older than 90 days.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.cleanup_security_buckets()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM public.rate_limit_buckets WHERE bucket_window < now() - interval '1 day';
  DELETE FROM public.ai_usage_buckets   WHERE day            < current_date - 90;
$$;
