require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');

const app = express();
app.use(express.json());

const API_KEY = process.env.API_KEY;
if (!API_KEY || API_KEY.length < 16) {
  console.error('FATAL: API_KEY env var missing or too short (need ≥16 chars).');
  process.exit(1);
}
const PORT = process.env.PORT || 3002;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

// Whitelisted dir for /send-media file_path (prevents arbitrary host file read).
const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR || path.join(__dirname, 'media'));

// Bot connects to a dedicated WA account (e.g. business number 0557201465)
// and replies only to the user's personal number (0524844686).
const USER_PHONE = process.env.LAZY_FINANCE_USER_PHONE || '0524844686';
function phoneToJid(phone) {
  const digits = String(phone).replace(/\D/g, '');
  const normalized = digits.startsWith('972') ? digits : digits.replace(/^0/, '972');
  return `${normalized}@s.whatsapp.net`;
}
const USER_JID = phoneToJid(USER_PHONE);

const KNOWLEDGE_PATH = path.join(__dirname, 'knowledge.md');
let KNOWLEDGE = '';
try {
  KNOWLEDGE = fs.readFileSync(KNOWLEDGE_PATH, 'utf8');
  console.log(`📚 Loaded knowledge.md (${KNOWLEDGE.length} chars)`);
} catch (e) {
  console.warn('⚠️  No knowledge.md found — bot will run without context.');
}

// ─── Arbox Lead Pipeline ─────────────────────────────────────────────────────
// Detects "נכנס ליד חדש" messages arriving at this WA account and forwards
// them to the Supabase edge function (which creates an Arbox lead with the
// correct owner / status / source). State file dedupes by msgId + phone.
const LEAD_MARKER = 'נכנס ליד חדש';
// Upgrade ("אפגרייד") sends this welcome bot message FROM Segev's account
// directly to each new lead. The message itself = lead-arrival signal.
const UPGRADE_MARKER = 'איזה כיף שפנית';
const ARBOX_WEBHOOK_URL = process.env.ARBOX_WEBHOOK_URL;
const ARBOX_WEBHOOK_BEARER = process.env.SUPABASE_ANON_KEY;
if (!ARBOX_WEBHOOK_URL || !ARBOX_WEBHOOK_BEARER) {
  console.warn('⚠️  ARBOX_WEBHOOK_URL or SUPABASE_ANON_KEY missing — Arbox lead forwarding disabled.');
}
const PROCESSED_LEADS_FILE = path.join(__dirname, 'processed_leads.json');

function loadProcessedLeads() {
  try { return JSON.parse(fs.readFileSync(PROCESSED_LEADS_FILE, 'utf8')); }
  catch { return { msg_ids: {}, phones: {} }; }
}
function saveProcessedLeads(state) {
  try { fs.writeFileSync(PROCESSED_LEADS_FILE, JSON.stringify(state, null, 2)); }
  catch (e) { console.error('processed_leads write failed:', e.message); }
}

function parseLeadMessage(text) {
  const nameM = /שם:\s*([^\n]+)/.exec(text);
  const phoneM = /טלפון:\s*([\d\-\s+]+)/.exec(text);
  if (!nameM || !phoneM) return null;
  const areaM = /איזור[^:]*:\s*([^\n]+)/.exec(text);
  const gradeM = /באיזה כיתה[^:]*:\s*([^\n]+)/.exec(text);
  let phone = phoneM[1].replace(/[\s\-]/g, '');
  if (phone.startsWith('+')) {
    // already international
  } else if (phone.startsWith('972')) {
    phone = '+' + phone;
  } else if (phone.startsWith('0')) {
    phone = '+972' + phone.slice(1);
  } else {
    phone = '+972' + phone;
  }
  return {
    first_name: nameM[1].trim(),
    phone,
    area: areaM ? areaM[1].trim() : '',
    grade: gradeM ? gradeM[1].trim() : '',
  };
}

async function pushLeadToArbox(lead) {
  // last_name carries the source label (כרישים במדיה / אפגרייד) so Segev can
  // identify the channel at a glance in Arbox.
  const payload = {
    first_name: lead.first_name,
    last_name: lead.last_name || 'כרישים במדיה',
    phone: lead.phone,
    area: lead.area,
    grade: lead.grade,
    source: 'whatsapp',
    comment: lead.comment || 'וואטסאפ (auto)',
  };
  const res = await fetch(ARBOX_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ARBOX_WEBHOOK_BEARER}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

async function handleUpgradeLead(chatJid, msgKey) {
  const phoneDigits = chatJid.replace(/@.*/, '').replace(/\D/g, '');
  if (!phoneDigits || phoneDigits.length < 9) return;
  const phone = '+' + (phoneDigits.startsWith('972') ? phoneDigits : '972' + phoneDigits.replace(/^0/, ''));
  const state = loadProcessedLeads();
  if (state.phones[phone]) {
    console.log(`⏭  upgrade phone already pushed: ${phone}`);
    return;
  }
  const last4 = phone.slice(-4);
  const lead = {
    first_name: 'ליד ' + last4,
    last_name: 'אפגרייד',
    phone,
    comment: 'ליד אוטומטי מבוט אפגרייד',
  };
  console.log(`🎯 NEW UPGRADE LEAD: ${phone}`);
  try {
    const r = await pushLeadToArbox(lead);
    console.log(`   → webhook ${r.status}: ${JSON.stringify(r.data).slice(0, 300)}`);
    if (r.ok) {
      state.phones[phone] = { ts: Date.now(), msgId: msgKey?.id || '', name: lead.first_name, source: 'upgrade' };
      saveProcessedLeads(state);
    } else {
      console.error(`   ❌ upgrade webhook returned ${r.status}, NOT marking processed`);
    }
  } catch (e) {
    console.error(`   ❌ upgrade webhook error: ${e.message}`);
  }
}

async function handleIncomingLead(text, msgKey) {
  const state = loadProcessedLeads();
  const msgId = msgKey?.id || '';
  if (msgId && state.msg_ids[msgId]) {
    console.log(`⏭  lead msg already processed: ${msgId}`);
    return;
  }
  const lead = parseLeadMessage(text);
  if (!lead) {
    console.log('⚠️  lead marker found but parse failed (missing שם/טלפון)');
    return;
  }
  if (state.phones[lead.phone]) {
    console.log(`⏭  phone already pushed: ${lead.phone} (${lead.first_name})`);
    if (msgId) {
      state.msg_ids[msgId] = { phone: lead.phone, ts: Date.now(), dup: true };
      saveProcessedLeads(state);
    }
    return;
  }
  console.log(`🎯 NEW LEAD: ${lead.first_name} (${lead.phone}) area=${lead.area} grade=${lead.grade}`);
  try {
    const r = await pushLeadToArbox(lead);
    console.log(`   → webhook ${r.status}: ${JSON.stringify(r.data).slice(0, 300)}`);
    if (r.ok) {
      state.phones[lead.phone] = { ts: Date.now(), msgId, name: lead.first_name };
      if (msgId) state.msg_ids[msgId] = { phone: lead.phone, ts: Date.now(), ok: true };
      saveProcessedLeads(state);
    } else {
      console.error(`   ❌ webhook returned ${r.status}, NOT marking processed`);
    }
  } catch (e) {
    console.error(`   ❌ webhook error: ${e.message}`);
  }
}

const BOT_MARKER = '🤖';
const HISTORY_LIMIT = 10;
const conversationHistory = new Map();

let sock = null;
let qrCode = null;
let isConnected = false;
let reconnectTimer = null;
let myJid = null;

const logger = pino({ level: 'warn' });

// Calls Claude via the local `claude` CLI (uses the OAuth token in the macOS keychain).
// This bypasses the need for a sk-ant-api03 API key.
function askClaude(history) {
  return new Promise((resolve, reject) => {
    // Build a single user prompt: latest user message; prior turns embedded.
    const userTurn = history[history.length - 1]?.content ?? '';
    const transcript = history
      .slice(0, -1)
      .map(t => `${t.role === 'user' ? 'משתמש' : 'בוט'}: ${t.content}`)
      .join('\n');
    const fullPrompt = transcript
      ? `שיחה עד כה:\n${transcript}\n\n--- שאלה חדשה ---\n${userTurn}`
      : userTurn;

    let ctx = '', sales = '', objections = '';
    try { ctx = fs.readFileSync(path.join(__dirname, '..', 'brief-context.md'), 'utf8'); } catch {}
    try { sales = fs.readFileSync(path.join(__dirname, '..', 'sales-playbook.md'), 'utf8'); } catch {}
    try { objections = fs.readFileSync(path.join(__dirname, '..', 'objections-full.md'), 'utf8'); } catch {}
    sales = sales + '\n\n' + objections;
    const persona = `אתה העוזר העסקי + מאמן המכירות של שגב (מאמן לילדים ונוער, בעל "סופר קידס"). ענה בעברית, קצר וישיר. כלל ברזל: לעולם לא משקל/דיאטה/קלוריות — רק ביטחון עצמי, רגש, שמחת תנועה. אתה יכול: לענות על שאלות עסקיות/פיננסיות; לאמן מכירות; ולשחק "הורה מתנגד" ל-roleplay כשמבקשים (תתנגד מציאותית, ואז תן פידבק קצר על התשובה של שגב). הסתמך על:\n\n=== הקשר עסקי ===\n${ctx}\n\n=== מערכת מכירות ===\n${sales}\n\n=== ידע פיננסי ===\n${KNOWLEDGE}`;
    const args = ['--print', '--model', 'sonnet', '--append-system-prompt', persona, fullPrompt];
    const env = { ...process.env }; delete env.ANTHROPIC_API_KEY;
    const child = spawn('claude', args, { stdio: ['ignore', 'pipe', 'pipe'], env });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Claude CLI timed out (60s)'));
    }, 60_000);
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`Claude CLI exit ${code}: ${stderr.trim()}`));
      resolve(stdout.trim());
    });
  });
}

function requireKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.key;
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function toJid(phone) {
  const digits = String(phone).replace(/\D/g, '');
  const normalized = digits.startsWith('972') ? digits : digits.replace(/^0/, '972');
  return `${normalized}@s.whatsapp.net`;
}

// ── Calendar command helpers (bot → Google Calendar via super-kids edge fn) ──
const SK_FUNCTIONS_URL = process.env.SK_FUNCTIONS_URL || '';
const SK_SERVICE_KEY = process.env.SK_SERVICE_KEY || '';
const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
function claudeParseJSON(prompt) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env }; delete env.ANTHROPIC_API_KEY;
    const child = spawn('claude', ['-p', '--model', 'sonnet', prompt], { stdio: ['ignore', 'pipe', 'pipe'], env });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d.toString(); });
    child.stderr.on('data', d => { err += d.toString(); });
    const t = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('claude timeout')); }, 60000);
    child.on('error', e => { clearTimeout(t); reject(e); });
    child.on('close', c => { clearTimeout(t); c === 0 ? resolve(out.trim()) : reject(new Error('claude exit ' + c)); });
  });
}
async function addCalendarEvent(desc) {
  if (!SK_FUNCTIONS_URL || !SK_SERVICE_KEY) throw new Error('יומן לא מוגדר (חסר SK_*)');
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const prompt = `היום ${today}, יום ${HEB_DAYS[now.getDay()]}. נתח את תיאור האימון והחזר אך ורק JSON תקין: {"summary":"כותרת קצרה","date":"YYYY-MM-DD","start":"HH:MM","duration_min":45}. פתור ימים יחסיים (היום/מחר/ראשון עד שבת) למופע הקרוב הבא. ברירת מחדל משך 45 דקות. תיאור: "${desc}". החזר JSON בלבד.`;
  const raw = await claudeParseJSON(prompt);
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('לא הצלחתי לפענח את הפרטים');
  const ev = JSON.parse(m[0]);
  const [h, mi] = String(ev.start).split(':').map(Number);
  const dur = Number(ev.duration_min) || 45;
  const endMin = h * 60 + mi + dur;
  const startISO = `${ev.date}T${pad(h)}:${pad(mi)}:00+03:00`;
  const endISO = `${ev.date}T${pad(Math.floor(endMin / 60) % 24)}:${pad(endMin % 60)}:00+03:00`;
  const res = await fetch(`${SK_FUNCTIONS_URL}/gcal-add-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SK_SERVICE_KEY}` },
    body: JSON.stringify({ summary: ev.summary, startISO, endISO, description: desc }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || 'שגיאת יומן');
  return { summary: ev.summary, date: ev.date, start: ev.start };
}

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_state');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: true,
    browser: ['Lazy Finance', 'Chrome', '120.0'],
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
    keepAliveIntervalMs: 25_000,
    // Skip init queries — fetchProps times out on current WA protocol and
    // triggers connection drops every ~20min (code 408/428).
    fireInitQueries: false,
    // Don't broadcast online presence — avoids conflict with the phone WA app.
    markOnlineOnConnect: false,
    // Faster retry on transient errors
    retryRequestDelayMs: 250,
  });

  sock.ev.on('creds.update', saveCreds);

  // Pairing-code login (more reliable than QR scanning — "Link with phone
  // number instead"). Enabled by setting PAIR_PHONE=972XXXXXXXXX in .env.
  // Only fires when the session is not yet registered.
  if (process.env.PAIR_PHONE && !sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(process.env.PAIR_PHONE.replace(/\D/g, ''));
        const pretty = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log(`\n🔗🔗 PAIRING CODE: ${pretty}\n   WhatsApp → Linked Devices → "Link with phone number instead"\n`);
        try { fs.writeFileSync('/tmp/wa-pairing-code.txt', pretty); } catch (_) {}
      } catch (e) { console.error('❌ pairing code error:', e.message); }
    }, 3000);
  }

  // Track message IDs we sent to prevent loops
  const sentMessageIds = new Set();

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    // Debug: log every message event to understand what arrives
    for (const m of messages) {
      const t = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
      const messageTypes = m.message ? Object.keys(m.message).join(',') : 'NO_MESSAGE';
      console.log(`🔎 [event=${type}] from=${m.key.remoteJid} participant=${m.key.participant || '-'} fromMe=${m.key.fromMe} types=[${messageTypes}] text="${t.slice(0,60)}"`);
      if (!t && m.message) {
        console.log('   FULL MESSAGE:', JSON.stringify(m.message).slice(0, 400));
      }
    }
    if (type !== 'notify' && type !== 'append') return;
    if (!myJid) return;

    // Arbox lead detection — runs before AI whitelist so leads from any
    // sender (Make/Zapier/manual paste) are captured. fromMe=true is also
    // honored so leads forwarded by Segev himself still flow through.
    for (const m of messages) {
      const txt = m.message?.conversation
        || m.message?.extendedTextMessage?.text
        || '';
      if (txt.includes(LEAD_MARKER)) {
        try { await handleIncomingLead(txt, m.key); }
        catch (e) { console.error('lead handler error:', e.message); }
      }
      // Upgrade welcome bot — fires from our own account to a new lead's chat.
      // Trigger only on outbound messages to direct chats (not groups).
      const caption = m.message?.imageMessage?.caption
        || m.message?.videoMessage?.caption
        || '';
      const chatJid = m.key?.remoteJid || '';
      if (m.key?.fromMe
          && chatJid.endsWith('@s.whatsapp.net')
          && (txt.includes(UPGRADE_MARKER) || caption.includes(UPGRADE_MARKER))) {
        try { await handleUpgradeLead(chatJid, m.key); }
        catch (e) { console.error('upgrade lead handler error:', e.message); }
      }
    }

    // STRICT WHITELIST
    // - Direct phone: must match this list (for @s.whatsapp.net chats)
    // - LID identifier: must match (for privacy-protected chats)
    // The @lid is per-conversation, learned dynamically: we save the LID once we
    // confirm a message came from the allowed phone (via senderKey/participant).
    const ALLOWED_PHONES = ['972524844686'];
    const ALLOWED_LIDS_FILE = path.join(__dirname, 'allowed_lids.txt');
    let ALLOWED_LIDS = new Set();
    try {
      if (fs.existsSync(ALLOWED_LIDS_FILE)) {
        ALLOWED_LIDS = new Set(fs.readFileSync(ALLOWED_LIDS_FILE, 'utf8').split('\n').filter(Boolean));
      }
    } catch {}

    for (const msg of messages) {
      try {
        const chatJid = msg.key.remoteJid;
        if (!chatJid) continue;
        // Skip groups, broadcasts, status
        if (chatJid.endsWith('@g.us')) continue;
        if (chatJid.endsWith('@broadcast')) continue;
        if (chatJid.endsWith('@status')) continue;
        // Allow the owner's "message yourself" notes (fromMe → own number);
        // still skip our own outbound to OTHER chats.
        const isSelfChat = msg.key.fromMe && chatJid === myJid;
        if (msg.key.fromMe && !isSelfChat) continue;
        if (msg.key.id && sentMessageIds.has(msg.key.id)) continue;

        // Identify the sender across both formats
        let allowed = isSelfChat;
        if (chatJid.endsWith('@s.whatsapp.net')) {
          const senderPhone = chatJid.replace(/@.*/, '');
          if (isSelfChat || ALLOWED_PHONES.includes(senderPhone)) {
            allowed = true;
          } else {
            console.log(`🚫 phone NOT whitelisted: ${senderPhone}`);
            continue;
          }
        } else if (chatJid.endsWith('@lid')) {
          // Check senderPn (the underlying phone number, sometimes attached to LID messages)
          const senderPn = msg.key.senderPn || msg.key.participantPn || '';
          const senderPnDigits = String(senderPn).replace(/\D/g, '');
          if (senderPnDigits && ALLOWED_PHONES.some(p => senderPnDigits.endsWith(p) || p.endsWith(senderPnDigits))) {
            allowed = true;
            // Remember this LID for future messages without senderPn
            ALLOWED_LIDS.add(chatJid);
            try { fs.writeFileSync(ALLOWED_LIDS_FILE, [...ALLOWED_LIDS].join('\n')); } catch {}
          } else if (ALLOWED_LIDS.has(chatJid)) {
            allowed = true;
          } else {
            console.log(`🚫 LID not yet whitelisted: ${chatJid} (senderPn=${senderPn || 'unknown'})`);
            continue;
          }
        } else {
          console.log(`🚫 unknown chat type: ${chatJid}`);
          continue;
        }
        if (!allowed) continue;

        const text = msg.message?.conversation
          || msg.message?.extendedTextMessage?.text
          || '';
        if (!text.trim()) continue;
        if (text.startsWith(BOT_MARKER)) continue;
        const cleanText = text.trim();

        // --- Morning-brief task inbox ---
        // Owner notes sent during the day are saved for the 06:00 brief.
        //   "נקה"/"אפס משימות"  → clear the list
        //   "משימות"            → list current tasks
        //   "?<question>"       → route to the finance advisor (falls through)
        //   anything else       → saved as a task ("✅ נשמר")
        const TASKS_FILE = path.join(__dirname, '..', 'morning_tasks.json');
        const cmd = cleanText.replace(/[!.׃:]/g, '').trim();
        const replyOwner = async (t) => {
          const s = await sock.sendMessage(chatJid, { text: `${BOT_MARKER} ${t}` });
          if (s?.key?.id) sentMessageIds.add(s.key.id);
        };
        if (cleanText.startsWith('יומן')) {
          const desc = cleanText.replace(/^יומן[:\s]+/, '').trim();
          if (!desc) {
            await replyOwner('📅 כתוב: יומן: <תיאור> <יום> <שעה>\nלמשל: יומן: זוגי דניאל ורעי שלישי 19:30');
          } else {
            try {
              const ev = await addCalendarEvent(desc);
              await replyOwner(`✅ נוסף ליומן: ${ev.summary}\n📅 ${ev.date} בשעה ${ev.start}`);
            } catch (e) { await replyOwner(`❌ לא הצלחתי להוסיף ליומן: ${e.message}`); }
          }
          continue;
        }
        if (['נקה', 'נקה משימות', 'אפס', 'אפס משימות'].includes(cmd)) {
          try { fs.writeFileSync(TASKS_FILE, '[]'); } catch {}
          await replyOwner('🧹 רשימת המשימות אופסה.');
          continue;
        }
        if (['משימות', 'מה המשימות', 'רשימה'].includes(cmd)) {
          let list = '(אין משימות פתוחות)';
          try {
            const a = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8')).filter(t => !t.done);
            if (a.length) list = a.map((t, i) => `${i + 1}. ${t.text}`).join('\n');
          } catch {}
          await replyOwner(`📋 המשימות שלך:\n${list}`);
          continue;
        }
        // "זכור:" / "תזכור:" → append to durable business memory (brief-context)
        if (/^(זכור|תזכור)[\s:]/.test(cleanText)) {
          const note = cleanText.replace(/^(זכור|תזכור)[\s:]+/, '').trim();
          try {
            const ctxPath = path.join(__dirname, '..', 'brief-context.md');
            const stamp = new Date().toISOString().slice(0, 10);
            fs.appendFileSync(ctxPath, `\n- (${stamp}) ${note}`);
            await replyOwner(`🧠 שמרתי בזיכרון: ${note}`);
          } catch (e) { await replyOwner(`❌ לא הצלחתי לשמור: ${e.message}`); }
          continue;
        }
        // "משימה:" / "תזכורת:" → add to the morning-brief task list
        if (/^(משימה|תזכורת)[\s:]/.test(cleanText)) {
          const t = cleanText.replace(/^(משימה|תזכורת)[\s:]+/, '').trim();
          let count = 0;
          try {
            let arr = []; try { arr = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8')); } catch {}
            if (!Array.isArray(arr)) arr = [];
            arr.push({ text: t, ts: new Date().toISOString(), done: false });
            fs.writeFileSync(TASKS_FILE, JSON.stringify(arr, null, 2));
            count = arr.filter(x => !x.done).length;
          } catch (e) { console.error('task save error:', e.message); }
          await replyOwner(`✅ נוסף למשימות (${count} במאגר)`);
          continue;
        }
        // anything else → conversational assistant (with business context)

        const history = conversationHistory.get(chatJid) || [];
        history.push({ role: 'user', content: cleanText });
        while (history.length > HISTORY_LIMIT * 2) history.shift();

        console.log(`📨 [from=${chatJid} type=${type} fromMe=${msg.key.fromMe}] ${text.slice(0, 80)}`);

        let reply;
        try {
          reply = await askClaude(history);
        } catch (e) {
          console.error('Claude error:', e.message);
          reply = `שגיאה זמנית: ${e.message}`;
        }

        history.push({ role: 'assistant', content: reply });
        conversationHistory.set(chatJid, history);

        const sent = await sock.sendMessage(chatJid, { text: `${BOT_MARKER} ${reply}` });
        if (sent?.key?.id) sentMessageIds.add(sent.key.id);
        console.log(`📤 replied (${reply.length} chars)`);
      } catch (e) {
        console.error('handler error:', e.message);
      }
    }
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCode = qr;
      isConnected = false;
      console.log('\n📱 QR ready — scan with WhatsApp → Settings → Linked Devices:\n');
      try {
        const ascii = await QRCode.toString(qr, { type: 'terminal', small: true });
        console.log(ascii);
      } catch (e) {
        console.log('Could not render ASCII QR:', e.message);
      }
    }

    if (connection === 'open') {
      isConnected = true;
      qrCode = null;
      const rawJid = sock.user?.id || '';
      const digits = rawJid.split(':')[0].split('@')[0];
      myJid = `${digits}@s.whatsapp.net`;
      console.log(`✅ Lazy Finance WhatsApp connected as ${myJid}`);
    }

    if (connection === 'close') {
      isConnected = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log(`❌ Connection closed (code ${code}) — reconnect: ${shouldReconnect}`);
      if (shouldReconnect) {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 5000);
      } else {
        const fs = require('fs');
        fs.rmSync('./auth_state', { recursive: true, force: true });
        qrCode = null;
        setTimeout(connect, 2000);
      }
    }
  });
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', connected: isConnected, server: 'lazy-finance' });
});

app.get('/status', requireKey, (_req, res) => {
  res.json({ connected: isConnected, hasQR: !!qrCode });
});

app.get('/qr', requireKey, async (_req, res) => {
  if (isConnected) return res.json({ message: 'Already connected' });
  if (!qrCode) return res.status(202).json({ message: 'QR not ready yet' });
  try {
    const png = await QRCode.toBuffer(qrCode, { type: 'png', width: 400 });
    res.set('Content-Type', 'image/png');
    res.send(png);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/send', requireKey, async (req, res) => {
  if (!isConnected) return res.status(503).json({ error: 'WhatsApp not connected' });
  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'phone and message required' });
  try {
    await sock.sendMessage(toJid(phone), { text: message });
    res.json({ success: true, phone });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Send a media file (video / image / document) by absolute path on disk.
// Body: { phone, file_path, kind: 'video'|'image'|'document', caption?, mimetype?, filename? }
app.post('/send-media', requireKey, async (req, res) => {
  if (!isConnected) return res.status(503).json({ error: 'WhatsApp not connected' });
  const { phone, file_path, kind = 'video', caption = '', mimetype, filename } = req.body || {};
  if (!phone || !file_path) return res.status(400).json({ error: 'phone and file_path required' });
  try {
    // Whitelist: file_path MUST resolve under MEDIA_DIR (no traversal, no symlinks).
    const resolved = fs.realpathSync(path.resolve(file_path));
    if (!resolved.startsWith(MEDIA_DIR + path.sep) && resolved !== MEDIA_DIR) {
      return res.status(403).json({ error: 'file_path outside whitelisted MEDIA_DIR' });
    }
    if (!fs.existsSync(resolved)) return res.status(400).json({ error: `file not found` });
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) return res.status(400).json({ error: 'not a regular file' });
    if (stat.size > 50 * 1024 * 1024) return res.status(413).json({ error: 'file too large (50MB max)' });
    const buffer = fs.readFileSync(resolved);
    const baseName = filename || path.basename(resolved);

    let payload;
    if (kind === 'image') {
      payload = { image: buffer, caption, mimetype: mimetype || 'image/jpeg' };
    } else if (kind === 'document') {
      payload = { document: buffer, mimetype: mimetype || 'application/octet-stream', fileName: baseName, caption };
    } else {
      // video (default) — Instagram-friendly H.264/AAC MP4 plays inline.
      // Explicitly disable gifPlayback so audio is preserved (otherwise Baileys
      // may auto-detect short clips as GIFs and strip the audio track).
      payload = {
        video: buffer,
        caption,
        mimetype: mimetype || 'video/mp4',
        fileName: baseName,
        gifPlayback: false,
        ptv: false,
      };
    }

    const sent = await sock.sendMessage(toJid(phone), payload);
    res.json({ success: true, phone, kind, bytes: buffer.length, message_id: sent?.key?.id || null });
  } catch (e) {
    console.error('[send-media error]', e);
    res.status(500).json({ error: e.message });
  }
});

// Fetch a publicly-hosted video URL and broadcast as a WhatsApp video
// message with caption — used by Super Kids welcome flow (baileys-send-roi
// edge function) so video files don't need to be on this server's disk
// inside MEDIA_DIR. Same security as other endpoints (requireKey).
app.post('/broadcast-video-url', requireKey, async (req, res) => {
  if (!isConnected) return res.status(503).json({ error: 'WhatsApp not connected' });
  const { phones, videoUrl, caption } = req.body || {};
  if (!phones?.length || !videoUrl) {
    return res.status(400).json({ error: 'phones[] and videoUrl required' });
  }
  let videoBuffer;
  try {
    const r = await fetch(videoUrl);
    if (!r.ok) return res.status(400).json({ error: `fetch ${r.status} for ${videoUrl}` });
    videoBuffer = Buffer.from(await r.arrayBuffer());
  } catch (e) {
    return res.status(400).json({ error: `fetch failed: ${e.message}` });
  }
  if (videoBuffer.length > 16 * 1024 * 1024) {
    return res.status(400).json({ error: `video too large: ${videoBuffer.length} bytes` });
  }
  const results = { sent: 0, failed: 0, errors: [] };
  for (let i = 0; i < phones.length; i++) {
    const phone = phones[i];
    try {
      await sock.sendMessage(toJid(phone), {
        video: videoBuffer,
        caption: caption || '',
        mimetype: 'video/mp4',
        gifPlayback: false,
        ptv: false,
      });
      results.sent++;
    } catch (e) {
      results.failed++;
      results.errors.push({ phone, error: e.message });
    }
    if (i < phones.length - 1) {
      const delay = 8000 + Math.floor(Math.random() * 4001);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  res.json(results);
});

app.get('/group/:jid', requireKey, async (req, res) => {
  if (!isConnected) return res.status(503).json({ error: 'WA not connected' });
  try {
    const jid = req.params.jid.endsWith('@g.us') ? req.params.jid : `${req.params.jid}@g.us`;
    const meta = await sock.groupMetadata(jid);
    res.json({
      id: meta.id,
      subject: meta.subject,
      desc: meta.desc,
      owner: meta.owner,
      creation: meta.creation,
      participants: meta.participants?.map(p => ({ id: p.id, admin: p.admin })) || [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/logout', requireKey, async (_req, res) => {
  try { await sock?.logout(); } catch {}
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🚀 Lazy Finance WhatsApp Server running on port ${PORT}`);
  connect();
});
