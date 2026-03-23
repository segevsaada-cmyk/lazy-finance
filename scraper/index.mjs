/**
 * Lazy Finance — Bank Scraper
 * Fetches transactions from Otsar HaHayal and syncs to Supabase.
 * Runs daily via Railway cron.
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_USER_ID        — your user ID from Supabase Auth
 *   BANK_USERNAME           — תעודת זהות
 *   BANK_PASSWORD           — סיסמה
 *   BANK_DAYS_BACK          — how many days back to fetch (default: 30)
 */

import { createScraper, CompanyTypes } from 'israeli-bank-scrapers';
import { createClient } from '@supabase/supabase-js';

// ──────────────────────────────────────────
// Config
// ──────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID = process.env.SUPABASE_USER_ID;
const BANK_USERNAME = process.env.BANK_USERNAME;
const BANK_PASSWORD = process.env.BANK_PASSWORD;
const DAYS_BACK = parseInt(process.env.BANK_DAYS_BACK || '30', 10);

if (!SUPABASE_URL || !SERVICE_KEY || !USER_ID || !BANK_USERNAME || !BANK_PASSWORD) {
  console.error('❌ Missing required environment variables. Check README.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ──────────────────────────────────────────
// Category guesser (Hebrew + English keywords)
// ──────────────────────────────────────────
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

// ──────────────────────────────────────────
// Main
// ──────────────────────────────────────────
async function run() {
  console.log(`🏦 Lazy Finance Scraper — Otsar HaHayal`);
  console.log(`📅 Fetching last ${DAYS_BACK} days...`);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DAYS_BACK);

  const scraper = createScraper({
    companyId: CompanyTypes.OtsarHaHayal,
    startDate,
    combineInstallments: false,
    showBrowser: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let result;
  try {
    result = await scraper.scrape({
      username: BANK_USERNAME,
      password: BANK_PASSWORD,
    });
  } catch (err) {
    console.error('❌ Scraper threw an error:', err.message);
    process.exit(1);
  }

  if (!result.success) {
    console.error(`❌ Scraper failed: ${result.errorType} — ${result.errorMessage}`);
    process.exit(1);
  }

  console.log(`✅ Scraper connected. Accounts found: ${result.accounts.length}`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const account of result.accounts) {
    console.log(`\n  Account: ${account.accountNumber} (${account.txns.length} txns)`);

    for (const tx of account.txns) {
      // Skip pending transactions
      if (tx.status === 'pending') {
        skipped++;
        continue;
      }

      const amount = Math.abs(Number(tx.chargedAmount ?? tx.originalAmount ?? 0));
      if (amount === 0) { skipped++; continue; }

      const type = (tx.chargedAmount ?? tx.originalAmount ?? 0) < 0 ? 'expense' : 'income';
      const date = (tx.date ?? tx.processedDate ?? new Date().toISOString()).split('T')[0];
      const description = [tx.description, tx.memo].filter(Boolean).join(' — ');

      // Stable dedup key: account + identifier or date+amount+description
      const bankId = `otzar-${account.accountNumber}-${tx.identifier ?? `${date}-${amount}-${(tx.description ?? '').slice(0, 20)}`}`;

      // Check if already imported
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('bank_identifier', bankId)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const { error } = await supabase.from('transactions').insert({
        user_id: USER_ID,
        type,
        amount,
        category_id: guessCategory(description, type),
        note: description || null,
        date,
        is_recurring: false,
        bank_identifier: bankId,
      });

      if (error) {
        console.error(`  ⚠️  Insert error for "${description}":`, error.message);
        errors++;
      } else {
        console.log(`  ✅ ${type === 'income' ? '💰' : '💸'} ${amount} ₪ — ${description.slice(0, 40)}`);
        imported++;
      }
    }
  }

  console.log(`\n📊 Summary: ${imported} imported, ${skipped} skipped, ${errors} errors`);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
