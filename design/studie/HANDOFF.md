# Överlämning till Claude Code: studieplan, loggbok, timer och AI-redigering

Det här dokumentet är briefen för Claude Code. Läs det först, utforska sedan kodbasen, och ställ frågorna under *Öppna frågor* innan du bygger.

## Bakgrund

Appen loggar redan keramikalster och var de befinner sig fysiskt och i processen (drejat, svarvat, biskvibränt, glaserat, färdigt). Ägaren drejar en session i veckan i en delad verkstad, gör allt utom bränningen, och har en studieplan på ett år som ska bli en del av appen.

Tre filer följer med:

| Fil | Vad | Används till |
| --- | --- | --- |
| `studieplan.json` | Planen som data: sessionsmall, faser med veckor och grindar, utmaningskort, loggbokens frågor, mått. | Källan som appen läser, visar och redigerar. Seedas in i databasen vid första start. |
| `studieplan.md` | Hela planen som text, inklusive forskningsgrund, bränningsflöde och resurser. | Referens för dig och för AI-redigeringen (systemkontext). Visas gärna i appen som "Om planen". |
| `HANDOFF.md` | Den här briefen. | Krav, datamodell, acceptanskriterier, byggordning. |

## Vad som ska byggas

Fyra moduler, i den här ordningen. Varje modul ska vara användbar på egen hand innan nästa påbörjas.

### 1. Plan och session

- Visa planen: faser, aktuell vecka, veckans huvudpass och finish, fasens grind och lekkort.
- "Aktuell vecka" räknas i **genomförda sessioner**, inte kalenderveckor. En session markerad som *fri* räknar inte upp veckan. Missade veckor skjuter planen framåt, aldrig bakåt.
- Starta en session från veckans plan: sessionen får fas, vecka, föreslaget delmål (redigerbart) och sessionsmallens segment.
- Koppla sessionen till alster: skapade, svarvade, hänklade, glaserade. Återanvänd appens befintliga alster-entitet och processsteg; skapa inte en parallell modell. Bränningsflödet i `studieplan.json` (`firingPipeline.stages`) ska mappas mot appens befintliga processsteg, inte ersätta dem.
- Dra ett utmaningskort (slumpa bland fasens `playCards`, eller hela leken).

### 2. Timer

- Utgår från `sessionTemplate.segments`. Tre sätt att starta: *Starta nu*, *ange starttid* (t.ex. 10:00, så att skivbokningen stämmer), eller ren nedräkning.
- Visar aktuellt segment, vad som ska göras, tid kvar i segmentet och i sessionen, och nästa segment. Markera tydligt när skivtiden (`wheelBooking`) börjar och slutar.
- Överlever sidomladdning och låst mobilskärm: spara starttid och sessions-id persistent (localStorage eller server), räkna fram läget från klockan, aldrig från en löpande räknare.
- Valfritt: notis vid segmentbyte om webbläsaren tillåter. Tyst fallback om inte.
- När sessionen avslutas öppnas loggboken för samma session.
- Segmenten ska vara redigerbara per session ("idag ingen glasyr"), utan att mallen ändras.

### 3. Loggbok

- Tre fasta rader per session (`logbook.perSession`): delmål och mått, en observation, en förändring. Visa exemplen som platshållare. Plus foto, lera, vikt, serienummer, vad som gick i fuktlådan.
- Vid sessionsstart visas förra sessionens tre rader överst, särskilt "en förändring".
- Blockutvärdering var 12:e genomförd session (`logbook.blockReview`): fem frågor, svar sparas, och ett nytt utmaningskort kan skapas direkt från fråga 3.
- Mått (`logbook.metrics`) registreras per fas och visas som enkel trend över året.
- Export av loggboken till markdown eller CSV.

### 4. Glasyrtester (kan vänta)

- Provplatta med kod, lera, glasyr eller recept, appliceringsmetod (dopp i sekunder, antal lager, lager A över B), bränning, resultat, foto, kopplad session. Fält finns i `glazeTest.fields`.
- Egna recept med ingredienser i procent och batchvikt; linjeblandning som genererar n provplattor från två recept.
- Bygg bara datamodellen och ett enkelt formulär först. Resten senare.

### 5. Redigera planen, manuellt och med AI

- Planen lagras versionerad: varje sparad ändring blir en `PlanRevision` med tidsstämpel, författare (`user` eller `ai`), en kort sammanfattning och en snapshot (eller diff). Återställning till tidigare version ska gå.
- Manuell redigering: formulär per fas och vecka, per segment i sessionsmallen, per utmaningskort. Validera mot JSON-schemat innan sparning.
- AI-redigering: användaren skriver en önskan i fritext ("skjut block 2 två veckor", "byt tallrikar mot fat", "gör block 3 mer glasyr") och får ett **förslag**: ny plan-JSON plus en läsbar sammanfattning av vad som ändrats. Användaren godkänner eller förkastar. Inget sparas utan godkännande.
  - Modellen får aktuell plan-JSON, `studieplan.md` som bakgrund, de senaste loggposterna och blockutvärderingarna som kontext, och ska svara med giltig JSON enligt schemat. Validera svaret; vid fel, be modellen rätta en gång, annars visa felet.
  - Använd Claude API via server-sidan. API-nyckeln ligger i miljövariabel, aldrig i klienten. Slå upp aktuell SDK och modell i Anthropics dokumentation i stället för att gissa.
  - En andra AI-funktion när grunden står: "utkast till blockutvärdering" som sammanfattar de senaste tolv sessionernas loggrader och föreslår nästa blocks delmål, som användaren redigerar.

## Datamodell

Anpassa namn till kodbasens konventioner. Det som finns i appen redan (alster, processsteg, plats, foton) återanvänds.

```
Plan            id, version, title, json (hela studieplan.json), createdAt, updatedAt
PlanRevision    id, planId, createdAt, author ('user'|'ai'), summary, snapshot (json), aiPrompt?
Session         id, planId, phaseId, weekNumber, date, isFree, goal, startedAt, endedAt,
                segments (kopia av mallens segment, ev. justerade), challengeCardId?
SessionPiece    sessionId, pieceId, action ('thrown'|'trimmed'|'handled'|'decorated'|'glazed')
LogEntry        id, sessionId, goalAndMeasure, observation, change, clay, weightGrams,
                seriesNumber, intoDampBox, photoIds[]
BlockReview     id, planId, phaseId, createdAt, answers[5], nextGoals, newCardId?
Metric          id, phaseId, metricId, value, measuredAt
GlazeTest       id, sessionId?, tileCode, clayBody, glaze, recipeId?, method, dipSeconds?,
                coats?, layering?, firing, result, photoIds[]
GlazeRecipe     id, name, cone, ingredients[{material, percent}], notes
```

Skriv ett JSON-schema (`studieplan.schema.json`) från `studieplan.json` och använd det både för manuell validering och för AI-svar.

## Acceptanskriterier

- Första start seedar planen från `studieplan.json`; appen visar "Återstart, vecka 1" med rätt huvudpass.
- Efter fyra genomförda sessioner (inte fria) visas Block 1, vecka 5. En fri session däremellan ändrar inte det.
- Timern startad 09:47 med starttid 10:00 visar "In, utan skiva" fram till 10:15 och sedan "Huvudpass, på skivan"; efter sidomladdning visar den samma läge.
- Loggboken sparar tre rader och ett foto på under en minut på mobil.
- En AI-redigering som ger ogiltig JSON sparas aldrig; en godkänd skapar en revision med author `ai`, och återställning till föregående revision fungerar.
- Alla texter på svenska. Inga förändringar i befintliga alster-flöden utan att det sägs uttryckligen.

## Byggordning

1. Utforska kodbasen: stack, datalager, hur alster och processsteg är modellerade, hur foton lagras, hur mobilvyn ser ut. Skriv en kort sammanfattning och ett arkitekturförslag innan kod.
2. Modul 1 (plan och session) med seed och koppling till alster.
3. Modul 2 (timer).
4. Modul 3 (loggbok, blockutvärdering, mått).
5. Modul 5 (versionerad plan, manuell redigering, sedan AI-förslag).
6. Modul 4 (glasyrtester), minsta version.

En commit eller PR per modul. Kör befintliga tester före och efter.

## Öppna frågor till ägaren

Fråga innan du bygger om du inte hittar svaret i kodbasen:

1. Vilken stack och vilket datalager är det, och finns det redan en autentisering eller är appen för en användare?
2. Hur heter appens processsteg för alster, och vilka ska mappas mot `firingPipeline.stages`?
3. Var lagras foton i dag, och ska loggbokens foton gå samma väg?
4. Mobil först eller desktop först? (Timern och loggboken används i verkstaden, troligen på mobil med leriga händer: stora knappar, få fält.)
5. Finns det en server att lägga Claude API-anropen på, eller är appen rent statisk? Om statisk behövs en liten backend eller edge-funktion för nyckeln.
