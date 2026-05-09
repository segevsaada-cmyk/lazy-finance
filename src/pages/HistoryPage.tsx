import { useState } from 'react';
import { Plus, ArrowUpRight, ArrowDownRight, Search, X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { TransactionItem } from '@/components/budget/TransactionItem';
import { MonthNavigator } from '@/components/budget/MonthNavigator';
import { AddTransactionSheet } from '@/components/budget/AddTransactionSheet';
import { BottomNav } from '@/components/budget/BottomNav';
import { useStorage } from '@/hooks/useStorage';
import { useBudget } from '@/hooks/useBudget';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatCurrency } from '@/lib/utils';
import { ALL_CATEGORIES } from '@/constants/categories';

export default function HistoryPage() {
  useDocumentTitle('תנועות');
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [search, setSearch] = useState('');

  const { transactions, settings, addTransaction, deleteTransaction } = useStorage();
  const { monthTransactions, totalIncome, totalExpenses } = useBudget({ transactions, settings, year, month });

  const q = search.trim().toLowerCase();
  const filtered = [...monthTransactions]
    .filter(t => filter === 'all' || t.type === filter)
    .filter(t => {
      if (!q) return true;
      const note = (t.note ?? '').toLowerCase();
      const categoryName = ALL_CATEGORIES.find(c => c.id === t.categoryId)?.name?.toLowerCase() ?? '';
      const amountStr = String(t.amount);
      return note.includes(q) || categoryName.includes(q) || amountStr.includes(q);
    })
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

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש בהערה, קטגוריה או סכום…"
            className="text-right pr-9 pl-9"
            aria-label="חיפוש בתנועות"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="נקה חיפוש"
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
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
