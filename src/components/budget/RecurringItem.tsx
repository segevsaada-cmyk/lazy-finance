import { Check, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { getCategoryById } from '@/constants/categories';
import type { Transaction } from '@/types/budget';
import { Button } from '@/components/ui/button';

interface RecurringItemProps {
  template: Transaction;
  isPaid: boolean;
  onConfirm: (template: Transaction) => void;
  onDelete: (id: string) => void;
  onEdit?: (template: Transaction) => void;
  showConfirm?: boolean; // show the "שולם" button
}

export function RecurringItem({
  template,
  isPaid,
  onConfirm,
  onDelete,
  onEdit,
  showConfirm = true,
}: RecurringItemProps) {
  const category = getCategoryById(template.categoryId);
  const isIncome = template.type === 'income';

  return (
    <div className="flex items-center gap-3 py-2.5">
      {/* Emoji with paid overlay */}
      <div className="relative text-2xl w-10 text-center flex-shrink-0">
        {isPaid ? (
          <div className="w-10 h-10 rounded-full bg-[rgba(34,197,94,0.15)] border border-[rgba(34,197,94,0.3)] flex items-center justify-center">
            <Check className="w-5 h-5" style={{ color: '#22c55e' }} />
          </div>
        ) : (
          <span className={isPaid ? 'opacity-40' : ''}>{category?.emoji ?? '🔄'}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-foreground truncate">
          {category?.name ?? 'קבוע'}
          {template.note ? ` — ${template.note}` : ''}
        </div>
        {template.recurringDayOfMonth && (
          <div className="text-xs text-muted-foreground">
            כל חודש ב-{template.recurringDayOfMonth}
          </div>
        )}
      </div>

      {/* Amount */}
      <span
        className="font-bold text-sm flex-shrink-0"
        style={{ color: isIncome ? '#4ade80' : '#fb7185' }}
      >
        {isIncome ? '+' : '-'}{formatCurrency(template.amount)}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {showConfirm && !isPaid && (
          <Button
            size="sm"
            variant="income"
            className="text-xs px-2 h-7"
            onClick={() => onConfirm(template)}
          >
            <Check className="w-3.5 h-3.5" />
            שולם
          </Button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(template)}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => onDelete(template.id)}
          className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
