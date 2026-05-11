/**
 * Vercel Serverless — resolve a phone number to its associated email so the
 * client can complete signInWithPassword. The phone column on user_settings
 * is service-role only; we expose only the email here, never the password.
 *
 * POST /api/login-by-phone
 * Body: { phone: "0524844685" | "972524844685" | "+972 52-484-4685" }
 * Reply: 200 { email } | 404 { error }
 *
 * Pre-auth endpoint (the user is trying to log in). Defended by:
 *   - method gate
 *   - body-size cap
 *   - phone-shape validation
 *   - per-IP and per-phone rate limit (anti-enumeration / brute-force)
 */

import {
  requireMethod, rejectIfTooLarge, enforceRateLimit, clientIp,
} from './_lib/security.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;
  if (!rejectIfTooLarge(req, res, 1024)) return;

  const { phone } = req.body || {};
  if (!phone || typeof phone !== 'string' || phone.length > 32) {
    return res.status(400).json({ error: 'phone required' });
  }

  const last9 = phone.replace(/\D/g, '').slice(-9);
  if (last9.length < 9) {
    return res.status(400).json({ error: 'phone too short' });
  }

  // Per-IP: 10 attempts/min — generous for a real user, hard for a botnet.
  if (!(await enforceRateLimit(req, res, `login:${clientIp(req)}`, 10, 60))) return;
  // Per-phone: 5 attempts/min — protects a specific user from being hammered
  // and from credential stuffing.
  if (!(await enforceRateLimit(req, res, `login-phone:${last9}`, 5, 60))) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'server not configured' });
  }

  const auth = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

  const lookup = await fetch(
    `${SUPABASE_URL}/rest/v1/user_settings?phone=ilike.%25${last9}&select=user_id`,
    { headers: auth },
  );
  // Single neutral error for all non-success paths — denies the attacker
  // information about whether a phone exists, has no email, etc.
  const NEUTRAL_ERR = { error: 'invalid_credentials', message: 'מספר או סיסמה שגויים' };

  if (!lookup.ok) {
    return res.status(502).json({ error: 'lookup failed' });
  }
  const rows = await lookup.json();
  if (!rows.length) {
    return res.status(404).json(NEUTRAL_ERR);
  }

  const userRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${rows[0].user_id}`,
    { headers: auth },
  );
  const u = await userRes.json();
  if (!u.email) {
    return res.status(404).json(NEUTRAL_ERR);
  }
  return res.status(200).json({ email: u.email });
}
