/**
 * Vercel Serverless — irrevocable account deletion (GDPR / Right to be Forgotten).
 * POST /api/delete-my-account
 * Body: { confirm: "DELETE" }
 *
 * Deletes every per-user row in the application schema and the auth.users
 * record itself. The primary admin (locked by the enforce_single_admin
 * trigger and matched here by the lock_primary_admin migration) is NEVER
 * deleted by this endpoint — they must use a separate admin tool.
 *
 * Defenses: method gate, body-size cap, JWT auth, mandatory typed
 * confirmation, 1/hour rate limit per user.
 */

import { createClient } from '@supabase/supabase-js';
import {
  requireMethod, rejectIfTooLarge, requireUser, enforceRateLimit,
} from './_lib/security.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Tables that hold per-user rows. Order matters only for clarity; service-role
// deletes ignore RLS but we still want predictable cascading.
const PER_USER_TABLES = [
  'transactions',
  'financial_goals',
  'whatsapp_users',
  'bank_connection_events',
  'bank_connections',
  'ai_usage_buckets',
  'user_settings',
];

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;
  if (!rejectIfTooLarge(req, res, 1024)) return;

  const user = await requireUser(req, res);
  if (!user) return;
  if (!(await enforceRateLimit(req, res, `delete-self:${user.id}`, 1, 3600))) return;

  const { confirm } = req.body || {};
  if (confirm !== 'DELETE') {
    return res.status(400).json({ error: 'must POST { "confirm": "DELETE" }' });
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(503).json({ error: 'service unavailable' });
  }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Defence in depth — the enforce_single_admin trigger hard-codes the
  // owner UUID; we also refuse here so the response is a friendly 403
  // instead of a database exception.
  const { data: settings } = await sb
    .from('user_settings')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (settings?.role === 'admin') {
    return res.status(403).json({
      error: 'admin_cannot_self_delete',
      message: 'מנהל ראשי לא יכול למחוק את חשבונו דרך האפליקציה — פנה לתמיכה',
    });
  }

  const errors = [];
  for (const t of PER_USER_TABLES) {
    const { error } = await sb.from(t).delete().eq('user_id', user.id);
    if (error && !/does not exist/i.test(error.message)) {
      errors.push({ table: t, error: error.message });
    }
  }

  // Finally remove the auth.users row itself.
  const { error: authErr } = await sb.auth.admin.deleteUser(user.id);
  if (authErr) errors.push({ scope: 'auth', error: authErr.message });

  if (errors.length) {
    console.error('delete-my-account partial failure', { user: user.id, errors });
    return res.status(500).json({
      error: 'partial_delete',
      details: errors,
      message: 'חלק מהנתונים נמחקו, אך לא הכל. פנה לתמיכה.',
    });
  }

  return res.status(200).json({ ok: true, message: 'החשבון נמחק' });
}
