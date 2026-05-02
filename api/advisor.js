/**
 * Vercel Serverless — AI Financial Advisor (Lazy Finance)
 * POST /api/advisor
 * Body: { messages: [{role, content}], context: string }
 *
 * Uses prompt caching so the 35KB finance-wisdom knowledge base
 * (135 finance figures + frameworks) is paid once per 5min, not per request.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WISDOM_DOC = readFileSync(
  join(__dirname, '_data', 'finance_wisdom.md'),
  'utf8',
);

const PERSONA = `אתה יועץ פיננסי חכם, מקצועי ומועיל. אתה עוזר למשתמשים של Lazy Finance — אפליקציה ישראלית לניהול פיננסי אישי.

יש לך גישה לבסיס ידע של 135 דמויות פיננסיות מהמשפיעות בעולם — ציטוטים, שיטות וכללי אצבע (מצורף בהמשך כקונטקסט).

הנחיות:
- דבר אך ורק בעברית
- תן עצות פרקטיות, קצרות וברורות
- היה ישיר ולעניין — אל תכתוב פסקאות ארוכות
- אל תמציא מספרים שלא ניתנו לך
- כשמדובר בהשקעות — הדגש שאתה לא יועץ השקעות מורשה ויש להתייעץ עם איש מקצוע
- השתמש במספרים עם ₪ כשרלוונטי
- המצב הפיננסי של המשתמש מצורף בתחילת ההודעה האחרונה — אל תשאל עליו מחדש
- כשרלוונטי, התבסס במפורש על גישות מבסיס הידע (למשל "באפט אומר...", "כלל ה־300", וכו')
- אל תזכיר שמות של מנטורים או יוצרי תוכן ספציפיים שמהם נלקח המידע — בסיס הידע שלך הוא תמצית של מאות שעות תוכן פיננסי שעובדו מראש`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY_MISSING' });
  }

  const { messages = [], context = '' } = req.body ?? {};

  const trimmed = messages.slice(-10);

  const enhanced = trimmed.map((m, i) => {
    if (i === trimmed.length - 1 && m.role === 'user') {
      return {
        role: 'user',
        content: `*המצב הפיננסי הנוכחי שלי:*\n${context || 'אין נתונים זמינים לחודש הנוכחי.'}\n\n---\n\n${m.content}`,
      };
    }
    return { role: m.role, content: m.content };
  });

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: [
        { type: 'text', text: PERSONA },
        {
          type: 'text',
          text: WISDOM_DOC,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: enhanced,
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    res.json({
      content: textBlock?.text ?? '',
      cache_read_tokens: response.usage?.cache_read_input_tokens ?? 0,
      cache_create_tokens: response.usage?.cache_creation_input_tokens ?? 0,
    });
  } catch (err) {
    console.error('Anthropic error:', err.message);
    res.status(500).json({ error: 'AI_ERROR', message: err.message });
  }
}
