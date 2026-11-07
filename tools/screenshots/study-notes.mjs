// Egna anteckningar + Mer-menyn i headern: node study-notes.mjs <out-dir> [theme] [WxH]
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

await page.goto(`${BASE}/studie`, { waitUntil: 'networkidle' });
await shot('01-idag', false); await overflow();
console.log('nav-flikar:', await page.locator('.bottom-nav .nav-item span').allTextContents());

await page.getByRole('button', { name: 'Mer', exact: true }).click();
await shot('02-mer', false);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

await page.getByRole('button', { name: /Lägg till en egen anteckning/ }).click();
await page.getByPlaceholder(/Armbågen/).fill('Armbågen mot knät när jag centrerar');
await page.getByPlaceholder(/video, artikel/).fill('youtube.com/watch?v=abc123');
await page.getByPlaceholder(/titta efter/).fill('Se hur han låser handleden vid 2:10.');
console.log('typ efter länk:', await page.locator('#note-form select').first().inputValue());
console.log('pass-val:', await page.locator('#note-form select').nth(1).inputValue());
await shot('03-anteckning-form', false);
await page.getByRole('button', { name: 'Spara', exact: true }).click();
await page.waitForTimeout(900);
await shot('04-idag-med-anteckning'); await overflow();
console.log('egen rad:', await page.locator('.inspiration-own .inspiration-item').count());

await page.getByRole('button', { name: /Ändra anteckningen/ }).click();
await shot('05-andra', false);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

await page.goto(`${BASE}/studie/plan`, { waitUntil: 'networkidle' });
await shot('06-plan'); await overflow();
console.log('plan egna rader:', await page.locator('.inspiration-own .inspiration-item').count(),
  'lägg-till-knappar:', await page.locator('.inspiration-add').count());

await page.goto(`${BASE}/studie`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Förbered passet|Fortsätt/ }).first().click();
await page.waitForURL(/\/studie\/pass\//);
const sessionId = page.url().split('/').pop();
await shot('07-pass-forberedelse'); await overflow();
console.log('pass egna rader:', await page.locator('.inspiration-own .inspiration-item').count());
const del = await page.request.delete(`${BASE}/api/study/sessions/${sessionId}`);
console.log('tillfälligt pass borttaget:', sessionId, del.status());

// Städa: ta bort anteckningen via arket
await page.goto(`${BASE}/studie`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Ändra anteckningen/ }).click();
await page.getByRole('button', { name: 'Ta bort anteckningen' }).click();
await page.getByRole('button', { name: 'Ta bort', exact: true }).click();
await page.waitForTimeout(900);
console.log('egna rader efter borttagning:', await page.locator('.inspiration-own .inspiration-item').count());
await shot('08-idag-efter', false);

await browser.close();
