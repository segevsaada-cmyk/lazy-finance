import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AuthPage() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loginBy, setLoginBy] = useState<'email' | 'phone'>('email');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data } = await supabase
          .from('user_settings')
          .select('is_approved')
          .eq('user_id', session.user.id)
          .maybeSingle();
        navigate(data?.is_approved ? '/' : '/pending-approval');
      }
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    if (loginBy === 'email' && !email) return;
    if (loginBy === 'phone' && !phone) return;
    setLoading(true);

    let loginEmail = email;
    if (loginBy === 'phone') {
      const r = await fetch('/api/login-by-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(j.error || 'מספר לא נמצא במערכת');
        setLoading(false);
        return;
      }
      const j = await r.json();
      loginEmail = j.email;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    if (error) {
      toast.error(error.message.includes('Invalid login credentials') ? 'פרטי התחברות שגויים' : error.message);
      setLoading(false);
      return;
    }
    const { data: settings } = await supabase
      .from('user_settings')
      .select('is_approved')
      .eq('user_id', data.user.id)
      .maybeSingle();
    navigate(settings?.is_approved ? '/' : '/pending-approval');
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('יש להזין שם מלא'); return; }
    if (!email || password.length < 6) { toast.error('סיסמה חייבת להיות לפחות 6 תווים'); return; }
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      toast.error(error.message.includes('already registered') ? 'האימייל כבר רשום — נסה להתחבר' : error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: settingsError } = await supabase.from('user_settings').insert({
        user_id: data.user.id,
        expected_monthly_income: 0,
        warning_threshold: 1000,
        is_osek_murshe: false,
        full_name: name.trim(),
        phone: phone.trim() || null,
        is_approved: false,
        role: 'user',
      });
      if (settingsError) {
        toast.error(`נרשמת אבל יצירת הפרופיל נכשלה: ${settingsError.message}. פנה למנהל המערכת.`);
        setLoading(false);
        return;
      }
    }

    navigate('/pending-approval');
    setLoading(false);
  };

  const ic = 'bg-background border-border text-foreground placeholder:text-muted-foreground/40 focus:border-rose-500/60 focus-visible:ring-0 focus-visible:ring-offset-0 text-right font-mono';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="pointer-events-none fixed top-0 left-0 right-0 h-64 opacity-15"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(244,63,94,0.5), transparent)' }}
      />

      <div
        dir="rtl"
        className="relative w-full max-w-sm border border-border bg-card rounded-2xl overflow-hidden"
        style={{
          boxShadow: '0 0 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
          transform: mounted ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
          opacity: mounted ? 1 : 0,
          transition: 'transform 0.45s cubic-bezier(0.16,1,0.3,1), opacity 0.45s ease',
        }}
      >
        {/* Header */}
        <div className="px-6 pt-8 pb-5 text-center border-b border-border/50">
          <h1 className="text-3xl font-black tracking-tight">
            <span style={{ color: '#f43f5e' }}>Lazy</span>{' '}
            <span className="text-foreground">Finance</span>
          </h1>
          <p className="text-xs text-muted-foreground/70 mt-1.5 tracking-wide">
            התנהלות פיננסית פשוטה לעצלנים
          </p>
        </div>

        <div className="px-6 py-5">
          {/* Tabs */}
          <div className="flex mb-5 bg-secondary rounded-lg p-0.5 gap-0.5">
            {[{ id: true, label: 'כניסה' }, { id: false, label: 'הרשמה' }].map(tab => (
              <button
                key={String(tab.id)}
                type="button"
                onClick={() => setIsLogin(tab.id)}
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 ${
                  isLogin === tab.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-3.5">
            {/* Signup-only fields */}
            {!isLogin && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">שם מלא</Label>
                  <Input
                    type="text"
                    placeholder="ישראל ישראלי"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    disabled={loading}
                    className={ic}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">טלפון (אופציונלי)</Label>
                  <Input
                    type="tel"
                    placeholder="050-0000000"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    disabled={loading}
                    className={ic}
                  />
                </div>
              </>
            )}

            {/* Login: choose email vs phone */}
            {isLogin && (
              <div className="flex bg-secondary/60 rounded-lg p-0.5 gap-0.5">
                {[{ id: 'email' as const, label: 'מייל' }, { id: 'phone' as const, label: 'נייד' }].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setLoginBy(t.id)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 ${
                      loginBy === t.id ? 'bg-card text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {(!isLogin || loginBy === 'email') && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">אימייל</Label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className={ic}
                />
              </div>
            )}

            {isLogin && loginBy === 'phone' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">נייד</Label>
                <Input
                  type="tel"
                  placeholder="050-0000000"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  disabled={loading}
                  className={ic}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">סיסמה</Label>
              <Input
                type="password"
                placeholder={isLogin ? '••••••••' : 'לפחות 6 תווים'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={loading}
                className={ic}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-1 rounded-xl font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #be123c, #f43f5e)',
                boxShadow: '0 2px 12px rgba(244,63,94,0.35)',
              }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : isLogin ? 'כניסה' : 'שלח בקשת הצטרפות'}
            </button>

            {!isLogin && (
              <p className="text-center text-[11px] text-muted-foreground/60 leading-relaxed">
                הרשמתך תיבחן על ידי האדמין ותאושר בהקדם
              </p>
            )}
          </form>
        </div>

        <div className="px-6 py-3 border-t border-border/30 text-center">
          <span className="text-[10px] text-muted-foreground/30 font-mono">LAZY FINANCE v1.0</span>
        </div>
      </div>
    </div>
  );
}
