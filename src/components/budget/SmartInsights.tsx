import { useMemo } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  Sparkles,
  Target,
  Repeat,
  Crown,
  Lightbulb,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Transaction, AppSettings } from '@/types/budget';
import { ALL_CATEGORIES } from '@/constants/categories';
import { formatCurrency, monthKey } from '@/lib/utils';

type Severity = 'good' | 'info' | 'warning' | 'danger';

interface Insight {
  id: string;
  severity: Severity;
  icon: LucideIcon;
  title: string;
  body: string;
  action?: string;
}

interface Props {
  transactions: Transaction[];
  settings: AppSettings;
  year: number;
  month: number;
}

const COLORS: Record<Severity, { fg: string; bg: string; border: string }> = {
  good: { fg: '#4ade80', bg: 'rgba(74,222,128,0.06)', border: 'rgba(74,222,128,0.2)' },
  info: { fg: '#a78bfa', bg: 'rgba(167,139,250,0.06)', border: 'rgba(167,139,250,0.2)' },
  warning: { fg: '#fbbf24', bg: 'rgba(251,191,36,0.06)', border: 'rgba(251,191,36,0.25)' },
  danger: { fg: '#fb7185', bg: 'rgba(251,113,133,0.06)', border: 'rgba(251,113,133,0.25)' },
};

function categoryName(id: string): string {
  return ALL_CATEGORIES.find((c) => c.id === id)?.name ?? id;
}

function buildInsights(
  transactions: Transaction[],
  settings: AppSettings,
  year: number,
  month: number,
): Insight[] {
  const insights: Insight[] = [];

  const currentKey = monthKey(year, month);
  const prevDate = new Date(year, month - 2, 1); // month is 1-indexed
  const prevKey = monthKey(prevDate.getFullYear(), prevDate.getMonth() + 1);

  const inMonth = (key: string) => (t: Transaction) =>
    !t.isRecurring && t.date.startsWith(key);

  const current = transactions.filter(inMonth(currentKey));
  const previous = transactions.filter(inMonth(prevKey));

  const sumByType = (txs: Transaction[], type: 'income' | 'expense') =>
    txs.filter((t) => t.type === type).reduce((s, t) => s + Number(t.amount), 0);

  const groupByCat = (txs: Transaction[], type: 'income' | 'expense') => {
    const m = new Map<string, number>();
    txs.filter((t) => t.type === type).forEach((t) => {
      m.set(t.categoryId, (m.get(t.categoryId) || 0) + Number(t.amount));
    });
    return m;
  };

  const income = sumByType(current, 'income');
  const expenses = sumByType(current, 'expense');
  const balance = income - expenses;
  const expensesByCat = groupByCat(current, 'expense');
  const incomeByCat = groupByCat(current, 'income');

  // ─── 1. Spending category framework — 3 buckets based on expense/income ratio
  if (income > 0) {
    const ratio = expenses / income;
    if (ratio > 1) {
      insights.push({
        id: 'spend-overdraft',
        severity: 'danger',
        icon: AlertTriangle,
        title: 'מצב: גרעון',
        body: `הוצאת ${formatCurrency(expenses)} מתוך ${formatCurrency(income)} — ${Math.round(ratio * 100)}% מההכנסה.`,
        action: 'הוצאות גבוהות מההכנסות. צריך לקצץ בקטגוריית מותרות (חו״ל, מסעדות, פינוקים).',
      });
    } else if (ratio > 0.9) {
      insights.push({
        id: 'spend-tight',
        severity: 'warning',
        icon: Target,
        title: 'מצב: על הקצה',
        body: `הוצאת ${Math.round(ratio * 100)}% מההכנסה. נותרו ${formatCurrency(balance)}.`,
        action: 'יעד: מתחת ל־75% כדי להגיע למצב חופשי. כל אחוז שתוריד = 300 ש״ח פחות בתיק שאתה צריך.',
      });
    } else if (ratio < 0.75) {
      insights.push({
        id: 'spend-healthy',
        severity: 'good',
        icon: Crown,
        title: 'מצב: עודף בריא',
        body: `הוצאת רק ${Math.round(ratio * 100)}% מההכנסה — עודף של ${formatCurrency(balance)}.`,
        action: 'מעולה. תוודא שהעודף מושקע (S&P 500, פיקדון נזיל לקרן חירום), לא נשאר בעו״ש.',
      });
    }
  }

  // ─── 2. Income concentration risk ────────────────────────────────────
  if (income > 0 && incomeByCat.size > 0) {
    const sortedIncome = Array.from(incomeByCat.entries()).sort((a, b) => b[1] - a[1]);
    const [topCatId, topAmount] = sortedIncome[0];
    const topRatio = topAmount / income;
    if (topRatio > 0.85 && incomeByCat.size <= 2) {
      insights.push({
        id: 'income-concentration',
        severity: 'warning',
        icon: AlertTriangle,
        title: 'מקור הכנסה יחיד = סיכון',
        body: `${Math.round(topRatio * 100)}% מההכנסה שלך מ"${categoryName(topCatId)}".`,
        action: 'המטרה: 2-3 ערוצי הכנסה לפחות. תכנן השנה להוסיף ערוץ נוסף (פרילנס, השכרה, השקעות).',
      });
    }
  }

  // ─── 3. Top category — domination ────────────────────────────────────
  if (expenses > 0 && expensesByCat.size > 1) {
    const sortedExp = Array.from(expensesByCat.entries()).sort((a, b) => b[1] - a[1]);
    const [topCatId, topAmount] = sortedExp[0];
    const topRatio = topAmount / expenses;
    if (topRatio > 0.4) {
      insights.push({
        id: 'top-cat',
        severity: 'info',
        icon: TrendingUp,
        title: `״${categoryName(topCatId)}״ — ${Math.round(topRatio * 100)}% מההוצאות`,
        body: `${formatCurrency(topAmount)} בקטגוריה הזו לבד.`,
        action: 'אם זו קטגוריית מותרות (חו״ל, מסעדות) — שווה לחתוך. אם זו הכרחית (שכירות, חשמל) — שווה לבדוק חלופות.',
      });
    }
  }

  // ─── 4. Category growth vs previous month ────────────────────────────
  if (previous.length > 0 && expensesByCat.size > 0) {
    const prevByCat = groupByCat(previous, 'expense');
    const growth: { catId: string; delta: number; pctDelta: number }[] = [];
    for (const [catId, curr] of expensesByCat) {
      const prev = prevByCat.get(catId) ?? 0;
      if (prev > 100 && curr > prev) {
        const pctDelta = ((curr - prev) / prev) * 100;
        if (pctDelta > 30) {
          growth.push({ catId, delta: curr - prev, pctDelta });
        }
      }
    }
    growth.sort((a, b) => b.delta - a.delta);
    if (growth.length > 0) {
      const top = growth[0];
      insights.push({
        id: `growth-${top.catId}`,
        severity: 'warning',
        icon: TrendingUp,
        title: `״${categoryName(top.catId)}״ קפצה ב־${Math.round(top.pctDelta)}%`,
        body: `${formatCurrency(top.delta)} יותר מהחודש הקודם.`,
        action: 'בדוק מה גרם לקפיצה — תנועה חד־פעמית או שינוי הרגל? אם זה השני, זמן לשים גבול.',
      });
    }
  }

  // ─── 5. Subscription detection — same note + similar amount, 2+ months ─
  if (transactions.length >= 4) {
    const last3MonthKeys: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(year, month - 1 - i, 1);
      last3MonthKeys.push(monthKey(d.getFullYear(), d.getMonth() + 1));
    }

    const noteMap = new Map<string, { months: Set<string>; amounts: number[]; catId: string }>();
    transactions
      .filter((t) => !t.isRecurring && t.type === 'expense' && t.note)
      .forEach((t) => {
        const noteKey = (t.note ?? '').trim().toLowerCase();
        if (!noteKey) return;
        const tMonth = t.date.slice(0, 7);
        if (!last3MonthKeys.includes(tMonth)) return;
        const entry = noteMap.get(noteKey) ?? { months: new Set<string>(), amounts: [], catId: t.categoryId };
        entry.months.add(tMonth);
        entry.amounts.push(Number(t.amount));
        noteMap.set(noteKey, entry);
      });

    const subs: { note: string; avg: number; catId: string }[] = [];
    for (const [note, info] of noteMap) {
      if (info.months.size >= 2) {
        const avg = info.amounts.reduce((s, a) => s + a, 0) / info.amounts.length;
        const min = Math.min(...info.amounts);
        const max = Math.max(...info.amounts);
        if (max - min < avg * 0.2) {
          subs.push({ note, avg, catId: info.catId });
        }
      }
    }

    if (subs.length > 0) {
      subs.sort((a, b) => b.avg - a.avg);
      const totalSubs = subs.reduce((s, x) => s + x.avg, 0);
      insights.push({
        id: 'subs',
        severity: 'info',
        icon: Repeat,
        title: `זוהו ${subs.length} מנויים חודשיים`,
        body: `סה״כ ~${formatCurrency(totalSubs)} בחודש: ${subs
          .slice(0, 3)
          .map((s) => s.note)
          .join(', ')}${subs.length > 3 ? '...' : ''}.`,
        action: 'עבור עליהם — אם משהו לא בשימוש, זה כסף שדולף. הוצאה של 50 ש״ח/חודש = 18,000 ש״ח לתיק לאורך 30 שנה (8% תשואה).',
      });
    }
  }

  // ─── 6. Emergency fund check ──────────────────────────────────────────
  if (settings.expectedMonthlyIncome > 0 && balance > 0) {
    const target = settings.expectedMonthlyIncome * 3;
    insights.push({
      id: 'emergency-fund',
      severity: 'info',
      icon: Lightbulb,
      title: 'יעד קרן חירום',
      body: `3× הכנסה חודשית = ${formatCurrency(target)} בפיקדון נזיל.`,
      action: `העודף החודש (${formatCurrency(balance)}) — שלח לפיקדון נזיל, לא לעו״ש. ״לא צפינו את זה״ קורה.`,
    });
  }

  // ─── 7. No-data state ─────────────────────────────────────────────────
  if (insights.length === 0 && transactions.filter((t) => !t.isRecurring).length === 0) {
    insights.push({
      id: 'no-data',
      severity: 'info',
      icon: Sparkles,
      title: 'מתחילים לעבוד',
      body: 'אין עדיין תנועות החודש.',
      action: 'הוסף את ההכנסות וההוצאות הראשונות מהדאשבורד, ותחזור לכאן לקבל ניתוח חכם של המצב.',
    });
  }

  return insights;
}

export function SmartInsights({ transactions, settings, year, month }: Props) {
  const insights = useMemo(
    () => buildInsights(transactions, settings, year, month),
    [transactions, settings, year, month],
  );

  if (insights.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4" style={{ color: '#a78bfa' }} />
        <h2 className="font-bold text-sm">תובנות חכמות</h2>
        <span className="text-[10px] text-muted-foreground">
          ({insights.length})
        </span>
      </div>

      <div className="space-y-2">
        {insights.map((ins) => {
          const Icon = ins.icon;
          const c = COLORS[ins.severity];
          return (
            <div
              key={ins.id}
              className="rounded-xl p-3 border"
              style={{ background: c.bg, borderColor: c.border }}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(0,0,0,0.15)' }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: c.fg }} />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-xs font-bold" style={{ color: c.fg }}>
                    {ins.title}
                  </p>
                  <p className="text-[11px] text-foreground/80 leading-relaxed">
                    {ins.body}
                  </p>
                  {ins.action && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed pt-0.5">
                      {ins.action}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

