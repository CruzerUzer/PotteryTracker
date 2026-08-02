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

### Fyll/synka testkontot med data
`stitchbot` bär en kopia av `Adam`s data. Skapa om eller synka den med:
```bash
cd ../../backend
node tools/copy-user.mjs Adam stitchbot            # kräver tomt mål
node tools/copy-user.mjs Adam stitchbot --wipe     # rensa målet och synka om
```
Bildfiler på disk delas — radera dem aldrig för att "städa" ett testkonto.

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
