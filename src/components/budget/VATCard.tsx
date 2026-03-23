import { formatCurrency } from '@/lib/utils';

const VAT_RATE = 0.18; // 18% — Israel 2025

interface VATCardProps {
  totalIncome: number;   // gross income (includes VAT)
  totalExpenses: number; // gross expenses (includes VAT where applicable)
}

export function VATCard({ totalIncome, totalExpenses }: VATCardProps) {
  if (totalIncome === 0 && totalExpenses === 0) return null;

  // VAT on income = income * 18/118
  const incomeVAT = totalIncome * (VAT_RATE / (1 + VAT_RATE));
  // Input VAT credit from business expenses
  const expenseVATCredit = totalExpenses * (VAT_RATE / (1 + VAT_RATE));
  // Net VAT to remit
  const netVATDue = incomeVAT - expenseVATCredit;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-sm text-foreground">מע״מ — עוסק מורשה (18%)</h2>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{
            background: netVATDue > 0 ? 'rgba(251,113,133,0.15)' : 'rgba(74,222,128,0.15)',
            color: netVATDue > 0 ? '#fb7185' : '#4ade80',
          }}
        >
          {netVATDue > 0 ? 'לתשלום' : 'זיכוי'}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">מע״מ על הכנסות</span>
          <span style={{ color: '#fb7185' }}>-{formatCurrency(incomeVAT)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">זיכוי מע״מ הוצאות</span>
          <span style={{ color: '#4ade80' }}>+{formatCurrency(expenseVATCredit)}</span>
        </div>
        <div className="border-t border-border pt-2 flex justify-between font-bold">
          <span>{netVATDue > 0 ? 'לשלם לרשות המסים' : 'זיכוי מהרשות'}</span>
          <span style={{ color: netVATDue > 0 ? '#fb7185' : '#4ade80' }}>
            {formatCurrency(Math.abs(netVATDue))}
          </span>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/60">
        * מחושב על הכנסות והוצאות עסקיות החודש. מוגש דו-חודשי לשע״מ.
      </p>
    </div>
  );
}
