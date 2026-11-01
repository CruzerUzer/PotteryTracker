# Studie: utbildningsmodulen i PotteryTracker

Arkitektur- och UX-plan. Skriven 2026-11-01 utifrån `design/studie/HANDOFF.md`
och ägarens svar. Uppdatera statustabellen när en modul blir klar.

## Status

| Modul | Branch | Status |
|-------|--------|--------|
| 1. Plan och pass | `feature/studie-1-plan` | Klar 2026-11-01, väntar på ägarens test |
| 2. Timer | `feature/studie-2-timer` | Planerad |
| 3. Loggbok, blockutvärdering, mått | `feature/studie-3-loggbok` | Planerad |
| 5. Versionerad plan och manuell redigering | `feature/studie-5-plan-redigering` | Planerad |
| 4. Glasyrtester, minsta version | `feature/studie-4-glasyr` | Planerad |
| AI-redigering (del av modul 5) | – | Skjuten på framtiden, se nedan |

En commit per modul. Backendtester och frontendbygge körs före och efter.
Ägaren testar på testservern (:8453) innan merge. Inget till produktion utan
uttryckligt OK (CLAUDE.md).

## Beslut från ägaren (2026-11-01)

1. **Passet flyttar inte alstrens fas automatiskt.** När ett alster markeras
   som till exempel glaserat i ett pass föreslår appen "Flytta till
   Glasyrbränning?" med en knapp. Ingen flytt utan bekräftelse.
2. **Bränningsflöde → appens faser:** Drejat, Svarvat → *På gång* ·
   Skröjbränt → *Skröjbränd* · Glaserat → *Glasyrbränning* · Ut ur ugnen →
   *Klar*. Mappningen sparas per användare eftersom faserna är egna per
   användare. Ordet **biskvi** byts mot **skröj** överallt i planen
   (`Biskvibränt` → `Skröjbränt`, `biskvibränt gods` → `skröjbränt gods`,
   `Biskvibränning` → `Skröjbränning`).
3. **Mobil först** för timer och loggbok. Planvy och redigering ska också
   fungera bra på desktop.
4. Ägaren **börjar på vecka 1**. Ingen import av gamla pass behövs, men det
   ska gå att logga ett pass i efterhand med annat datum.
5. **Studie är en flagga per användare, av som standard.** Kolumnen
   `users.study_enabled` (0/1) sätts av admin under Användare. Fliken och
   API:et finns bara för användare med flaggan på.
6. **AI-redigeringen väntar.** Tills vidare redigeras planen manuellt i appen
   eller genom att ägaren ber Claude Code ändra `studieplan.json` i repot
   (se *Planfilen och revisioner*).
7. **Egen flik "Studie"** i bottennavigeringen: Kanban · Lista · Studie ·
   Färdiga · Mer.

## Vad som finns att bygga på

- Multi-user Express + SQLite, sessionsinloggning, `user_id` i varje tabell.
- Faser (`phases`) och platser (`locations`) är egna per användare och går
  att byta namn på. Ägarens faser: På gång → Skröjbränd → Glasyrbränning →
  Klar. Alster sätts `done` när de når sista fasen.
- Ingen fashistorik i dag, bara aktuell fas.
- Material (`materials`) med typ `clay`/`glaze`/`other`, kopplat till alster
  via `piece_materials`.
- Foton: Multer + Sharp till `uploads/` och `uploads/thumbnails/`,
  `piece_images` kräver `piece_id` och `phase_id`.
- Migrationer: fristående skript i `backend/database/`, uppräknade i
  `update-potterytracker.sh`. Export, arkiv och `copy-user` listar tabeller
  explicit och måste utökas.
- Mobilredesign klar: bottennav, Mer-ark, Sheet, toasts, ConfirmDialog,
  skelett, tokens i `App.css`.

## Namn

Planens "faser" (Återstart, Block 1–4) heter **block** i kod, tabeller och
API (`plan_block_id`), så att de inte blandas ihop med appens faser
(processsteg). I gränssnittet heter de "Återstart" och "Block 1–4" som i
planen. "Session" i briefen heter **pass** i gränssnittet (planen själv
säger "pass"), `study_sessions` i databasen.

## Känsla och ton

Studie ska kännas som en lugn, uppmuntrande studiekamrat, inte en
träningsapp med dåligt samvete. Planens egna regler styr tonen:
*"Missade veckor är normalt. Fortsätt där planen står."*

- **Inga streaks, inga röda dagar.** Framsteg räknas i genomförda pass:
  "Pass 7 av 52", "4 av 12 i Block 1". Ett missat kalendervecka syns inte
  som ett misslyckande.
- **Idag först.** Startsidan svarar på en fråga: *vad gör jag i dag?*
  Allt annat (planen, loggen, måtten) ligger ett klick bort.
- **Appen håller tråden mellan passen.** Förra passets "en förändring"
  visas som ett citat överst när nästa pass startar. Det är planens
  viktigaste mekanism och ska vara det första ögat landar på.
- **Tre generationer gods.** Appen vet vilka alster som drejades förra
  passet och vilka som är skröjbrända, och föreslår dem i Finish- och
  Glasyrsegmenten. Det är här kopplingen pass ↔ alster betalar sig: ingen
  dubbelinmatning, och passet påminner om vad som väntar på hyllan.
- **Lek är en del av planen.** Utmaningskortet dras som ett riktigt kort
  (vänd-animation, Galleri Noir-tokens), inte som en listrad.
- **Fira blocket.** Efter 12 genomförda pass öppnas blockutvärderingen
  som en avslutning: "Block 1 avklarat", fotogalleri från blockets alster,
  måttens trend, sedan de fem frågorna.
- Stora tryckytor och få fält i verkstaden. Leriga händer: allt som ska
  göras under passet går att göra med en tumme.

## Vyer

### `/studie` – Idag

Startsidan. Innehåll uppifrån och ned:

1. **Block och vecka.** "Block 1 · Grundformer i serie" med en tunn
   framstegsring (4/12) och årets framsteg (pass 8 av 52).
2. **Förra gången.** Citatkort med förra passets "en förändring" (och
   observationen i mindre stil). Döljs vecka 1.
3. **Veckans huvudpass** och **Finish**, planens texter för aktuell vecka.
   Delmålet (redigerbart) föreslås av huvudpassets text.
4. **Gods på hyllan.** Två rader: "Att svarva: 6 cylindrar (drejade
   24 okt)" och "Att glasera: 4 bägare (skröjbrända)". Hämtas från
   `study_session_pieces` + alstrens aktuella fas. Klick öppnar listan.
5. **Starta passet**, stor primärknapp. Under den: *Fritt pass* (räknar inte
   upp veckan) och *Logga ett pass i efterhand*.
6. **Blockets grind** som checklista. Kryssas i av användaren när den
   klarats, sparas på blocket (`study_gate_checks`).
7. **Utmaningskort.** "Dra ett kort" (blockets lek eller hela). Kortet kan
   fästas vid dagens pass.
8. **Inför nästa pass.** Planens `betweenSessions` plus nästa veckas
   huvudpass i en rad.

### `/studie/pass/:id` – Passet

Ett pass går genom tre lägen på samma URL:

- **Förberedelse** (före start): delmål, dagens segment (toggla av "Yta och
  glasyr", justera minuter; mallen ändras inte), starttid (nu / ange
  klockslag / ren nedräkning), kopplat utmaningskort.
- **Pågår** (modul 2): timern. Stora siffror, aktuellt segment med
  beskrivning, tid kvar i segment och i passet, nästa segment. Ett
  mässingsband visar skivtiden (`wheelBooking`). Segment med skiva har
  skivikon. Knappar: *Nästa segment*, *+10 min*, *Avsluta passet*. Under
  timern ligger segmentets **snabbåtgärder**:
  - Huvudpass: "Lägg till nya alster" → serieformulär (se *Alster i passet*).
  - Finish: lista på gods att svarva/hänkla, bocka av.
  - Yta och glasyr: lista på skröjbränt gods, bocka av som glaserat.
  - Städ och logg ut: loggboken öppnas inline.
- **Avslutat** (modul 3): loggboken för passet, sedan sammanfattning.

Läget räknas alltid fram från sparad starttid och klockan, aldrig från en
löpande räknare. Starttid, segment och pass-id sparas på servern;
localStorage är bara cache för att visa rätt direkt vid omladdning.
Wake Lock håller skärmen tänd om webbläsaren stöder det. Notis vid
segmentbyte bara om tillåtet och sidan är öppen; annars tyst.

### `/studie/plan` – Planen

Årets fem block som kapitel i en tidslinje med blockfärger. Aktuellt block
är utfällt, aktuell vecka markerad. Varje block visar tema (tekniskt och
kreativt), veckor (huvudpass och finish), grind och lek. Flik **Om planen**
renderar `studieplan.md` (syfte, forskning, bränningsflöde, resurser).
Modul 5 lägger till *Redigera* här.

### `/studie/logg` – Loggboken

Lista över alla pass, nyast överst: datum, block/vecka, de tre raderna,
foto-tumnagel, kopplade alster. Filter per block. **Mått** som enkel
trend per mätvärde (jämnhet, väggtjocklek, genomströmning, tempo) med
blockgränser. **Blockutvärderingar** som egna kort. Export till Markdown
och CSV.

### Alstrets detaljsida (befintlig)

Får en rad "Pass" med de pass alstret varit med i och vad som gjordes
("Drejat pass 7 · Svarvat pass 8 · Glaserat pass 10"). Ingen annan
ändring i alsterflödet.

## Alster i passet

- **Serieformulär.** "Skapa serie" med antal, namn, vikt i gram, lera (från
  Material). Skapar till exempel 6 alster "Cylinder 500 g · S12-1 … S12-6"
  i fasen *På gång* med passets standardplats, kopplar dem till passet som
  `thrown`, och sätter serienummer. Serienumret räknas upp per användare och
  visas i loggboken som "Märk: S12" för ristningen i foten.
- **Koppla befintliga.** Sök bland egna alster som inte är klara och välj
  åtgärd: drejat, svarvat, hänklat, dekorerat, glaserat.
- **Fasförslag.** När åtgärden motsvarar ett steg i bränningsflödet visas
  "Flytta till Glasyrbränning?" med knapp (beslut 1). Flytten görs via
  befintlig `PATCH /api/pieces/:id/phase`.
- **Gods på hyllan** på Idag-sidan bygger på samma data: alster kopplade
  som `thrown` utan `trimmed` → att svarva; alster i fasen *Skröjbränd* →
  att glasera.

## Datamodell

Alla tabeller har `user_id` och indexeras på det. Tidsstämplar som ISO-text
som i övriga schemat.

```
users                   + study_enabled INTEGER DEFAULT 0

study_plans             id, user_id, version, title, json, created_at, updated_at
study_plan_revisions    id, plan_id, user_id, created_at, author ('seed'|'user'|'file'|'ai'),
                        summary, snapshot (json), ai_prompt
study_stage_phase_map   user_id, stage_id ('thrown'|'trimmed'|'bisque'|'glazed'|'done'), phase_id
study_sessions          id, user_id, plan_id, plan_block_id, week_number, date, is_free,
                        goal, planned_start, started_at, ended_at, segments_json,
                        challenge_card_id, created_at
study_session_pieces    id, session_id, piece_id, action
                        ('thrown'|'trimmed'|'handled'|'decorated'|'glazed')
study_gate_checks       id, user_id, plan_block_id, gate_index, checked_at
study_series            id, user_id, number, session_id, name, weight_grams   (modul 1)

study_log_entries       id, session_id, user_id, goal_and_measure, observation, change,
                        clay_material_id, weight_grams, series_number, into_damp_box, created_at
study_session_images    id, session_id, user_id, piece_id (valfri), filename,
                        original_filename, created_at
study_block_reviews     id, user_id, plan_id, plan_block_id, created_at, answers_json,
                        next_goals, new_card_id
study_metrics           id, user_id, plan_block_id, metric_id, value, measured_at, session_id

glaze_recipes           id, user_id, name, cone, ingredients_json, notes, created_at
glaze_tests             id, user_id, session_id, tile_code, clay_material_id, glaze_material_id,
                        recipe_id, method, dip_seconds, coats, layering, firing, result, created_at
glaze_test_images       id, glaze_test_id, user_id, filename, original_filename, created_at
```

`stage_id` `bisque` behålls som tekniskt id i JSON och databas (det är
nyckeln i `firingPipeline.stages`); namnet som visas är *Skröjbränt*.

**Aktuell vecka** lagras inte. Den räknas fram: antal pass med `ended_at`
satt och `is_free = 0` plus 1, begränsat till 52. Blocket slås upp från
veckan i planens JSON. Vid start sparas block och vecka på passet som
ögonblicksbild, så historiken står kvar även om planen ändras.

## Planfilen och revisioner

- `studieplan.json`, `studieplan.schema.json` och `studieplan.md` ligger i
  `backend/database/studie/`. Schemat skrivs i modul 1 och validerar med
  `ajv`.
- Första gången en användare med `study_enabled` öppnar Studie seedas planen
  från filen som revision 1 med `author = 'seed'`.
- När ägaren ber Claude Code ändra planen ändras filen i repot och
  `version` räknas upp. Vid nästa deploy ser servern att filens version är
  nyare än användarens och visar en banderoll: "Ny version av planen
  (v3): *Block 2 flyttat två veckor*. Hämta?" Hämtning skapar en revision
  med `author = 'file'`. Inget byts ut utan att användaren väljer det.
- Modul 5 lägger till formulär per block, vecka, segment och kort
  (`author = 'user'`) och återställning till tidigare revision. AI-delen
  (`author = 'ai'`) byggs när ägaren säger till; datamodellen är redan
  förberedd med `ai_prompt`.

## API

Alla under `/api/study`, bakom `requireAuth` + `requireStudy`
(401/403 om `study_enabled = 0`).

```
GET    /plan                        aktuell plan + beräknad vecka, block, framsteg
POST   /plan/seed                   seeda från fil (körs automatiskt av GET om ingen plan finns)
GET    /plan/file-version           filens version vs användarens
POST   /plan/adopt-file             hämta filens version som ny revision
GET    /plan/document               studieplan.md
GET    /stage-map  PUT /stage-map   mappning bränningsflöde → faser
GET    /today                       allt Idag-sidan behöver i ett anrop
POST   /sessions                    skapa pass (förberedelse)
GET    /sessions  GET /sessions/:id
PATCH  /sessions/:id                delmål, segment, starttid, kort, is_free
POST   /sessions/:id/start          sätter started_at / planned_start
POST   /sessions/:id/end            sätter ended_at
POST   /sessions/:id/pieces         koppla alster {piece_id, action} eller serie {count, name, weight, clay}
DELETE /sessions/:id/pieces/:spId
GET    /pieces/:pieceId/sessions    för alstrets detaljsida
POST   /gates/:blockId/:index  DELETE …   grindkryss
GET    /cards/draw?block=…          slumpa kort
```

Modul 3 lägger till `/sessions/:id/log`, `/sessions/:id/images`,
`/reviews`, `/metrics`, `/export?format=md|csv`. Modul 5: `/plan/revisions`,
`PUT /plan`, `POST /plan/revisions/:id/restore`. Modul 4: `/glaze/tests`,
`/glaze/recipes`.

## Frontend

```
frontend/src/components/study/
  StudyToday.jsx          /studie
  StudySession.jsx        /studie/pass/:id   (förberedelse · timer · logg)
  StudyPlan.jsx           /studie/plan
  StudyLog.jsx            /studie/logg
  SeriesForm.jsx          skapa serie
  PiecePicker.jsx         koppla befintliga alster
  ChallengeCard.jsx       kortet med vänd-animation
  ProgressRing.jsx
  SegmentTimer.jsx        (modul 2)
  LogbookForm.jsx         (modul 3)
  BlockReview.jsx         (modul 3)
  MetricTrend.jsx         (modul 3)
frontend/src/hooks/useStudyClock.js   (modul 2) räknar läge från klockan
frontend/src/services/api.js          + study-anrop
```

Fliken "Studie" (ikon `GraduationCap` eller `BookOpen`) läggs till i
`BottomNav.jsx` och `Sidebar.jsx`, bara när `user.study_enabled`.
`AuthContext` får fältet från `/api/auth/me`. Admin → Användare får en
växel "Studie".

## Byggordning per modul

**Modul 1** – flagga + admin-växel, planfil med schema och biskvi→skröj,
seed, stage-map, `/today`, pass (skapa, förbereda, avsluta utan timer),
serieformulär, koppla alster, fasförslag, grind, kort, Idag-sidan, Planen,
Pass-sidan i förberedelse- och avslutat-läge (utan logg), rad på alstrets
detaljsida, export/arkiv/copy-user utökade, migration + rad i
`update-potterytracker.sh`, tester.

**Modul 2** – timer med tre startsätt, segment per pass, `useStudyClock`,
Wake Lock, notis, snabbåtgärder per segment, avslut → loggbok.

**Modul 3** – loggbok med tre rader, foto (egen tabell, samma uppladdning,
valfri koppling till alster → syns i alstrets galleri), lera från Material,
vikt, serienummer, fuktlåda. Förra passet överst. Blockutvärdering var 12:e
pass med firande och nytt kort från fråga 3. Mått per block med trend.
Export md/csv.

**Modul 5** – revisioner synliga, återställning, formulär per block, vecka,
segment, kort, validering mot schemat, filversions-banderoll. AI väntar.

**Modul 4** – `glaze_recipes`, `glaze_tests`, enkelt formulär, koppling till
pass och Material. Linjeblandning senare.

## Acceptanskriterier (från briefen, justerade)

- Användare med flaggan av ser ingen Studie-flik och får 403 på
  `/api/study/*`.
- Första öppning seedar planen; Idag visar "Återstart · vecka 1" med rätt
  huvudpass.
- Efter fyra avslutade pass (inte fria) visas Block 1, vecka 5. Ett fritt
  pass däremellan ändrar inte det.
- En serie om 6 skapar 6 alster i *På gång*, kopplade till passet som
  drejade, med löpande serienummer.
- "Glaserat" på ett alster visar fasförslaget; alstret flyttas bara efter
  klick.
- Timern startad 09:47 med starttid 10:00 visar "In, utan skiva" till 10:15,
  sedan "Huvudpass, på skivan"; samma läge efter omladdning.
- Loggboken sparar tre rader och ett foto på under en minut på mobil.
- Alla texter på svenska. Ordet biskvi förekommer inte.
- Befintliga alsterflöden oförändrade utöver raden "Pass" på detaljsidan.
