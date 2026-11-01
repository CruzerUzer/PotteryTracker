// Ad hoc-skript: node shoot.mjs <out-dir> <theme> <width>x<height> <name>=<path>[!action] ...
// action: "more" öppnar Mer-arket, "scroll" scrollar 600px, "click:<selector>" klickar.
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
// Sessionen sparas och återanvänds: backend tillåter bara 10 inloggningar per 15 min.
const AUTH = join(dirname(fileURLToPath(import.meta.url)), 'out', '.auth.json');
const [out, theme, size, ...shots] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const BASE = process.env.BASE_URL || 'http://localhost:4301';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: w, height: h },
  deviceScaleFactor: 1,
  hasTouch: w < 1024,
  storageState: existsSync(AUTH) ? AUTH : undefined,
});
await ctx.addInitScript((t) => {
  localStorage.setItem('potteryTrackerSettings', JSON.stringify({ theme: t }));
  localStorage.setItem('pwaInstallDismissed', '1');
}, theme);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
if (new URL(page.url()).pathname.startsWith('/login')) {
  await page.fill('#username', process.env.SHOT_USER || 'stitchbot');
  await page.fill('#password', process.env.SHOT_PASS || 'stitchbot-pw-1234');
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login')), page.click('button[type="submit"]')]);
  mkdirSync(dirname(AUTH), { recursive: true });
  await ctx.storageState({ path: AUTH });
}
for (const spec of shots) {
  const eq = spec.indexOf('=');
  const name = spec.slice(0, eq);
  const rest = spec.slice(eq + 1);
  const [path, ...actions] = rest.split('!');
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  let full = true;
  for (const a of actions) {
    if (a === 'more') { await page.click('button[aria-haspopup="dialog"]'); await page.waitForTimeout(500); full = false; }
    else if (a === 'scroll') { await page.mouse.wheel(0, 600); await page.waitForTimeout(500); full = false; }
    else if (a === 'viewport') { full = false; }
    else if (a.startsWith('click:')) { await page.click(a.slice(6)); await page.waitForTimeout(600); full = false; }
    else if (a === 'overflow') {
      console.log(await page.evaluate(() => {
        const vw = window.innerWidth;
        const out = [`scrollWidth=${document.documentElement.scrollWidth} vw=${vw}`];
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          const pr = el.parentElement?.getBoundingClientRect();
          if (r.right > vw + 2 && pr && pr.right <= vw + 2) out.push(`${el.tagName}.${String(el.className).slice(0, 70)} right=${Math.round(r.right)}`);
        }
        for (const el of [document.documentElement, document.body, ...document.querySelectorAll('#root, #root *')]) {
          const cs = getComputedStyle(el);
          if (el.scrollWidth > vw + 2 && cs.overflowX === 'visible') out.push(`VISIBLE-OVERFLOW ${el.tagName}.${String(el.className).slice(0, 60)} sw=${el.scrollWidth}`);
        }
        for (const el of document.querySelectorAll('body > *')) out.push(`body child ${el.tagName}.${String(el.className).slice(0,40)} sw=${el.scrollWidth} r=${Math.round(el.getBoundingClientRect().right)}`);
        return out.slice(0, 30).join('\n');
      }));
    }
    else if (a.startsWith('wait:')) { await page.waitForTimeout(Number(a.slice(5))); }
  }
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: full });
  console.log('✓', name);
}
await browser.close();
