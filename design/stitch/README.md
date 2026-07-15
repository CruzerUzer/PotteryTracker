# Stitch-redesign — överlämning

Nytt visuellt förslag framtaget i Google Stitch. **Inspiration, inte kravbild:**
vi vill fånga *utseendet*, men **all befintlig funktion ska vara kvar**. Nya
features får föreslås utifrån Stitch, men bekräftas separat innan de byggs.

## Vad som läggs här

| Plats | Innehåll |
|-------|----------|
| `images/` | Skärmbilder av Stitch-förslaget, en per vy. Namnge `NN-vy.png`, t.ex. `01-kanban.png`, `03-pjas-detalj.png`. |
| `export/` | Stitch HTML/CSS-export (om tillgänglig). Ger exakta färger/spacing/typografi. |
| `tokens.md` | Färgkoder + typsnitt (fyll i mallen). |
| detta README | Intention per vy (fyll i tabellen nedan). |

## Intention per vy (fyll i)

För varje vy: vad ska **fångas** (måste), vad är bara utfyllnad, ev. avvikelser.

| Vy | Bildfil | Måste fångas | Strunta i | Ev. ny feature-idé |
|----|---------|--------------|-----------|--------------------|
| Kanban |  |  |  |  |
| Lista |  |  |  |  |
| Pjäs-detalj |  |  |  |  |
| Material |  |  |  |  |
| Statistik |  |  |  |  |
| Inställningar |  |  |  |  |
| Inloggning |  |  |  |  |

## Helhetskänsla
3–5 känsloord för hela designen (t.ex. "lugn, hantverksmässig, luftig, varm"):

>

## Så verifierar vi
Appen är tokenbaserad (`frontend/src/styles/App.css`), så omstylingen sker
mest via design-tokens + per-komponent-finjustering — funktioner rörs inte.
Skärmbilder av den byggda appen tas med `tools/screenshots/` och jämförs mot
`images/` här. Inget till prod utan godkännande.
