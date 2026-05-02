import { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { BalanceCard } from '@/components/budget/BalanceCard';
import { SummaryStrip } from '@/components/budget/SummaryStrip';
import { TransactionItem } from '@/components/budget/TransactionItem';
import { RecurringItem } from '@/components/budget/RecurringItem';
import { MonthNavigator } from '@/components/budget/MonthNavigator';
import { AddTransactionSheet } from '@/components/budget/AddTransactionSheet';
import { ChatTransactionSheet } from '@/components/budget/ChatTransactionSheet';
import { VATCard } from '@/components/budget/VATCard';
import { BottomNav } from '@/components/budget/BottomNav';
import { useStorage } from '@/hooks/useStorage';
import { useBudget } from '@/hooks/useBudget';
import type { Transaction } from '@/types/budget';

export default function DashboardPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(true ? false : false); // default closed
  // The + button opens chat by default; users can switch to the full form from inside.

  const { transactions, settings, addTransaction, deleteTransaction, confirmRecurring } = useStorage();
  const { totalIncome, totalExpenses, balance, balanceStatus, monthTransactions, pendingRecurring, spentPercent } =
    useBudget({ transactions, settings, year, month });

  const handleConfirm = (template: Transaction) => {
    confirmRecurring(template);
  };

  const recentTransactions = [...monthTransactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-24">
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed top-0 left-0 right-0 h-48 opacity-30"
        style={{
          background:
            balanceStatus === 'danger'
              ? 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(244,63,94,0.3), transparent)'
              : balanceStatus === 'warning'
              ? 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(245,158,11,0.2), transparent)'
              : 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(34,197,94,0.15), transparent)',
        }}
      />

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4 relative">
        {/* App header */}
        <div className="text-center pb-1">
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            <span style={{ color: '#f43f5e' }}>Lazy</span>{' '}
            <span className="text-foreground">Finance</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">התנהלות פיננסית פשוטה לעצלנים</p>
        </div>

        {/* Month navigation */}
        <MonthNavigator
          year={year}
          month={month}
          onChange={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
        />

        {/* Balance card */}
        <BalanceCard
          balance={balance}
          status={balanceStatus}
          expectedIncome={settings.expectedMonthlyIncome}
          spentPercent={spentPercent}
          totalExpenses={totalExpenses}
        />

        {/* Income / Expense summary */}
        <SummaryStrip totalIncome={totalIncome} totalExpenses={totalExpenses} />

        {/* Pending recurring */}
        {pendingRecurring.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4 space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-bold text-sm text-foreground">הוצאות קבועות לאישור</h2>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-[rgba(251,113,133,0.15)] text-[#fb7185] font-semibold">
                {pendingRecurring.length}
              </span>
            </div>
            {pendingRecurring.map((t, i) => (
              <div key={t.id}>
                {i > 0 && <Separator className="my-1" />}
                <RecurringItem
                  template={t}
                  isPaid={false}
                  onConfirm={handleConfirm}
                  onDelete={deleteTransaction}
                  showConfirm
                />
              </div>
            ))}
          </div>
        )}

        {/* VAT card — only for עוסק מורשה */}
        {settings.isOsekMurshe && <VATCard totalIncome={totalIncome} totalExpenses={totalExpenses} />}

        {/* Recent transactions */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <h2 className="font-bold text-sm text-foreground mb-2">תנועות אחרונות</h2>
          {recentTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">
              אין תנועות החודש עדיין
              <br />
              <span className="text-xs">לחץ + להוסיף</span>
            </p>
          ) : (
            recentTransactions.map((t, i) => (
              <div key={t.id}>
                {i > 0 && <Separator className="my-0.5" />}
                <TransactionItem
                  transaction={t}
                  onDelete={deleteTransaction}
                  compact
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-20 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center z-30 active:scale-90 transition-all duration-150"
        style={{
          background: 'linear-gradient(135deg, #e11d48, #f43f5e)',
          boxShadow: '0 4px 24px rgba(244,63,94,0.5)',
        }}
        aria-label="הוסף תנועה"
      >
        <Plus className="w-8 h-8 text-white" strokeWidth={2.5} />
      </button>

      <ChatTransactionSheet
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onSave={addTransaction}
        onSwitchToForm={() => { setChatOpen(false); setSheetOpen(true); }}
      />
      <AddTransactionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSave={addTransaction}
      />

      <BottomNav />
    </div>
  );
}
