# Mobil-redesign: modern och exklusiv navigering och scroll

Överlämningsplan. Skriven 2026-11-01 så att en ny session kan ta över utan
att läsa om hela kodbasen. Helm-ärende: #150 (redesign), #149 (surfplattebugg).

## Status

| Fas | Status | Kommentar |
|-----|--------|-----------|
| 0. Testserver på Hemmalinux | **Klar** | Se avsnittet *Testserver* nedan |
| 1. Appskal och navigation | Ej påbörjad | **Nästa.** Planen är godkänd 2026-11-01 |
| 2. Kanban på mobil | Ej påbörjad | |
| 3. Lista, Färdiga, Detalj, Formulär | Ej påbörjad | |
| 4. Finish | Ej påbörjad | |
| 5. Verifiering och deploy | Ej påbörjad | Fråga alltid innan prod-deploy |

Uppdatera tabellen när en fas blir klar. Branch: `feature/mobile-redesign`.

## Mål och känsla

Appen ska kännas modern och exklusiv. Det visuella temat **Galleri Noir**
(elfenben och mässing i ljust läge, kolsvart och mässing i mörkt, Cormorant
Garamond för rubriker, Inter för brödtext) behålls och förfinas. Arbetet
läggs främst på **navigering, scroll och touch** på mobil. Desktop ska inte bli
sämre, men mobilen är viktigast.

Grundregler, ärvda från `design/stitch/README.md`:

- All befintlig funktion ska vara kvar. Nya features bekräftas separat.
- Appen är tokenbaserad (`frontend/src/styles/App.css`), så visuella ändringar
  görs i första hand via tokens, därefter per komponent.
- Inget till produktion utan uttryckligt OK. Se CLAUDE.md.

## Användarperspektiv: vad som är fel idag

Verifierat 2026-11-01 med skärmbilder från `tools/screenshots/` (390×844,
ljust och mörkt) samt ett surfplatteformat (900 px).

1. **Kanban har scroll-i-scroll.** `KanbanView.jsx` lägger tavlan i en box
   med `maxHeight: calc(100vh - 200px)` och `overflow: auto`. Sidan scrollar
   först, sedan boxen, och dessutom i sidled: fyra faskolumner à 160 px blir
   640 px på en 390 px bred skärm. Faserna där bilderna finns (sista två)
   ligger utanför skärmen. Korten har `touch-action: none` och ett
   300 ms long-press-drag, så ett finger på ett kort blockerar vanlig scroll.
2. **Kromet äter skärmen.** Sticky header (~75 px), sidtitel + knapp
   (~100 px), bottennav (~75 px) och versionsfooter tar runt 35 % av
   skärmhöjden innan innehållet börjar.
3. **"Mer"-menyn är en desktop-dropdown** (Radix DropdownMenu) som poppar upp
   vid bottennaven. Fem av nio vyer ligger där. Inga övergångar mellan vyer.
   Bakåtpilen i `PieceDetail.jsx` går alltid till `/kanban`, inte dit du kom
   ifrån.
4. **Listan börjar med ett helt filterkort** (`PieceList.jsx`). Första pjäsen
   syns först efter en hel skärms scroll.
5. **Detaljvyn visar bilderna sist** och "Ta bort" är den mest framträdande
   knappen (röd, uppe till höger). Inline-redigering av namn och beskrivning
   bygger på hover-ikoner som inte finns på touch.
6. **Native `window.confirm` och `alert`** används på ~15 ställen
   (`PieceDetail`, `WorkflowManager`, `MaterialManager`, `ImageLightbox`).
7. **Döda inställningar** i `Settings.jsx` / `ThemeContext.jsx`: `defaultView`,
   `showImagesInCards`, `showDescriptions` och `phaseColors` sparas i
   localStorage men läses ingenstans. Fasfärgerna i inställningarna matchar
   inte heller tokens i App.css.
8. **Surfplatta 769–1023 px** (Helm #149): `.sidebar` döljs bara ≤768 px och
   `.main-content` får `margin-left` först ≥1024 px, så sidomenyn ligger
   ovanpå innehållet.
9. **Småsaker:** `index.html` har `user-scalable=no` (tillgänglighet),
   `theme-color` är alltid mörk (#17150F) även i ljust läge, lightboxen
   saknar swipe, formuläret saknar fast sparaknapp, materiallistan är en lång
   checkboxlista.

## Planen fas för fas

### Fas 1: Appskal och navigation (mobil först)

Filer: `App.jsx`, `BottomNav.jsx`, `Sidebar.jsx`, `Footer.jsx`, `App.css`,
`index.html`, nya `components/ui/sheet.jsx` och `components/ui/toast.jsx`
(Radix Dialog respektive `@radix-ui/react-toast`, redan i devDependencies).

- Kompakt header som krymper vid scroll (logo + ordmärke, tema och konto).
- Bottennav: **Kanban, Lista, [+ Ny pjäs som central knapp], Färdiga, Mer.**
  "Mer" öppnar en **bottom sheet** med Statistik, Arbetsflöde, Material,
  Säkerhetskopia, Inställningar, Admin (om admin), temaväxling och Logga ut.
- Sidövergångar (kort fade/slide, respektera `prefers-reduced-motion`),
  scrollposition som minns per flik, bakåt via `navigate(-1)` med fallback.
- Versionsfootern tas bort på mobil och visas i Inställningar.
- Surfplattefix: sidomeny från 1024 px, bottennav under det (#149).
- Viewport: tillåt zoom, `viewport-fit=cover`, safe-area-insets i bottennav
  och sheets, `theme-color` per tema.
- Ersätt alla `confirm`/`alert` med en `ConfirmDialog` och toasts.

### Fas 2: Kanban på mobil

Fil: `KanbanView.jsx` (740 rader, delas upp i `kanban/` med `PhasePager`,
`PieceCard`, `MoveSheet`). Test finns i `__tests__/KanbanView.test.jsx`.

- Ta bort den inre scrollboxen. Sidan scrollar som en vanlig sida.
- Mobil: faserna blir **horisontella sidor med scroll-snap** och en fast
  **fassväljare med antal** under headern. Inom varje fas grupperas pjäserna
  per plats (samma data som swimlanes idag).
- Flytt på mobil: **tryck på kortet → bottom sheet** med fas och plats som
  chips. Long-press-drag tas bort på mobil (det blockerar scroll).
  Drag-and-drop behålls på desktop, där matrisen plats × fas behålls.
- Kort: bildförst, två kolumner, namn, "Färdig"-märke, antal material/bilder.
- Kollapsade kolumner/lanes i localStorage behålls på desktop.

### Fas 3: Lista, Färdiga, Detalj, Formulär

Filer: `PieceList.jsx`, `DonePieces.jsx`, `PieceDetail.jsx`, `PieceForm.jsx`,
`ImageLightbox.jsx`, `ImageUpload.jsx`.

- Lista: sökfält överst, filter som **chips** (fas, material, datum) och full
  filterpanel i bottom sheet. Pjäserna syns direkt. Två kolumner på mobil.
- Detalj: **omslagsbild som hero** överst, bildremsa under, fas och plats som
  chips som öppnar samma `MoveSheet` som kanban, beskrivning och material.
  "Ta bort" flyttas till en overflow-meny (⋯) med bekräftelsedialog.
  Redigering via tydliga pennikoner, inte hover.
- Lightbox: swipe mellan bilder, pinch-zoom finns redan (`react-zoom-pan-pinch`).
- Formulär: fast sparaknapp i botten, sökbar materialväljare med chips.

### Fas 4: Finish

- Skelett-laddning i alla vyer (klassen `.skeleton` finns).
- Mikroanimationer: tryckåterkoppling på kort och knappar, sheet-animationer.
- Tomma tillstånd med en handling ("Lägg till din första pjäs").
- Mörkt läge finjusteras på de nya ytorna.
- Inställningar städas: de döda valen tas bort (beslutat).

### Fas 5: Verifiering och deploy

1. `cd backend && npm test` och `cd frontend && npm run build` måste passera.
2. `cd frontend && npx vitest run` (KanbanView- och StatsDashboard-tester).
3. Screenshot-sviten: `cd tools/screenshots && npm run capture` mot
   testservern. Jämför mobilbilderna mot utgångsläget.
4. Användaren testar på telefon via testservern och godkänner.
5. Merge till `main` först efter godkännande.
6. **Fråga innan prod-deploy.** Frontend via `./deploy-frontend.sh` från en
   maskin med gott om RAM. Backend-ändringar via update-skriptet på prod.

## Beslut (tagna av användaren 2026-11-01)

| Fråga | Beslut |
|-------|--------|
| Palett | **Behåll Galleri Noir och förfina.** Ingen ny look. |
| Kanban mobil | **Swipe mellan faser** med fast fassväljare, pjäser grupperade per plats inom fasen. |
| Döda inställningar | **Ta bort** `defaultView`, `showImagesInCards`, `showDescriptions`, `phaseColors`. |
| Bottennav | **Central "+"-knapp** för Ny pjäs. |

Planen är godkänd i sin helhet. Nästa steg är fas 1. Implementationen görs i
en ny session (användaren bytte modell till Opus 5.5 efter planeringen).

## Testserver på Hemmalinux (fas 0, klar)

Dev-läge med HMR, så varje sparad fil syns direkt i telefonen.

| Vad | Värde |
|-----|-------|
| URL (tailnet) | https://hemmalinux.taila35f69.ts.net:8453 |
| Frontend | Vite dev på 127.0.0.1:4301, unit `potterytracker-frontend.service` |
| Backend | `node --watch server.js` på 127.0.0.1:4300, unit `potterytracker-backend.service` |
| Unit-filer | `deploy/hemmalinux/*.service` (installerade i `~/.config/systemd/user/`) |
| Helm-portar | 4300 `potterytracker-backend`, 4301 `potterytracker-frontend` (`helmctl ports`) |
| Helm serve | `helmctl serve claim potterytracker 8453`, registrerad i `~/.helm/services.json` som "PotteryTracker TEST" |
| Infra-docs | `hemmalinux-infra/SERVER.md` (serve-raden) och `helm-services.json` uppdaterade, ej committade i det repot |
| Testkonto | `stitchbot` / `stitchbot-pw-1234`, kopia av Adams data. Synka om: `cd backend && node tools/copy-user.mjs Adam stitchbot --wipe` |
| Databas | Lokal `backend/database/database.db`, inte prod |

Drift:

```bash
systemctl --user status potterytracker-backend potterytracker-frontend
journalctl --user -u potterytracker-frontend -f
systemctl --user restart potterytracker-frontend   # efter ändring i vite.config.js
```

Vite-konfigen tillåter `.ts.net`-värdar (`allowedHosts`) och proxar `/api`
till backend, så inloggning och HMR fungerar genom `tailscale serve`.

## Så tar en ny session över

1. `git checkout feature/mobile-redesign && git pull`.
2. Läs denna fil, sedan `CLAUDE.md`. Kontrollera testservern enligt ovan.
3. Ta nästa fas i statustabellen. Jobba i små commits per fas.
4. Fota med `tools/screenshots/` före och efter. Bilderna hamnar i
   `tools/screenshots/out/` (gitignorerat).
5. Uppdatera statustabellen här och kommentera Helm #150 när en fas är klar.
