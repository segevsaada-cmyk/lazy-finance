import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Transaction, AppSettings } from '@/types/budget';
import { todayStr } from '@/lib/utils';

const DEFAULT_SETTINGS: AppSettings = {
  expectedMonthlyIncome: 0,
  warningThreshold: 1000,
  isOsekMurshe: false,
};

function dbRowToTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as string,
    type: row.type as 'income' | 'expense',
    amount: Number(row.amount),
    categoryId: row.category_id as string,
    note: row.note as string | undefined,
    date: row.date as string,
    isRecurring: row.is_recurring as boolean,
    recurringDayOfMonth: row.recurring_day_of_month as number | undefined,
    recurringParentId: row.recurring_parent_id as string | undefined,
    accountType: (row.account_type as 'private' | 'business') ?? 'private',
  };
}

export function useStorage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }

    setLoading(true);

    const fetchAll = async () => {
      const [txRes, settingsRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (txRes.data) {
        setTransactions(txRes.data.map(dbRowToTransaction));
      }
      if (settingsRes.data) {
        setSettings({
          expectedMonthlyIncome: Number(settingsRes.data.expected_monthly_income),
          warningThreshold: Number(settingsRes.data.warning_threshold),
          isOsekMurshe: settingsRes.data.is_osek_murshe ?? false,
        });
      }
      setLoading(false);
    };

    fetchAll();
  }, [user]);

  const addTransaction = useCallback(
    async (tx: Omit<Transaction, 'id'>): Promise<Transaction | null> => {
      if (!user) return null;

      const baseInsert = {
        user_id: user.id,
        type: tx.type,
        amount: tx.amount,
        category_id: tx.categoryId,
        note: tx.note ?? null,
        date: tx.date,
        is_recurring: tx.isRecurring,
        recurring_day_of_month: tx.recurringDayOfMonth ?? null,
        recurring_parent_id: tx.recurringParentId ?? null,
      };

      // Try with account_type first; if the column doesn't exist (migration not applied yet),
      // fall back to insert without it. Once the migration is applied this fast path always wins.
      let { data, error } = await supabase
        .from('transactions')
        .insert({ ...baseInsert, account_type: tx.accountType })
        .select()
        .single();

      if (error && /account_type/i.test(error.message ?? '')) {
        const fallback = await supabase
          .from('transactions')
          .insert(baseInsert)
          .select()
          .single();
        data = fallback.data;
        error = fallback.error;
      }

      if (error || !data) return null;
      const newTx = dbRowToTransaction(data);
      setTransactions(prev => [newTx, ...prev]);
      return newTx;
    },
    [user]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (!user) return;
      setTransactions(prev => prev.filter(t => t.id !== id));
      await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id);
    },
    [user]
  );

  const updateSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      if (!user) return;
      const next = { ...settings, ...partial };
      setSettings(next);
      await supabase.from('user_settings').upsert({
        user_id: user.id,
        expected_monthly_income: next.expectedMonthlyIncome,
        warning_threshold: next.warningThreshold,
        is_osek_murshe: next.isOsekMurshe,
        updated_at: new Date().toISOString(),
      });
    },
    [user, settings]
  );

  const confirmRecurring = useCallback(
    async (recurringTemplate: Transaction, date?: string) => {
      return addTransaction({
        type: recurringTemplate.type,
        amount: recurringTemplate.amount,
        categoryId: recurringTemplate.categoryId,
        note: recurringTemplate.note,
        date: date ?? todayStr(),
        isRecurring: false,
        recurringParentId: recurringTemplate.id,
        accountType: recurringTemplate.accountType,
      });
    },
    [addTransaction]
  );

  const recurringTemplates = transactions.filter(t => t.isRecurring);

  return {
    transactions,
    settings,
    recurringTemplates,
    loading,
    addTransaction,
    deleteTransaction,
    updateSettings,
    confirmRecurring,
  };
}
