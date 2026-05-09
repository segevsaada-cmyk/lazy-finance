/**
 * Vercel Serverless — signup gate (anti-flood).
 * POST /api/signup-precheck
 * Body: { phone: string }
 *
 * AuthPage calls this BEFORE supabase.auth.signUp() so we can rate-limit
 * by IP (anyone can spam signUp directly otherwise — Supabase has its own
 * limits but we want a tighter app-level cap to keep the trial table clean
 * and to log abuse to security_events).
 *
 * Defenses: method gate, body cap, per-IP rate limit (3/hour),
 * per-phone rate limit (2/hour) so a single phone can't churn signups.
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

  const ip = clientIp(req);
  if (!(await enforceRateLimit(req, res, `signup-ip:${ip}`, 3, 3600))) return;
  if (!(await enforceRateLimit(req, res, `signup-phone:${last9}`, 2, 3600))) return;

  return res.status(200).json({ ok: true });
}
