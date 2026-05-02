import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const TODAY = '02/05/2026';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-1.5 rounded-lg hover:bg-secondary"><ArrowRight className="w-4 h-4" /></Link>
          <h1 className="text-base font-bold">מדיניות פרטיות</h1>
        </div>
      </header>

      <article className="max-w-2xl mx-auto px-4 py-6 space-y-5 text-sm leading-relaxed text-foreground/90">
        <p className="text-xs text-muted-foreground">עודכן לאחרונה: {TODAY}</p>

        <Section title="1. כללי">
          אפליקציית Lazy Finance ("האפליקציה") מסייעת בניהול תזרים אישי. מסמך זה מסביר אילו נתונים אנו אוספים, למה, וכיצד אתה שומר על שליטה בהם. השימוש באפליקציה מהווה הסכמה למדיניות זו.
        </Section>

        <Section title="2. מידע שאנו אוספים">
          <ul className="list-disc pr-5 space-y-1.5">
            <li><b>פרטי חשבון:</b> כתובת אימייל, שם מלא, מספר טלפון (אם סיפקת).</li>
            <li><b>נתונים פיננסיים שאתה מזין:</b> הכנסות, הוצאות, קטגוריות, יעדים — נשמרים בחשבונך בלבד.</li>
            <li><b>נתוני שימוש בסיסיים:</b> תאריך הצטרפות, מועד התחברות אחרון. אין מעקב אנליטי צד-שלישי.</li>
            <li><b>תקשורת WhatsApp (אופציונלי):</b> אם בחרת לקבל טיפים יומיים, נשמור את מספרך לצורך משלוח בלבד.</li>
          </ul>
        </Section>

        <Section title="3. שימוש במידע">
          המידע משמש אך ורק להפעלת האפליקציה: שמירת הנתונים שלך, הצגת תובנות פיננסיות, מתן ייעוץ AI על בסיס הנתונים שלך, ושליחת הודעות שירות שביקשת. <b>איננו מוכרים, משכירים או מעבירים את המידע לצדדים שלישיים</b> לצרכים שיווקיים.
        </Section>

        <Section title="4. אחסון ואבטחה">
          הנתונים מאוחסנים אצל ספק תשתית מאובטח (Supabase, מבוסס AWS — מרכז מידע פרנקפורט). הגישה מוגנת באמצעות אימות סטנדרטי, מדיניות גישה ברמת השורה (Row-Level Security) המבטיחה שכל משתמש רואה רק את נתוניו, וקריפטוגרפיה במעבר (HTTPS/TLS).
        </Section>

        <Section title="5. ייעוץ AI">
          תכונת היועץ הפיננסי בנויה על מודל שפה גדול (Claude מבית Anthropic). כשאתה מבקש ייעוץ, השאלה והנתונים המסכמים שלך נשלחים לעיבוד אצל הספק. הספק מתחייב לא להשתמש בנתונים שלך לאימון מודלים. בסיס הידע של היועץ זוקק ממאות שעות תוכן פיננסי שעובדו מראש על-ידי מערכת הבינה המלאכותית של האפליקציה.
        </Section>

        <Section title="6. זכויותיך">
          <ul className="list-disc pr-5 space-y-1.5">
            <li><b>עיון:</b> אתה רואה את כל הנתונים שלך בכל עת באפליקציה.</li>
            <li><b>ייצוא:</b> בעמוד ההגדרות תוכל לייצא את כל הנתונים בקובץ JSON.</li>
            <li><b>תיקון או מחיקה:</b> ניתן למחוק עסקאות פרטניות בעצמך, או לפנות אלינו למחיקת חשבון מלאה.</li>
            <li><b>הפסקת קבלת הודעות:</b> תוכל להפסיק קבלת טיפי WhatsApp בכל עת בבקשה.</li>
          </ul>
        </Section>

        <Section title="7. עוגיות (Cookies)">
          האפליקציה משתמשת ב־localStorage של הדפדפן בלבד לצורך שמירת מצב התחברות והעדפות. אין שימוש ב־cookies של מעקב או פרסום.
        </Section>

        <Section title="8. ילדים">
          האפליקציה אינה מיועדת לקטינים מתחת לגיל 16. איננו אוספים ביודעין נתונים מקטינים.
        </Section>

        <Section title="9. שינויים במדיניות">
          נעדכן את מדיניות הפרטיות מעת לעת. גרסה מעודכנת תפורסם בעמוד זה עם תאריך עדכון.
        </Section>

        <Section title="10. יצירת קשר">
          לפניות בנושא פרטיות, מימוש זכויות או הסרה מהמערכת — צור קשר במייל: <a href="mailto:segevsaada@gmail.com" className="underline" style={{ color: '#f43f5e' }}>segevsaada@gmail.com</a>
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
