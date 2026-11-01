// Loggbok, mått och blockutvärdering: node study-log.mjs <out-dir> <bild> [theme]
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
const AUTH = join(dirname(fileURLToPath(import.meta.url)), 'out', '.auth.json');
const [out, photo, theme = 'light'] = process.argv.slice(2);
const BASE = process.env.BASE_URL || 'http://localhost:4301';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, storageState: existsSync(AUTH) ? AUTH : undefined });
await ctx.addInitScript((t) => {
  localStorage.setItem('potteryTrackerSettings', JSON.stringify({ theme: t }));
  localStorage.setItem('pwaInstallDismissed', '1');
}, theme);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
const shot = async (n, full = true) => { await page.waitForTimeout(700); await page.screenshot({ path: join(out, `${n}.png`), fullPage: full }); console.log('shot', n); };
await page.goto(`${BASE}/studie`, { waitUntil: 'networkidle' });
const api = (path, method = 'GET', body) => page.evaluate(async ([p, m, b]) => {
  const r = await fetch(`/api/study${p}`, { method: m, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  return r.json();
}, [path, method, body]);
// Avsluta ev. aktivt pass och skapa ett nytt
const today = await api('/today');
if (today.activeSession) await api(`/sessions/${today.activeSession.id}/end`, 'POST');
const s = await api('/sessions', 'POST', {});
await api(`/sessions/${s.id}/pieces`, 'POST', { series: { count: 3, name: 'Bägare', weight_grams: 400 } });
await api(`/sessions/${s.id}/start`, 'POST', { mode: 'now' });
await page.goto(`${BASE}/studie/pass/${s.id}`, { waitUntil: 'networkidle' });
const t0 = Date.now();
await page.locator('.timer-btn--end').evaluate((el) => el.click());
await page.waitForTimeout(800);
const areas = page.locator('.logbook textarea');
await areas.nth(0).fill('3 bägare à 400 g, mål 10 cm. Fick 9–11 cm.');
await areas.nth(1).fill('Botten blir tjock när jag stressar öppningen.');
await areas.nth(2).fill('Mät bottnen med nål innan jag drar upp.');
await page.locator('.logbook select').first().selectOption({ index: 1 });
await page.setInputFiles('.logbook input[type="file"]', photo);
await page.waitForSelector('.logbook-photo img');
await shot('l1-loggbok');
await page.locator('.logbook button[type=submit]').evaluate((el) => el.click());
await page.waitForSelector('.log-summary');
console.log('loggbok på', Math.round((Date.now() - t0) / 1000), 's (automatiskt)');
await shot('l2-sammanfattning');
// Fler pass så att Återstart blir avklarad
const t = await api('/today');
for (let i = t.progress.completed; i < 4; i++) {
  const x = await api('/sessions', 'POST', {});
  await api(`/sessions/${x.id}/end`, 'POST');
}
await api('/metrics', 'POST', { metric_id: 'evenness', value: 9, plan_block_id: 'restart' });
await api('/metrics', 'POST', { metric_id: 'evenness', value: 6, plan_block_id: 'restart' });
await api('/metrics', 'POST', { metric_id: 'evenness', value: 4 });
await page.goto(`${BASE}/studie`, { waitUntil: 'networkidle' });
await shot('l3-idag', false);
await page.goto(`${BASE}/studie/logg`, { waitUntil: 'networkidle' });
await shot('l4-logg');
await page.getByRole('tab', { name: 'Mått' }).click();
await shot('l5-matt');
await page.goto(`${BASE}/studie/utvardering/restart`, { waitUntil: 'networkidle' });
await shot('l6-utvardering');
console.log('overflow', await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth));
await browser.close();
