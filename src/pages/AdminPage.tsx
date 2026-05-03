import { useEffect, useState } from 'react';
import { CheckCircle2, Users, ArrowRight, Clock, Shield, UserCheck, UserX, UserPlus, Trash2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

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
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<Tab>('pending');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '' });

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

  const createUser = async () => {
    if (!form.email || !form.password) {
      toast.error('אימייל וסיסמה הם שדות חובה');
      return;
    }
    if (form.password.length < 6) {
      toast.error('הסיסמה חייבת להיות לפחות 6 תווים');
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: {
        action: 'create',
        email: form.email,
        password: form.password,
        full_name: form.full_name || null,
        phone: form.phone || null,
        is_approved: true,
      },
    });
    if (error || (data && data.error)) {
      toast.error('שגיאה ביצירת המשתמש: ' + (data?.error || error?.message || ''));
    } else {
      toast.success('המשתמש נוצר ואושר');
      setForm({ email: '', password: '', full_name: '', phone: '' });
      setShowCreate(false);
      await refresh();
    }
    setCreating(false);
  };

  const deleteUser = async (u: UserRow) => {
    setBusyId(u.user_id);
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'delete', user_id: u.user_id },
    });
    if (error || (data && data.error)) {
      toast.error('שגיאה במחיקה: ' + (data?.error || error?.message || ''));
    } else {
      toast.success('המשתמש נמחק');
      setUsers(prev => prev.filter(x => x.user_id !== u.user_id));
    }
    setBusyId(null);
    setConfirmDelete(null);
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
          <div className="flex items-center gap-2 flex-1">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <h1 className="text-lg font-bold text-foreground">ניהול</h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95 flex items-center gap-1.5"
            style={{ background: 'linear-gradient(135deg, #15803d, #22c55e)' }}
          >
            <UserPlus className="w-3.5 h-3.5" />
            משתמש חדש
          </button>
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
                    {currentUser?.id !== u.user_id && (
                      <button
                        onClick={() => setConfirmDelete(u)}
                        disabled={busy}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                        style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e' }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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

      {/* Create user modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => !creating && setShowCreate(false)}>
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> יצירת משתמש חדש
              </h2>
              <button onClick={() => !creating && setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-secondary">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">אימייל *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">סיסמה * (לפחות 6 תווים)</label>
                <input
                  type="text"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">שם מלא</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">טלפון</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40 font-mono"
                  placeholder="0501234567"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => !creating && setShowCreate(false)}
                disabled={creating}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold border border-border text-muted-foreground hover:text-foreground transition-all active:scale-95 disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                onClick={createUser}
                disabled={creating}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #15803d, #22c55e)' }}
              >
                {creating ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    צור משתמש
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => busyId !== confirmDelete.user_id && setConfirmDelete(null)}>
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4" style={{ color: '#f43f5e' }} />
              <h2 className="text-base font-bold text-foreground">מחיקת משתמש</h2>
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                המשתמש <span className="font-bold text-foreground">{confirmDelete.full_name || 'ללא שם'}</span>
                {confirmDelete.phone && <span className="font-mono text-foreground"> ({confirmDelete.phone})</span>}
                {' '}יימחק לצמיתות, יחד עם כל הנתונים שלו (תנועות, יעדים, חיבורי בנק, היסטוריית WhatsApp).
              </p>
              <p className="text-xs text-rose-400 font-semibold">פעולה זו לא ניתנת לביטול.</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => busyId !== confirmDelete.user_id && setConfirmDelete(null)}
                disabled={busyId === confirmDelete.user_id}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold border border-border text-muted-foreground hover:text-foreground transition-all active:scale-95 disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                onClick={() => deleteUser(confirmDelete)}
                disabled={busyId === confirmDelete.user_id}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #b91c1c, #f43f5e)' }}
              >
                {busyId === confirmDelete.user_id ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    מחק
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
