import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const TODAY = '02/05/2026';

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-1.5 rounded-lg hover:bg-secondary"><ArrowRight className="w-4 h-4" /></Link>
          <h1 className="text-base font-bold">הצהרת נגישות</h1>
        </div>
      </header>

      <article className="max-w-2xl mx-auto px-4 py-6 space-y-5 text-sm leading-relaxed text-foreground/90">
        <p className="text-xs text-muted-foreground">עודכן לאחרונה: {TODAY}</p>

        <Section title="המחויבות שלנו לנגישות">
          אנו מאמינים שכלי לניהול תזרים אישי צריך להיות נגיש לכולם, ללא קשר ליכולת או למוגבלות. אנו פועלים לעמוד בדרישות חוק שוויון זכויות לאנשים עם מוגבלות ובתקנות הנגישות בישראל (תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), תשע"ג-2013), ובתקן <b>WCAG 2.1 ברמה AA</b>.
        </Section>

        <Section title="ההתאמות שביצענו">
          <ul className="list-disc pr-5 space-y-1.5">
            <li><b>ניווט במקלדת מלא</b> — כל הפעולות באפליקציה ניתנות לביצוע ללא עכבר.</li>
            <li><b>תיוג סמנטי</b> של מבנה המסמך, שדות טופס וכפתורים, התומך בקוראי מסך.</li>
            <li><b>ניגודיות צבעים גבוהה</b> — תמה כהה כברירת מחדל, עם יחסי ניגודיות העומדים בדרישות AA.</li>
            <li><b>תמיכה בהגדלת טקסט</b> עד 200% מבלי לאבד תוכן או פונקציונליות.</li>
            <li><b>תמיכה בעברית מלאה</b> כולל RTL נכון בכל המסכים.</li>
            <li><b>הודעות סטטוס</b> ושגיאות מועברות באופן ברור גם לטכנולוגיות מסייעות.</li>
            <li><b>זמני תגובה</b> — אין שום פעולה מוגבלת בזמן באפליקציה.</li>
          </ul>
        </Section>

        <Section title="אופן השימוש בעזרי נגישות">
          האפליקציה תואמת לעזרי נגישות מובילים: VoiceOver (iOS / macOS), TalkBack (Android), NVDA ו־JAWS (Windows). מומלץ להשתמש בגרסה עדכנית של הדפדפן ושל מערכת ההפעלה.
        </Section>

        <Section title="מגבלות ידועות">
          <p>
            רכיבים מסוימים — בעיקר תרשימים גרפיים בעמוד הדוחות — עשויים להיות פחות נגישים לקוראי מסך בגרסה הנוכחית. אנו עובדים על שיפור הנגישות שלהם, ובינתיים הנתונים זמינים גם בטבלה הנגישה לצידם.
          </p>
        </Section>

        <Section title="פנייה לרכז הנגישות">
          <p>
            נתקלת בבעיית נגישות, או שיש לך הצעה לשיפור?
          </p>
          <ul className="list-none pr-0 space-y-1 mt-2">
            <li><b>שם:</b> שגב סעדה</li>
            <li><b>אימייל:</b> <a href="mailto:segevsaada@gmail.com" className="underline" style={{ color: '#f43f5e' }}>segevsaada@gmail.com</a></li>
            <li><b>זמן תגובה צפוי:</b> תוך 30 ימים מקבלת הפנייה.</li>
          </ul>
        </Section>

        <Section title="עדכון ההצהרה">
          הצהרה זו תעודכן ככל שיתווספו רכיבים או שינויי נגישות. תאריך העדכון האחרון מופיע בראש העמוד.
        </Section>
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      <div className="text-foreground/80">{children}</div>
    </section>
  );
}
