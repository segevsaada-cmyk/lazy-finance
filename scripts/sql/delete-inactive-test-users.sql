-- ─────────────────────────────────────────────────────────────────────────
-- One-shot user removal helper for the private-alpha pivot (2026-05-09).
-- Run this in Supabase Studio → SQL Editor as the project owner (service-role).
--
-- The script is split into TWO steps. Step 1 just LISTS candidates so you
-- can verify the names + last activity before pulling the trigger. Step 2
-- is wrapped in a transaction and is COMMENTED OUT — uncomment after Step 1
-- looks right.
--
-- Targets: users named "אור" or "אוריאל עודד". Add or remove names below.
-- The single primary admin (locked by enforce_single_admin) is excluded by
-- default — the trigger would refuse anyway, this is just clearer.
-- ─────────────────────────────────────────────────────────────────────────

-- ============================ STEP 1 — preview ===========================
-- Lists every candidate row with last sign-in timestamp + transaction count
-- so you can be sure you're deleting the right people. Read carefully.

SELECT
  us.user_id,
  us.full_name,
  us.phone,
  us.role,
  us.is_approved,
  us.subscription_status,
  au.email,
  au.created_at      AS account_created_at,
  au.last_sign_in_at,
  (SELECT count(*) FROM public.transactions t WHERE t.user_id = us.user_id) AS tx_count
FROM public.user_settings us
LEFT JOIN auth.users au ON au.id = us.user_id
WHERE
  us.role <> 'admin'
  AND (
    us.full_name ILIKE '%אור%'           -- catches אור, אוריאל
    OR us.full_name ILIKE '%עודד%'        -- catches עודד as last name
  )
ORDER BY au.last_sign_in_at NULLS FIRST;

-- ============================ STEP 2 — delete ============================
-- After verifying Step 1, REMOVE THE BLOCK COMMENT below to execute.
-- The transaction wraps everything so a single error rolls back all deletes.
-- The cascade order matches /api/delete-my-account.js so we don't surprise
-- foreign keys.
--
-- /*
-- BEGIN;
--
-- WITH targets AS (
--   SELECT us.user_id
--   FROM public.user_settings us
--   WHERE us.role <> 'admin'
--     AND (us.full_name ILIKE '%אור%' OR us.full_name ILIKE '%עודד%')
-- )
-- DELETE FROM public.transactions             WHERE user_id IN (SELECT user_id FROM targets);
-- DELETE FROM public.financial_goals          WHERE user_id IN (SELECT user_id FROM targets);
-- DELETE FROM public.whatsapp_users           WHERE user_id IN (SELECT user_id FROM targets);
-- DELETE FROM public.bank_connection_events   WHERE user_id IN (SELECT user_id FROM targets);
-- DELETE FROM public.bank_connections         WHERE user_id IN (SELECT user_id FROM targets);
-- DELETE FROM public.ai_usage_buckets         WHERE user_id IN (SELECT user_id FROM targets);
-- DELETE FROM public.terms_acceptances        WHERE user_id IN (SELECT user_id FROM targets);
-- -- user_settings last so any RLS / FK using it still resolves above.
-- DELETE FROM public.user_settings            WHERE user_id IN (SELECT user_id FROM targets);
-- -- Finally remove the auth.users row itself. Service-role only.
-- DELETE FROM auth.users                      WHERE id IN (SELECT user_id FROM targets);
--
-- COMMIT;
-- */
