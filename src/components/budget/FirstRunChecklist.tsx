import { Sparkles, ArrowLeft, Wallet, RefreshCw, MessageSquarePlus, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  hasIncome: boolean;
  hasRecurring: boolean;
  hasTransactions: boolean;
  onAddTransaction: () => void;
}

/**
 * First-run welcome card shown on the dashboard when the user has no
 * transactions yet. Walks them through three concrete next actions.
 * Hides itself once all three are checked off (or once they have any
 * transaction at all — see DashboardPage).
 */
export function FirstRunChecklist({
  hasIncome,
  hasRecurring,
  hasTransactions,
  onAddTransaction,
}: Props) {
  const navigate = useNavigate();

  const items: Array<{
    done: boolean;
    icon: React.ReactNode;
    title: string;
    sub: string;
    action: () => void;
    cta: string;
  }> = [
    {
      done: hasIncome,
      icon: <Wallet className="w-4 h-4" />,
      title: 'הגדר הכנסה חודשית',
      sub: 'כדי שנדע איפה אתה ביחס למה שאתה צפוי להרוויח',
      action: () => navigate('/settings'),
      cta: 'להגדרות',
    },
    {
      done: hasRecurring,
      icon: <RefreshCw className="w-4 h-4" />,
      title: 'הוסף תשלום קבוע',
      sub: 'שכירות, ספוטיפיי, כושר — הכל יחויב אוטומטית כל חודש',
      action: () => navigate('/recurring'),
      cta: 'להוסיף',
    },
    {
      done: hasTransactions,
      icon: <MessageSquarePlus className="w-4 h-4" />,
      title: 'רשום תנועה ראשונה',
      sub: 'אפשר גם בצ׳אט: "קפה ב-22" — והכל יסתדר אוטומטית',
      action: onAddTransaction,
      cta: 'להוסיף',
    },
  ];

  const completed = items.filter((i) => i.done).length;

  return (
    <div
      className="bg-card rounded-2xl border p-5 space-y-3"
      style={{
        borderColor: 'rgba(244,63,94,0.2)',
        background:
          'linear-gradient(135deg, rgba(244,63,94,0.04) 0%, rgba(244,63,94,0.01) 100%)',
      }}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4" style={{ color: '#f43f5e' }} />
        <h2 className="font-bold text-sm text-foreground">ברוך הבא 👋</h2>
        <span className="ms-auto text-[11px] font-mono text-muted-foreground">
          {completed}/3
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        שלוש פעולות קצרות לסיום ההקמה. אחרי זה האפליקציה עובדת בשבילך:
      </p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={item.action}
            disabled={item.done}
            className={`w-full flex items-center gap-3 rounded-xl p-3 text-right transition-colors ${
              item.done
                ? 'bg-secondary/30 cursor-default'
                : 'bg-secondary/60 hover:bg-secondary active:scale-[0.99]'
            }`}
          >
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                item.done ? 'text-muted-foreground/40' : 'text-foreground'
              }`}
              style={{
                background: item.done
                  ? 'rgba(74,222,128,0.12)'
                  : 'rgba(244,63,94,0.12)',
              }}
            >
              {item.done ? (
                <CheckCircle2 className="w-4 h-4" style={{ color: '#4ade80' }} />
              ) : (
                item.icon
              )}
            </div>
            <div className="flex-1 min-w-0 text-right">
              <p
                className={`text-sm font-semibold ${
                  item.done ? 'text-muted-foreground/50 line-through' : 'text-foreground'
                }`}
              >
                {item.title}
              </p>
              {!item.done && (
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                  {item.sub}
                </p>
              )}
            </div>
            {!item.done && (
              <span className="flex-shrink-0 text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                {item.cta}
                <ArrowLeft className="w-3 h-3" />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
