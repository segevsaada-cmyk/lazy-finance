import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const TODAY = '02/05/2026';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-1.5 rounded-lg hover:bg-secondary"><ArrowRight className="w-4 h-4" /></Link>
          <h1 className="text-base font-bold">תקנון השימוש</h1>
        </div>
      </header>

      <article className="max-w-2xl mx-auto px-4 py-6 space-y-5 text-sm leading-relaxed text-foreground/90">
        <p className="text-xs text-muted-foreground">עודכן לאחרונה: {TODAY}</p>

        <Section title="1. הסכמה לתקנון">
          השימוש באפליקציית Lazy Finance ("האפליקציה" או "השירות") מהווה הסכמה מלאה לתנאים אלה. אם אינך מסכים לתנאי כלשהו, אנא הימנע מהשימוש.
        </Section>

        <Section title="2. אופי השירות">
          האפליקציה היא <b>כלי תיעוד וניהול תזרים אישי</b>. היא מאפשרת לרשום הכנסות והוצאות, לראות פילוחים ויעדים, ולקבל תובנות בסיסיות על בסיס הנתונים שאתה מזין.
        </Section>

        <Section title="3. אינה ייעוץ פיננסי או השקעתי">
          <p>
            המידע, התובנות והמלצות הבינה המלאכותית באפליקציה הם <b>חינוכיים בלבד</b> ואינם תחליף לייעוץ פיננסי, השקעתי, מסי או משפטי הניתן על ידי איש מקצוע מורשה. המפעיל אינו יועץ השקעות מורשה ואינו ממליץ על מכשירים פיננסיים ספציפיים.
          </p>
          <p className="mt-2">
            כל החלטה פיננסית שתקבל היא באחריותך הבלעדית. <b>השקעות בשוק ההון כרוכות בסיכון לאובדן הקרן.</b>
          </p>
        </Section>

        <Section title="4. דיוק הנתונים">
          הנתונים באפליקציה מבוססים על מה שהמשתמש מזין ידנית. איננו מתחברים לבנקים או לכרטיסי אשראי, ולא ניתן להבטיח שהנתונים יהיו עדכניים, מלאים או מדויקים.
        </Section>

        <Section title="5. שימוש מקובל">
          <ul className="list-disc pr-5 space-y-1.5">
            <li>אסור לבצע פעולות שעלולות לפגוע ביציבות השירות או באבטחתו.</li>
            <li>אסור להעלות תוכן בלתי-חוקי, פוגעני או המפר זכויות צד שלישי.</li>
            <li>אסור לבצע reverse engineering, scraping או גישה אוטומטית למערכת ללא אישור.</li>
            <li>חשבון אחד למשתמש. אין לחלוק פרטי גישה.</li>
          </ul>
        </Section>

        <Section title="6. הפסקת שירות">
          המפעיל רשאי להשעות או להסיר חשבון שמפר את התקנון, ולסגור את השירות כולו או חלקים ממנו בכל עת, בהודעה סבירה מראש כשניתן.
        </Section>

        <Section title="7. קניין רוחני">
          העיצוב, הקוד, התובנות, ובסיס הידע של היועץ — שייכים למפעיל. הנתונים האישיים שאתה מזין שייכים לך, ואתה מעניק רישיון להשתמש בהם רק לצורך הפעלת השירות עבורך.
        </Section>

        <Section title="8. הגבלת אחריות">
          השירות מוצע "כמו שהוא" (AS IS). המפעיל אינו אחראי לכל נזק ישיר, עקיף או תוצאתי הנובע מהשימוש או מאי-שימוש באפליקציה, מהחלטות שהתקבלו על בסיס המידע בה, או מהפסקות שירות. בכל מקרה אחריות המפעיל לא תעלה על הסכום ששולם בפועל עבור השירות (אם בכלל).
        </Section>

        <Section title="9. הדין החל וסמכות שיפוט">
          על תקנון זה יחולו דיני מדינת ישראל. סמכות השיפוט הבלעדית בכל סכסוך מסור לבתי המשפט המוסמכים בתל אביב-יפו.
        </Section>

        <Section title="10. שינויים בתקנון">
          המפעיל רשאי לעדכן תקנון זה. גרסה מעודכנת תפורסם בעמוד זה. המשך שימוש לאחר עדכון מהווה הסכמה לתקנון החדש.
        </Section>

        <Section title="11. יצירת קשר">
          לשאלות בנושא התקנון: <a href="mailto:segevsaada@gmail.com" className="underline" style={{ color: '#f43f5e' }}>segevsaada@gmail.com</a>
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
