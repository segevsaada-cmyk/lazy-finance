/**
 * Max — direct API fetch via an authenticated persistent browser profile.
 * Bypasses israeli-bank-scrapers' broken/OTP login: opens the saved profile
 * (~/.lazy-max-profile), and if logged in, calls Max's internal transactions
 * API for each month of 2026 and inserts into Supabase.
 *
 * If the profile session expired, opens a visible window for manual re-login.
 * Run:  node --env-file=.env max-fetch.mjs
 */
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { homedir } from 'node:os';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROFILE_DIR = process.env.MAX_PROFILE_DIR || `${homedir()}/.lazy-max-profile`;
const API = 'https://onlinelcapi.max.co.il';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Resolve the Max connection (user_id) from the DB
const { data: conn } = await supabase
  .from('bank_connections').select('id,user_id').eq('bank_id', 'max').maybeSingle();
if (!conn) { console.error('No max connection row'); process.exit(1); }
const USER_ID = conn.user_id;

function guessCategory(desc = '') {
  const d = desc.toLowerCase();
  if (/סופר|מעדניה|שוק|שופרסל|רמי לוי|victory|mega|yochananof|אושר עד|טיב טעם|אמזון|amazon/i.test(d)) return 'groceries';
  if (/מסעדה|קפה|אוכל|פיצה|בורגר|sushi|cafe|coffee|restaurant|pizza|burger|wolt|10ביס|תן ביס/i.test(d)) return 'food';
  if (/דלק|סונול|פז|delek|fuel|חניה|חנייה|parking|כביש 6|רב.?קו|רכבת|אוטובוס/i.test(d)) return 'car';
  if (/חשמל|מים|גז|ועד בית|בזק|hot|yes|partner|cellcom|electric|ביטוח|insurance|ארנונה/i.test(d)) return 'utilities';
  if (/סלולר|פלאפון|פרטנר|הוט מובייל|גולן טלקום/i.test(d)) return 'phone';
  if (/בריאות|רופא|מאוחדת|כללית|מכבי|pharmacy|בית מרקחת|דנטל|שיניים|סופר.?פארם|super.?pharm/i.test(d)) return 'health';
  if (/אל על|arkia|flight|airbnb|booking|hotel|מלון|טיסה|חופשה|נופש/i.test(d)) return 'travel';
  if (/zara|h&m|fox|castro|פוקס|קסטרו|זארה|ביגוד|נעליים/i.test(d)) return 'clothing';
  if (/מספרה|תספורת|טיפוח|איפור|קוסמטיקה|מניקור|פדיקור|spa|ספא/i.test(d)) return 'beauty';
  if (/ספורט|gym|חדר כושר|הולמס|crossfit|פילאטיס|יוגה|אופניים|בריכה/i.test(d)) return 'sport';
  if (/apple|google|microsoft|אייפון|iphone|מקבוק|מחשב|software|תוכנה|מנוי דיגיטלי/i.test(d)) return 'tech';
  if (/netflix|spotify|disney|youtube|נטפליקס|ספוטיפיי|דיסני|סרט|הצגה|תיאטרון|בידור/i.test(d)) return 'entertainment';
  if (/שכירות|שכר.?דירה/i.test(d)) return 'rent';
  return 'other_expense';
}

const browser = await puppeteer.launch({
  headless: false,
  userDataDir: PROFILE_DIR,
  defaultViewport: null,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
});
const page = (await browser.pages())[0] || (await browser.newPage());

async function fetchMonth(year, month) {
  const date = `${year}-${month}-01`;
  const filter = `{"userIndex":-1,"cardIndex":-1,"monthView":true,"date":"${date}","dates":{"startDate":"0","endDate":"0"},"bankAccount":{"bankAccountIndex":-1,"cards":null}}`;
  const url = `${API}/api/registered/transactionDetails/getTransactionsAndGraphs?filterData=${encodeURIComponent(filter)}&firstCallCardIndex=-1`;
  return page.evaluate(async (u) => {
    try {
      const r = await fetch(u, { credentials: 'include', headers: { Accept: 'application/json' } });
      if (!r.ok) return { _err: r.status };
      return await r.json();
    } catch (e) { return { _err: String(e) }; }
  }, url);
}

console.log('→ Opening Max login. PLEASE LOG IN in the window (username + password + SMS code).');
await page.goto('https://www.max.co.il/login', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

// Wait until the transactions API actually authorizes (not 403) — robust auth check.
const thisMonth = new Date().getUTCMonth() + 1;
let authed = false;
for (let i = 0; i < 60; i++) { // up to ~5 min
  const probe = await fetchMonth(2026, thisMonth);
  if (!probe?._err) { authed = true; break; }
  if (i === 0) console.log('   ...waiting for you to finish login (probing API every 5s)...');
  await new Promise((r) => setTimeout(r, 5000));
}
if (!authed) { console.log('❌ Not authenticated within time limit. Aborting.'); await browser.close(); process.exit(1); }
console.log('✓ Authenticated — API responding. Pulling all of 2026...');

let imported = 0, skipped = 0, errors = 0, total = 0;
const now = new Date();
for (let m = 1; m <= now.getUTCMonth() + 1; m++) {
  const data = await fetchMonth(2026, m);
  if (data?._err) { console.log(`  month ${m}: API error ${data._err}`); errors++; continue; }
  const txns = data?.result?.transactions || [];
  console.log(`  2026-${String(m).padStart(2, '0')}: ${txns.length} transactions`);
  for (const t of txns) {
    if (!t.merchantName || t.actualPaymentAmount == null) { skipped++; continue; }
    total++;
    const amount = Math.abs(Number(t.actualPaymentAmount));
    if (amount === 0) { skipped++; continue; }
    const date = (t.purchaseDate || t.paymentDate || '').split('T')[0];
    const desc = [t.merchantName?.trim(), t.comments].filter(Boolean).join(' — ');
    const ident = `max-${t.shortCardNumber}-${t.dealData?.arn || `${date}-${amount}-${(t.merchantName || '').slice(0, 15)}`}`;
    const { data: ex } = await supabase.from('transactions').select('id').eq('user_id', USER_ID).eq('bank_identifier', ident).maybeSingle();
    if (ex) { skipped++; continue; }
    const { error } = await supabase.from('transactions').insert({
      user_id: USER_ID, type: 'expense', amount,
      category_id: guessCategory(desc), note: desc || null, date,
      is_recurring: false, bank_identifier: ident,
    });
    if (error) { errors++; console.log('    insert err:', error.message); } else imported++;
  }
}

await supabase.from('bank_connections').update({
  last_sync_at: new Date().toISOString(),
  last_sync_status: errors && !imported ? 'error' : 'ok',
  last_error: null, is_active: true, consecutive_failures: 0,
}).eq('id', conn.id);

console.log(`\n📊 Max: ${imported} imported, ${skipped} skipped, ${errors} errors (of ${total} seen).`);
await browser.close();
process.exit(0);
