// Lazy Finance — shared security helpers for /api/* serverless functions.
//
// Each helper returns an `ok` boolean + sends a JSON response (and the
// caller `return`s immediately). This pattern keeps the per-endpoint code
// flat and the security policy auditable in one place.

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Auth — verify the Supabase JWT in the Authorization header.
// On success returns { user }. On failure responds 401 and returns null.
// ─────────────────────────────────────────────────────────────────────────
export async function requireUser(req, res) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token || token.length < 20) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(503).json({ error: 'auth not configured' });
    return null;
  }
  const sb = adminClient();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  return data.user;
}

// ─────────────────────────────────────────────────────────────────────────
// Rate limit — bumps a Postgres bucket via SECURITY DEFINER RPC.
// `key`: opaque string (e.g. "advisor:userId" or "login:ip"). `max`: per
// `windowSeconds` window. Returns true if allowed, false if 429 was sent.
// ─────────────────────────────────────────────────────────────────────────
export async function enforceRateLimit(req, res, key, max, windowSeconds = 60) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    // Fail closed in prod, fail open in dev where supabase isn't configured.
    return process.env.NODE_ENV === 'production'
      ? (res.status(503).json({ error: 'rate limiter unavailable' }), false)
      : true;
  }
  const sb = adminClient();
  const { data, error } = await sb.rpc('bump_rate_limit', {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    // Don't take down the API if the limiter has a hiccup — log and continue.
    console.error('rate_limit error:', error.message);
    return true;
  }
  if (!data?.allowed) {
    res.setHeader('Retry-After', String(windowSeconds));
    res.status(429).json({ error: 'too many requests', limit: max, window_seconds: windowSeconds });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// Daily AI token budget — checks (and later records) Anthropic spend
// per user. Cap is generous for legitimate use, hard for abusers.
// ─────────────────────────────────────────────────────────────────────────
export async function checkAiBudget(res, userId, maxTokens) {
  const sb = adminClient();
  const { data, error } = await sb.rpc('check_ai_budget', {
    p_user_id: userId,
    p_max_tokens: maxTokens,
  });
  if (error) {
    console.error('check_ai_budget error:', error.message);
    return true; // fail open on internal error
  }
  if (!data?.allowed) {
    res.status(429).json({
      error: 'daily AI budget exceeded',
      used: data.used,
      limit: data.limit,
    });
    return false;
  }
  return true;
}

export async function recordAiTokens(userId, tokens) {
  if (!tokens || tokens <= 0) return;
  const sb = adminClient();
  const { error } = await sb.rpc('record_ai_tokens', {
    p_user_id: userId,
    p_tokens: tokens,
  });
  if (error) console.error('record_ai_tokens error:', error.message);
}

// ─────────────────────────────────────────────────────────────────────────
// Best-effort client IP. Vercel sets x-forwarded-for; first hop is the
// real client. Used only as a rate-limit key, never trusted for authz.
// ─────────────────────────────────────────────────────────────────────────
export function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────
// AI input filter — block obvious prompt-injection / jailbreak phrases
// before they reach Claude. Not exhaustive (the model itself is the last
// line of defense per the system-prompt rules), but cheaply kills the
// low-effort attacks. Returns null if safe, error string if blocked.
// ─────────────────────────────────────────────────────────────────────────
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|prompts|rules)/i,
  /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|prompts|rules)/i,
  /(reveal|show|print|output|reveal\s+me|tell\s+me)\s+(your|the)\s+(system\s+)?(prompt|instructions|rules)/i,
  /(you\s+are\s+now|act\s+as|pretend\s+(to\s+be|you\s+are)|role[- ]?play\s+as)\s+/i,
  /(jailbreak|developer\s+mode|DAN\s+mode|sudo\s+mode)/i,
  /(forget\s+(everything|all|previous)|reset\s+(your\s+)?(instructions|persona))/i,
  /<\|.*?\|>|\[INST\]|<<SYS>>/i, // instruction-tuning sentinels
  // Hebrew variants
  /(התעלם|תתעלם)\s+(מכל|מה[־-]?)?(הוראות|הכללים|המערכת)/i,
  /(גלה|הצג|תן\s+לי)\s+את\s+(ה[־-]?)?(הוראות|פרומפט|הנחיות)\s+המערכת/i,
];

export function detectPromptInjection(text) {
  if (!text || typeof text !== 'string') return null;
  for (const p of INJECTION_PATTERNS) {
    if (p.test(text)) return 'BLOCKED_INJECTION_PATTERN';
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Output scrubber — strip anything that looks like a leaked secret before
// returning AI output to the client. We use placeholders so the response
// stays grammatical.
// ─────────────────────────────────────────────────────────────────────────
const SECRET_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{20,}/g,           // Anthropic
  /sk_live_[A-Za-z0-9]{20,}/g,            // Stripe live
  /AKIA[0-9A-Z]{16}/g,                     // AWS access key id
  /(eyJ[A-Za-z0-9_-]+\.){2}[A-Za-z0-9_-]+/g, // JWT shape
  /\b(?:postgres|postgresql):\/\/[^\s]+/gi,    // DB URLs
];

export function scrubSecrets(text) {
  if (!text) return text;
  let out = text;
  for (const p of SECRET_PATTERNS) {
    out = out.replace(p, '[REDACTED]');
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Twilio signature verification — validate that an incoming request was
// actually sent by Twilio using the auth-token-signed X-Twilio-Signature.
// See https://www.twilio.com/docs/usage/security#validating-requests
// ─────────────────────────────────────────────────────────────────────────
export function verifyTwilioSignature(req, fullUrl) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;
  const signature = req.headers['x-twilio-signature'];
  if (!signature) return false;

  const params = req.body && typeof req.body === 'object' ? req.body : {};
  const sortedKeys = Object.keys(params).sort();
  let data = fullUrl;
  for (const k of sortedKeys) data += k + String(params[k]);

  const expected = crypto.createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Generic guards.
// ─────────────────────────────────────────────────────────────────────────
export function requireMethod(req, res, method) {
  if (req.method !== method) {
    res.setHeader('Allow', method);
    res.status(405).json({ error: 'method not allowed' });
    return false;
  }
  return true;
}

export function rejectIfTooLarge(req, res, maxBytes = 32 * 1024) {
  const len = parseInt(req.headers['content-length'] || '0', 10);
  if (len > maxBytes) {
    res.status(413).json({ error: 'payload too large', max_bytes: maxBytes });
    return false;
  }
  return true;
}
