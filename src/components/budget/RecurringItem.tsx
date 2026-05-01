import { Check, Pencil, Trash2, RefreshCw, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { getCategoryById, CATEGORY_ICON_MAP } from '@/constants/categories';
import type { Transaction } from '@/types/budget';
import { Button } from '@/components/ui/button';

interface RecurringItemProps {
  template: Transaction;
  isPaid: boolean;
  onConfirm: (template: Transaction) => void;
  onDelete: (id: string) => void;
  onEdit?: (template: Transaction) => void;
  showConfirm?: boolean;
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
  const amountColor = isIncome ? '#4ade80' : '#fb7185';
  const CategoryIcon = CATEGORY_ICON_MAP[template.categoryId] ?? DollarSign;

  return (
    <div className="flex items-center gap-3 py-2.5">
      {/* Icon */}
      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
        {isPaid ? (
          <div className="w-8 h-8 rounded-lg bg-[rgba(34,197,94,0.12)] flex items-center justify-center">
            <Check className="w-4 h-4" style={{ color: '#22c55e' }} />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <CategoryIcon className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-foreground truncate">
          {category?.name ?? 'קבוע'}
          {template.note ? ` — ${template.note}` : ''}
        </div>
        {template.recurringDayOfMonth && (
          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <RefreshCw className="w-2.5 h-2.5" />
            כל {template.recurringDayOfMonth} לחודש
          </div>
        )}
      </div>

      {/* Amount */}
      <span className="font-bold text-sm font-mono tabular-nums flex-shrink-0" style={{ color: amountColor }}>
        {isIncome ? '+' : '−'}{formatCurrency(template.amount)}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {showConfirm && !isPaid && (
          <Button size="sm" variant="income" className="text-xs px-2 h-7" onClick={() => onConfirm(template)}>
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
