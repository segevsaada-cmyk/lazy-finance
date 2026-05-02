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
 */

// Order matters — first match wins. Be specific before generic.
const KEYWORD_MAP = [
  // Expense — housing
  { rgx: /\b(שכירות|דירה לשכור|שכר דירה|שכר[ \-]?דירה)\b/i, id: 'rent' },
  { rgx: /\b(ארנונה|חשמל|מים|גז|בזק|הוט|תאגיד מים|אינטרנט הביתי)\b/i, id: 'utilities' },

  // Expense — car / transport
  { rgx: /\b(דלק|תחנת דלק|פז|דור אלון|סדש|סונול|טסט|רישוי רכב|ביטוח רכב|חניה|חנייה|רכבת|אוטובוס|מונית|רב[ \-]?קו|יוניקרדס|טסלה|כביש 6)\b/i, id: 'car' },

  // Expense — groceries
  { rgx: /\b(סופר|מכולת|שופרסל|רמי לוי|מגה|טיב טעם|יוחננוף|ויקטורי|אושר עד|קניות לבית)\b/i, id: 'groceries' },

  // Expense — food / restaurants
  { rgx: /\b(מסעדה|מסעדות|קפה|בית קפה|פיצה|פיצות|המבורגר|בורגר|סושי|פלאפל|שווארמה|ארוחה|מסעדנים|10ביס|תן ביס|וולט|wolt|takeaway|טייק[ \-]?אוואי|משלוח אוכל)\b/i, id: 'food' },

  // Expense — entertainment
  { rgx: /\b(נטפליקס|נטפליקס|netflix|disney|disney plus|דיסני|spotify|ספוטיפיי|youtube premium|סינמטק|סרט|הצגה|תיאטרון|מופע|פסטיבל|בידור)\b/i, id: 'entertainment' },

  // Expense — health
  { rgx: /\b(רופא|מרפאה|בריאות|תרופות|בית מרקחת|סופר[ \-]?פארם|super[ \-]?pharm|ניתוח|רנטגן|שיניים|דנטל|אופטומטריסט|פיזיותרפיה|פסיכולוג|טיפול)\b/i, id: 'health' },

  // Expense — phone
  { rgx: /\b(סלולר|פלאפון|פרטנר|הוט מובייל|גולן טלקום|012 mobile|חבילת סלולר|טעינה לטלפון)\b/i, id: 'phone' },

  // Expense — tech
  { rgx: /\b(מחשב|לפטופ|laptop|מקבוק|macbook|אייפון|iphone|אנדרואיד|android|טלפון|אוזניות|airpods|מצלמה|גאדג'?ט|תוכנה|מנוי דיגיטלי|ssd|כרטיס מסך|gpu|cpu|מקלדת|עכבר|מסך)\b/i, id: 'tech' },

  // Expense — travel
  { rgx: /\b(טיסה|טיסות|חו"ל|חו״ל|חופשה בחו|מלון|airbnb|booking|חבילת נופש|רכב שכור|תיירות|נסיעה לחו)\b/i, id: 'travel' },

  // Expense — education
  { rgx: /\b(קורס|קורסים|ספר|ספרים|לימודים|שכר[ \-]?לימוד|אוניברסיטה|מכללה|udemy|יודמי|coursera|מנוי לימודי|הרצאה|סמינר)\b/i, id: 'education' },

  // Expense — clothing
  { rgx: /\b(ביגוד|בגדים|חולצה|מכנסיים|נעליים|שמלה|חליפה|zara|זארה|h&m|fox|פוקס|castro|קסטרו|caphir|מעיל|ז'?קט)\b/i, id: 'clothing' },

  // Expense — sport
  { rgx: /\b(חדר כושר|מנוי כושר|gym|holmes place|הולמס פלייס|גולד'?ס|crossfit|קרוספיט|פילאטיס|יוגה|אופניים|ריצה|טריאתלון|ציוד ספורט)\b/i, id: 'sport' },

  // Expense — beauty
  { rgx: /\b(מספרה|תספורת|טיפוח|איפור|מסקרה|שמפו|קוסמטיקה|מניקור|פדיקור|פייספ|לק|חינ?ה|spa|ספא|מסאז'?)\b/i, id: 'beauty' },

  // Expense — gifts
  { rgx: /\b(מתנה|מתנות|יום הולדת|חתונה|בר מצווה|בת מצווה|ברית|מתנה לחבר|מתנה ל)\b/i, id: 'gifts' },

  // Income
  { rgx: /\b(משכורת|שכר חודשי|שכר עבודה|תלוש|בונוס|13)\b/i, id: 'salary', type: 'income' },
  { rgx: /\b(פרילנס|פרי[ \-]?לאנס|freelance|חשבונית|לקוח שילם|פרויקט)\b/i, id: 'freelance', type: 'income' },
  { rgx: /\b(דיבידנד|ריבית|רווח השקעות|תיק השקעות|s&p|מניות|קרן נאמנות)\b/i, id: 'investments', type: 'income' },
  { rgx: /\b(מתנה כספית|העברה במתנה|כסף במתנה|נתנו לי|מתנה מההורים)\b/i, id: 'gift_income', type: 'income' },
];

const INCOME_HINTS = /\b(קיבלתי|התקבל|התקבלו|הופקד|שולם לי|שילמו לי|הופקדו|הגיע ל[חיש][שב])\b/i;
const EXPENSE_HINTS = /\b(שילמתי|קניתי|הוצאתי|חייבו אותי|חויב|חיוב)\b/i;

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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const { text } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text required' });
  }

  const result = categorize(text.trim());
  return res.status(200).json(result);
}
