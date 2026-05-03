-- Lock role='admin' to a single primary admin (segevsaada@gmail.com).
-- Even service_role / admin scripts cannot grant admin to anyone else.
-- This is the ultimate guard against accidental privilege grants.

CREATE OR REPLACE FUNCTION public.enforce_single_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  primary_admin_id uuid := '663457e3-af7c-4976-9606-66e51ab8ed3c';
BEGIN
  IF NEW.role = 'admin' AND NEW.user_id <> primary_admin_id THEN
    RAISE EXCEPTION 'role=admin is reserved for the primary admin (segevsaada@gmail.com)'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_single_admin_ins ON public.user_settings;
CREATE TRIGGER enforce_single_admin_ins
  BEFORE INSERT ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_single_admin();

DROP TRIGGER IF EXISTS enforce_single_admin_upd ON public.user_settings;
CREATE TRIGGER enforce_single_admin_upd
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_single_admin();
