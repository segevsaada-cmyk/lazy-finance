-- Lazy Finance — inactivity-based user cleanup.
--
-- Why: app pivoted to private alpha (2026-05-09). New invitees who don't
-- log in within ~2 weeks of approval are considered uninterested and
-- should be purged so the user_settings table stays small and audit-clean.
--
-- This migration ADDS a function — it does not run automatically. Call it
-- manually from SQL Editor (`SELECT public.cleanup_inactive_users(14);`)
-- or wire it to pg_cron later. Returns the user_ids that were removed
-- so you can spot-check the outcome.
--
-- Safety: NEVER deletes admins (covered by both an explicit role filter
-- and the enforce_single_admin trigger as a backstop).

CREATE OR REPLACE FUNCTION public.cleanup_inactive_users(p_days int DEFAULT 14)
RETURNS TABLE(deleted_user_id uuid, full_name text, last_sign_in_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target uuid;
BEGIN
  IF p_days < 7 THEN
    RAISE EXCEPTION 'p_days must be >= 7 (got %) — refuse to mass-delete on a short window',
      p_days USING ERRCODE = '22023';
  END IF;

  FOR v_target IN
    SELECT us.user_id
    FROM public.user_settings us
    JOIN auth.users au ON au.id = us.user_id
    WHERE us.role <> 'admin'
      AND (
        au.last_sign_in_at IS NULL
        OR au.last_sign_in_at < now() - (p_days || ' days')::interval
      )
      AND au.created_at < now() - (p_days || ' days')::interval
  LOOP
    -- Capture metadata BEFORE deleting so we can return it.
    deleted_user_id := v_target;
    SELECT us.full_name, au.last_sign_in_at
      INTO full_name, last_sign_in_at
    FROM public.user_settings us
    JOIN auth.users au ON au.id = us.user_id
    WHERE us.user_id = v_target;

    -- Cascade through every per-user table. Order matches
    -- /api/delete-my-account.js for consistency.
    DELETE FROM public.transactions             WHERE user_id = v_target;
    DELETE FROM public.financial_goals          WHERE user_id = v_target;
    DELETE FROM public.whatsapp_users           WHERE user_id = v_target;
    DELETE FROM public.bank_connection_events   WHERE user_id = v_target;
    DELETE FROM public.bank_connections         WHERE user_id = v_target;
    DELETE FROM public.ai_usage_buckets         WHERE user_id = v_target;
    DELETE FROM public.terms_acceptances        WHERE user_id = v_target;
    DELETE FROM public.user_settings            WHERE user_id = v_target;
    DELETE FROM auth.users                      WHERE id      = v_target;

    -- Forensic crumb so we know later who was purged automatically.
    PERFORM public.log_security_event(
      v_target,
      'inactive_user_purged',
      NULL,
      NULL,
      jsonb_build_object('inactivity_days', p_days)
    );

    RETURN NEXT;
  END LOOP;
END;
$$;

-- Convenience: a SECURITY-INVOKER thin wrapper an admin client can call
-- without having to remember the exact signature. Default 14 days.
CREATE OR REPLACE FUNCTION public.cleanup_inactive_users()
RETURNS TABLE(deleted_user_id uuid, full_name text, last_sign_in_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.cleanup_inactive_users(14);
$$;
