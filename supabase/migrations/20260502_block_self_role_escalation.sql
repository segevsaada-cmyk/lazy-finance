-- Block self-promotion to admin and self-approval.
-- Without this, an authenticated user could run
--   UPDATE user_settings SET role='admin', is_approved=true WHERE user_id=auth.uid()
-- because the per-user UPDATE policy permits any column change on their own row.

-- A SECURITY DEFINER trigger raises if the acting user (not service_role)
-- tried to modify role or is_approved AND is not already an admin.

CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_role text;
BEGIN
  -- service_role bypasses RLS and can do anything (admin API, scripts).
  IF auth.role() <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  -- Did this update touch the privileged columns?
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
    SELECT us.role INTO acting_role
    FROM public.user_settings AS us
    WHERE us.user_id = auth.uid()
    LIMIT 1;

    IF acting_role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'role and is_approved can only be modified by an admin'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_role_escalation ON public.user_settings;
CREATE TRIGGER prevent_self_role_escalation
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_role_escalation();

-- Belt and suspenders: also block direct INSERT with role='admin' or
-- is_approved=true by anyone other than service_role.
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

  IF NEW.role = 'admin' OR NEW.is_approved = true THEN
    RAISE EXCEPTION 'role admin and is_approved=true require admin assignment'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_admin_self_signup ON public.user_settings;
CREATE TRIGGER block_admin_self_signup
  BEFORE INSERT ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.block_admin_self_signup();
