// Vercel Serverless Function — WhatsApp Webhook (Twilio)
// POST /api/whatsapp

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VAT_RATE = 0.18; // Israel 2025

// -------------------------------------------------------
// Parse Hebrew message into a transaction
// -------------------------------------------------------
function parseMessage(text) {
  const t = text.trim();

  // Check for balance/summary commands
  if (/^(יתרה|מצב|סיכום|balance)$/i.test(t)) return { command: 'balance' };
  if (/^(מע["״]מ|vat)$/i.test(t)) return { command: 'vat' };
  if (/^(עזרה|help|פקודות)$/i.test(t)) return { command: 'help' };

  // Try to extract amount — number anywhere in the message
  const amountMatch = t.match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1].replace(',', '.'));
  if (!amount || amount <= 0) return null;

  // Determine type
  const incomeKeywords = /קיבלתי|הכנסה|שכר|משכורת|פרילנס|לקוח|עבודה|תשלום נכנס|income/i;
  const type = incomeKeywords.test(t) ? 'income' : 'expense';

  // Extract note — remove the amount from the text
  const note = t.replace(amountMatch[0], '').replace(/\s+/g, ' ').trim() || undefined;

  // Simple category guessing
  const categoryId = guessCategoryId(t, type);

  // Today's date in YYYY-MM-DD
  const today = new Date().toISOString().split('T')[0];

  return { type, amount, categoryId, note, date: today, isRecurring: false };
}

function guessCategoryId(text, type) {
  if (type === 'income') {
    if (/משכורת|שכר|salary/i.test(text)) return 'salary';
    if (/פרילנס|freelance/i.test(text)) return 'freelance';
    if (/השקעה|investment/i.test(text)) return 'investments';
    return 'other-income';
  }
  if (/קפה|cafe|coffee/i.test(text)) return 'restaurants';
  if (/אוכל|מסעדה|food|ארוחה/i.test(text)) return 'restaurants';
  if (/סופר|קניות|shopping/i.test(text)) return 'shopping';
  if (/רכב|דלק|פארקינג|car|fuel/i.test(text)) return 'car';
  if (/שכירות|rent/i.test(text)) return 'rent';
  if (/חשבון|electricity|מים|gas|internet/i.test(text)) return 'bills';
  if (/בריאות|רופא|תרופה|health/i.test(text)) return 'health';
  if (/טלפון|סלולר|mobile/i.test(text)) return 'mobile';
  if (/בידור|entertainment|קולנוע/i.test(text)) return 'entertainment';
  return 'other';
}

// -------------------------------------------------------
// Format currency in NIS
// -------------------------------------------------------
function fmt(n) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
}

// -------------------------------------------------------
// Main handler
// -------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // Parse Twilio form body (application/x-www-form-urlencoded)
  const body = req.body || {};
  const from = (body.From || '').replace('whatsapp:', '').replace('+', '');
  const messageText = (body.Body || '').trim();

  if (!from || !messageText) {
    return res.status(200).send(twimlResponse('לא הצלחתי לקרוא את ההודעה 🤔'));
  }

  // Look up user by phone number
  const { data: waUser } = await supabase
    .from('whatsapp_users')
    .select('user_id')
    .eq('phone_number', from)
    .maybeSingle();

  if (!waUser) {
    return res.status(200).send(
      twimlResponse(
        '❌ המספר שלך לא מחובר ל-Lazy Finance.\n\nהיכנס לאפליקציה → הגדרות → חבר וואטסאפ.'
      )
    );
  }

  const userId = waUser.user_id;
  const parsed = parseMessage(messageText);

  if (!parsed) {
    return res.status(200).send(
      twimlResponse('לא הבנתי 🤔\n\nדוגמאות:\n💸 קפה 25\n💰 קיבלתי 5000\n📊 יתרה')
    );
  }

  // Handle commands
  if (parsed.command === 'help') {
    return res.status(200).send(
      twimlResponse(
        `📋 *פקודות Lazy Finance:*\n\n💸 הוצאה: "קפה 35"\n💰 הכנסה: "קיבלתי 5000 לקוח"\n📊 יתרה: "יתרה"\n🧾 מע״מ: "מע״מ"`
      )
    );
  }

  if (parsed.command === 'balance') {
    const reply = await getBalanceSummary(userId);
    return res.status(200).send(twimlResponse(reply));
  }

  if (parsed.command === 'vat') {
    const reply = await getVATSummary(userId);
    return res.status(200).send(twimlResponse(reply));
  }

  // Insert transaction
  const { error } = await supabase.from('transactions').insert({
    user_id: userId,
    type: parsed.type,
    amount: parsed.amount,
    category_id: parsed.categoryId,
    note: parsed.note ?? null,
    date: parsed.date,
    is_recurring: false,
  });

  if (error) {
    return res.status(200).send(twimlResponse('❌ שגיאה בשמירת התנועה. נסה שוב.'));
  }

  // Build confirmation message
  const emoji = parsed.type === 'income' ? '💰' : '💸';
  const typeHe = parsed.type === 'income' ? 'הכנסה' : 'הוצאה';

  let reply = `${emoji} *${typeHe} נרשמה!*\n\n`;
  reply += `סכום: ${fmt(parsed.amount)}\n`;
  if (parsed.note) reply += `הערה: ${parsed.note}\n`;

  // Add VAT breakdown for income
  if (parsed.type === 'income') {
    const vatAmount = parsed.amount * (VAT_RATE / (1 + VAT_RATE));
    const netAmount = parsed.amount - vatAmount;
    reply += `\n🧾 *מע״מ (18%):*\n`;
    reply += `נטו: ${fmt(netAmount)}\n`;
    reply += `מע״מ לתשלום: ${fmt(vatAmount)}`;
  }

  return res.status(200).send(twimlResponse(reply));
}

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
async function getBalanceSummary(userId) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { data: txs } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('user_id', userId)
    .eq('is_recurring', false)
    .gte('date', `${monthKey}-01`);

  if (!txs || txs.length === 0) {
    return '📊 אין תנועות החודש עדיין.';
  }

  const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const balance = income - expenses;

  const monthName = now.toLocaleString('he-IL', { month: 'long' });

  return (
    `📊 *סיכום ${monthName}:*\n\n` +
    `💰 הכנסות: ${fmt(income)}\n` +
    `💸 הוצאות: ${fmt(expenses)}\n` +
    `📈 יתרה: ${fmt(balance)}\n\n` +
    (balance < 0 ? '⚠️ יתרה שלילית!' : balance < 1000 ? '🟡 יתרה נמוכה' : '✅ מצב טוב')
  );
}

async function getVATSummary(userId) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { data: txs } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('user_id', userId)
    .eq('is_recurring', false)
    .gte('date', `${monthKey}-01`);

  if (!txs || txs.length === 0) return '🧾 אין נתונים לחישוב מע״מ החודש.';

  const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  const incomeVAT = income * (VAT_RATE / (1 + VAT_RATE));
  const expenseVAT = expenses * (VAT_RATE / (1 + VAT_RATE));
  const net = incomeVAT - expenseVAT;

  return (
    `🧾 *מע״מ החודש (18%):*\n\n` +
    `מע״מ על הכנסות: ${fmt(incomeVAT)}\n` +
    `זיכוי מע״מ הוצאות: ${fmt(expenseVAT)}\n\n` +
    `*${net > 0 ? `לשלם לרשות: ${fmt(net)}` : `זיכוי מהרשות: ${fmt(Math.abs(net))}`}*`
  );
}

function twimlResponse(message) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(message)}</Message>
</Response>`;
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
