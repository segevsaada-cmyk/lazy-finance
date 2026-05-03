// Lazy Finance — Admin user management
// Single endpoint with action=create | delete. Requires the caller to hold
// role='admin' in public.user_settings. Uses the service-role key to bypass
// RLS and to call the auth admin API.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

// Tables that store per-user data and need to be cleaned before deleting auth.users.
const USER_DATA_TABLES = [
  "transactions",
  "financial_goals",
  "bank_connections",
  "whatsapp_users",
  "user_settings",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "missing token" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "invalid token" }, 401);
  const callerId = userData.user.id;

  const { data: callerSettings, error: csErr } = await admin
    .from("user_settings")
    .select("role")
    .eq("user_id", callerId)
    .maybeSingle();
  if (csErr) return json({ error: csErr.message }, 500);
  if (callerSettings?.role !== "admin") return json({ error: "admin only" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const action = body.action;

  if (action === "create") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const full_name = body.full_name ? String(body.full_name).trim() : null;
    const phone = body.phone ? String(body.phone).trim() : null;
    const is_approved = body.is_approved !== false;

    if (!email || !password) return json({ error: "email and password required" }, 400);
    if (password.length < 6) return json({ error: "password must be at least 6 chars" }, 400);

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: full_name ? { full_name } : undefined,
    });
    if (cErr || !created?.user) return json({ error: cErr?.message ?? "create failed" }, 400);
    const newId = created.user.id;

    const { error: usErr } = await admin
      .from("user_settings")
      .upsert({
        user_id: newId,
        full_name,
        phone,
        is_approved,
        role: "user",
      }, { onConflict: "user_id" });
    if (usErr) {
      await admin.auth.admin.deleteUser(newId).catch(() => {});
      return json({ error: usErr.message }, 500);
    }

    return json({ ok: true, user_id: newId, email });
  }

  if (action === "delete") {
    const user_id = String(body.user_id ?? "").trim();
    if (!user_id) return json({ error: "user_id required" }, 400);
    if (user_id === callerId) return json({ error: "cannot delete yourself" }, 400);

    for (const table of USER_DATA_TABLES) {
      const { error } = await admin.from(table).delete().eq("user_id", user_id);
      if (error) return json({ error: `${table}: ${error.message}` }, 500);
    }

    const { error: aErr } = await admin.auth.admin.deleteUser(user_id);
    if (aErr) return json({ error: aErr.message }, 500);

    return json({ ok: true });
  }

  return json({ error: "unknown action" }, 400);
});
