import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CURRENT_TERMS_VERSION } from '@/constants/legal';

const TERMS_VERSION = CURRENT_TERMS_VERSION;

export default function AcceptTermsPage() {
  const navigate = useNavigate();
  const { user, loading, profile, isApproved, hasAcceptedTerms, refreshProfile, signOut } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Side-effects (navigate) must run AFTER render — calling navigate()
  // inside the render body produces "Cannot update a component while
  // rendering a different component" warnings and is unreliable across
  // route transitions.
  useEffect(() => {
    if (loading || (user && profile === null)) return;
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }
    if (hasAcceptedTerms) {
      navigate(isApproved ? '/' : '/pending-approval', { replace: true });
    }
  }, [loading, user, profile, hasAcceptedTerms, isApproved, navigate]);

  if (loading || (user && profile === null)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // While the effect is redirecting (after these conditions), render nothing
  // rather than the form to avoid a flash of the wrong UI.
  if (!user || hasAcceptedTerms) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted) {
      toast.error('יש לסמן את התיבה כדי להמשיך');
      return;
    }
    setSubmitting(true);

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: user.id,
          terms_accepted_at: nowIso,
          terms_version: TERMS_VERSION,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      toast.error(`שמירת האישור נכשלה: ${error.message}`);
      setSubmitting(false);
      return;
    }

    await refreshProfile();
    toast.success('תודה! האישור נשמר');
    navigate(isApproved ? '/' : '/pending-approval', { replace: true });
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="pointer-events-none fixed top-0 left-0 right-0 h-64 opacity-15"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(244,63,94,0.5), transparent)' }}
      />

      <div
        className="relative w-full max-w-md border border-border bg-card rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 0 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)' }}
      >
        <div className="px-6 pt-7 pb-5 text-center border-b border-border/50">
          <div className="flex justify-center mb-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center border"
              style={{ borderColor: 'rgba(244,63,94,0.25)', background: 'rgba(244,63,94,0.06)' }}
            >
              <ShieldCheck className="w-7 h-7" style={{ color: '#f43f5e' }} />
            </div>
          </div>
          <h1 className="text-xl font-black text-foreground">צעד אחרון לפני הכניסה</h1>
          <p className="text-xs text-muted-foreground/80 mt-2 leading-relaxed">
            כדי להמשיך, יש לאשר את המסמכים המשפטיים של השירות.
            <br />
            אישור זה מתועד עם חותמת זמן וגרסה.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2">
            <DocLink href="/terms" label="תקנון ותנאי שימוש" />
            <DocLink href="/privacy" label="מדיניות פרטיות ואבטחת מידע" />
            <DocLink href="/accessibility" label="הצהרת נגישות" />
          </div>

          <label className="flex items-start gap-2 cursor-pointer group select-none">
            <input
              type="checkbox"
              checked={accepted}
              onChange={e => setAccepted(e.target.checked)}
              disabled={submitting}
              required
              className="mt-0.5 w-4 h-4 accent-rose-500 cursor-pointer flex-shrink-0"
              aria-describedby="accept-label"
            />
            <span id="accept-label" className="text-[12px] text-foreground/85 leading-relaxed">
              קראתי, הבנתי, ואני מאשר/ת את <b>התקנון</b>, <b>מדיניות הפרטיות</b> ו<b>הצהרת הנגישות</b> כפי שהוצגו בלינקים שלמעלה.
            </span>
          </label>

          <button
            type="submit"
            disabled={!accepted || submitting}
            className="w-full py-3 rounded-xl font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #be123c, #f43f5e)',
              boxShadow: '0 2px 12px rgba(244,63,94,0.35)',
            }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'אישור והמשך'}
          </button>

          <button
            type="button"
            onClick={signOut}
            className="w-full text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1"
          >
            לא מסכים — התנתקות
          </button>
        </form>
      </div>
    </div>
  );
}

function DocLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between text-sm text-foreground/90 hover:text-foreground py-1.5 px-2 rounded-md hover:bg-secondary/40 transition-colors"
    >
      <span>{label}</span>
      <span className="text-[11px] text-rose-400">פתח</span>
    </a>
  );
}
