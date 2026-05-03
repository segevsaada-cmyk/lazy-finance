# Lazy Finance — Multi-User Bank Scraper

קורא את כל החיבורים הפעילים מטבלת `public.bank_connections`, מפענח את הסיסמאות
המוצפנות עם `BANK_CRED_KEY`, ומסנכרן עסקאות לכל משתמש דרך
[israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers).

## פריסה ב-Railway

### 1. Environment Variables
| שם | ערך |
|---|---|
| `SUPABASE_URL` | `https://jamltyybiemjpmbmvobt.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (מה-.env המקומי שלך) |
| `BANK_CRED_KEY` | אותו base64 שנשמר ב-Supabase function secrets — חייב להיות זהה |
| `BANK_DAYS_BACK` | `30` |

> ⚠️ אם `BANK_CRED_KEY` שונה מזה שב-edge function, הפענוח ייכשל לכל המשתמשים.

### 2. Cron
Railway → Settings → Cron Schedule:
```
0 4 * * *
```
(כל יום ב-07:00 שעון ישראל = 04:00 UTC)

### 3. הוספת חיבורים
משתמשים מחברים את הבנק שלהם דרך הממשק (`/settings`) — ה-edge function
`connect-bank` מצפינה את הסיסמה ושומרת. אין צורך לערוך משתני סביבה לכל משתמש.

## הרצה ידנית לטסט
```bash
cd scraper
npm install
node --env-file=.env index.mjs
```
