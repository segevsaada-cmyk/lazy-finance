/**
 * Vercel Serverless — natural-language transaction categorizer (rule-based).
 * Pattern-matches Hebrew descriptions of transactions and returns a structured
 * row for the client to save.
 *
 * POST /api/categorize
 * Body: { text: string }
 * Reply: 200 { type, amount, categoryId, note }
 *      | 200 { needsClarification: true, question }
 *      | 400 { error }
 *
 * Defenses: method gate, body-size cap, JWT auth, per-user rate limit.
 */
import {
  requireMethod, rejectIfTooLarge, requireUser, enforceRateLimit,
} from './_lib/security.js';

const MAX_TEXT = 1000;

// Order matters — first match wins. Be specific before generic.
const KEYWORD_MAP = [
  // Expense — housing
  { rgx: /(?<![A-Za-z֐-׿])(שכירות|דירה לשכור|שכר דירה|שכר[ \-]?דירה)(?![A-Za-z֐-׿])/i, id: 'rent' },
  { rgx: /(?<![A-Za-z֐-׿])(ארנונה|חשמל|מים|גז|בזק|הוט|תאגיד מים|אינטרנט הביתי)(?![A-Za-z֐-׿])/i, id: 'utilities' },

  // Expense — car / transport
  { rgx: /(?<![A-Za-z֐-׿])(דלק|תחנת דלק|פז|דור אלון|סדש|סונול|טסט|רישוי רכב|ביטוח רכב|חניה|חנייה|רכבת|אוטובוס|מונית|רב[ \-]?קו|יוניקרדס|טסלה|כביש 6)(?![A-Za-z֐-׿])/i, id: 'car' },

  // Expense — groceries
  { rgx: /(?<![A-Za-z֐-׿])(סופר|מכולת|שופרסל|רמי לוי|מגה|טיב טעם|יוחננוף|ויקטורי|אושר עד|קניות לבית)(?![A-Za-z֐-׿])/i, id: 'groceries' },

  // Expense — food / restaurants
  { rgx: /(?<![A-Za-z֐-׿])(מסעדה|מסעדות|קפה|בית קפה|פיצה|פיצות|המבורגר|בורגר|סושי|פלאפל|שווארמה|ארוחה|מסעדנים|10ביס|תן ביס|וולט|wolt|takeaway|טייק[ \-]?אוואי|משלוח אוכל)(?![A-Za-z֐-׿])/i, id: 'food' },

  // Expense — entertainment
  { rgx: /(?<![A-Za-z֐-׿])(נטפליקס|נטפליקס|netflix|disney|disney plus|דיסני|spotify|ספוטיפיי|youtube premium|סינמטק|סרט|הצגה|תיאטרון|מופע|פסטיבל|בידור)(?![A-Za-z֐-׿])/i, id: 'entertainment' },

  // Expense — health
  { rgx: /(?<![A-Za-z֐-׿])(רופא|מרפאה|בריאות|תרופות|בית מרקחת|סופר[ \-]?פארם|super[ \-]?pharm|ניתוח|רנטגן|שיניים|דנטל|אופטומטריסט|פיזיותרפיה|פסיכולוג|טיפול)(?![A-Za-z֐-׿])/i, id: 'health' },

  // Expense — phone
  { rgx: /(?<![A-Za-z֐-׿])(סלולר|פלאפון|פרטנר|הוט מובייל|גולן טלקום|012 mobile|חבילת סלולר|טעינה לטלפון)(?![A-Za-z֐-׿])/i, id: 'phone' },

  // Expense — tech
  { rgx: /(?<![A-Za-z֐-׿])(מחשב|לפטופ|laptop|מקבוק|macbook|אייפון|iphone|אנדרואיד|android|טלפון|אוזניות|airpods|מצלמה|גאדג'?ט|תוכנה|מנוי דיגיטלי|ssd|כרטיס מסך|gpu|cpu|מקלדת|עכבר|מסך)(?![A-Za-z֐-׿])/i, id: 'tech' },

  // Expense — travel
  { rgx: /(?<![A-Za-z֐-׿])(טיסה|טיסות|חו"ל|חו״ל|חופשה בחו|מלון|airbnb|booking|חבילת נופש|רכב שכור|תיירות|נסיעה לחו)(?![A-Za-z֐-׿])/i, id: 'travel' },

  // Expense — education
  { rgx: /(?<![A-Za-z֐-׿])(קורס|קורסים|ספר|ספרים|לימודים|שכר[ \-]?לימוד|אוניברסיטה|מכללה|udemy|יודמי|coursera|מנוי לימודי|הרצאה|סמינר)(?![A-Za-z֐-׿])/i, id: 'education' },

  // Expense — clothing
  { rgx: /(?<![A-Za-z֐-׿])(ביגוד|בגדים|חולצה|מכנסיים|נעליים|שמלה|חליפה|zara|זארה|h&m|fox|פוקס|castro|קסטרו|caphir|מעיל|ז'?קט)(?![A-Za-z֐-׿])/i, id: 'clothing' },

  // Expense — sport
  { rgx: /(?<![A-Za-z֐-׿])(חדר כושר|מנוי כושר|gym|holmes place|הולמס פלייס|גולד'?ס|crossfit|קרוספיט|פילאטיס|יוגה|אופניים|ריצה|טריאתלון|ציוד ספורט)(?![A-Za-z֐-׿])/i, id: 'sport' },

  // Expense — beauty
  { rgx: /(?<![A-Za-z֐-׿])(מספרה|תספורת|טיפוח|איפור|מסקרה|שמפו|קוסמטיקה|מניקור|פדיקור|פייספ|לק|חינ?ה|spa|ספא|מסאז'?)(?![A-Za-z֐-׿])/i, id: 'beauty' },

  // Expense — gifts
  { rgx: /(?<![A-Za-z֐-׿])(מתנה|מתנות|יום הולדת|חתונה|בר מצווה|בת מצווה|ברית|מתנה לחבר|מתנה ל)(?![A-Za-z֐-׿])/i, id: 'gifts' },

  // Income
  { rgx: /(?<![A-Za-z֐-׿])(משכורת|שכר חודשי|שכר עבודה|תלוש|בונוס|13)(?![A-Za-z֐-׿])/i, id: 'salary', type: 'income' },
  { rgx: /(?<![A-Za-z֐-׿])(פרילנס|פרי[ \-]?לאנס|freelance|חשבונית|לקוח שילם|פרויקט)(?![A-Za-z֐-׿])/i, id: 'freelance', type: 'income' },
  { rgx: /(?<![A-Za-z֐-׿])(דיבידנד|ריבית|רווח השקעות|תיק השקעות|s&p|מניות|קרן נאמנות)(?![A-Za-z֐-׿])/i, id: 'investments', type: 'income' },
  { rgx: /(?<![A-Za-z֐-׿])(מתנה כספית|העברה במתנה|כסף במתנה|נתנו לי|מתנה מההורים)(?![A-Za-z֐-׿])/i, id: 'gift_income', type: 'income' },
];

const INCOME_HINTS = /(?<![A-Za-z֐-׿])(קיבלתי|התקבל|התקבלו|הופקד|שולם לי|שילמו לי|הופקדו|הגיע ל[חיש][שב])(?![A-Za-z֐-׿])/i;
const EXPENSE_HINTS = /(?<![A-Za-z֐-׿])(שילמתי|קניתי|הוצאתי|חייבו אותי|חויב|חיוב)(?![A-Za-z֐-׿])/i;

function extractAmount(text) {
  // Remove common Hebrew currency words to clean up
  const cleaned = text.replace(/ש["״]?ח|שקל(?:ים)?|nis|₪/gi, ' ');
  // Find first number (allow comma or dot decimals, optional thousand separators)
  const match = cleaned.match(/(\d{1,3}(?:[,]\d{3})+(?:\.\d+)?|\d+(?:[\.,]\d+)?)/);
  if (!match) return null;
  return parseFloat(match[1].replace(/,/g, ''));
}

function pickCategory(text) {
  for (const k of KEYWORD_MAP) {
    if (k.rgx.test(text)) return { id: k.id, type: k.type };
  }
  return null;
}

function pickType(text, categoryHint) {
  if (categoryHint?.type) return categoryHint.type;
  if (INCOME_HINTS.test(text)) return 'income';
  if (EXPENSE_HINTS.test(text)) return 'expense';
  return 'expense'; // default
}

function categorize(text) {
  const amount = extractAmount(text);
  if (amount === null || amount <= 0) {
    return { needsClarification: true, question: 'לא הצלחתי לקרוא את הסכום. כמה זה היה ב־ש"ח?' };
  }

  const categoryHint = pickCategory(text);
  const type = pickType(text, categoryHint);
  const categoryId = categoryHint?.id || (type === 'income' ? 'other_income' : 'other_expense');

  // Try to grab a brief note (anything after a separator or a clear noun, max 30 chars)
  let note = null;
  const noteMatch = text.match(/(?:על|עבור|ל[־\- ])\s*([^,.\n]{2,30})/);
  if (noteMatch) note = noteMatch[1].trim();

  return { type, amount, categoryId, note };
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;
  if (!rejectIfTooLarge(req, res, 8 * 1024)) return;

  const user = await requireUser(req, res);
  if (!user) return;

  if (!(await enforceRateLimit(req, res, `categorize:${user.id}`, 60, 60))) return;

  const { text } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text required' });
  }
  if (text.length > MAX_TEXT) {
    return res.status(400).json({ error: 'text too long', max_chars: MAX_TEXT });
  }

  const result = categorize(text.trim());
  return res.status(200).json(result);
}
