# Lazy Finance — Bank Scraper

מושך עסקאות מאוצר החייל ומסנכרן ל-Supabase פעם ביום.

## פריסה ב-Railway (5 דקות)

### 1. צור חשבון ב-Railway
https://railway.app → Sign up (חינמי עד $5/חודש)

### 2. חבר GitHub
- New Project → Deploy from GitHub repo → בחר `lazy-finance`
- **Root Directory:** `scraper`

### 3. הגדר Environment Variables
ב-Railway → Variables:

| שם | ערך |
|---|---|
| `SUPABASE_URL` | `https://jamltyybiemjpmbmvobt.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (מה-.env שלך) |
| `SUPABASE_USER_ID` | (ה-User ID שלך מ-Supabase Auth) |
| `BANK_USERNAME` | תעודת זהות |
| `BANK_PASSWORD` | סיסמת האינטרנט של אוצר החייל |
| `BANK_DAYS_BACK` | `30` |

### 4. הגדר Cron
Railway → Settings → Cron Schedule:
```
0 7 * * *
```
(כל יום ב-07:00 בוקר)

### 5. מצא את ה-User ID שלך
כנס ל: https://jamltyybiemjpmbmvobt.supabase.co/auth/users
ותמצא את ה-ID שלך ליד האימייל.

## הרצה ידנית לטסט
```bash
npm install
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_USER_ID=... \
BANK_USERNAME=123456789 BANK_PASSWORD=mypass \
node index.mjs
```
