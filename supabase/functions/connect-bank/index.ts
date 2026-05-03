// Lazy Finance — Connect Bank
// Receives plaintext bank credentials from the user, encrypts them with
// AES-256-GCM, and upserts a row in public.bank_connections.
//
// The encryption key (BANK_CRED_KEY) is a 32-byte base64 string shared with
// the scraper. Plaintext credentials never touch the database.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BANK_CRED_KEY_B64 = Deno.env.get("BANK_CRED_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

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
  if (!ALLOWED_BANKS.has(bankId)) return json({ error: "unsupported bank" }, 400);

  const required = FIELDS_BY_BANK[bankId];
  const creds = body.credentials ?? {};
  for (const f of required) {
    const v = creds[f];
    if (typeof v !== "string" || v.length === 0) {
      return json({ error: `missing field: ${f}` }, 400);
    }
  }
  // Strip any unexpected fields.
  const cleanCreds: Record<string, string> = {};
  for (const f of required) cleanCreds[f] = creds[f];

  // Approval gate: only approved users can connect a bank.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: settings } = await admin
    .from("user_settings")
    .select("is_approved")
    .eq("user_id", userId)
    .maybeSingle();
  if (!settings?.is_approved) return json({ error: "user not approved" }, 403);

  const ciphertext = await encryptCredentials(JSON.stringify(cleanCreds));

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
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,bank_id" },
    );

  if (upsertErr) return json({ error: upsertErr.message }, 500);
  return json({ ok: true, bank_id: bankId });
});
