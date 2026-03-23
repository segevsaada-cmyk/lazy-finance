import { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { RecurringItem } from '@/components/budget/RecurringItem';
import { AddTransactionSheet } from '@/components/budget/AddTransactionSheet';
import { BottomNav } from '@/components/budget/BottomNav';
import { useStorage } from '@/hooks/useStorage';
import { formatCurrency } from '@/lib/utils';
import type { Transaction } from '@/types/budget';

export default function RecurringPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Transaction | null>(null);

  const { recurringTemplates, addTransaction, deleteTransaction } = useStorage();

  const totalMonthly = recurringTemplates
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const handleSave = async (tx: Omit<Transaction, 'id'>) => {
    if (editingTemplate) {
      await deleteTransaction(editingTemplate.id);
    }
    await addTransaction({ ...tx, isRecurring: true });
    setEditingTemplate(null);
  };

  const handleEdit = (template: Transaction) => {
    setEditingTemplate(template);
    setSheetOpen(true);
  };

  const handleClose = () => {
    setSheetOpen(false);
    setEditingTemplate(null);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-xl font-bold text-foreground">תשלומים קבועים</h1>
        </div>

        {/* Monthly total */}
        {totalMonthly > 0 && (
          <div className="rounded-xl bg-card border border-border p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">סה"כ הוצאות קבועות בחודש</span>
            <span className="font-bold text-lg" style={{ color: '#fb7185' }}>
              {formatCurrency(totalMonthly)}
            </span>
          </div>
        )}

        {/* List */}
        <div className="bg-card rounded-2xl border border-border p-4">
          {recurringTemplates.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <div className="text-4xl">🔄</div>
              <p className="text-muted-foreground text-sm">
                אין תשלומים קבועים עדיין
              </p>
              <p className="text-xs text-muted-foreground">
                הוסף שכירות, מנויים וחשבונות קבועים
              </p>
            </div>
          ) : (
            recurringTemplates.map((t, i) => (
              <div key={t.id}>
                {i > 0 && <Separator className="my-0.5" />}
                <RecurringItem
                  template={t}
                  isPaid={false}
                  onConfirm={() => {}}
                  onDelete={deleteTransaction}
                  onEdit={handleEdit}
                  showConfirm={false}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => { setEditingTemplate(null); setSheetOpen(true); }}
        className="fixed bottom-20 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center z-30 active:scale-90 transition-all"
        style={{ background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', boxShadow: '0 4px 20px rgba(59,130,246,0.4)' }}
      >
        <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
      </button>

      <AddTransactionSheet
        open={sheetOpen}
        onClose={handleClose}
        onSave={handleSave}
        editTemplate={editingTemplate}
      />
      <BottomNav />
    </div>
  );
}
