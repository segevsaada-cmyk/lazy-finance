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
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) navigate('/');
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(
        error.message.includes('Invalid login credentials')
          ? 'אימייל או סיסמה שגויים'
          : error.message
      );
    } else {
      navigate('/');
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || password.length < 6) {
      toast.error('סיסמה חייבת להיות לפחות 6 תווים');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      toast.error(
        error.message.includes('already registered')
          ? 'האימייל כבר רשום — נסה להתחבר'
          : error.message
      );
    } else {
      toast.success('ברוך הבא ל-Lazy Finance!');
      navigate('/');
    }
    setLoading(false);
  };

  const ic =
    'bg-background border-rose-500/30 text-foreground placeholder:text-muted-foreground/50 focus:border-rose-500 focus-visible:ring-0 focus-visible:ring-offset-0 text-right';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Glow */}
      <div
        className="pointer-events-none fixed top-0 left-0 right-0 h-72 opacity-20"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(244,63,94,0.4), transparent)' }}
      />

      <div
        dir="rtl"
        className="relative w-full max-w-sm border border-rose-500/30 bg-card rounded-2xl overflow-hidden"
        style={{
          boxShadow: '0 0 40px rgba(244,63,94,0.1)',
          transform: mounted ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.98)',
          opacity: mounted ? 1 : 0,
          transition: 'transform 0.4s ease, opacity 0.4s ease',
        }}
      >
        {/* Header */}
        <div className="px-6 pt-8 pb-5 text-center border-b border-rose-500/15">
          <h1 className="text-3xl font-black tracking-tight">
            <span style={{ color: '#f43f5e' }}>Lazy</span>{' '}
            <span className="text-foreground">Finance</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">התנהלות פיננסית פשוטה לעצלנים</p>
        </div>

        <div className="px-6 py-5">
          {/* Tabs */}
          <div className="flex mb-5 border border-rose-500/20 rounded-lg overflow-hidden">
            {[{ id: true, label: 'כניסה' }, { id: false, label: 'הרשמה' }].map(tab => (
              <button
                key={String(tab.id)}
                type="button"
                onClick={() => setIsLogin(tab.id)}
                className={`flex-1 py-2 text-sm font-bold transition-all ${
                  isLogin === tab.id
                    ? 'bg-rose-500/15 text-rose-400 border-b-2 border-rose-500'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold tracking-wide text-muted-foreground">אימייל</Label>
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
            <div className="space-y-1.5">
              <Label className="text-xs font-bold tracking-wide text-muted-foreground">סיסמה</Label>
              <Input
                type="password"
                placeholder={isLogin ? '••••••' : 'לפחות 6 תווים'}
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
              className="w-full py-3 rounded-xl font-bold text-white transition-all active:scale-95 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #e11d48, #f43f5e)', boxShadow: '0 4px 16px rgba(244,63,94,0.3)' }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : isLogin ? (
                'כניסה'
              ) : (
                'צור חשבון חינמי'
              )}
            </button>
          </form>
        </div>

        <div className="px-6 py-3 border-t border-rose-500/10 text-center">
          <span className="text-[10px] text-muted-foreground/40">Lazy Finance v0.1</span>
        </div>
      </div>
    </div>
  );
}
