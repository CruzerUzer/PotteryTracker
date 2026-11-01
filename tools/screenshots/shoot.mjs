// Ad hoc-skript: node shoot.mjs <out-dir> <theme> <width>x<height> <name>=<path>[!action] ...
// action: "more" öppnar Mer-arket, "scroll" scrollar 600px, "click:<selector>" klickar.
import { chromium } from 'playwright';
import { join } from 'path';
import { mkdirSync } from 'fs';
const [out, theme, size, ...shots] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const BASE = process.env.BASE_URL || 'http://localhost:4301';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 1024 });
await ctx.addInitScript((t) => {
  localStorage.setItem('potteryTrackerSettings', JSON.stringify({ theme: t }));
  localStorage.setItem('pwaInstallDismissed', '1');
}, theme);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#username', 'stitchbot');
await page.fill('#password', 'stitchbot-pw-1234');
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login')), page.click('button[type="submit"]')]);
for (const spec of shots) {
  const [name, rest] = spec.split('=');
  const [path, ...actions] = rest.split('!');
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  let full = true;
  for (const a of actions) {
    if (a === 'more') { await page.click('button[aria-haspopup="dialog"]'); await page.waitForTimeout(500); full = false; }
    else if (a === 'scroll') { await page.mouse.wheel(0, 600); await page.waitForTimeout(500); full = false; }
    else if (a === 'viewport') { full = false; }
    else if (a.startsWith('click:')) { await page.click(a.slice(6)); await page.waitForTimeout(600); full = false; }
    else if (a.startsWith('wait:')) { await page.waitForTimeout(Number(a.slice(5))); }
  }
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: full });
  console.log('✓', name);
}
await browser.close();
