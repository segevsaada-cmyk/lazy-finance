-- Lazy Finance — server-stamped trial period (close client-side bypass).
--
-- Why: AuthPage previously INSERT-ed user_settings with
--   subscription_status: 'trial', trial_ends_at: <14 days from now>
-- An attacker could simply send 'paid' (caught by block_admin_self_signup),
-- but they could also send 'trial' with trial_ends_at = '2099-01-01' and
-- enjoy an 80-year free trial. The escalation trigger only fires on
-- UPDATE — INSERT had no defense for these columns.
--
-- This migration introduces a BEFORE INSERT trigger that *always*
-- overrides these columns to the server-controlled values for any
-- authenticated client INSERT. Service-role inserts (admin tooling)
-- pass through untouched.

CREATE OR REPLACE FUNCTION public.stamp_trial_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role / cron should retain the ability to set arbitrary state.
  IF auth.role() <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  NEW.subscription_status   := 'trial';
  NEW.trial_ends_at         := now() + interval '14 days';
  NEW.payment_notice_sent_at := NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_trial_on_signup ON public.user_settings;
CREATE TRIGGER stamp_trial_on_signup
  BEFORE INSERT ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_trial_on_signup();

-- ─────────────────────────────────────────────────────────────────────────
-- Defense-in-depth CHECK constraints. If these reject existing rows the
-- migration will fail loudly — manually clean and re-run.
-- ─────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Phone shape: digits / + / - / spaces only, length 9–20.
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'user_settings' AND column_name = 'phone') THEN
    ALTER TABLE public.user_settings
      DROP CONSTRAINT IF EXISTS user_settings_phone_shape;
    ALTER TABLE public.user_settings
      ADD CONSTRAINT user_settings_phone_shape
      CHECK (phone IS NULL OR phone ~ '^[0-9+\-\s]{9,20}$');
  END IF;

  -- Full name: 1..80 chars, no obvious control characters.
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'user_settings' AND column_name = 'full_name') THEN
    ALTER TABLE public.user_settings
      DROP CONSTRAINT IF EXISTS user_settings_full_name_shape;
    ALTER TABLE public.user_settings
      ADD CONSTRAINT user_settings_full_name_shape
      CHECK (
        full_name IS NULL
        OR (length(full_name) BETWEEN 1 AND 80
            AND full_name !~ '[\x00-\x1f\x7f]')
      );
  END IF;
END $$;
