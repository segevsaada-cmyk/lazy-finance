/**
 * Lazy Finance — Multi-User Bank Scraper
 * Reads encrypted bank credentials from public.bank_connections, decrypts each
 * with BANK_CRED_KEY (AES-256-GCM), scrapes the right provider via
 * israeli-bank-scrapers, and writes transactions for that user.
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   BANK_CRED_KEY              base64(32 bytes), shared with connect-bank edge fn
 *   BANK_DAYS_BACK             optional, default 30
 */

import { createScraper, CompanyTypes } from 'israeli-bank-scrapers';
import { createClient } from '@supabase/supabase-js';
import { createDecipheriv } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BANK_CRED_KEY_B64 = process.env.BANK_CRED_KEY;
const DAYS_BACK = parseInt(process.env.BANK_DAYS_BACK || '30', 10);

if (!SUPABASE_URL || !SERVICE_KEY || !BANK_CRED_KEY_B64) {
  console.error('❌ Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BANK_CRED_KEY required.');
  process.exit(1);
}

const KEY_BYTES = Buffer.from(BANK_CRED_KEY_B64, 'base64');
if (KEY_BYTES.length !== 32) {
  console.error('❌ BANK_CRED_KEY must decode to 32 bytes.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─────────────────────────────────────────────────────────────
// Crypto — must match connect-bank edge function format
// stored = base64(iv12) + ":" + base64(ciphertext + tag16)
// ─────────────────────────────────────────────────────────────
function decryptCredentials(stored) {
  const [ivB64, ctTagB64] = stored.split(':');
  if (!ivB64 || !ctTagB64) throw new Error('malformed ciphertext');
  const iv = Buffer.from(ivB64, 'base64');
  const ctTag = Buffer.from(ctTagB64, 'base64');
  if (iv.length !== 12 || ctTag.length < 17) throw new Error('bad iv/tag length');
  const tag = ctTag.subarray(ctTag.length - 16);
  const ct = ctTag.subarray(0, ctTag.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', KEY_BYTES, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  return JSON.parse(plain);
}

// ─────────────────────────────────────────────────────────────
// Map our bank_id → CompanyTypes enum
// ─────────────────────────────────────────────────────────────
const BANK_ID_TO_COMPANY = {
  hapoalim: CompanyTypes.hapoalim,
  leumi: CompanyTypes.leumi,
  mizrahi: CompanyTypes.mizrahi,
  discount: CompanyTypes.discount,
  mercantile: CompanyTypes.mercantile,
  otsarHahayal: CompanyTypes.otsarHahayal,
  max: CompanyTypes.max,
  visaCal: CompanyTypes.visaCal,
  isracard: CompanyTypes.isracard,
  amex: CompanyTypes.amex,
  union: CompanyTypes.union,
  beinleumi: CompanyTypes.beinleumi,
  massad: CompanyTypes.massad,
  yahav: CompanyTypes.yahav,
  beyahadBishvilha: CompanyTypes.beyahadBishvilha,
  behatsdaa: CompanyTypes.behatsdaa,
  pagi: CompanyTypes.pagi,
};

// ─────────────────────────────────────────────────────────────
// Category guesser (Hebrew + English keywords)
// ─────────────────────────────────────────────────────────────
function guessCategory(description = '', type) {
  if (type === 'income') {
    if (/משכורת|שכר|salary|wage/i.test(description)) return 'salary';
    if (/פרילנס|freelance|שירות/i.test(description)) return 'freelance';
    return 'other-income';
  }
  const d = description.toLowerCase();
  if (/סופר|מעדניה|שוק|שופרסל|רמי לוי|victory|mega|yochananof/i.test(d)) return 'shopping';
  if (/מסעדה|קפה|אוכל|פיצה|בורגר|sushi|cafe|coffee|restaurant|pizza|burger/i.test(d)) return 'restaurants';
  if (/דלק|סונול|פז|elf|delek|fuel|חניה|parking/i.test(d)) return 'car';
  if (/ביטוח|insurance/i.test(d)) return 'bills';
  if (/חשמל|מים|גז|ועד בית|בזק|hot|yes|partner|cellcom|012|013|electric/i.test(d)) return 'bills';
  if (/בריאות|רופא|מאוחדת|כללית|מכבי|pharmacy|אחות|קופת חולים/i.test(d)) return 'health';
  if (/חינוך|גן ילדים|בי"ס|אוניברסיטה|טכניון|course|לימוד|תואר/i.test(d)) return 'education';
  if (/נסיעות|אל על|arkia|flight|airbnb|booking|hotel|מלון/i.test(d)) return 'travel';
  if (/אמזון|amazon|aliexpress|ebay|online/i.test(d)) return 'shopping';
  if (/ספורט|gym|מכון כושר|pool|בריכה/i.test(d)) return 'sports';
  if (/טכנולוגיה|apple|google|microsoft|spotify|netflix|software/i.test(d)) return 'technology';
  return 'other';
}

// ─────────────────────────────────────────────────────────────
// Scrape one connection
// ─────────────────────────────────────────────────────────────
async function scrapeOne(connection) {
  const { id, user_id, bank_id } = connection;
  const company = BANK_ID_TO_COMPANY[bank_id];
  if (!company) throw new Error(`unsupported bank_id: ${bank_id}`);

  const credentials = decryptCredentials(connection.credentials_encrypted);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DAYS_BACK);

  const scraper = createScraper({
    companyId: company,
    startDate,
    combineInstallments: false,
    showBrowser: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const result = await scraper.scrape(credentials);
  if (!result.success) {
    throw new Error(`${result.errorType}: ${result.errorMessage}`);
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const account of result.accounts ?? []) {
    for (const tx of account.txns ?? []) {
      if (tx.status === 'pending') { skipped++; continue; }

      const amount = Math.abs(Number(tx.chargedAmount ?? tx.originalAmount ?? 0));
      if (amount === 0) { skipped++; continue; }

      const type = (tx.chargedAmount ?? tx.originalAmount ?? 0) < 0 ? 'expense' : 'income';
      const date = (tx.date ?? tx.processedDate ?? new Date().toISOString()).split('T')[0];
      const description = [tx.description, tx.memo].filter(Boolean).join(' — ');

      const bankIdent = `${bank_id}-${account.accountNumber}-${tx.identifier ?? `${date}-${amount}-${(tx.description ?? '').slice(0, 20)}`}`;

      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', user_id)
        .eq('bank_identifier', bankIdent)
        .maybeSingle();
      if (existing) { skipped++; continue; }

      const { error } = await supabase.from('transactions').insert({
        user_id,
        type,
        amount,
        category_id: guessCategory(description, type),
        note: description || null,
        date,
        is_recurring: false,
        bank_identifier: bankIdent,
      });

      if (error) { errors++; console.error(`    insert error: ${error.message}`); }
      else imported++;
    }
  }

  return { connectionId: id, imported, skipped, errors, accounts: result.accounts?.length ?? 0 };
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function run() {
  console.log(`🏦 Lazy Finance Scraper — multi-user (${DAYS_BACK} days back)`);

  const { data: connections, error } = await supabase
    .from('bank_connections')
    .select('id, user_id, bank_id, credentials_encrypted')
    .eq('is_active', true);

  if (error) { console.error('❌ Failed to load connections:', error.message); process.exit(1); }
  if (!connections || connections.length === 0) {
    console.log('No active bank connections. Nothing to do.');
    return;
  }

  console.log(`Found ${connections.length} active connection(s).\n`);

  let totalImported = 0;
  let totalErrors = 0;

  for (const conn of connections) {
    const label = `${conn.bank_id} (user ${conn.user_id.slice(0, 8)})`;
    console.log(`▶ ${label}`);
    const startedAt = Date.now();
    try {
      const stats = await scrapeOne(conn);
      const ms = Date.now() - startedAt;
      console.log(`  ✅ ${stats.imported} imported, ${stats.skipped} skipped, ${stats.errors} insert-errors, ${stats.accounts} accounts (${ms}ms)`);
      totalImported += stats.imported;
      totalErrors += stats.errors;

      await supabase.from('bank_connections').update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: stats.errors > 0 ? 'partial' : 'ok',
        last_error: null,
      }).eq('id', conn.id);
    } catch (err) {
      console.error(`  ❌ ${label}: ${err.message}`);
      totalErrors++;
      await supabase.from('bank_connections').update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'error',
        last_error: err.message?.slice(0, 500) ?? 'unknown error',
      }).eq('id', conn.id);
    }
  }

  console.log(`\n📊 Done. ${totalImported} transactions imported across all users. ${totalErrors} error(s).`);
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
