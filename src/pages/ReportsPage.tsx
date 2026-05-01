import { useMemo, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { BottomNav } from '@/components/budget/BottomNav';
import { SmartInsights } from '@/components/budget/SmartInsights';
import { useStorage } from '@/hooks/useStorage';
import { CATEGORY_ICON_MAP, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/constants/categories';
import { formatCurrency, getMonthLabel } from '@/lib/utils';

interface MonthData {
  year: number;
  month: number;
  label: string;
  income: number;
  expenses: number;
  balance: number;
}

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

function categoryName(id: string): string {
  return ALL_CATEGORIES.find(c => c.id === id)?.name ?? id;
}

export default function ReportsPage() {
  const { transactions, settings } = useStorage();
  const [months, setMonths] = useState(6);

  const monthly = useMemo<MonthData[]>(() => {
    const today = new Date();
    const result: MonthData[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;

      const monthTxs = transactions.filter(
        t => !t.isRecurring && t.date.startsWith(monthKey)
      );

      const income = monthTxs
        .filter(t => t.type === 'income')
        .reduce((s, t) => s + Number(t.amount), 0);
      const expenses = monthTxs
        .filter(t => t.type === 'expense')
        .reduce((s, t) => s + Number(t.amount), 0);

      result.push({
        year,
        month,
        label: getMonthLabel(year, month),
        income,
        expenses,
        balance: income - expenses,
      });
    }
    return result;
  }, [transactions, months]);

  const max = Math.max(1, ...monthly.flatMap(m => [m.income, m.expenses]));
  const totalIncome = monthly.reduce((s, m) => s + m.income, 0);
  const totalExpenses = monthly.reduce((s, m) => s + m.expenses, 0);
  const totalBalance = totalIncome - totalExpenses;
  const avgIncome = totalIncome / months;
  const avgExpenses = totalExpenses / months;

  const currentMonth = monthly[monthly.length - 1];
  const previousMonth = monthly[monthly.length - 2];

  const incomeDelta = previousMonth && previousMonth.income > 0
    ? ((currentMonth.income - previousMonth.income) / previousMonth.income) * 100
    : null;
  const expensesDelta = previousMonth && previousMonth.expenses > 0
    ? ((currentMonth.expenses - previousMonth.expenses) / previousMonth.expenses) * 100
    : null;

  const currentMonthKey = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}`;
  const currentExpensesByCat = useMemo(() => {
    const map = new Map<string, number>();
    transactions
      .filter(t => !t.isRecurring && t.type === 'expense' && t.date.startsWith(currentMonthKey))
      .forEach(t => {
        map.set(t.categoryId, (map.get(t.categoryId) || 0) + Number(t.amount));
      });
    return Array.from(map.entries())
      .map(([id, amount]) => ({ id, amount, name: categoryName(id) }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, currentMonthKey]);

  const totalCurrentExpenses = currentExpensesByCat.reduce((s, c) => s + c.amount, 0);

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <h1 className="text-xl font-bold">דוחות חודשיים</h1>
          </div>
          <div className="flex gap-1 bg-secondary rounded-full p-0.5">
            {[3, 6, 12].map(n => (
              <button
                key={n}
                onClick={() => setMonths(n)}
                className={`text-[11px] font-bold px-3 py-1 rounded-full transition-all ${
                  months === n ? 'bg-rose-500 text-white' : 'text-muted-foreground'
                }`}
              >
                {n}ח׳
              </button>
            ))}
          </div>
        </div>

        {/* Smart insights */}
        <SmartInsights
          transactions={transactions}
          settings={settings}
          year={currentMonth.year}
          month={currentMonth.month}
        />

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card border border-border rounded-2xl p-3 space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground">הכנסה ממוצעת</p>
            <p className="text-sm font-bold tabular-nums" style={{ color: '#4ade80' }}>
              {formatCurrency(avgIncome)}
            </p>
            {incomeDelta !== null && (
              <p className="text-[10px] flex items-center gap-0.5" style={{ color: incomeDelta >= 0 ? '#4ade80' : '#fb7185' }}>
                {incomeDelta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(incomeDelta).toFixed(0)}%
              </p>
            )}
          </div>
          <div className="bg-card border border-border rounded-2xl p-3 space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground">הוצאה ממוצעת</p>
            <p className="text-sm font-bold tabular-nums" style={{ color: '#fb7185' }}>
              {formatCurrency(avgExpenses)}
            </p>
            {expensesDelta !== null && (
              <p className="text-[10px] flex items-center gap-0.5" style={{ color: expensesDelta <= 0 ? '#4ade80' : '#fb7185' }}>
                {expensesDelta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(expensesDelta).toFixed(0)}%
              </p>
            )}
          </div>
          <div className="bg-card border border-border rounded-2xl p-3 space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground">סה״כ נטו</p>
            <p className="text-sm font-bold tabular-nums" style={{ color: totalBalance >= 0 ? '#4ade80' : '#fb7185' }}>
              {formatCurrency(totalBalance)}
            </p>
            <p className="text-[10px] text-muted-foreground">{months} חודשים</p>
          </div>
        </div>

        {/* Bar chart */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm">הכנסות מול הוצאות</h2>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: '#4ade80' }} />
                <span className="text-muted-foreground">הכנסות</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: '#fb7185' }} />
                <span className="text-muted-foreground">הוצאות</span>
              </span>
            </div>
          </div>

          {totalIncome === 0 && totalExpenses === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">אין נתונים בחודשים האחרונים</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">תוסיף תנועות מהדאשבורד</p>
            </div>
          ) : (
            <div className="space-y-3">
              {monthly.map(m => (
                <div key={`${m.year}-${m.month}`} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-foreground">{m.label}</span>
                    <span
                      className="font-mono tabular-nums font-bold"
                      style={{ color: m.balance >= 0 ? '#4ade80' : '#fb7185' }}
                    >
                      {m.balance >= 0 ? '+' : ''}{formatCurrency(m.balance)}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-3 bg-muted/20 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${(m.income / max) * 100}%`,
                            background: 'linear-gradient(90deg, #22c55e, #4ade80)',
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-mono tabular-nums w-16 text-left text-muted-foreground">
                        {formatCurrency(m.income)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-3 bg-muted/20 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${(m.expenses / max) * 100}%`,
                            background: 'linear-gradient(90deg, #e11d48, #fb7185)',
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-mono tabular-nums w-16 text-left text-muted-foreground">
                        {formatCurrency(m.expenses)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category breakdown for current month */}
        {currentExpensesByCat.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm">פירוט הוצאות — {currentMonth.label}</h2>
              <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                {formatCurrency(totalCurrentExpenses)}
              </span>
            </div>

            <div className="space-y-2">
              {currentExpensesByCat.slice(0, 8).map(cat => {
                const Icon = CATEGORY_ICON_MAP[cat.id] || BarChart3;
                const pct = (cat.amount / totalCurrentExpenses) * 100;
                return (
                  <div key={cat.id} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-3.5 h-3.5" style={{ color: '#fb7185' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs font-semibold truncate">{cat.name}</p>
                        <p className="text-[11px] font-mono tabular-nums text-muted-foreground">
                          {formatCurrency(cat.amount)}
                        </p>
                      </div>
                      <div className="h-1 bg-muted/20 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: 'linear-gradient(90deg, #e11d48, #fb7185)',
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] font-mono tabular-nums text-muted-foreground w-9 text-left">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Trend insight */}
        {previousMonth && (
          <div
            className="rounded-2xl p-4 border space-y-2"
            style={{
              borderColor: 'rgba(244,63,94,0.2)',
              background: 'linear-gradient(135deg, rgba(244,63,94,0.04), rgba(168,85,247,0.04))',
            }}
          >
            <div className="flex items-center gap-2">
              {currentMonth.balance > previousMonth.balance ? (
                <TrendingUp className="w-4 h-4" style={{ color: '#4ade80' }} />
              ) : (
                <TrendingDown className="w-4 h-4" style={{ color: '#fb7185' }} />
              )}
              <p className="text-xs font-bold">
                {currentMonth.balance > previousMonth.balance ? 'מגמה חיובית' : 'מגמה שלילית'}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {currentMonth.balance > previousMonth.balance
                ? `החודש העברת ${formatCurrency(currentMonth.balance - previousMonth.balance)} יותר לחיסכון מהחודש שעבר. כך נראית הדרך לחופש כלכלי.`
                : `החודש החיסכון ירד ב־${formatCurrency(previousMonth.balance - currentMonth.balance)} לעומת החודש שעבר. בדוק איפה הייתה החריגה ותתקן בחודש הקרוב.`}
            </p>
          </div>
        )}

      </div>

      <BottomNav />
    </div>
  );
}
