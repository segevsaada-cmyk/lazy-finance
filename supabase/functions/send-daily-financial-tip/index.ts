// Lazy Finance — Daily Financial Tip via WhatsApp
// Sends one rotating tip per linked user every morning.
// Triggered by pg_cron at 06:00 UTC = 09:00 IL summer / 08:00 IL winter.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WA_SERVER_URL = Deno.env.get("WA_SERVER_URL")!;
const WA_API_KEY = Deno.env.get("WA_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function fmt(n: number): string {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}

function todayIL(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

function dayOfYear(): number {
  const start = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 0));
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

// ─────────────────────────────────────────────────────────────
// Rotating tip pool — 14 tips, cycles every 2 weeks
// ─────────────────────────────────────────────────────────────
type TipBuilder = (ctx: { income: number; expenses: number; balance: number }) => string;

const TIPS: TipBuilder[] = [
  () =>
    `🌅 *בוקר טוב*\n\n` +
    `המטרה היומית: לסמן ✓ אחת מהפעולות המיידיות בעמוד ״כלים לשחרור פיננסי״.\n\n` +
    `כל פעולה שאתה סוגר היום מקצרת את הדרך לחופש כלכלי.\n\n` +
    `👉 https://lazy-finance.vercel.app/liberation`,

  () =>
    `💡 *כלל ה־300 (אליאור)*\n\n` +
    `סך הוצאות חודשיות × 300 = הסכום שמשחרר אותך מעבודה.\n\n` +
    `אם אתה מוציא 12,000 ש״ח לחודש — צריך תיק של 3.6 מיליון.\n` +
    `כל שקל שאתה חוסך מהוצאות מורידה 300 ש״ח מהסכום הזה.`,

  ({ balance }) =>
    `📊 *מצב נכון לבוקר*\n\n` +
    `יתרה החודש: *${fmt(balance)}*\n\n` +
    (balance < 0
      ? `מינוס. תזכורת: לא לחלק לתשלומים אלא אם ההוצאה > 50% מההכנסה.`
      : balance < 1000
      ? `יתרה נמוכה. תיכנס לאפליקציה ותראה איפה אפשר לקצץ.`
      : `מצב טוב. תזכורת: לא להשאיר עודפים בעו״ש — שוחקים אינפלציה.`),

  () =>
    `🛡 *קרן חירום*\n\n` +
    `הכנסות חודשיות × 3 = הסכום שצריך בפיקדון נזיל.\n\n` +
    `אם עוד אין לך — הוראת קבע של 1,000 ש״ח לחודש זה ההתחלה.\n` +
    `״לא צפינו את זה״ קורה. תהיה מוכן.`,

  () =>
    `🔁 *ריבית דריבית*\n\n` +
    `10K דולר בגיל 20 → ~600K דולר בגיל 60.\n` +
    `אותם 10K בגיל 40 → 40K בלבד.\n\n` +
    `ההפרש הוא לא הסכום — הוא הזמן.\n` +
    `כל יום שאתה לא משקיע, אתה מאבד את ההפרש הזה.`,

  () =>
    `💳 *דירוג אשראי*\n\n` +
    `יעד: 850+ (טוב מאוד עד מצוין).\n\n` +
    `2 כללים שמרימים דירוג:\n` +
    `1. חיוב ויזה אחרי כניסת המשכורת\n` +
    `2. תשלומים — רק כשההוצאה > 50% מההכנסה, ל־2 תשלומים בלבד\n\n` +
    `אם עדיין לא הוצאת דירוג מקפטן קרדיט — היום יום טוב.`,

  () =>
    `🎯 *3 המטבעות (אליאור)*\n\n` +
    `כסף · זמן · אנרגיה.\n\n` +
    `מספיק להשקיע 2 מתוך 3 כדי להצליח.\n` +
    `מה אתה משקיע *השבוע* בעצמך הפיננסי?`,

  ({ income, expenses }) => {
    const ratio = income > 0 ? Math.round((expenses / income) * 100) : 0;
    return (
      `📈 *מי אתה היום?*\n\n` +
      `הוצאת ${fmt(expenses)} מתוך ${fmt(income)} (${ratio}%)\n\n` +
      (ratio > 100
        ? `״עניים״ — הוצאות > הכנסות.`
        : ratio > 90
        ? `״שורדים״ — אפס/מינוס קטן.`
        : `״חופשיים״ — יש עודף.`) +
      `\n\nהמטרה: 75% או פחות.`
    );
  },

  () =>
    `🧾 *חצי החודש — תזכורת*\n\n` +
    `אם היום ה־15:\n` +
    `הזמן להתחיל להכין תקציב לחודש הבא.\n\n` +
    `אל תחכה ל־1 — אז כבר מאוחר.\n` +
    `5 דקות עכשיו = חודש שלם רגוע.`,

  () =>
    `💼 *סיווג הוצאות (אליאור)*\n\n` +
    `1. הכרחי וקבוע — ״בוקר טוב״ (שכ״ד, חשמל)\n` +
    `2. הכרחי ולא קבוע — ״חיוניות״ (בגדים, טסט)\n` +
    `3. לא הכרחי ולא קבוע — ״מותרות״ (חו״ל, רכב)\n\n` +
    `מקצצים? תמיד מקטגוריה 3, אף פעם לא מ־1.`,

  () =>
    `🚫 *הרוצח השקט: אינפלציה*\n\n` +
    `כסף בעו״ש = כסף שנשחק.\n` +
    `כסף בפיקדון = כסף שנשחק קצת פחות.\n` +
    `כסף ב־S&P 500 = כסף שעובד.\n\n` +
    `מה יש לך בעו״ש *שלא צריך* להיות שם?`,

  () =>
    `🪜 *5 שלבים לחופש כלכלי*\n\n` +
    `1. מטרה פיננסית\n` +
    `2. תזרים\n` +
    `3. תקציב חודשי\n` +
    `4. השקעות מניבות\n` +
    `5. הכנסות פסיביות\n\n` +
    `אתה בשלב כמה כרגע? יש שלב שדילגת עליו?`,

  ({ income }) =>
    `🏦 *פיזור הכנסות*\n\n` +
    `מקור הכנסה אחד = סיכון מקסימלי.\n` +
    `המטרה: 2–3 לפחות.\n\n` +
    `הכנסה החודש: ${fmt(income)}\n\n` +
    `שאלה: כמה ערוצים זה? אחד? שניים? תכננת השנה להוסיף עוד אחד?`,

  () =>
    `✋ *די עם ההשוואות*\n\n` +
    `מה לחבר שלך, מה לאח שלך, מה לבן דוד שלך — לא משנה.\n` +
    `אתה לא נמדד מולם, אתה נמדד מול האני שלך לפני שנה.\n\n` +
    `שאלה אחת לבוקר: *מה השתפר אצלי החודש?*`,
];

// ─────────────────────────────────────────────────────────────

async function sendWA(phone: string, message: string): Promise<boolean> {
  if (!WA_SERVER_URL || WA_SERVER_URL === "placeholder") return false;
  try {
    const res = await fetch(`${WA_SERVER_URL}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": WA_API_KEY },
      body: JSON.stringify({ phone, message }),
    });
    const data = await res.json();
    return !!data.success;
  } catch {
    return false;
  }
}

async function getMonthlyBudget(userId: string) {
  const today = todayIL();
  const monthStart = today.slice(0, 7) + "-01";

  const { data: txs } = await supabase
    .from("transactions")
    .select("type, amount")
    .eq("user_id", userId)
    .eq("is_recurring", false)
    .gte("date", monthStart);

  const income = (txs || [])
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expenses = (txs || [])
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  return { income, expenses, balance: income - expenses };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    // Restricted to admins only — bot runs from owner's personal phone, so we
    // do not send tips to non-admin accounts even if they appear in
    // whatsapp_users. Lift this gate once the bot moves to a dedicated number.
    const { data: admins, error: adminErr } = await supabase
      .from("user_settings")
      .select("user_id")
      .eq("role", "admin");
    if (adminErr) return json({ error: adminErr.message }, 500);
    const adminIds = (admins ?? []).map((a) => a.user_id);
    if (adminIds.length === 0) return json({ ok: true, sent: 0, reason: "no admins" });

    const { data: waUsers, error } = await supabase
      .from("whatsapp_users")
      .select("user_id, phone_number")
      .in("user_id", adminIds);

    if (error) return json({ error: error.message }, 500);
    if (!waUsers?.length) return json({ ok: true, sent: 0, reason: "no linked admin users" });

    const tipIndex = dayOfYear() % TIPS.length;
    const buildTip = TIPS[tipIndex];

    let sent = 0;
    let failed = 0;

    for (const wu of waUsers) {
      const ctx = await getMonthlyBudget(wu.user_id);
      const message = buildTip(ctx);
      const ok = await sendWA(wu.phone_number, message);
      if (ok) sent++;
      else failed++;
      await new Promise((r) => setTimeout(r, 3000)); // 3s spacing
    }

    return json({ ok: true, sent, failed, tipIndex });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
