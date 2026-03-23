import { Trash2, RefreshCw } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getCategoryById } from '@/constants/categories';
import type { Transaction } from '@/types/budget';
import { cn } from '@/lib/utils';

interface TransactionItemProps {
  transaction: Transaction;
  onDelete?: (id: string) => void;
  compact?: boolean;
}

export function TransactionItem({ transaction, onDelete, compact = false }: TransactionItemProps) {
  const category = getCategoryById(transaction.categoryId);
  const isIncome = transaction.type === 'income';

  return (
    <div className={cn('flex items-center gap-3 py-2.5', !compact && 'px-1')}>
      {/* Emoji */}
      <div className="text-2xl w-10 text-center flex-shrink-0">
        {category?.emoji ?? '💰'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm text-foreground truncate">
            {category?.name ?? 'עסקה'}
          </span>
          {transaction.recurringParentId && (
            <RefreshCw className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          )}
        </div>
        {transaction.note && (
          <p className="text-xs text-muted-foreground truncate">{transaction.note}</p>
        )}
      </div>

      {/* Amount + date */}
      <div className="flex flex-col items-end flex-shrink-0">
        <span
          className="font-bold text-sm"
          style={{ color: isIncome ? '#4ade80' : '#fb7185' }}
        >
          {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
        </span>
        <span className="text-xs text-muted-foreground">{formatDate(transaction.date)}</span>
      </div>

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={() => onDelete(transaction.id)}
          className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
          aria-label="מחק"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
