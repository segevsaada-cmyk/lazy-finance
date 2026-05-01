-- Fix: signup silently failed because RLS blocked authenticated users from
-- inserting their own user_settings row. Discovered when מורן סעדה signed up
-- but did not appear on /admin (no settings row was ever written).

-- Allow authenticated users to insert exactly one row for themselves.
CREATE POLICY "users insert own settings"
  ON public.user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own row (full_name, phone, etc).
CREATE POLICY "users update own settings"
  ON public.user_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
