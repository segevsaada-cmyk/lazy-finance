/**
 * Vercel Serverless — GDPR / privacy-law data export.
 * GET /api/export-my-data
 * Returns a JSON dump of every row tied to the authenticated user.
 *
 * Defenses: method gate, JWT auth, 2/hour rate limit per user (bulk export
 * is expensive and must not be a DoS vector).
 */

import { createClient } from '@supabase/supabase-js';
import {
  requireMethod, requireUser, enforceRateLimit,
} from './_lib/security.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return;
  const user = await requireUser(req, res);
  if (!user) return;
  if (!(await enforceRateLimit(req, res, `export:${user.id}`, 2, 3600))) return;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(503).json({ error: 'export not configured' });
  }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [settingsRes, txRes, goalsRes, bankRes, eventsRes, waRes] = await Promise.all([
    sb.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
    sb.from('transactions').select('*').eq('user_id', user.id),
    sb.from('financial_goals').select('*').eq('user_id', user.id),
    // Never include encrypted credentials in the export.
    sb.from('bank_connections')
      .select('id, bank_id, is_active, last_sync_at, last_error, created_at, updated_at')
      .eq('user_id', user.id),
    sb.from('bank_connection_events')
      .select('id, bank_id, event_type, details, created_at')
      .eq('user_id', user.id),
    sb.from('whatsapp_users').select('phone_number, created_at').eq('user_id', user.id),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    spec_version: 1,
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
    },
    user_settings: settingsRes.data ?? null,
    transactions: txRes.data ?? [],
    financial_goals: goalsRes.data ?? [],
    bank_connections: bankRes.data ?? [],
    bank_connection_events: eventsRes.data ?? [],
    whatsapp_links: waRes.data ?? [],
  };

  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="lazyfinance-export-${date}.json"`
  );
  res.status(200).json(payload);
}
