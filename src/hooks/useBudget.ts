import { useMemo } from 'react';
import type { Transaction, AppSettings, BalanceStatus } from '@/types/budget';
import { monthKey } from '@/lib/utils';

interface UseBudgetArgs {
  transactions: Transaction[];
  settings: AppSettings;
  year: number;
  month: number; // 1-indexed
}

interface MonthSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  balanceStatus: BalanceStatus;
  monthTransactions: Transaction[];
  pendingRecurring: Transaction[]; // recurring not yet confirmed this month
  spentPercent: number; // expenses as % of expected income (capped at 100)
}

export function useBudget({ transactions, settings, year, month }: UseBudgetArgs): MonthSummary {
  return useMemo(() => {
    const key = monthKey(year, month);

    // All non-recurring transactions for this month
    const monthTransactions = transactions.filter(t => {
      if (t.isRecurring) return false;
      return t.date.startsWith(key);
    });

    const totalIncome = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const balance = totalIncome - totalExpenses;

    // Balance status
    let balanceStatus: BalanceStatus = 'ok';
    if (balance < 0) {
      balanceStatus = 'danger';
    } else if (balance < settings.warningThreshold) {
      balanceStatus = 'warning';
    }

    // Recurring templates not yet confirmed this month
    const confirmedParentIds = new Set(
      monthTransactions
        .filter(t => t.recurringParentId)
        .map(t => t.recurringParentId!)
    );

    const recurringTemplates = transactions.filter(t => t.isRecurring);
    const pendingRecurring = recurringTemplates.filter(
      t => !confirmedParentIds.has(t.id)
    );

    const expectedIncome = settings.expectedMonthlyIncome;
    const spentPercent =
      expectedIncome > 0
        ? Math.min(100, Math.round((totalExpenses / expectedIncome) * 100))
        : 0;

    return {
      totalIncome,
      totalExpenses,
      balance,
      balanceStatus,
      monthTransactions,
      pendingRecurring,
      spentPercent,
    };
  }, [transactions, settings, year, month]);
}
