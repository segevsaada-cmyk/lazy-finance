/**
 * Vercel Serverless — resolve a phone number to its associated email so the
 * client can complete signInWithPassword. The phone column on user_settings
 * is service-role only; we expose only the email here, never the password.
 *
 * POST /api/login-by-phone
 * Body: { phone: "0524844685" | "972524844685" | "+972 52-484-4685" }
 * Reply: 200 { email } | 404 { error }
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const { phone } = req.body || {};
  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ error: 'phone required' });
  }

  const last9 = phone.replace(/\D/g, '').slice(-9);
  if (last9.length < 9) {
    return res.status(400).json({ error: 'phone too short' });
  }

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
  if (!lookup.ok) {
    return res.status(502).json({ error: 'lookup failed' });
  }
  const rows = await lookup.json();
  if (!rows.length) {
    return res.status(404).json({ error: 'מספר לא נמצא במערכת' });
  }

  const userRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${rows[0].user_id}`,
    { headers: auth },
  );
  const u = await userRes.json();
  if (!u.email) {
    return res.status(404).json({ error: 'no email for user' });
  }
  return res.status(200).json({ email: u.email });
}
