import { useEffect, useState } from 'react';
import { CheckCircle2, Users, ArrowRight, Clock, Shield, ShieldOff, UserCheck, UserX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface UserRow {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  is_approved: boolean;
  role: string | null;
  updated_at: string;
}

type Tab = 'pending' | 'all';

export default function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('pending');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_settings')
      .select('user_id, full_name, phone, is_approved, role, updated_at')
      .order('updated_at', { ascending: false });
    if (error) {
      toast.error('שגיאה בטעינת המשתמשים');
    } else if (data) {
      setUsers(data as UserRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const setApproval = async (userId: string, isApproved: boolean) => {
    setBusyId(userId);
    const { error } = await supabase
      .from('user_settings')
      .update({ is_approved: isApproved })
      .eq('user_id', userId);
    if (error) {
      toast.error('שגיאה בעדכון');
    } else {
      toast.success(isApproved ? 'המשתמש אושר' : 'הגישה בוטלה');
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_approved: isApproved } : u));
    }
    setBusyId(null);
  };

  const setRole = async (userId: string, role: 'admin' | 'user') => {
    setBusyId(userId);
    const { error } = await supabase
      .from('user_settings')
      .update({ role })
      .eq('user_id', userId);
    if (error) {
      toast.error('שגיאה בעדכון תפקיד');
    } else {
      toast.success(role === 'admin' ? 'הוגדר כאדמין' : 'הוסר אדמין');
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role } : u));
    }
    setBusyId(null);
  };

  const pending = users.filter(u => !u.is_approved);
  const visible = tab === 'pending' ? pending : users;
  const approvedCount = users.filter(u => u.is_approved).length;
  const adminCount = users.filter(u => u.role === 'admin').length;

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-12">
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-xl bg-secondary hover:bg-accent transition-colors"
          >
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <h1 className="text-lg font-bold text-foreground">ניהול</h1>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card border border-border rounded-2xl p-3 space-y-0.5">
            <p className="text-[10px] font-bold text-muted-foreground">ממתינים</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: pending.length > 0 ? '#f43f5e' : 'currentColor' }}>
              {pending.length}
            </p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-3 space-y-0.5">
            <p className="text-[10px] font-bold text-muted-foreground">מאושרים</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: '#4ade80' }}>{approvedCount}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-3 space-y-0.5">
            <p className="text-[10px] font-bold text-muted-foreground">אדמינים</p>
            <p className="text-lg font-bold tabular-nums">{adminCount}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary rounded-full p-0.5">
          <button
            onClick={() => setTab('pending')}
            className={`flex-1 text-xs font-bold px-3 py-1.5 rounded-full transition-all flex items-center justify-center gap-1.5 ${
              tab === 'pending' ? 'bg-rose-500 text-white' : 'text-muted-foreground'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            ממתינים
            {pending.length > 0 && (
              <span className="text-[10px] font-mono bg-white/20 rounded-full px-1.5">{pending.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab('all')}
            className={`flex-1 text-xs font-bold px-3 py-1.5 rounded-full transition-all flex items-center justify-center gap-1.5 ${
              tab === 'all' ? 'bg-rose-500 text-white' : 'text-muted-foreground'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            כל המשתמשים
            <span className="text-[10px] font-mono opacity-70">{users.length}</span>
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <CheckCircle2 className="w-12 h-12 mx-auto text-muted-foreground/30" />
            <p className="font-semibold text-muted-foreground">
              {tab === 'pending' ? 'אין ממתינים לאישור' : 'אין משתמשים'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(u => {
              const isAdmin = u.role === 'admin';
              const busy = busyId === u.user_id;
              return (
                <div
                  key={u.user_id}
                  className="bg-card border border-border rounded-xl p-3 space-y-2"
                >
                  {/* Top row: identity + status */}
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      u.is_approved ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                    }`}>
                      {isAdmin ? (
                        <Shield className="w-4 h-4" style={{ color: '#a78bfa' }} />
                      ) : u.is_approved ? (
                        <UserCheck className="w-4 h-4" style={{ color: '#4ade80' }} />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-foreground truncate">{u.full_name || 'ללא שם'}</p>
                        {isAdmin && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>
                            ADMIN
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{u.phone || 'ללא טלפון'}</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">{formatDate(u.updated_at)}</p>
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="flex gap-2 pt-1 border-t border-border/40">
                    {!u.is_approved ? (
                      <button
                        onClick={() => setApproval(u.user_id, true)}
                        disabled={busy}
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                        style={{ background: 'linear-gradient(135deg, #15803d, #22c55e)' }}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        אשר גישה
                      </button>
                    ) : (
                      <button
                        onClick={() => setApproval(u.user_id, false)}
                        disabled={busy}
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 border border-border text-muted-foreground hover:text-foreground"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        בטל גישה
                      </button>
                    )}
                    {u.is_approved && (
                      isAdmin ? (
                        <button
                          onClick={() => setRole(u.user_id, 'user')}
                          disabled={busy}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 border border-border text-muted-foreground hover:text-foreground"
                        >
                          <ShieldOff className="w-3.5 h-3.5" />
                          הסר אדמין
                        </button>
                      ) : (
                        <button
                          onClick={() => setRole(u.user_id, 'admin')}
                          disabled={busy}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                          style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}
                        >
                          <Shield className="w-3.5 h-3.5" />
                          הפוך לאדמין
                        </button>
                      )
                    )}
                    {busy && (
                      <div className="w-4 h-4 rounded-full border-2 border-rose-500 border-t-transparent animate-spin self-center" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
