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

const API_KEY = process.env.API_KEY || 'lazy-finance-key';
const PORT = process.env.PORT || 3002;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

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

    const args = [
      '--print',
      '--model', 'sonnet',
      '--append-system-prompt', KNOWLEDGE,
      fullPrompt,
    ];
    const child = spawn('claude', args, { stdio: ['ignore', 'pipe', 'pipe'] });
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

  // Track message IDs we sent to prevent loops
  const sentMessageIds = new Set();

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    // Debug: log every message event to understand what arrives
    for (const m of messages) {
      const t = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
      const messageTypes = m.message ? Object.keys(m.message).join(',') : 'NO_MESSAGE';
      console.log(`🔎 [event=${type}] from=${m.key.remoteJid} fromMe=${m.key.fromMe} types=[${messageTypes}] text="${t.slice(0,60)}"`);
      if (!t && m.message) {
        console.log('   FULL MESSAGE:', JSON.stringify(m.message).slice(0, 400));
      }
    }
    if (type !== 'notify' && type !== 'append') return;
    if (!myJid) return;

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
        // Skip our own outbound messages
        if (msg.key.fromMe) continue;
        if (msg.key.id && sentMessageIds.has(msg.key.id)) continue;

        // Identify the sender across both formats
        let allowed = false;
        if (chatJid.endsWith('@s.whatsapp.net')) {
          const senderPhone = chatJid.replace(/@.*/, '');
          if (ALLOWED_PHONES.includes(senderPhone)) {
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

app.post('/logout', requireKey, async (_req, res) => {
  try { await sock?.logout(); } catch {}
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🚀 Lazy Finance WhatsApp Server running on port ${PORT}`);
  connect();
});
