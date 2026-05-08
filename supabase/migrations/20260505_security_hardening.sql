-- Lazy Finance — security hardening pass.
--
-- Fixes:
-- 1. The 20260502 escalation trigger only blocked changes to role/is_approved.
--    20260504 added subscription_status / trial_ends_at / payment_notice_sent_at,
--    which an authenticated user could change on their own row to mark themselves
--    as 'paid' and bypass the 14-day trial gate. Extend the trigger.
-- 2. Defensive ENABLE ROW LEVEL SECURITY on user-scoped tables that may have been
--    created via the Studio UI (no SQL migration of record). Idempotent.
-- 3. Defensive ownership policy for `transactions` if missing.

-- =========================================================================
-- 1. Extend prevent_self_role_escalation to cover subscription columns.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_role text;
BEGIN
  IF auth.role() <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_approved IS DISTINCT FROM OLD.is_approved
     OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
     OR NEW.payment_notice_sent_at IS DISTINCT FROM OLD.payment_notice_sent_at THEN
    SELECT us.role INTO acting_role
    FROM public.user_settings AS us
    WHERE us.user_id = auth.uid()
    LIMIT 1;

    IF acting_role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'privileged columns can only be modified by an admin'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Same for the INSERT block — prevent self-paid signup.
CREATE OR REPLACE FUNCTION public.block_admin_self_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF NEW.role = 'admin'
     OR NEW.is_approved = true
     OR NEW.subscription_status = 'paid' THEN
    RAISE EXCEPTION 'admin/approved/paid status requires admin assignment'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- =========================================================================
-- 2. Ensure RLS is enabled on user-scoped tables.
-- Idempotent: ALTER TABLE ... ENABLE RLS is a no-op if already on.
-- Wrapped in DO blocks because some of these tables may not exist in dev.
-- =========================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_settings') THEN
    EXECUTE 'ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.user_settings FORCE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transactions') THEN
    EXECUTE 'ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'financial_goals') THEN
    EXECUTE 'ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'whatsapp_users') THEN
    EXECUTE 'ALTER TABLE public.whatsapp_users ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- =========================================================================
-- 3. Defensive ownership policies for tables created via the Studio UI.
-- DROP IF EXISTS + CREATE makes this idempotent and self-documenting.
-- =========================================================================
DO $$
BEGIN
  -- transactions — owner-only on every CRUD verb.
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transactions')
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'user_id') THEN
    DROP POLICY IF EXISTS "transactions owner all" ON public.transactions;
    EXECUTE $POL$
      CREATE POLICY "transactions owner all" ON public.transactions
        FOR ALL TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    $POL$;
  END IF;

  -- financial_goals — owner-only on every CRUD verb.
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'financial_goals')
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'financial_goals' AND column_name = 'user_id') THEN
    DROP POLICY IF EXISTS "financial_goals owner all" ON public.financial_goals;
    EXECUTE $POL$
      CREATE POLICY "financial_goals owner all" ON public.financial_goals
        FOR ALL TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    $POL$;
  END IF;

  -- whatsapp_users — owner read, no client writes.
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'whatsapp_users')
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'whatsapp_users' AND column_name = 'user_id') THEN
    DROP POLICY IF EXISTS "whatsapp_users owner select" ON public.whatsapp_users;
    EXECUTE $POL$
      CREATE POLICY "whatsapp_users owner select" ON public.whatsapp_users
        FOR SELECT TO authenticated
        USING (auth.uid() = user_id)
    $POL$;
  END IF;

  -- user_settings — owner read (writes already governed by triggers + the
  -- existing self-insert / self-update policies in 20260501).
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_settings')
     AND NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'user_settings'
          AND policyname = 'user_settings owner select'
     ) THEN
    EXECUTE $POL$
      CREATE POLICY "user_settings owner select" ON public.user_settings
        FOR SELECT TO authenticated
        USING (auth.uid() = user_id)
    $POL$;
  END IF;
END $$;
