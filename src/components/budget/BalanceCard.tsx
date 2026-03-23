import { cn, formatCurrency } from '@/lib/utils';
import type { BalanceStatus } from '@/types/budget';

interface BalanceCardProps {
  balance: number;
  status: BalanceStatus;
  expectedIncome: number;
  spentPercent: number;
  totalExpenses: number;
}

const STATUS_COLOR = {
  ok: '#22c55e',
  warning: '#f59e0b',
  danger: '#f43f5e',
};

const STATUS_BG = {
  ok: 'rgba(34,197,94,0.08)',
  warning: 'rgba(245,158,11,0.08)',
  danger: 'rgba(244,63,94,0.08)',
};

const STATUS_LABEL = {
  ok: 'מצב טוב',
  warning: 'שים לב',
  danger: 'חסר כסף!',
};

export function BalanceCard({ balance, status, expectedIncome, spentPercent, totalExpenses }: BalanceCardProps) {
  const color = STATUS_COLOR[status];
  const bg = STATUS_BG[status];

  return (
    <div
      className={cn(
        'rounded-2xl p-5 border transition-all duration-500',
        status === 'danger' && 'animate-pulse-glow'
      )}
      style={{ background: bg, borderColor: `${color}33` }}
    >
      {/* Status badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${color}20`, color }}>
          {STATUS_LABEL[status]}
        </span>
        <span className="text-sm text-muted-foreground">יתרה החודש</span>
      </div>

      {/* Big balance number */}
      <div
        className={cn('text-5xl font-black tracking-tight text-right transition-colors duration-300', status === 'danger' && 'animate-pulse')}
        style={{ color }}
      >
        {formatCurrency(balance)}
      </div>

      {/* Progress bar — expenses vs expected income */}
      {expectedIncome > 0 && (
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{spentPercent}% מהצפוי</span>
            <span>
              {formatCurrency(totalExpenses)} מתוך {formatCurrency(expectedIncome)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${spentPercent}%`,
                background: `linear-gradient(to left, ${color}, ${color}80)`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
