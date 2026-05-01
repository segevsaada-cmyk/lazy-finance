import { useState, useEffect } from 'react';
import { Plus, Target, Trash2, PlusCircle, CheckCircle2, Building2, Bot, Link2, X, ChevronLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BottomNav } from '@/components/budget/BottomNav';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  created_at: string;
}

export default function GoalsPage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState('');
  const [saving, setSaving] = useState(false);

  // New goal form
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newCurrent, setNewCurrent] = useState('');
  const [newDeadline, setNewDeadline] = useState('');

  const fetchGoals = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('financial_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (data) setGoals(data as Goal[]);
    setLoading(false);
  };

  useEffect(() => { fetchGoals(); }, [user]);

  const handleAddGoal = async () => {
    if (!user || !newName.trim() || !newTarget) return;
    setSaving(true);
    const { data, error } = await supabase.from('financial_goals').insert({
      user_id: user.id,
      name: newName.trim(),
      target_amount: parseFloat(newTarget) || 0,
      current_amount: parseFloat(newCurrent) || 0,
      deadline: newDeadline || null,
    }).select().single();
    if (error) { toast.error('שגיאה ביצירת מטרה'); }
    else {
      setGoals(prev => [...prev, data as Goal]);
      setShowAdd(false);
      setNewName(''); setNewTarget(''); setNewCurrent(''); setNewDeadline('');
      toast.success('מטרה נוצרה!');
    }
    setSaving(false);
  };

  const handleAddToGoal = async (goalId: string) => {
    const amount = parseFloat(addAmount);
    if (!amount || amount <= 0) return;
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    const newAmount = goal.current_amount + amount;
    const { error } = await supabase
      .from('financial_goals').update({ current_amount: newAmount }).eq('id', goalId);
    if (error) { toast.error('שגיאה'); }
    else {
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, current_amount: newAmount } : g));
      if (newAmount >= goal.target_amount) toast.success('מטרה הושגה!');
      else toast.success(`נוספו ${formatCurrency(amount)}`);
      setAddingTo(null);
      setAddAmount('');
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('financial_goals').delete().eq('id', id);
    setGoals(prev => prev.filter(g => g.id !== id));
  };

  const daysLeft = (deadline: string) => {
    const d = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
    return d;
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-muted-foreground" />
            <h1 className="text-xl font-bold">מטרות פיננסיות</h1>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl transition-all active:scale-95"
            style={{ background: 'rgba(244,63,94,0.12)', color: '#f43f5e' }}
          >
            <Plus className="w-3.5 h-3.5" />
            מטרה חדשה
          </button>
        </div>

        {/* Coming Soon Teaser */}
        <div
          className="rounded-2xl p-5 border space-y-4"
          style={{
            borderColor: 'rgba(244,63,94,0.2)',
            background: 'linear-gradient(135deg, rgba(244,63,94,0.04) 0%, rgba(168,85,247,0.04) 100%)',
          }}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-foreground tracking-wide">בקרוב — הכל במקום אחד</p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
              SOON
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Building2, label: 'חיבור לבנק', desc: 'עסקאות אוטומטיות', color: '#60a5fa' },
              { icon: ChevronLeft, label: 'רואה חשבון', desc: 'מס ודוחות שנתיים', color: '#4ade80' },
              { icon: Bot, label: 'יועץ AI', desc: 'עצות חכמות', color: '#f43f5e', active: true },
            ].map(({ icon: Icon, label, desc, color, active }) => (
              <div
                key={label}
                className="rounded-xl p-3 border text-center space-y-1.5"
                style={{ borderColor: `${color}25`, background: active ? `${color}10` : 'transparent', opacity: active ? 1 : 0.6 }}
              >
                <div className="w-8 h-8 rounded-lg mx-auto flex items-center justify-center" style={{ background: `${color}15` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <p className="text-[11px] font-semibold text-foreground leading-tight">{label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
                {active && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${color}20`, color }}>
                    פעיל
                  </span>
                )}
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed text-center">
            סנכרון אוטומטי מהבנק, חישוב מס ודוחות רואה חשבון,
            ועצות AI חכמות — הכל בממשק אחד.
          </p>
        </div>

        {/* Goals list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
          </div>
        ) : goals.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-3">
            <Target className="w-10 h-10 mx-auto text-muted-foreground/25" />
            <p className="font-semibold text-muted-foreground">אין מטרות עדיין</p>
            <p className="text-xs text-muted-foreground/60">הוסף מטרה פיננסית כדי לעקוב אחרי ההתקדמות שלך</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-2 text-sm font-bold px-4 py-2 rounded-xl transition-all active:scale-95"
              style={{ background: 'rgba(244,63,94,0.12)', color: '#f43f5e' }}
            >
              + הוסף מטרה ראשונה
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {goals.map(goal => {
              const pct = Math.min(Math.round((goal.current_amount / goal.target_amount) * 100), 100);
              const done = goal.current_amount >= goal.target_amount;
              const color = done ? '#22c55e' : pct >= 75 ? '#f59e0b' : '#f43f5e';

              return (
                <div key={goal.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  {/* Goal header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: done ? 'rgba(34,197,94,0.12)' : 'rgba(244,63,94,0.1)' }}
                      >
                        {done
                          ? <CheckCircle2 className="w-5 h-5" style={{ color: '#22c55e' }} />
                          : <Target className="w-5 h-5" style={{ color: '#f43f5e' }} />
                        }
                      </div>
                      <div>
                        <p className="font-bold text-sm text-foreground">{goal.name}</p>
                        {goal.deadline && !done && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {daysLeft(goal.deadline) > 0
                              ? `עוד ${daysLeft(goal.deadline)} ימים`
                              : 'עבר הזמן'}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="p-1.5 rounded-lg hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="h-1.5 rounded-full bg-muted/25 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] font-mono tabular-nums">
                      <span style={{ color }}>{pct}%{done ? ' — הושלם!' : ''}</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
                      </span>
                    </div>
                  </div>

                  {/* Add money */}
                  {!done && (
                    <>
                      {addingTo === goal.id ? (
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            placeholder="כמה להוסיף?"
                            value={addAmount}
                            onChange={e => setAddAmount(e.target.value)}
                            className="text-right font-mono"
                            autoFocus
                          />
                          <Button size="sm" onClick={() => handleAddToGoal(goal.id)} disabled={!addAmount}>
                            הוסף
                          </Button>
                          <button
                            onClick={() => { setAddingTo(null); setAddAmount(''); }}
                            className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                          >
                            <X className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingTo(goal.id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          הוסף כסף למטרה
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add goal sheet */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end" onClick={() => setShowAdd(false)}>
          <div
            dir="rtl"
            className="w-full max-w-lg mx-auto bg-card border border-border rounded-t-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-foreground">מטרה חדשה</h2>
              <button onClick={() => setShowAdd(false)} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <Separator />

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">שם המטרה</Label>
                <Input placeholder="לדוגמה: רכב, דירה, חופשה" value={newName} onChange={e => setNewName(e.target.value)} className="text-right" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">סכום יעד (₪)</Label>
                <Input type="number" placeholder="50000" value={newTarget} onChange={e => setNewTarget(e.target.value)} className="text-right font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">כבר חסכת (₪) — אופציונלי</Label>
                <Input type="number" placeholder="0" value={newCurrent} onChange={e => setNewCurrent(e.target.value)} className="text-right font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">תאריך יעד — אופציונלי</Label>
                <Input type="date" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} className="text-right" />
              </div>
            </div>

            <button
              onClick={handleAddGoal}
              disabled={saving || !newName.trim() || !newTarget}
              className="w-full py-3 rounded-xl font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #be123c, #f43f5e)', boxShadow: '0 2px 12px rgba(244,63,94,0.3)' }}
            >
              {saving ? '...' : 'צור מטרה'}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
