// Studie-flöde för visuell kontroll: node study-flow.mjs <out-dir> <theme>
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
const AUTH = join(dirname(fileURLToPath(import.meta.url)), 'out', '.auth.json');
const [out, theme = 'light', size = '390x844'] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const BASE = process.env.BASE_URL || 'http://localhost:4301';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1024, storageState: existsSync(AUTH) ? AUTH : undefined });
await ctx.addInitScript((t) => {
  localStorage.setItem('potteryTrackerSettings', JSON.stringify({ theme: t }));
  localStorage.setItem('pwaInstallDismissed', '1');
}, theme);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
if (new URL(page.url()).pathname.startsWith('/login')) {
  await page.fill('#username', 'stitchbot');
  await page.fill('#password', 'stitchbot-pw-1234');
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login')), page.click('button[type="submit"]')]);
  await ctx.storageState({ path: AUTH });
}
const shot = async (name, full = true) => { await page.waitForTimeout(700); await page.screenshot({ path: join(out, `${name}.png`), fullPage: full }); console.log('shot', name); };
const overflow = async () => console.log('overflow', await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth));
const steps = (process.env.STEPS || 'today,start,series,link,end,plan,piece').split(',');
await page.goto(`${BASE}/studie`, { waitUntil: 'networkidle' });
await shot('01-idag'); await overflow();
if (steps.includes('start')) {
  await page.getByRole('button', { name: 'Dra ett kort' }).click();
  await shot('02-kort', false);
  await page.getByRole('button', { name: /Förbered passet|Fortsätt/ }).first().click();
  await page.waitForURL(/\/studie\/pass\//);
  await shot('03-forberedelse'); await overflow();
}
if (steps.includes('series')) {
  await page.getByRole('button', { name: 'Ny serie' }).click();
  await shot('04-serie', false);
  await page.getByRole('button', { name: /Skapa \d+ alster/ }).click();
  await page.waitForTimeout(800);
}
if (steps.includes('link')) {
  await page.getByRole('button', { name: 'Koppla alster' }).click();
  await page.getByRole('radio', { name: 'Glaserat' }).click();
  await shot('05-valjare', false);
  await page.locator('.pick-row:not(.pick-row--done)').first().click();
  await page.waitForTimeout(600);
  await page.keyboard.press('Escape');
  await shot('06-alster');
}
if (steps.includes('end')) {
  await page.getByRole('button', { name: 'Starta passet' }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Avsluta passet' }).click();
  await shot('07-avslutat');
}
if (steps.includes('plan')) {
  await page.goto(`${BASE}/studie/plan`, { waitUntil: 'networkidle' });
  await shot('08-planen'); await overflow();
  await page.getByRole('tab', { name: 'Om planen' }).click();
  await shot('09-om', false); await overflow();
  await page.getByRole('tab', { name: 'Bränningsflöde' }).click();
  await shot('10-flode');
}
if (steps.includes('piece')) {
  await page.goto(`${BASE}/studie`, { waitUntil: 'networkidle' });
  await shot('11-idag-efter');
  const href = await page.evaluate(async () => {
    const r = await fetch('/api/study/sessions', { credentials: 'include' }); const s = await r.json();
    const d = await (await fetch(`/api/study/sessions/${s[0].id}`, { credentials: 'include' })).json();
    return d.pieces[0] ? `/pieces/${d.pieces[0].id}` : null;
  });
  if (href) { await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' }); await page.mouse.wheel(0, 2000); await shot('12-alster-pass', false); }
}
await browser.close();
