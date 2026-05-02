import { useEffect, useState } from 'react';
import {
  Compass,
  Zap,
  Target,
  Wallet,
  Shield,
  CreditCard,
  TrendingUp,
  BarChart3,
  ChevronDown,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { BottomNav } from '@/components/budget/BottomNav';

type Item =
  | { kind: 'action'; id: string; text: string; hint?: string }
  | { kind: 'info'; text: string }
  | { kind: 'kv'; label: string; value: string };

type Section = {
  id: string;
  title: string;
  subtitle?: string;
  icon: typeof Zap;
  color: string;
  items: Item[];
};

const SECTIONS: Section[] = [
  {
    id: 'immediate',
    title: 'פעולות מיידיות',
    subtitle: 'לסגור השבוע',
    icon: Zap,
    color: '#f43f5e',
    items: [
      { kind: 'action', id: 'credit-rating', text: 'להוציא דירוג אשראי מקפטן קרדיט' },
      { kind: 'action', id: 'bank-id', text: 'להוציא תעודת זהות בנקאית (הדוח המפורט)' },
      { kind: 'action', id: 'osh-3m', text: 'פירוט הוצאות עו״ש 3 חודשים אחורה' },
      { kind: 'action', id: 'cards-3m', text: 'פירוט הוצאות כרטיסי אשראי 3 חודשים אחורה' },
      { kind: 'action', id: 'har-hakesef', text: 'בדיקת נכסים פיננסיים', hint: 'har-hakesef.gov.il' },
    ],
  },
  {
    id: 'goals',
    title: 'מטרות פיננסיות',
    subtitle: 'מטרה × שווי × זמן',
    icon: Target,
    color: '#a855f7',
    items: [
      { kind: 'info', text: 'הגדר כאן יעדים אישיים: רכב, דירה, חופש כלכלי. השתמש בעמוד "יעדים" כדי לעקוב אחרי ההתקדמות שלהם.' },
    ],
  },
  {
    id: 'budget',
    title: 'תקציב חודשי',
    subtitle: 'כל 1 לחודש, לא מאוחר יותר',
    icon: Wallet,
    color: '#60a5fa',
    items: [
      { kind: 'info', text: 'חלוקת הוראות קבע:' },
      { kind: 'kv', label: '50%', value: 'מחייה שוטפת' },
      { kind: 'kv', label: '10%', value: 'קניות' },
      { kind: 'kv', label: '10%', value: 'אוכל' },
      { kind: 'kv', label: '10%', value: 'פינוקים / קניות רגשיות' },
      { kind: 'kv', label: '10%', value: 'תרומה' },
      { kind: 'kv', label: '5%', value: 'התפתחות אישית' },
      { kind: 'info', text: 'סיווג כל הוצאה לאחת מ־3:' },
      { kind: 'kv', label: 'הכרחי וקבוע', value: 'שכ״ד, חשמל, מים, ארנונה' },
      { kind: 'kv', label: 'הכרחי ולא קבוע', value: 'בגדים, טסט, יום הולדת' },
      { kind: 'kv', label: 'לא הכרחי ולא קבוע', value: 'חו״ל, בונוסים, רכב חדש' },
      { kind: 'info', text: 'תהליך חודשי:' },
      { kind: 'info', text: 'תיעוד יומי של כל הוצאה (אפשר ישירות באפליקציה דרך הצ׳אט)' },
      { kind: 'info', text: 'בסוף כל חודש סקירה: שימור הטוב, שיפור החלש' },
      { kind: 'info', text: 'ב־15 לחודש להכין תקציב לחודש הבא' },
    ],
  },
  {
    id: 'safety',
    title: 'קרנות הגנה',
    subtitle: 'חובה לפני השקעות',
    icon: Shield,
    color: '#22c55e',
    items: [
      { kind: 'kv', label: 'קרן חירום', value: 'הכנסות × 3 חודשים, בפיקדון נזיל' },
      { kind: 'info', text: 'מתחילים מ־1,000 ש״ח בחודש להפרשה אוטומטית.' },
      { kind: 'kv', label: 'קרן בלת״מים', value: 'הוצאות חודשיות × 5% × 12 ≈ 9,000 ש״ח' },
      { kind: 'info', text: 'מיועדת למלחמה, מגפה, אירועים מאקרו לא צפויים.' },
    ],
  },
  {
    id: 'credit',
    title: 'ניהול אשראי',
    subtitle: 'יעד דירוג: 850+',
    icon: CreditCard,
    color: '#f59e0b',
    items: [
      { kind: 'action', id: 'visa-after-salary', text: 'להעביר את חיוב הויזה לאחרי כניסת המשכורת' },
      { kind: 'info', text: 'תשלומים: רק כשההוצאה > 50% מההכנסה החודשית, ואז ל־2 תשלומים בלבד.' },
      { kind: 'info', text: 'לא למחוק היסטוריית דירוג אשראי לעולם.' },
      { kind: 'info', text: 'סולם הדירוג: 0–320 גרוע · 320–570 משתפר · 570–730 טוב · 730–850 טוב מאוד · 850+ מצוין.' },
    ],
  },
  {
    id: 'investing',
    title: 'עקרונות השקעה',
    subtitle: 'לתת לכסף לעבוד עבורי',
    icon: TrendingUp,
    color: '#06b6d4',
    items: [
      { kind: 'info', text: 'להתחיל עכשיו, גם עם 100–200 ש״ח/חודש. ההפרש בין גיל 20 לגיל 40 על אותם 10K דולר הוא ~600K דולר בריבית דריבית.' },
      { kind: 'info', text: 'אסור להשאיר עודפים בעו״ש או פיקדון — האינפלציה שוחקת את הכסף.' },
      { kind: 'info', text: 'מקור הכנסה אחד = סיכון מקסימלי. לפזר ל־2–3 לפחות.' },
      { kind: 'info', text: 'ערוצי הכנסה פסיבית: שוק ההון (S&P 500), נדל״ן, REITs, עסק בוגר, שותפויות.' },
    ],
  },
  {
    id: 'metrics',
    title: 'מדדים למעקב',
    subtitle: 'איך יודעים שהדרך נכונה',
    icon: BarChart3,
    color: '#fb7185',
    items: [
      { kind: 'kv', label: 'כלל ה־300', value: 'הוצאות חודשיות × 300 = הסכום שמשחרר מעבודה' },
      { kind: 'info', text: '5 שלבים לחופש כלכלי: מטרה ← תזרים ← תקציב ← השקעות מניבות ← הכנסות פסיביות.' },
      { kind: 'kv', label: 'עניים', value: '0–65% — הוצאות גבוהות מההכנסות' },
      { kind: 'kv', label: 'שורדים', value: '65–75% — אפס/מינוס קטן' },
      { kind: 'kv', label: 'חופשיים', value: '75–100% — 2–3K עודף קבוע ומעלה' },
    ],
  },
];

const STORAGE_KEY = 'liberation-tools-checked';

function loadChecked(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function LiberationToolsPage() {
  const [open, setOpen] = useState<Record<string, boolean>>({ immediate: true });
  const [checked, setChecked] = useState<Record<string, boolean>>(loadChecked);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
    } catch {
      // ignore quota errors
    }
  }, [checked]);

  const toggleSection = (id: string) =>
    setOpen(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleCheck = (id: string) =>
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const totalActions = SECTIONS.flatMap(s => s.items).filter(i => i.kind === 'action').length;
  const doneActions = Object.values(checked).filter(Boolean).length;

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-muted-foreground" />
          <h1 className="text-xl font-bold text-foreground">כלים לשחרור פיננסי</h1>
        </div>

        {/* Hero */}
        <div
          className="rounded-2xl p-5 border space-y-3"
          style={{
            borderColor: 'rgba(244,63,94,0.2)',
            background: 'linear-gradient(135deg, rgba(244,63,94,0.06) 0%, rgba(168,85,247,0.06) 100%)',
          }}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-wide text-foreground">מתודולוגיה שזוקקה ממאות שעות תוכן פיננסי</p>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(244,63,94,0.15)', color: '#f43f5e' }}
            >
              {doneActions}/{totalActions}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            סדר הפעולות, התקציב והעקרונות שצריך לעבוד לפיהם.
            סמן ✓ ליד כל משימה כשהיא נסגרת — השאר נשמר אצלך במכשיר.
          </p>
          <div className="h-1.5 rounded-full bg-muted/25 overflow-hidden">
            <div
              className="h-1.5 rounded-full transition-all duration-700"
              style={{
                width: `${totalActions ? Math.round((doneActions / totalActions) * 100) : 0}%`,
                background: 'linear-gradient(90deg, #f43f5e, #a855f7)',
              }}
            />
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {SECTIONS.map(section => {
            const Icon = section.icon;
            const isOpen = !!open[section.id];
            const sectionActions = section.items.filter(i => i.kind === 'action') as Extract<Item, { kind: 'action' }>[];
            const sectionDone = sectionActions.filter(a => checked[a.id]).length;
            const hasActions = sectionActions.length > 0;

            return (
              <div
                key={section.id}
                className="bg-card border border-border rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full px-4 py-4 flex items-center gap-3 transition-colors hover:bg-accent/30"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${section.color}18` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: section.color }} />
                  </div>
                  <div className="flex-1 text-right">
                    <p className="font-bold text-sm text-foreground">{section.title}</p>
                    {section.subtitle && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{section.subtitle}</p>
                    )}
                  </div>
                  {hasActions && (
                    <span
                      className="text-[10px] font-mono font-bold tabular-nums px-2 py-0.5 rounded-full"
                      style={{
                        background: `${section.color}15`,
                        color: section.color,
                      }}
                    >
                      {sectionDone}/{sectionActions.length}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 space-y-2 border-t border-border/50">
                    {section.items.map((item, idx) => {
                      if (item.kind === 'action') {
                        const isDone = !!checked[item.id];
                        return (
                          <button
                            key={item.id}
                            onClick={() => toggleCheck(item.id)}
                            className="w-full flex items-start gap-2.5 py-2 text-right transition-opacity active:opacity-60"
                          >
                            {isDone ? (
                              <CheckCircle2
                                className="w-4 h-4 mt-0.5 flex-shrink-0"
                                style={{ color: section.color }}
                              />
                            ) : (
                              <Circle className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground/40" />
                            )}
                            <div className="flex-1">
                              <p
                                className={`text-sm leading-snug ${
                                  isDone ? 'line-through text-muted-foreground' : 'text-foreground'
                                }`}
                              >
                                {item.text}
                              </p>
                              {item.hint && (
                                <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{item.hint}</p>
                              )}
                            </div>
                          </button>
                        );
                      }

                      if (item.kind === 'kv') {
                        return (
                          <div
                            key={idx}
                            className="flex items-start justify-between gap-3 py-1.5"
                          >
                            <p className="text-xs font-semibold text-foreground flex-shrink-0">{item.label}</p>
                            <p className="text-xs text-muted-foreground text-left">{item.value}</p>
                          </div>
                        );
                      }

                      return (
                        <p key={idx} className="text-xs text-muted-foreground leading-relaxed pt-1">
                          {item.text}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="text-[10px] text-center text-muted-foreground/60 pt-2 leading-relaxed">
          הסיכום עודכן לאחרונה ב־29.04.2026 · יעודכן אוטומטית כשתוסיף סרטונים נוספים
        </p>
      </div>

      <BottomNav />
    </div>
  );
}
