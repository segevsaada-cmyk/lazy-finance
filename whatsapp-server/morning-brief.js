#!/usr/bin/env node
// Lazy Finance — Smart Morning Brief (06:00)
// Pulls the owner's captured tasks + Lazy Finance numbers + standing business
// context, asks the Claude CLI to compose a tight Hebrew brief, and sends it
// via the local WA server to BRIEF_PHONE.
require('dotenv').config();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3002;
const API_KEY = process.env.API_KEY || 'lazy-finance-wa-2026';
const TARGET = process.env.BRIEF_PHONE || '0557201465';
const DATA_DIR = path.join(__dirname, '..'); // ~/Library/Application Support/lazy-wa
const TASKS_FILE = path.join(DATA_DIR, 'morning_tasks.json');
const CONTEXT_FILE = path.join(DATA_DIR, 'brief-context.md');
const SUPA_URL = process.env.LAZY_SUPABASE_URL || 'https://jamltyybiemjpmbmvobt.supabase.co';
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SEGEV_UID = process.env.SEGEV_UID || '663457e3-af7c-4976-9606-66e51ab8ed3c';

const ils = (n) => '₪' + Math.round(n).toLocaleString('en-US');
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function loadTasks() {
  try {
    const a = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
    return Array.isArray(a) ? a.filter((t) => !t.done) : [];
  } catch { return []; }
}
function loadContext() {
  try { return fs.readFileSync(CONTEXT_FILE, 'utf8'); } catch { return ''; }
}

async function financeSummary() {
  if (!SRK) return 'נתוני Lazy Finance לא זמינים כרגע.';
  const now = new Date();
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const headers = { apikey: SRK, Authorization: `Bearer ${SRK}` };
  const q = `${SUPA_URL}/rest/v1/transactions?user_id=eq.${SEGEV_UID}&date=gte.${ymd(monthStart)}&select=type,amount,date`;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(q, { headers, signal: ctrl.signal });
    clearTimeout(to);
    if (!res.ok) return `שליפת נתונים פיננסיים נכשלה (HTTP ${res.status}).`;
    const rows = await res.json();
    let inM = 0, exM = 0, inY = 0, exY = 0;
    const yStr = ymd(yest);
    for (const r of rows) {
      const amt = Number(r.amount) || 0;
      const inc = r.type === 'income';
      if (inc) inM += amt; else exM += amt;
      if (String(r.date).startsWith(yStr)) { if (inc) inY += amt; else exY += amt; }
    }
    return `מתחילת החודש: הכנסות ${ils(inM)} · הוצאות ${ils(exM)} · נטו ${ils(inM - exM)}.\n`
      + `אתמול: הכנסות ${ils(inY)} · הוצאות ${ils(exY)}.`;
  } catch (e) { return `נתונים פיננסיים לא זמינים (${e.message}).`; }
}

function buildPrompt(tasks, finance, context) {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const now = new Date();
  const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  const taskList = tasks.length
    ? tasks.map((t, i) => `${i + 1}. ${t.text}`).join('\n')
    : '(לא נכתבו משימות חדשות)';
  return `אתה העוזר האישי-עסקי של שגב. צור "בריף בוקר" קצר, חד וברור בעברית לשליחה בוואטסאפ.
היום: יום ${days[now.getDay()]}, ${dateStr}.

== משימות שכתב שגב ==
${taskList}

== מצב פיננסי (Lazy Finance) ==
${finance}

== הקשר עסקי קבוע ==
${context || '(אין)'}

הנחיות פלט:
- פתח ב"בוקר טוב 🌅" קצר.
- "המשימות שלך להיום" — עד 5, ממוינות לפי דחיפות; כל אחת בשורה אחת עם פעולה ברורה. שלב את מה שכתב שגב יחד עם מה שעולה מההקשר (מחנה קיץ / החזרים / אימון).
- שורה פיננסית אחת אם רלוונטי.
- סיים במשפט מנייע אחד.
- בלי הקדמות, בלי לחזור על ההוראות — רק ההודעה עצמה. עד ~12 שורות.`;
}

// Uses the local Claude Code CLI (subscription-based, no API cost). The invalid
// ANTHROPIC_API_KEY from .env is stripped so the CLI falls back to the
// logged-in subscription instead of trying the dead key.
function askClaude(prompt) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    const child = spawn('claude', ['-p', '--model', 'sonnet', prompt], { stdio: ['ignore', 'pipe', 'pipe'], env });
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    const t = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('claude CLI timeout')); }, 90000);
    child.on('error', (e) => { clearTimeout(t); reject(e); });
    child.on('close', (c) => { clearTimeout(t); c === 0 ? resolve(out.trim()) : reject(new Error(`claude exit ${c}: ${err.trim()}`)); });
  });
}

async function send(message) {
  const res = await fetch(`http://localhost:${PORT}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ phone: TARGET, message }),
  });
  return res.json();
}

(async () => {
  const tasks = loadTasks();
  const finance = await financeSummary();
  const context = loadContext();
  let brief;
  try {
    brief = await askClaude(buildPrompt(tasks, finance, context));
    if (!brief) throw new Error('empty brief');
  } catch (e) {
    console.error(`[${new Date().toISOString()}] ⚠️ AI brief failed (${e.message}) — sending plain fallback`);
    const list = tasks.length ? tasks.map((t, i) => `${i + 1}. ${t.text}`).join('\n') : '(אין משימות חדשות)';
    brief = `🌅 בוקר טוב!\n\n*המשימות שלך להיום:*\n${list}\n\n💰 ${finance}`;
  }
  try {
    const r = await send(brief);
    if (r.success) {
      console.log(`[${new Date().toISOString()}] ✅ morning brief sent to ${TARGET} (${tasks.length} tasks)`);
      process.exit(0);
    }
    console.error(`[${new Date().toISOString()}] ❌ send failed:`, r);
    process.exit(1);
  } catch (e) {
    console.error(`[${new Date().toISOString()}] ❌ send error:`, e.message);
    process.exit(1);
  }
})();
