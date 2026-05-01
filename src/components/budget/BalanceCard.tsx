import { cn, formatCurrency } from '@/lib/utils';
import type { BalanceStatus } from '@/types/budget';

interface BalanceCardProps {
  balance: number;
  status: BalanceStatus;
  expectedIncome: number;
  spentPercent: number;
  totalExpenses: number;
}

const STATUS_COLOR = { ok: '#22c55e', warning: '#f59e0b', danger: '#f43f5e' };
const STATUS_LABEL = { ok: 'מצב טוב', warning: 'שים לב', danger: 'חריגה' };

export function BalanceCard({ balance, status, expectedIncome, spentPercent, totalExpenses }: BalanceCardProps) {
  const color = STATUS_COLOR[status];

  return (
    <div
      className="rounded-2xl p-5 border bg-card transition-colors duration-500"
      style={{ borderColor: `${color}25` }}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-muted-foreground tracking-wider uppercase font-medium">יתרה חודשית</span>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
          <span className="text-xs font-medium" style={{ color }}>{STATUS_LABEL[status]}</span>
        </div>
      </div>

      <div
        className={cn('text-5xl font-black font-mono tabular-nums leading-none tracking-tight', status === 'danger' && 'animate-pulse')}
        style={{ color }}
      >
        {formatCurrency(balance)}
      </div>

      {expectedIncome > 0 && (
        <div className="mt-5 space-y-2">
          <div className="h-px rounded-full bg-muted/25 overflow-hidden">
            <div
              className="h-px rounded-full transition-all duration-700"
              style={{ width: `${Math.min(spentPercent, 100)}%`, background: color }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground font-mono tabular-nums">
            <span>{spentPercent}% נוצל</span>
            <span>{formatCurrency(totalExpenses)} / {formatCurrency(expectedIncome)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
