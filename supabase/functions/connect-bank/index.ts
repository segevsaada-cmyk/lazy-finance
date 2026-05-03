// Lazy Finance — Connect Bank
// Receives plaintext bank credentials from the user, encrypts them with
// AES-256-GCM, and upserts a row in public.bank_connections.
//
// Hardening:
//   * Approval gate: user_settings.is_approved must be true
//   * Rate limit: max 20 connect_attempt events per user per hour
//   * Audit log: every attempt (success/fail) recorded in bank_connection_events
//   * WA notification: if user has a linked WhatsApp number, send an instant
//     "bank connected" alert so they can detect unauthorized adds
//   * Plaintext creds never persisted; key (BANK_CRED_KEY) lives only in env

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BANK_CRED_KEY_B64 = Deno.env.get("BANK_CRED_KEY")!;
const WA_SERVER_URL = Deno.env.get("WA_SERVER_URL");
const WA_API_KEY = Deno.env.get("WA_API_KEY");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RATE_LIMIT_PER_HOUR = 20;

const ALLOWED_BANKS = new Set([
  "hapoalim", "leumi", "mizrahi", "discount", "mercantile", "otsarHahayal",
  "max", "visaCal", "isracard", "amex", "union", "beinleumi", "massad",
  "yahav", "beyahadBishvilha", "behatsdaa", "pagi",
]);

const FIELDS_BY_BANK: Record<string, string[]> = {
  hapoalim: ["userCode", "password"],
  leumi: ["username", "password"],
  mizrahi: ["username", "password"],
  discount: ["id", "password", "num"],
  mercantile: ["id", "password", "num"],
  otsarHahayal: ["username", "password"],
  max: ["username", "password"],
  visaCal: ["username", "password"],
  isracard: ["id", "card6Digits", "password"],
  amex: ["id", "card6Digits", "password"],
  union: ["username", "password"],
  beinleumi: ["username", "password"],
  massad: ["username", "password"],
  yahav: ["username", "nationalID", "password"],
  beyahadBishvilha: ["id", "password"],
  behatsdaa: ["id", "password"],
  pagi: ["username", "password"],
};

const BANK_DISPLAY: Record<string, string> = {
  hapoalim: "בנק הפועלים", leumi: "בנק לאומי", mizrahi: "בנק מזרחי",
  discount: "בנק דיסקונט", mercantile: "בנק מרכנתיל", otsarHahayal: "אוצר החייל",
  max: "מאקס", visaCal: "ויזה כאל", isracard: "ישראכרט", amex: "אמריקן אקספרס",
  union: "בנק איגוד", beinleumi: "הבינלאומי", massad: "בנק מסד",
  yahav: "בנק יהב", beyahadBishvilha: "ביחד בשבילך", behatsdaa: "בהצדעה",
  pagi: 'בנק פאג"י',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function importKey(): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(BANK_CRED_KEY_B64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("BANK_CRED_KEY must decode to 32 bytes");
  return await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]);
}

async function encryptCredentials(plaintextJson: string): Promise<string> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintextJson)),
  );
  const b64 = (a: Uint8Array) => btoa(String.fromCharCode(...a));
  return `${b64(iv)}:${b64(ct)}`;
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function logEvent(
  userId: string,
  bankId: string | null,
  eventType: string,
  details: Record<string, unknown> | null,
  ip: string,
  ua: string,
) {
  await admin.from("bank_connection_events").insert({
    user_id: userId,
    bank_id: bankId,
    event_type: eventType,
    details: details ?? {},
    ip_address: ip || null,
    user_agent: ua || null,
  });
}

async function checkRateLimit(userId: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("bank_connection_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", "connect_attempt")
    .gte("created_at", oneHourAgo);
  return (count ?? 0) < RATE_LIMIT_PER_HOUR;
}

async function notifyUserWA(userId: string, bankId: string, action: "connected" | "disconnected") {
  if (!WA_SERVER_URL || !WA_API_KEY) return;
  const { data: wa } = await admin
    .from("whatsapp_users")
    .select("phone_number")
    .eq("user_id", userId)
    .maybeSingle();
  if (!wa?.phone_number) return;

  const display = BANK_DISPLAY[bankId] ?? bankId;
  const verb = action === "connected" ? "חובר" : "נותק";
  const message = `🔔 *התראת אבטחה — Lazy Finance*\n\nחשבון *${display}* ${verb} זה עתה לחשבון שלך.\n\nאם זה לא היית אתה, היכנס מיד ל:\nhttps://lazy-finance.vercel.app/settings\nונתק את החיבור.`;

  try {
    await fetch(`${WA_SERVER_URL}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": WA_API_KEY },
      body: JSON.stringify({ phone: wa.phone_number, message }),
    });
  } catch {
    // notification is best-effort
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
  const ua = req.headers.get("user-agent") ?? "";

  // Authenticate the caller via their JWT.
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "missing auth" }, 401);

  const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "invalid auth" }, 401);
  const userId = userData.user.id;

  // Parse and validate body.
  let body: { bank_id?: string; display_name?: string; credentials?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const bankId = (body.bank_id ?? "").trim();

  // Rate limit BEFORE any heavy work, scoped per-user.
  const allowed = await checkRateLimit(userId);
  if (!allowed) {
    await logEvent(userId, bankId || null, "rate_limited", { limit: RATE_LIMIT_PER_HOUR, window_minutes: 60 }, ip, ua);
    return json({ error: `נחסם זמנית — מקסימום ${RATE_LIMIT_PER_HOUR} ניסיונות חיבור לשעה. נסה שוב בעוד שעה.` }, 429);
  }

  // Always log the attempt (counts toward rate limit).
  await logEvent(userId, bankId || null, "connect_attempt", { bank_id: bankId }, ip, ua);

  if (!ALLOWED_BANKS.has(bankId)) return json({ error: "unsupported bank" }, 400);

  const required = FIELDS_BY_BANK[bankId];
  const creds = body.credentials ?? {};
  for (const f of required) {
    const v = creds[f];
    if (typeof v !== "string" || v.length === 0) {
      return json({ error: `missing field: ${f}` }, 400);
    }
  }
  const cleanCreds: Record<string, string> = {};
  for (const f of required) cleanCreds[f] = creds[f];

  // Gate: until owner finishes validating his own bank flow, only admins can
  // connect. Relax back to is_approved-only once stable.
  const { data: settings } = await admin
    .from("user_settings")
    .select("is_approved, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!settings?.is_approved) {
    await logEvent(userId, bankId, "connect_rejected_unapproved", null, ip, ua);
    return json({ error: "user not approved" }, 403);
  }
  if (settings.role !== "admin") {
    await logEvent(userId, bankId, "connect_rejected_non_admin", null, ip, ua);
    return json({ error: "החיבור לבנק עדיין בבדיקה — יהיה זמין בקרוב" }, 403);
  }

  let ciphertext: string;
  try {
    ciphertext = await encryptCredentials(JSON.stringify(cleanCreds));
  } catch (e) {
    await logEvent(userId, bankId, "connect_rejected_crypto", { error: String(e) }, ip, ua);
    return json({ error: "encryption failure" }, 500);
  }

  const { error: upsertErr } = await admin
    .from("bank_connections")
    .upsert(
      {
        user_id: userId,
        bank_id: bankId,
        display_name: body.display_name?.trim() || null,
        credentials_encrypted: ciphertext,
        is_active: true,
        last_error: null,
        last_sync_status: null,
        consecutive_failures: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,bank_id" },
    );

  if (upsertErr) {
    await logEvent(userId, bankId, "connect_db_error", { error: upsertErr.message }, ip, ua);
    return json({ error: upsertErr.message }, 500);
  }

  await logEvent(userId, bankId, "connected", { fields: required }, ip, ua);
  // Fire-and-forget security notification.
  notifyUserWA(userId, bankId, "connected").catch(() => {});

  return json({ ok: true, bank_id: bankId });
});
