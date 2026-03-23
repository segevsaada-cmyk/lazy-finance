import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface SummaryStripProps {
  totalIncome: number;
  totalExpenses: number;
}

export function SummaryStrip({ totalIncome, totalExpenses }: SummaryStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Income */}
      <div className="rounded-xl p-3.5 border income-bg flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[rgba(74,222,128,0.15)]">
          <TrendingUp className="w-4 h-4" style={{ color: '#4ade80' }} />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">הכנסות</div>
          <div className="font-bold text-base" style={{ color: '#4ade80' }}>
            {formatCurrency(totalIncome)}
          </div>
        </div>
      </div>

      {/* Expenses */}
      <div className="rounded-xl p-3.5 border expense-bg flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[rgba(251,113,133,0.15)]">
          <TrendingDown className="w-4 h-4" style={{ color: '#fb7185' }} />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">הוצאות</div>
          <div className="font-bold text-base" style={{ color: '#fb7185' }}>
            {formatCurrency(totalExpenses)}
          </div>
        </div>
      </div>
    </div>
  );
}
