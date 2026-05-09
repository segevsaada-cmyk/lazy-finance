import { Lock, MessageCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const MONTHLY_PRICE_ILS = 400;
const ADMIN_WHATSAPP = '972557201465';

export default function TrialExpiredPage() {
  const { signOut, profile } = useAuth();
  const name = profile?.fullName?.trim().split(' ')[0] || '';

  const waText = encodeURIComponent(
    `היי שגב, אני ${profile?.fullName ?? ''} — רוצה להמשיך עם Lazy Finance ולעבור למנוי החודשי.`,
  );
  const waLink = `https://wa.me/${ADMIN_WHATSAPP}?text=${waText}`;

  return (
    <div dir="rtl" className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div
        className="pointer-events-none fixed top-0 left-0 right-0 h-48 opacity-10"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(244,63,94,0.6), transparent)' }}
      />

      <div className="w-full max-w-sm space-y-7 relative">
        <div className="flex justify-center">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center border"
            style={{ borderColor: 'rgba(244,63,94,0.25)', background: 'rgba(244,63,94,0.06)' }}
          >
            <Lock className="w-9 h-9" style={{ color: '#f43f5e' }} />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black text-foreground">
            {name ? `היי ${name},` : 'היי,'}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            תקופת הניסיון של שבועיים הסתיימה.
            <br />
            כדי להמשיך, יש לעבור למנוי החודשי.
          </p>
        </div>

        <div
          className="rounded-2xl border p-5 space-y-3"
          style={{ borderColor: 'rgba(244,63,94,0.2)', background: 'rgba(244,63,94,0.03)' }}
        >
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-muted-foreground tracking-wide">מנוי חודשי</span>
            <div>
              <span className="text-3xl font-black" style={{ color: '#f43f5e' }}>
                ₪{MONTHLY_PRICE_ILS}
              </span>
              <span className="text-xs text-muted-foreground"> /חודש</span>
            </div>
          </div>
          <ul className="text-[12px] text-muted-foreground/90 leading-relaxed space-y-1.5 pt-2 border-t border-border/40">
            <li>• תכנון פיננסי אישי עם יועץ AI</li>
            <li>• מעקב הוצאות, הכנסות ויעדים</li>
            <li>• דוחות חודשיים ותחזיות</li>
            <li>• טיפ פיננסי יומי בוואטסאפ</li>
          </ul>
        </div>

        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #be123c, #f43f5e)',
            boxShadow: '0 2px 12px rgba(244,63,94,0.35)',
          }}
        >
          <MessageCircle className="w-4 h-4" />
          אני רוצה להמשיך — דברו איתי
        </a>

        {/* Required disclosures per חוק הגנת הצרכן §14ה (cooling-off) +
            §14ג1 (recurring online services). Phrasing kept short and
            in the same voice as the rest of the page. */}
        <div className="text-[11px] text-muted-foreground/70 leading-relaxed space-y-1.5 text-center px-2">
          <p>
            <b className="text-foreground/80">המחיר כולל מע״מ.</b> ביטול מתבצע
            בפנייה אחת ב-WhatsApp או במייל — נכנס לתוקף תוך 24 שעות, ללא קנס.
          </p>
          <p>
            בהתאם לחוק הגנת הצרכן, יש לך זכות ביטול של 14 יום מיום החיוב הראשון
            לקבלת החזר מלא.
          </p>
          <p>
            המנוי לא מתחדש אוטומטית — כל חיוב חודשי דורש את אישורך המפורש.
            הנתונים שלך נשמרים גם אם לא חידשת — ברגע שתחזור, תמשיך בדיוק מאיפה
            שעצרת.
          </p>
          <p className="pt-1">
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              לתקנון המלא §12
            </a>
          </p>
        </div>

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
