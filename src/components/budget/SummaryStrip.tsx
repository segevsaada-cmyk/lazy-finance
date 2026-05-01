import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface SummaryStripProps {
  totalIncome: number;
  totalExpenses: number;
}

export function SummaryStrip({ totalIncome, totalExpenses }: SummaryStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium">הכנסות</span>
          <ArrowUpRight className="w-3.5 h-3.5" style={{ color: '#4ade80' }} />
        </div>
        <div className="font-bold text-lg font-mono tabular-nums" style={{ color: '#4ade80' }}>
          {formatCurrency(totalIncome)}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium">הוצאות</span>
          <ArrowDownRight className="w-3.5 h-3.5" style={{ color: '#fb7185' }} />
        </div>
        <div className="font-bold text-lg font-mono tabular-nums" style={{ color: '#fb7185' }}>
          {formatCurrency(totalExpenses)}
        </div>
      </div>
    </div>
  );
}
