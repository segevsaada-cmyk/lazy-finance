import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CURRENT_TERMS_VERSION } from '@/constants/legal';

function phoneDigitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

function syntheticEmailFromPhone(phone: string): string {
  return `phone-${phoneDigitsOnly(phone).slice(-9)}@auth.lazyfinance.app`;
}

export default function AuthPage() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const TERMS_VERSION = CURRENT_TERMS_VERSION;

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
    if (!phone || !password) return;
    setLoading(true);

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
    const { email: loginEmail } = await r.json();

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
    if (phoneDigitsOnly(phone).length < 9) { toast.error('יש להזין מספר נייד תקין'); return; }
    if (password.length < 6) { toast.error('סיסמה חייבת להיות לפחות 6 תווים'); return; }
    if (!acceptedTerms) { toast.error('יש לאשר את התקנון, מדיניות הפרטיות והצהרת הנגישות'); return; }
    setLoading(true);

    // Server-side rate limit (anti-flood). Returns 429 with Retry-After
    // if either the IP or the phone has signed up too recently.
    const pre = await fetch('/api/signup-precheck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (!pre.ok) {
      if (pre.status === 429) {
        toast.error('יותר מדי ניסיונות. נסה שוב בעוד שעה.');
      } else {
        const j = await pre.json().catch(() => ({}));
        toast.error(j.error || 'שגיאה בהרשמה');
      }
      setLoading(false);
      return;
    }

    const syntheticEmail = syntheticEmailFromPhone(phone);
    const { data, error } = await supabase.auth.signUp({ email: syntheticEmail, password });
    if (error) {
      toast.error(error.message.includes('already registered') ? 'הנייד הזה כבר רשום — נסה להתחבר' : error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const trialEnds = new Date(Date.now() + 14 * 86400000).toISOString();
      const { error: settingsError } = await supabase.from('user_settings').insert({
        user_id: data.user.id,
        expected_monthly_income: 0,
        warning_threshold: 1000,
        is_osek_murshe: false,
        full_name: name.trim(),
        phone: phone.trim(),
        is_approved: false,
        role: 'user',
        terms_accepted_at: new Date().toISOString(),
        terms_version: TERMS_VERSION,
        subscription_status: 'trial',
        trial_ends_at: trialEnds,
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
        <div className="px-6 pt-6 pb-5 text-center border-b border-border/50">
          <img
            src="/lazy-finance-logo.png"
            alt="Lazy Finance"
            className="brand-logo block w-full max-w-[220px] h-auto mx-auto select-none"
            draggable={false}
          />
          <p className="mt-3 text-sm font-bold tracking-tight text-foreground/90">
            כסף עובד. אתה לא.
          </p>
          <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/80 font-medium tracking-wide flex-wrap">
            <span>ניהול פיננסי חכם</span>
            <span className="text-muted-foreground/40">·</span>
            <span>תובנות חכמות</span>
            <span className="text-muted-foreground/40">·</span>
            <span>בלי כאב ראש</span>
          </div>
          {/* Trust signals — small icons that quietly answer "is this safe?" */}
          <div className="mt-4 flex items-center justify-center gap-3 text-[10px] text-muted-foreground/70">
            <span className="flex items-center gap-1">🔒 הצפנה</span>
            <span className="text-muted-foreground/30">·</span>
            <span className="flex items-center gap-1">🇮🇱 ישראל</span>
            <span className="text-muted-foreground/30">·</span>
            <span className="flex items-center gap-1">👤 רק אתה רואה</span>
          </div>
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
            {/* Signup-only: full name */}
            {!isLogin && (
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
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">נייד</Label>
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="050-0000000"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                disabled={loading}
                className={ic}
              />
            </div>
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

            {!isLogin && (
              <label className="flex items-start gap-2 pt-1 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={e => setAcceptedTerms(e.target.checked)}
                  disabled={loading}
                  required
                  className="mt-0.5 w-4 h-4 accent-rose-500 cursor-pointer flex-shrink-0"
                  aria-describedby="terms-label"
                />
                <span id="terms-label" className="text-[11px] text-muted-foreground/80 leading-relaxed select-none">
                  קראתי ואני מאשר/ת את ה
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground" style={{ color: '#f43f5e' }}>תקנון</a>
                  , את ה
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground" style={{ color: '#f43f5e' }}>מדיניות הפרטיות</a>
                  {' '}ואת ה
                  <a href="/accessibility" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground" style={{ color: '#f43f5e' }}>הצהרת הנגישות</a>
                  .
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={loading || (!isLogin && !acceptedTerms)}
              className="w-full py-3 mt-1 rounded-xl font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
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
                לאחר השליחה — תיבחן על ידי האדמין ותאושר בהקדם.
              </p>
            )}
          </form>

          <div className="mt-5 pt-4 border-t border-border/30 flex justify-center gap-4 text-[10px] text-muted-foreground/60">
            <a href="/privacy" className="hover:text-foreground">פרטיות</a>
            <span>·</span>
            <a href="/terms" className="hover:text-foreground">תקנון</a>
            <span>·</span>
            <a href="/accessibility" className="hover:text-foreground">נגישות</a>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-border/30 text-center">
          <span className="text-[10px] text-muted-foreground/30 font-mono">LAZY FINANCE v1.0</span>
        </div>
      </div>
    </div>
  );
}
