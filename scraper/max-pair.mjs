/**
 * One-time Max device pairing.
 * Opens a VISIBLE Chrome with a persistent profile, lets the user log in to
 * Max manually (incl. SMS OTP). The session/device-trust cookies persist in
 * PROFILE_DIR so later headless scrapes can reuse them and skip the OTP.
 *
 * Run:  node scraper/max-pair.mjs
 */
import puppeteer from 'puppeteer';
import { homedir } from 'os';

const PROFILE_DIR = `${homedir()}/.lazy-max-profile`;
const LOGIN_URL = 'https://www.max.co.il/login';

console.log('🔓 Opening Chrome for manual Max login...');
console.log(`   Profile dir: ${PROFILE_DIR}`);

const browser = await puppeteer.launch({
  headless: false,
  userDataDir: PROFILE_DIR,
  defaultViewport: null,
  args: ['--no-first-run', '--no-default-browser-check', '--start-maximized'],
});

const pages = await browser.pages();
const page = pages[0] || (await browser.newPage());
await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

console.log('\n👉 התחבר ל-Max בחלון שנפתח (שם משתמש + סיסמה + קוד SMS).');
console.log('   אם יש "זכור את המכשיר הזה" — סמן אותו!');
console.log('   ממתין עד שתסיים להתחבר (עד 5 דקות)...\n');

try {
  await page.waitForFunction(
    () => {
      const u = location.href;
      return u.includes('/homepage') || u.includes('account') || u.includes('personal') || u.includes('dashboard') || u.includes('transactions');
    },
    { timeout: 300000, polling: 2000 },
  );
  console.log('✅ זוהתה התחברות מוצלחת! שומר את הפרופיל...');
  await new Promise((r) => setTimeout(r, 4000)); // let cookies settle
} catch (e) {
  console.log('⚠️ לא זוהתה התחברות בתוך הזמן. סוגר בכל זאת — מה שנשמר יישמר.');
}

await browser.close();
console.log(`\n💾 הפרופיל נשמר ב-${PROFILE_DIR}. עכשיו אפשר לבדוק סנכרון מול הפרופיל הזה.`);
