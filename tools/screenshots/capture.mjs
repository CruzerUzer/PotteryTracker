// Fotar varje vy av den KÖRANDE appen till PNG, i både ljust/mörkt läge och
// desktop/mobil — för visuell jämförelse mot Stitch-förslaget i design/stitch/.
//
// Kräver att appen kör (dev: frontend 4301 → backend 4300) och ett testkonto.
// Konfig via miljövariabler:
//   BASE_URL   (default http://localhost:4301)
//   SHOT_USER  (default stitchbot)
//   SHOT_PASS  (default stitchbot-pw-1234)
//   SHOT_OUT   (default ./out)
//
// Kör:  npm run capture

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE = process.env.BASE_URL || 'http://localhost:4301';
const USER = process.env.SHOT_USER || 'stitchbot';
const PASS = process.env.SHOT_PASS || 'stitchbot-pw-1234';
const OUT = process.env.SHOT_OUT || join(__dirname, 'out');

const routes = [
  ['kanban', '/'],
  ['lista', '/list'],
  ['fardiga', '/done'],
  ['statistik', '/stats'],
  ['arbetsflode', '/workflow'],
  ['material', '/materials'],
  ['sakerhetskopia', '/backup'],
  ['installningar', '/settings'],
];

const viewports = [
  ['desktop', { width: 1280, height: 900 }],
  ['mobil', { width: 390, height: 844 }],
];

const themes = ['light', 'dark'];

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#username', USER);
  await page.fill('#password', PASS);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);
}

const run = async () => {
  const browser = await chromium.launch();
  try {
    for (const theme of themes) {
      // Sätt temat i localStorage innan appens JS kör
      const context = await browser.newContext();
      await context.addInitScript((t) => {
        localStorage.setItem('potteryTrackerSettings', JSON.stringify({ theme: t }));
        localStorage.setItem('pwaInstallDismissed', '1'); // dölj install-bannern i bilderna
      }, theme);

      const page = await context.newPage();
      await login(page);

      for (const [vpName, vp] of viewports) {
        await page.setViewportSize(vp);
        const dir = join(OUT, theme, vpName);
        mkdirSync(dir, { recursive: true });
        for (const [name, path] of routes) {
          await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
          await page.waitForTimeout(400); // låt animationer landa
          await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
          console.log(`✓ ${theme}/${vpName}/${name}.png`);
        }
      }
      await context.close();
    }
    console.log(`\nKlart. Bilder i: ${OUT}`);
  } finally {
    await browser.close();
  }
};

run().catch((e) => { console.error(e); process.exit(1); });
