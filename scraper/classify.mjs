/**
 * Classification engine: seed tx_rules, apply scope+category to all transactions.
 * scope: business | personal | internal | (null=needs review)
 * Run: node --env-file=.env classify.mjs
 */
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: conn } = await supabase.from('bank_connections').select('user_id').limit(1).maybeSingle();
const USER = conn.user_id;

// Ordered rules — first match wins. [pattern, scope, category]
const RULES = [
  ['העברת משכורות|העברה מהחשבון|העברה ב.?BIT|^משכורת|הפקדת מזומן', 'internal', 'העברה'],
  ['כרישים|קמפיינר|שיווק פייסבוק|פייסבוק', 'business', 'שיווק'],
  ['Tok|אורן גרגו|יופיגי', 'business', 'ליווי (הופסק)'],
  ['מע"מ|מעמ|ביטוח לאומי|מס הכנסה', 'business', 'מסים'],
  ['זכאים|דותן כהן|אליאור', 'business', 'ייעוץ/הנהח"ש'],
  ['CLAUDE|ANTHROPIC|TWILIO|CHATGPT|OPENAI|WORKSPACE|VERCEL|GITHUB|CURSOR', 'business', 'תוכנה'],
  ['רמקול|פליימובייל', 'business', 'ציוד'],
  ['פריים|ליסינג|ליס ', 'business', 'רכב/ליסינג'],
  ['פז |פז$|סונול|דלק|paz|delek|תחנת', 'business', 'דלק (רכב עסקי)'],
  ['טעינות|חבר שלי', 'personal', 'דלק אישי'],
  ['דביר צוברי|מאמן ריצה|אליה בונן', 'personal', 'אימון אישי'],
  ['מקס איט פיננסים', 'personal', 'אשראי'],
  ['דקאתלון|אדידס|נייקי|ZARA|קסטרו|פוקס', 'personal', 'ספורט/ביגוד'],
  ['לאקי ציקן|בלייזפוד|מסעד|קפה|פיצה|בורגר|wolt|ארומה|מאפ|ציקן|בוטקה', 'personal', 'אוכל בחוץ'],
  ['אלכוהול', 'personal', 'אחר'],
  ['APPLE|GOOGLE ONE|GOOGLE PLAY', 'personal', 'מנויים'],
  ['ריבית על מסגרת', 'business', 'ריבית/עמלות'],
  ['הראל|פלא קארד|אי.אר.אן|ביטוח', 'business', 'ביטוח/שירותים'],
];
const compiled = RULES.map(([p, s, c]) => [new RegExp(p, 'i'), s, c]);

// seed tx_rules (clear + insert)
await supabase.from('tx_rules').delete().eq('user_id', USER);
await supabase.from('tx_rules').insert(RULES.map(([pattern, scope, category]) => ({ user_id: USER, pattern, scope, category })));
console.log(`seeded ${RULES.length} rules`);

// card default scope for unmatched
function cardDefault(bi) {
  if (!bi) return 'business';            // manual entries → mostly business
  if (bi.startsWith('max-')) return 'personal';
  return 'business';                      // isracard(Hever)+otsar → business
}

// fetch all 2026 transactions
const { data: txns } = await supabase.from('transactions').select('id,note,amount,type,bank_identifier,date')
  .gte('date', '2026-01-01').lte('date', '2026-06-28').limit(2000);

let matched = 0, defaulted = 0;
const stats = {};
for (const t of txns) {
  const note = (t.note || '');
  let scope = null, cat = null;
  for (const [re, s, c] of compiled) { if (re.test(note)) { scope = s; cat = c; break; } }
  if (scope) matched++; else { scope = cardDefault(t.bank_identifier); defaulted++; }
  await supabase.from('transactions').update({ scope, ...(cat ? { category_id: cat } : {}) }).eq('id', t.id);
  if (t.type === 'expense') stats[scope] = (stats[scope] || 0) + t.amount;
}
console.log(`classified ${txns.length}: ${matched} by rule, ${defaulted} by card-default`);
console.log('expense by scope:', Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, Math.round(v)])));
process.exit(0);
