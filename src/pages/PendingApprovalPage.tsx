import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export default function PendingApprovalPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }

    const check = async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('is_approved')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.is_approved) navigate('/');
    };

    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, [user, navigate]);

  return (
    <div dir="rtl" className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Top glow */}
      <div
        className="pointer-events-none fixed top-0 left-0 right-0 h-48 opacity-10"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(245,158,11,0.6), transparent)' }}
      />

      <div className="w-full max-w-sm space-y-8 relative">
        {/* Icon */}
        <div className="flex justify-center">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center border"
            style={{ borderColor: 'rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.06)' }}
          >
            <Clock className="w-9 h-9" style={{ color: '#f59e0b' }} />
          </div>
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black text-foreground">ממתין לאישור</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            הבקשה שלך נשלחה. האדמין יאשר אותך בהקדם —
            <br />
            ברגע שזה יקרה, תועבר ישירות לאפליקציה.
          </p>
        </div>

        {/* Status indicator */}
        <div
          className="rounded-xl border p-4 flex items-center gap-3"
          style={{ borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.04)' }}
        >
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
          <span className="text-sm text-muted-foreground">בודק סטטוס כל 15 שניות...</span>
        </div>

        {/* Coming soon: bank */}
        <div
          className="rounded-xl border p-4 space-y-2"
          style={{ borderColor: 'rgba(244,63,94,0.15)', background: 'rgba(244,63,94,0.03)' }}
        >
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4" style={{ color: '#f43f5e' }} />
            <span className="text-xs font-semibold text-foreground">בקרוב — חיבור לחשבון הבנק</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            בקרוב תוכל לחבר את חשבון הבנק שלך וכל העסקאות יסתנכרנו אוטומטית — ללא הקלדה ידנית.
          </p>
        </div>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors py-2"
        >
          התנתק
        </button>
      </div>
    </div>
  );
}
