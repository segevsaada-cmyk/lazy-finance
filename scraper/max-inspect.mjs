/** Inspect how Max's SPA authorizes its API calls (token location + headers). */
import puppeteer from 'puppeteer';
import { homedir } from 'node:os';
const PROFILE_DIR = process.env.MAX_PROFILE_DIR || `${homedir()}/.lazy-max-profile`;

const browser = await puppeteer.launch({
  headless: false, userDataDir: PROFILE_DIR, defaultViewport: null,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
});
const page = (await browser.pages())[0] || (await browser.newPage());

// Capture the SPA's own API request headers to onlinelcapi
const captured = [];
await page.setRequestInterception(true);
page.on('request', (req) => {
  const u = req.url();
  if (u.includes('onlinelcapi.max.co.il/api')) {
    captured.push({ url: u.slice(0, 90), headers: req.headers() });
  }
  req.continue();
});

console.log('→ Loading personal homepage...');
await page.goto('https://www.max.co.il/homepage/personal', { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 6000));

// dump storage
const storage = await page.evaluate(() => {
  const ls = {}; const ss = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = (localStorage.getItem(k) || '').slice(0, 60); }
  for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); ss[k] = (sessionStorage.getItem(k) || '').slice(0, 60); }
  return { ls, ss, url: location.href };
});
console.log('URL:', storage.url);
console.log('localStorage keys:', JSON.stringify(storage.ls, null, 1));
console.log('sessionStorage keys:', JSON.stringify(storage.ss, null, 1));
console.log('\nCaptured API requests + headers:');
for (const c of captured.slice(0, 4)) {
  console.log(' ', c.url);
  const h = c.headers;
  for (const k of Object.keys(h)) {
    if (/auth|token|csrf|xsrf|key|bearer/i.test(k)) console.log('     ', k, '=', String(h[k]).slice(0, 50));
  }
}
console.log('total captured api calls:', captured.length);
await browser.close();
process.exit(0);
