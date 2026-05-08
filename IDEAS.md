# Lazy Finance — Roadmap & open items

A living document. Captures what was found in the night-of-2026-05-08 audit
but **not yet implemented**, plus future ideas worth their cost. Severity tag
in front of each item.

> Notation: **🔴** = security/legal exposure or visible bug, do urgently.
> **🟡** = polish or feature with clear ROI.
> **🟢** = future bet, worth spec'ing later.

---

## A. Security — outstanding

### 🔴 A1. Rotate the Supabase anon JWT committed in `whatsapp-server/index.js`
The Baileys server falls back to a hardcoded anon JWT (long-lived, ties this
repo to the public Supabase project). Even after replacing with `process.env`,
the leaked token must be rotated in Supabase → Project Settings → API.
**Action:** rotate, drop the `||` fallback in source, redeploy WA server.

### 🔴 A2. Default API_KEY in `whatsapp-server/index.js`
`const API_KEY = process.env.API_KEY || 'lazy-finance-key'`. If `API_KEY` is
ever unset (or the deployer uses the default literally), anyone who finds the
server's port becomes a free WhatsApp spam relay via `/send`, `/send-media`,
`/logout`. Same pattern in `whatsapp-server/daily-tip.js:6`.
**Fix:** `if (!process.env.API_KEY) { console.error('API_KEY required'); process.exit(1); }`.

### 🔴 A3. WhatsApp server has no rate limit + no path sandbox
`/send-media` accepts any `file_path` and sends. `/send` has no per-IP throttle.
**Fix:** add `express-rate-limit` (30/min/IP) + `path.resolve(MEDIA_DIR, file_path)`
+ refuse `..` segments.

### 🟡 A4. Tighten CORS on Supabase edge functions
`admin-users`, `connect-bank`, `send-daily-financial-tip` use
`Access-Control-Allow-Origin: *`. Replace with origin allowlist:
```ts
const ORIGIN = req.headers.get("origin");
const ALLOWED = ["https://lazyfinance.app", "https://your-vercel-preview.vercel.app"];
const corsOrigin = ALLOWED.includes(ORIGIN ?? "") ? ORIGIN! : "null";
```
JWT gates make this defense-in-depth, not a hot bug.

### 🟡 A5. Per-account login lockout + 4xx response uniformity
`/api/login-by-phone` returns 404 for unknown phones, 200 for known. That's a
phone enumeration oracle. Plus there's no per-account lockout after N failed
password attempts.
**Fix:** always return 200 with a generic shape; track `failed_logins` table
and lock for 15min after 5 wrong attempts.

### 🟡 A6. Per-IP signup rate limit
Anyone can flood `auth.users` + `user_settings` with synthetic accounts. Add
`/api/signup-precheck` that bumps `signup:<ip>` (3/hour) before AuthPage calls
`supabase.auth.signUp`.

### 🟡 A7. WhatsApp link UI writes `whatsapp_users` without OTP verification
`SettingsPage.handleLinkWhatsapp` accepts any number. If the admin's number
hasn't been linked yet, an attacker who registers their own account can
preemptively claim it. Add OTP via Twilio before insert + a UNIQUE constraint
on `whatsapp_users.phone_number`.

### 🟡 A8. `whatsapp-server/server.err` is 80MB and contains conversation excerpts
The `*.err` extension isn't gitignored (only `*.log` is). The file holds full
message bodies, lead PII (phone+name+grade), redacted only by truncation.
**Fix:** add `*.err` to both `.gitignore` files; switch console logging to
pino with daily rotation + 7-day retention; redact phones to `***last4` and
drop `JSON.stringify(m.message)` outside debug builds.

### 🟡 A9. Constant-time comparison for `Authorization` header
`send-daily-financial-tip` compares `authHeader !== expected` directly. Not
exploitable over real networks but trivially better via
`crypto.subtle.timingSafeEqual` or hashed comparison.

### 🟢 A10. App-level audit log table
Today only `bank_connection_events` is audited. Worth a generic
`security_events` table covering: failed login, role change, mass-delete,
admin actions, AI budget exhaustion. Surface in `/admin` for forensics.

### 🟢 A11. Pin third-party SDK versions + Dependabot
`npm audit` runs in CI now (added 2026-05-08), but turn on Dependabot
weekly PRs to keep on top of CVEs.

### 🟢 A12. Strict CSP with nonce
`script-src 'self'` is solid. Upgrade to `'strict-dynamic' 'nonce-XXX'`
once you've migrated `theme-init.js` to a per-request nonce in Vercel
edge middleware.

---

## B. Legal / privacy — outstanding

### 🔴 B1. Consumer Protection Law disclosures on `/trial-expired`
`TrialExpiredPage.tsx` sells a ₪400/month subscription via WhatsApp without
disclosing in-screen: cancellation method, 14-day cooling-off right, no
auto-renewal language. Add a small footnote referencing Terms §12 (just
rewritten with these clauses).

### 🟡 B2. Replace `ת.ז.` in legal pages with non-sensitive controller info
`PrivacyPage:1`, `TermsPage:22` publish a personal Israeli ID number. The
Privacy Law requires identifying the controller, not their ID. Replace with
name + email + (optional) PO box.

### 🟡 B3. Children safeguard checkbox at signup
Privacy §13 prohibits under-18 use, but signup has no age affirmation.
Add `<input type="checkbox" required>` "אני מאשר/ת שאני מעל גיל 18".

### 🟡 B4. Itemized localStorage / cookies list in PrivacyPage
Today: "אין שימוש בעוגיות מעקב". True but incomplete. Add an itemized list:
`lf-theme`, Supabase auth session, etc. Reduces complaints to the regulator.

### 🟡 B5. Accessibility coordinator phone (or explicit reason)
ת"י 5568 / תקנות שוויון §35 require name, email **and phone**. Today only
name + email are listed. Add a phone or note "מענה במייל בלבד מטעמי פרטיות".

### 🟡 B6. Immutable terms-acceptance history table
Currently only the latest acceptance is stored on `user_settings`. For
evidentiary value, write each acceptance to an append-only
`terms_acceptances(user_id, version, accepted_at, ip, user_agent)`.

### 🟢 B7. Sub-processor change-log page
Privacy §5 promises "שינוי משמעותי יפורסם" but no page exists. A simple
`<details>` block with date entries is enough.

---

## C. UX — quick wins (≤30 min each)

### 🔴 C1. ReportsPage with only 1 month of data
The deltas already null-guard, but the UI lacks a friendly "צריך לפחות 2
חודשי נתונים להשוואה" hint until enough data accumulates.

### 🔴 C2. AuthPage needs a "שכחתי סיסמה" link
Phone-only login = lost password = locked-out user emailing you. Add a
magic-link via WA flow.

### 🟡 C3. First-run dashboard checklist
When `transactions.length === 0`, show: ① הגדר הכנסה חודשית → Settings,
② הוסף תשלום קבוע → Recurring, ③ רשום תנועה ראשונה → FAB. Highest
joy/effort UX win we identified.

### 🟡 C4. BottomNav active-item indicator
Dot is `w-1 h-1` — invisible on most screens. Either trim to 5 nav items
(move Settings to a top-right gear) or enlarge active dot to `w-1.5 h-1.5`
with the rose accent fill.

### 🟡 C5. BalanceCard shake-once instead of constant pulse on danger
`animate-pulse` constantly is anxiety-inducing. One-time shake on
transition into "danger" state would communicate the same info less
aggressively.

### 🟡 C6. ChatTransactionSheet "undo" link
After save, the saved-tx bubble has no way to delete that just-created tx
without going to History. Add a small "בטל" link in the bubble.

### 🟡 C7. AdvisorPage cap message-history sent to Claude
Today the *full* history is sent every turn. After ~30 messages this
costs O(n²). Cap to last 20 + a system-injected summary of older.

### 🟡 C8. Per-route page titles
Every tab is just "Lazy Finance". Add `useDocumentTitle('דאשבורד · Lazy Finance')`
hook + call per page.

### 🟡 C9. `aria-current="page"` + `aria-live` on key spots
BottomNav active link, AdvisorPage message stream, PendingApprovalPage
status flip. Screen readers currently miss these.

### 🟡 C10. `ChatTransactionSheet` welcome message personalization
"היי {name}, מה קנית?" instead of generic. Use `useAuth().profile.fullName`.

### 🟡 C11. HistoryPage search + date-range chips
Add a text-search filter (note + category name) + quick chips
"השבוע / החודש / 30 יום".

### 🟡 C12. `RecurringPage` quick-add example chips
Empty state shows 3 example chips (שכירות, ספוטיפיי, כושר) that pre-fill
the AddTransactionSheet.

---

## D. UX — delight features (worth ~1 evening each)

### 🟢 D1. Streak counter ("5 ימים ברצף")
Derive from transactions' distinct `created_at::date`. Small flame icon
next to balance card. Habit-forming.

### 🟢 D2. Goal achievement confetti
Add `canvas-confetti` (3KB) and fire when a goal hits 100%. Subtle haptic
on mobile via `navigator.vibrate(50)`.

### 🟢 D3. Calendar heatmap on Reports
GitHub-style 30×4 grid showing daily spending intensity. Massively readable.

### 🟢 D4. CSV import from Israeli banks
"ייבא מבנק" in Settings — user pastes their bank's CSV (פירוט עו״ש),
batch-runs through `/api/categorize`, previews, imports. ~2 hours of work,
huge value.

### 🟢 D5. Voice input on chat sheet
`webkitSpeechRecognition` in Hebrew. "Click mic, say 'קפה ב-22'". ~1h.

### 🟢 D6. Onboarding tour
Four spotlight tooltips: balance card → FAB → bottom nav → advisor. Once.
`onboardingDoneAt` flag in `user_settings`.

### 🟢 D7. Weekly digest WhatsApp message
Sunday morning cron sends "השבוע הוצאת ₪X. הקטגוריה הכבדה: אוכל ₪Y".
Infrastructure already exists (the daily-tip cron is the same shape).

### 🟢 D8. PWA install prompt
Add `manifest.json` + soft "Install" banner after 3 visits. Lazy Finance
is a perfect PWA candidate.

### 🟢 D9. "מי בנה את זה" footer link
Small "מי בנה את זה" link next to terms/privacy that opens a 1-paragraph
human story. Personal-app trust signal.

### 🟢 D10. AI advisor follow-up suggestion chips
After each response, model returns 2-3 short follow-up question chips.
Engagement multiplier.

### 🟢 D11. "Frozen" categories
Mark a category as "I'm not allowed to spend here this month". When
adding a tx in that category, friendly "...אתה בטוח?" dialog. Behavioral nudge.

### 🟢 D12. Smart "מה עוד שכחת?" evening prompt
Cron at 21:00 → dashboard banner: "היום רשמת 3 תנועות. מה עוד שכחת?".

### 🟢 D13. Bulk-edit in History
Long-press to enter selection mode → multi-delete or bulk-recategorize.

### 🟢 D14. Dashboard "vs last month" strip
Small "+12% הוצאות לעומת אפריל" between BalanceCard and SummaryStrip.
Uses existing `useBudget` data.

### 🟢 D15. Auto-categorize on note input in AddTransactionSheet
When user types `note` like "קופיקס", suggest category before they tap.
Reuse `/api/categorize`.

---

## E. Infra — recommended

### 🟡 E1. Apply `supabase db push` on the new migrations
Pending: 20260505 (RLS hardening), 20260506 (rate_limit + AI budget),
20260507 (trial-stamp + CHECK constraints). Run once.

### 🟡 E2. Deploy `send-daily-financial-tip` edge function with the new auth gate
Pending: the constant-bearer comparison. Without redeploying, the leak risk
identified by audit is not yet closed.

### 🟡 E3. Set `app.settings.service_role_key` GUC in Postgres
Migration 20260429 calls `current_setting('app.settings.service_role_key',
true)`. If the GUC isn't set, the cron silently sends an empty bearer →
the new auth gate returns 401 → tips don't go out. Verify or set:
```sql
ALTER DATABASE postgres SET app.settings.service_role_key = '<service_role_key>';
```

### 🟡 E4. Add `TWILIO_AUTH_TOKEN` to Vercel env
Required for `/api/whatsapp` Twilio signature verification in production.
Without it, the endpoint refuses all requests in prod (which is correct).

### 🟡 E5. Run Mozilla Observatory + SSL Labs after deploy
Targets: A+ on Observatory, A+ on SSL Labs. The vercel.json headers should
score there.

### 🟢 E6. Restart Claude Code to pick up `ui-ux-pro-max` skill
The skill is installed at `.claude/skills/ui-ux-pro-max/`. Restart so the
runtime indexes it.

### 🟢 E7. CI workflow gating
Currently `npm audit` + tsc + gitleaks run on PR but **don't block merge**
(no branch protection rules). Configure GitHub branch protection to require
these checks before merge.

---

## F. Pre-existing modified files I left alone

23 files were modified by prior sessions before tonight. I did NOT commit
them as my own work. Review/commit yourself:

- `.gitignore`, `.vercel/project.json`
- `scraper/index.mjs` + `scraper/package-lock.json`
- `src/App.tsx`, `src/hooks/useAuth.ts`
- `src/pages/AccessibilityPage.tsx`, `AdminPage.tsx`, `PendingApprovalPage.tsx`,
  `PrivacyPage.tsx`, `TermsPage.tsx`
- `supabase/functions/admin-users/index.ts`
- `supabase/migrations/20260501_add_account_type.sql`
- `whatsapp-server/index.js`, `package.json`, `package-lock.json`,
  `whatsapp-server/server.err` (this last one should be *deleted* per A8)

---

*Authored over the night of 2026-05-08 by an autonomous Claude Opus session.
Re-read this when you wake up; it's your morning briefing.*
