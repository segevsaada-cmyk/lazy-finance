import { useState } from 'react';
import { Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { TransactionItem } from '@/components/budget/TransactionItem';
import { MonthNavigator } from '@/components/budget/MonthNavigator';
import { AddTransactionSheet } from '@/components/budget/AddTransactionSheet';
import { BottomNav } from '@/components/budget/BottomNav';
import { useStorage } from '@/hooks/useStorage';
import { useBudget } from '@/hooks/useBudget';
import { formatCurrency } from '@/lib/utils';

export default function HistoryPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

  const { transactions, settings, addTransaction, deleteTransaction } = useStorage();
  const { monthTransactions, totalIncome, totalExpenses } = useBudget({ transactions, settings, year, month });

  const filtered = [...monthTransactions]
    .filter(t => filter === 'all' || t.type === filter)
    .sort((a, b) => b.date.localeCompare(a.date));

  const FILTERS = [
    { id: 'all' as const, label: 'הכל', icon: null },
    { id: 'expense' as const, label: 'הוצאות', icon: <ArrowDownRight className="w-3.5 h-3.5" style={{ color: '#fb7185' }} /> },
    { id: 'income' as const, label: 'הכנסות', icon: <ArrowUpRight className="w-3.5 h-3.5" style={{ color: '#4ade80' }} /> },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        <MonthNavigator year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />

        {/* Filter tabs */}
        <div className="flex rounded-xl overflow-hidden border border-border text-sm font-semibold">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition-all ${
                filter === f.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>

        {/* Summary line */}
        <div className="flex justify-between text-sm px-1 font-mono tabular-nums">
          <span className="text-muted-foreground">{filtered.length} תנועות</span>
          <span>
            <span style={{ color: '#4ade80' }}>+{formatCurrency(totalIncome)}</span>
            <span className="text-muted-foreground mx-1">/</span>
            <span style={{ color: '#fb7185' }}>−{formatCurrency(totalExpenses)}</span>
          </span>
        </div>

        {/* Transactions */}
        <div className="bg-card rounded-2xl border border-border p-4">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">אין תנועות להצגה</p>
          ) : (
            filtered.map((t, i) => (
              <div key={t.id}>
                {i > 0 && <Separator className="my-0.5" />}
                <TransactionItem transaction={t} onDelete={deleteTransaction} />
              </div>
            ))
          )}
        </div>
      </div>

      <button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-20 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center z-30 active:scale-90 transition-all"
        style={{ background: 'linear-gradient(135deg, #e11d48, #f43f5e)', boxShadow: '0 4px 20px rgba(244,63,94,0.4)' }}
      >
        <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
      </button>

      <AddTransactionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onSave={addTransaction} />
      <BottomNav />
    </div>
  );
}
