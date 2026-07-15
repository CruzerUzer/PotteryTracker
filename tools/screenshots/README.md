# Screenshot-verktyg

Fotar varje vy av den **körande** appen till PNG — ljust/mörkt läge × desktop/mobil —
för visuell jämförelse mot Stitch-förslaget i `design/stitch/images/`.

## Engångs-setup
```bash
cd tools/screenshots
npm install
npx playwright install chromium
```

## Förutsättningar
- Appen kör (dev: frontend på 4301, backend på 4300 — eller sätt `BASE_URL`).
- Ett testkonto finns. Default `stitchbot` / `stitchbot-pw-1234`
  (skapa med: `SHOT_USER=stitchbot SHOT_PASS=stitchbot-pw-1234` via registrering,
  eller ange egna via miljövariabler).

## Kör
```bash
npm run capture
# eller mot annan miljö/konto:
BASE_URL=http://hemmalinux.taila35f69.ts.net:4301 SHOT_USER=... SHOT_PASS=... npm run capture
```

Bilderna hamnar i `out/<tema>/<viewport>/<vy>.png` (gitignorerat).

## Vyer som fotas
kanban, lista, färdiga, statistik, arbetsflöde, material, säkerhetskopia, inställningar.
Justera listan i `capture.mjs` vid behov.
