# Handoff — after Session 33 (2026-09-08)

## State of the world

**Cinquefoil v1 is live on Vercel; the deploy playtest continues.** Session 33 — **the tiers against the road** — measured and moved nothing: no knob, no list, no catalog row. The matrix (sweep part 8: every tier-3 mage at life {12, 16, 20} × entrance {0, 1, 2 basics}, every tier-2 mage at {10, 12, 14} × {0, 1}, against both mid-road references) and the beast table (part 9: the tier-2/3 beasts at catalog life, +4, +8) are below with their aggregates; part 4's blue re-read is below; Part 6's scoping of the matchup resolver is below. The mage entrance rides the Heart's roots path unchanged and is fixtured at one and two basics with a byte-exact replay. `--tier-life` parameterises the sweep's tier life for parts 1–7. Pool 194 (unchanged).

## Done this session

- **Part 0**: `docs/decision-updates/s33.md` — the ratifications (S32 deviation 1 as an erratum to S28), ADR-112/113/114/115, the filing note.
- **Part 1**: both levers are already vocabulary — tier life is the sweep's `TIER_LIFE` (now `--tier-life 8,10,12`) and the catalog's `worldLife`; the entrance is `permanentOnBattlefield` (the Heart's roots path). `s33-entrance.test.ts`: one and two basics enter untapped under the mage before turn one (after the mulligans, ADR-002), fire no landfall, and the replay is byte-exact.
- **Part 2**: sweep part 8 — the matrix. The mage's entrance basics are its own colours ranked by the list's pip count (one basic = the primary colour; two = one of each for a two-colour mage; a mono mage repeats its one). Per cell: the reference's win rate, mean turns, wins by library; per tier: the aggregate table (mean over the five mages × two references) and a per-mage table. 150 pairings, 15,000 games.
- **Part 3**: sweep part 9 — the ten tier-2/3 beasts (the Tactician at tier 2) at catalog life, +4 and +8, no roots; 60 pairings, 6,000 games; the aggregate by delta.
- **Part 4**: Brainstorm's per-copy rate and its windows for the five blue decks (200 games each against their tier mates, a scratch script reading the ACTION log's step against the turn's active player) beside the S31 rates.
- **Part 6**: the scoping below.

## Director round (Chris, 2026-09-08): the Matchup Lab

**`/lab` in the viewer (dev surface; `pnpm viewer` → the menu's "matchup lab" door or `/lab`)** — an interactive analysis tool for the tier question and any other matchup read. Pick side A from every deck the game has (the fifteen mages, the seventeen beasts at their catalog rows, the five starters, the road decks incl. `road-mid-W/B` and `chris-road-B`, the slice decks A–E), set its life, basics in play and AI profile; side B the same (the reference, fixed). The grid varies A over lists of lives × basics (any values), N games per cell both seats, from a seed; cells run in web workers (one fewer than the machine's cores) with the REAL engine and heuristic agents — the sweep's call, in the browser. Each cell shows B's (or A's) win rate with its 95% interval, mean turns and the by-library share, shaded green inside a band you set (55–65 by default) and redder the further outside; click a cell for the play/draw split, wins by library, the winners' life left (the margin), and a turns histogram. Runs save to the gitignored **`analysis/runs/<name>.json`** through the dev server (name + notes; listed, loadable, and one can be overlaid as a Δ column on the current grid); "download JSON" for the deploy case. `analysis/` is the exploratory scratch space going forward (README inside). Nine cells of 100 games take about two minutes on six workers; the S33 matrix cell for Corvane at 20/2 reproduced at 65% in a twenty-game smoke (the sweep said 59% at a hundred). Files: `packages/ui/src/lab/` (`LabApp.tsx`, `lab-worker.ts`, `lab-decks.ts`, `lab-types.ts`), the `/__lab-list` and `/__lab-save` dev middlewares in `vite.config.ts`. The Lab re-implements no rules.

**Round two (Chris, same day) — the bosses, starting bonuses, the deck editor.** (1) **Every boss is in the pickers** with the world's anchors as defaults: the five power guardians (14–16 life, master), the five Mox court (14–16 life; their symmetric laws — a Plains / a 2/2 Zombie / a Llanowar Elves / a Mountain in play, or a bonus card — on BOTH sides), the five stronghold lords (30 base life; the law card in play, the signature to hand), the five petal bosses (30; the lord's law of their colour returned), and the Manafleur (40 standard; five roots, the flower to hand, the law ring). (2) **Starting bonuses are a per-side editor over the engine's modifier vocabulary** (data-model §5): a permanent in play (any card — basics, tokens, laws), a card to hand after the mulligans, bonus cards, the law ring, each with a "both seats" flag; a deck's defaults load with it and "reset to the deck's" restores them; the grid's basics axis stays the S33 pip-rule entrance on top. A future modifier kind is one more row type (`LabBonus` in `lab-types.ts`, `sideModifiers` in `lab-decks.ts`). (3) **The deck editor**: "edit a copy" on either side opens the deck — counts up/down/remove, add any pool card by name, archetype, notes, live stats (cards / lands / avg MV, unknown ids, under-30 warning) — saved to **`analysis/decks/<name>.json`** through the dev server and listed in both pickers under "custom" (an unsaved edit can be used for the page session); a saved run records the RESOLVED sides (decklists, entrances, bonuses), so a run stays reproducible after its custom deck changes. Side B's manalinks are the same controls (life, entrance basics, bonuses). The worker takes resolved sides and knows no catalogue. Verified live: the Warden (law + signature) and the Manafleur (roots + flower + ring) run clean; a custom copy of road-mid-W plus a Serra saved and ran as side B.

**Round three (Chris: grids stopped with cells never run — three lives → two swept; three lives × two basics → three cells).** The cause class: a module worker that fails to load or dies fires `error`, not `message`, and a job posted to it was lost silently — the page dispatched every cell to a worker at once and waited forever. Not reproduced here (six cells of the Usher ran clean), so the fix is structural: `lab-pool.ts` — a pool with a READY handshake (a worker takes a job only after its module graph loaded), `error`/`messageerror` handling (report, replace the worker, re-queue the cell at the front; three failures drop it), a stall watchdog (no progress for 90 s → the same), a status line ("4 workers: 4 ready, 2 busy, 3 cells queued, 1 failed and replaced"), and four workers by default instead of six (each loads the whole engine through the dev server; six at once is the likeliest way one fails). If a cell is ever lost again the errors panel will say which and why.

## Director round (Chris, 2026-09-08): the BASELINE — the stock starters against the roster

**The ask.** The five starters unmodified (stock lists, 10 life, no basics in play, journeyman) against the fifteen mages at their tier settings (T1 apprentice 8 · T2 journeyman 10 · T3 master 12) and the sixteen beasts at their catalog rows — the win-rate baseline before the more detailed variations, read for the shape Chris wants: fairly high at tier 1, near even at tier 2, unfavourable but winnable at tier 3. Run fresh in Node (`pnpm mage-sweep --part 2|5|6 --baseline none`, 100 games per pairing, both seats — 15,500 games; the S32 parts 2/5/6 were the same configuration and agree within noise). **The Lab's new roster mode** (below) draws the same grid live.

### The starters against the fifteen mages (the STARTER's win %, 100 games each, both seats)

| starter \ opponent | Sister Oriel (T1) | Tessaly Reed (T1) | Pale Edric (T1) | Brann the Scorched (T1) | Old Hask (T1) | Mistress Vael (T2) | Kessa Emberhand (T2) | Adept Maelin (T2) | Brennor of the Glade (T2) | Pell of the Shallows (T2) | Lord Corvane (T3) | Varro Flamebrand (T3) | High Warden Sorrel (T3) | Thornmother Ysolde (T3) | Magister Quill (T3) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Dawn Levy (W)** | 45 | 86 | 76 | 77 | 76 | 45 | 70 | 81 | 68 | 79 | 68 | 59 | 60 | 53 | 72 |
| **Tidal Grimoire (U)** | 24 | 48 | 50 | 55 | 49 | 21 | 49 | 62 | 39 | 56 | 68 | 42 | 41 | 26 | 64 |
| **Pallid Court (B)** | 41 | 70 | 35 | 65 | 83 | 20 | 66 | 69 | 70 | 65 | 72 | 56 | 55 | 44 | 52 |
| **Ember Warband (R)** | 40 | 71 | 45 | 76 | 70 | 31 | 67 | 66 | 48 | 64 | 65 | 46 | 52 | 34 | 59 |
| **Verdant Trail (G)** | 48 | 77 | 55 | 66 | 63 | 36 | 55 | 61 | 57 | 74 | 62 | 58 | 60 | 34 | 68 |

### The starters against the sixteen beasts (the STARTER's win %)

| starter \ opponent | A Grizzly Bear (T1) | The Deadly Recluse (T1) | A Bloom of Man-o'-War (T1) | The Cunning Tactician (T1) | A Plague of Rats (T1) | A Gray Ogre (T1) | A Savannah Lion (T1) | The Boggart Warband (T2) | A Vampire Nighthawk (T2) | The Living Gale (T2) | A Rumbling Baloth (T2) | The Siege-Gang (T3) | The Hypnotic Specter (T3) | The Serra Angel (T3) | The Pelakka Wurm (T3) | The Faerie Formation (T3) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Dawn Levy (W)** | 90 | 70 | 92 | 88 | 84 | 89 | 64 | 61 | 42 | 87 | 62 | 47 | 80 | 21 | 52 | 62 |
| **Tidal Grimoire (U)** | 76 | 59 | 69 | 75 | 61 | 73 | 34 | 38 | 27 | 76 | 64 | 44 | 70 | 18 | 38 | 62 |
| **Pallid Court (B)** | 71 | 73 | 74 | 69 | 77 | 78 | 46 | 51 | 8 | 58 | 72 | 38 | 71 | 14 | 36 | 29 |
| **Ember Warband (R)** | 71 | 82 | 81 | 79 | 77 | 79 | 56 | 54 | 18 | 84 | 38 | 34 | 73 | 16 | 38 | 42 |
| **Verdant Trail (G)** | 73 | 54 | 75 | 79 | 70 | 84 | 51 | 55 | 15 | 72 | 40 | 46 | 54 | 24 | 34 | 42 |

### Aggregate by tier — each starter's mean win % over the group (n = opponents in the group)

| starter | T1 mages (n=5) | T2 mages (n=5) | T3 mages (n=5) | T1 beasts (n=7) | T2 beasts (n=4) | T3 beasts (n=5) | all mages (n=15) | all beasts (n=16) | everyone (n=31) |
|---|---|---|---|---|---|---|---|---|---|
| **Dawn Levy (W)** | 72% | 69% | 62% | 82% | 63% | 52% | 68% | 68% | 68% |
| **Tidal Grimoire (U)** | 45% | 45% | 48% | 64% | 51% | 46% | 46% | 55% | 51% |
| **Pallid Court (B)** | 59% | 58% | 56% | 70% | 47% | 38% | 58% | 54% | 56% |
| **Ember Warband (R)** | 60% | 55% | 51% | 75% | 48% | 41% | 56% | 58% | 57% |
| **Verdant Trail (G)** | 62% | 57% | 56% | 69% | 46% | 40% | 58% | 54% | 56% |
| *all five* | 60% | 57% | 55% | 72% | 51% | 43% | 57% | 58% | 57% |

**The reads.**
- **The tiers do not separate from the starters' side.** Against the mages the starters average 60% at tier 1, 57% at tier 2, 55% at tier 3 — a five-point slope where the shape wanted is high / even / unfavourable. The tier-3 masters at 12 life are still FAVOURABLE for four of the five starters (only Tidal Grimoire is under 50 against them, and it is under 50 against every tier). This is the S32/S33 finding from the other side: the mage ladder's difficulty lives in the lists more than the tiers, and the tier lever (S33's matrix — life plus entrance) is what would open the gap.
- **The beasts DO have the gradient**: 72% / 51% / 43% by tier. The tier-1 beasts are fodder (Grizzly, Ogre, Man-o'-War, Tactician at 84–92 for Dawn Levy); the tier-3 beasts are the only opponents that are unfavourable across the board (the Serra 14–24, the Wurm 34–52, the Siege-Gang 34–47). The beast catalog is closer to the wanted shape than the mage ladder.
- **The walls**: Sister Oriel at tier 1 (the starters win 24–48 — the lifegain wall the teachers' tier should not have), Mistress Vael at tier 2 (20–45), the Vampire Nighthawks at tier 2 (8–42 — the black starter wins 8%). Thornmother Ysolde is the one tier-3 mage that plays like a tier-3 (26–53). The fodder: Tessaly (48–86), Hask (49–83), Maelin (61–81), Pell (56–79), Corvane (62–72 — a tier-3 master the starters beat two games in three).
- **The roads**: Dawn Levy 68% over everyone (the gentle road, ADR-114, confirmed from this side too); Pallid Court, Ember Warband and Verdant Trail 56–57%; **Tidal Grimoire 51% overall and 46% against the mages** — the blue road is the hard one, and it is hard at every tier rather than progressively.
- **Per-tier bands for the visual**: the Lab's roster mode shades each cell by its column's tier band, seeded with placeholders Chris can move — T1 65–80, T2 45–55, T3 30–45 (the row's win rate). Against those, the baseline's mages sit above every band at tiers 2 and 3 for most starters; the beasts sit inside at tiers 2–3 and above at tier 1.

**The first tuning read (Chris, 2026-09-08 — `analysis/runs/first_tier_tuning.json`, 200 games per cell, fresh seeds, 62,000 games).** Shifts: tier-1 mages −2 life; tier-2 mages +2 life; tier-3 mages +2 life and one entrance basic; tier-3 beasts +2 life; tier-1/2 beasts untouched (the noise floor). Tier aggregates, the starter's win %, baseline → shifted, against the placeholder bands (T1 65–80, T2 45–55, T3 30–45; ✓ in band, ▲ above, ▼ below):

| starter | T1 mages | T2 mages | T3 mages | T1 beasts | T2 beasts | T3 beasts |
|---|---|---|---|---|---|---|
| Dawn Levy (W) | 73 → **79** ✓ | 68 → **63** ▲ | 62 → **37** ✓ | 85 → 83 ▲ | 65 → 64 ▲ | 56 → 50 ▲ |
| Tidal Grimoire (U) | 50 → **55** ▼ | 49 → **44** ▼ | 46 → **32** ✓ | 63 → 65 ▼ | 52 → 50 ✓ | 46 → 44 ✓ |
| Pallid Court (B) | 62 → **66** ✓ | 60 → **53** ✓ | 57 → **36** ✓ | 73 → 72 ✓ | 49 → 51 ✓ | 39 → 33 ✓ |
| Ember Warband (R) | 62 → **77** ✓ | 54 → **49** ✓ | 49 → **28** ▼ | 72 → 74 ✓ | 49 → 46 ✓ | 39 → 30 ✓ |
| Verdant Trail (G) | 63 → **72** ✓ | 56 → **55** ▲ | 56 → **32** ✓ | 64 → 66 ✓ | 43 → 45 ✓ | 40 → 32 ✓ |
| in band (of 5) | 4 | 2 | 4 | 3 | 4 | 4 |

Per cell (the starter's win %, baseline → shifted):

| starter | Oriel T1 | Tessaly T1 | Edric T1 | Brann T1 | Hask T1 | Vael T2 | Kessa T2 | Maelin T2 | Brennor T2 | Pell T2 | Corvane T3 | Varro T3 | Sorrel T3 | Ysolde T3 | Quill T3 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Dawn Levy | 54→58 | 80→91 | 74→80 | 78→78 | 80→90 | 48→48 | 66→60 | 83→80 | 67→62 | 76→68 | 76→54 | 52→27 | 53→38 | 54→26 | 76→40 |
| Tidal Grimoire | 27→29 | 49→59 | 54→65 | 60→63 | 60→58 | 24→22 | 52→40 | 66→62 | 41→40 | 60→55 | 62→48 | 47→26 | 40→32 | 27→14 | 56→40 |
| Pallid Court | 40→46 | 74→79 | 40→44 | 74→72 | 82→86 | 20→18 | 64→62 | 73→65 | 76→64 | 68→55 | 68→46 | 58→29 | 52→40 | 52→30 | 54→37 |
| Ember Warband | 44→64 | 72→80 | 49→71 | 70→85 | 72→85 | 32→32 | 66→58 | 65→54 | 46→42 | 64→60 | 54→34 | 50→21 | 54→38 | 33→17 | 54→29 |
| Verdant Trail | 45→60 | 78→84 | 54→62 | 68→77 | 68→80 | 31→38 | 63→63 | 60→61 | 54→50 | 72→64 | 66→34 | 54→32 | 54→33 | 47→23 | 62→36 |

| starter | Grizzly T1 | Recluse T1 | Man-o'-War T1 | Tactician T1 | Rats T1 | Ogre T1 | Lion T1 | Warband T2 | Nighthawk T2 | Gale T2 | Baloth T2 | Siege-Gang T3 | Specter T3 | Serra T3 | Wurm T3 | Formation T3 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Dawn Levy | 87→88 | 77→77 | 94→91 | 92→94 | 86→84 | 84→80 | 71→69 | 64→62 | 43→46 | 88→86 | 63→62 | 49→50 | 82→76 | 28→20 | 54→46 | 68→61 |
| Tidal Grimoire | 80→74 | 60→56 | 67→72 | 70→79 | 68→66 | 66→72 | 28→34 | 40→40 | 24→22 | 78→74 | 64→62 | 51→46 | 67→74 | 20→15 | 38→35 | 54→50 |
| Pallid Court | 80→79 | 76→76 | 78→82 | 70→70 | 80→80 | 82→79 | 43→42 | 57→58 | 6→14 | 58→61 | 74→74 | 40→31 | 68→68 | 15→10 | 44→32 | 28→24 |
| Ember Warband | 68→76 | 74→78 | 86→82 | 81→79 | 70→72 | 84→78 | 44→53 | 54→48 | 22→20 | 84→83 | 36→34 | 34→26 | 66→62 | 16→10 | 38→27 | 41→27 |
| Verdant Trail | 64→70 | 44→52 | 70→75 | 78→80 | 59→64 | 82→83 | 48→42 | 50→57 | 17→17 | 67→68 | 37→38 | 49→43 | 56→48 | 28→20 | 30→22 | 38→28 |

The reads:
- **Chris's read holds**: 21 of 30 tier aggregates land in band, and every miss but two is one pattern — Dawn Levy punches above (T2 mages 63; all three beast tiers high) and Tidal Grimoire below (T1 mages 55, T2 mages 44, T1 beasts 65). Black, red and green are in band at every group except red's tier-3 mages at 28, just under. Chris's reading of the cause: tricky play with instants and counters is harder to build a good AI for than executing a weenie deck in a 10–20-life format — the white/blue split is the AI's, not only the lists'.
- **The tier-3 lever is large and real**: +2 life and one basic moved the tier-3 mage aggregate −14 to −25 for every starter, against a measured noise floor of ±4 (the unshifted beast groups: mean Δ +1.0, sd 4.5 over 35 cells; max |Δ| 9). The tier-2 shift of +2 life alone moved −1 to −7, mostly inside the noise — life alone is the weak lever, the basic the strong one (the S33 matrix's conclusion from this side).
- **The tier-1 shift worked the wanted way** (+4 to +15 for the starters); Oriel remains the wall even at 6 life (29–64 for the starters), Vael at 12 (18–48) — the two mages a tier shift does not reach: list problems.
- Per cell, the mages moved from 18 to 26 of 75 cells in band; the beasts stayed at 26 of 80 (only tier 3 was shifted there; the tier-1 beasts sit above every starter's band, as in the baseline).
- **The two starters that miss, miss in opposite directions by about the same amount** — a tier shift that brings blue into band pushes white further out. The next tests belong on the deck side: Dawn Levy and Tidal Grimoire list variations, run against the same roster with the Lab's custom decks (edit a copy → save → rows), the baseline overlaid. Chris and the planner to scope them.

**The roster mode (the Lab).** A second mode beside the pairing grid: rows = any set of decks (the five starters by default; roads, custom decks and the slice decks may join), at their world defaults or one override for life / basics / AI; columns = every mage and/or every beast at THEIR defaults (a checkbox each); N games per cell; the grid shows the row's win rate per cell shaded by the column's tier band (three editable bands), a rows'-mean line, and a per-row aggregate table by group — T1/T2/T3 mages, T1/T2/T3 beasts, all mages, all beasts, everyone — each a number with n and a bar (0–100, the tick at 50, the band in green); click a cell for the play/draw split, margins and turns. Saves and loads as a run like the grid (the setup is kept, so a re-run after a list change is one click).

**The differential (Chris, same day).** A Shifts panel beside Columns: for each of the six enemy groups (the three tiers of mages, the three tiers of beasts) a shift in life and in entrance basics, added to every column's world default. With "run a second sweep" on, the roster runs twice — the baseline at the defaults, then every cell again with the shifts — and each cell carries two values: the baseline win rate on top and the shifted sweep's Δ beneath (▲ marks a shifted column; the rows'-mean line carries the mean Δ). **The second sweep uses fresh seeds by default**, so the UNshifted cells show the Monte Carlo noise floor and an effect size can be read against it (the sim is deterministic per seed — paired seeds would make every unshifted Δ exactly zero; a "paired" toggle gives that low-variance comparison when wanted). The noise floor for a Δ at N games (the standard error of a difference of two proportions near 50%) is printed and Δs beyond it are coloured — blue when the row wins more, red when less. The aggregate table shows "baseline → shifted Δ" per group with the shifted mean as a dark marker on the bar; the band is now an outlined box in a higher-contrast green. Verified live: tier-3 mages at +4 life / +2 basics, 5 × 15 × 4 × 2 sweeps — the T3 aggregate moved −5 for Dawn Levy while the unshifted tiers showed +15 / +20 of noise at four games per cell (the floor there is ±35).

## Deviations from the brief

None. Nothing moved; the two findings below (Concerns 4–5) are reported, not changed — this being a measuring session.

## Concerns

1. **The matrix (100 games per cell, both seats; the mage at its tier's profile; the references at 12 life with a basic in play, journeyman; the read is the REFERENCE's win rate):**

## 8a. The matrix — tier 3 mages at life {12, 16, 20} × entrance {0, 1, 2 basics} vs the mid-road references (the mage at master; the references at 12 / journeyman with a basic in play)

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S31 |
|---|---|---|---|---|---|---|---|
| T3×road | Lord Corvane (corvane) @12/0 | road-mid-W | 10% | 90% | 0 | 11.3 | — |
| T3×road | Lord Corvane (corvane) @12/0 | road-mid-B | 12% (8% by library) | 88% | 0 | 16.6 | — |
| T3×road | Lord Corvane (corvane) @12/1 | road-mid-W | 15% | 85% | 0 | 11.8 | — |
| T3×road | Lord Corvane (corvane) @12/1 | road-mid-B | 26% | 74% | 0 | 17.9 | — |
| T3×road | Lord Corvane (corvane) @12/2 | road-mid-W | 30% | 70% | 0 | 12.9 | — |
| T3×road | Lord Corvane (corvane) @12/2 | road-mid-B | 26% | 74% (1% by library) | 0 | 18.2 | — |
| T3×road | Lord Corvane (corvane) @16/0 | road-mid-W | 11% | 89% | 0 | 12.7 | — |
| T3×road | Lord Corvane (corvane) @16/0 | road-mid-B | 14% (7% by library) | 86% | 0 | 19.7 | — |
| T3×road | Lord Corvane (corvane) @16/1 | road-mid-W | 23% | 77% | 0 | 13.2 | — |
| T3×road | Lord Corvane (corvane) @16/1 | road-mid-B | 32% (3% by library) | 68% | 0 | 21.2 | — |
| T3×road | Lord Corvane (corvane) @16/2 | road-mid-W | 39% | 61% | 0 | 14.0 | — |
| T3×road | Lord Corvane (corvane) @16/2 | road-mid-B | 36% (3% by library) | 64% (2% by library) | 0 | 21.5 | — |
| T3×road | Lord Corvane (corvane) @20/0 | road-mid-W | 13% | 87% | 0 | 13.9 | — |
| T3×road | Lord Corvane (corvane) @20/0 | road-mid-B | 21% (5% by library) | 79% | 0 | 22.4 | — |
| T3×road | Lord Corvane (corvane) @20/1 | road-mid-W | 27% | 73% | 0 | 14.1 | — |
| T3×road | Lord Corvane (corvane) @20/1 | road-mid-B | 37% (8% by library) | 63% | 0 | 23.3 | — |
| T3×road | Lord Corvane (corvane) @20/2 | road-mid-W | 43% | 57% | 0 | 14.8 | — |
| T3×road | Lord Corvane (corvane) @20/2 | road-mid-B | 39% (3% by library) | 61% (2% by library) | 0 | 22.8 | — |
| T3×road | Varro Flamebrand (varro) @12/0 | road-mid-W | 18% (39% by library) | 82% | 0 | 13.4 | — |
| T3×road | Varro Flamebrand (varro) @12/0 | road-mid-B | 14% (50% by library) | 86% | 0 | 15.8 | — |
| T3×road | Varro Flamebrand (varro) @12/1 | road-mid-W | 24% (33% by library) | 76% | 0 | 15.3 | — |
| T3×road | Varro Flamebrand (varro) @12/1 | road-mid-B | 26% (19% by library) | 74% | 0 | 16.9 | — |
| T3×road | Varro Flamebrand (varro) @12/2 | road-mid-W | 36% (19% by library) | 64% | 0 | 14.8 | — |
| T3×road | Varro Flamebrand (varro) @12/2 | road-mid-B | 29% (24% by library) | 71% | 0 | 16.5 | — |
| T3×road | Varro Flamebrand (varro) @16/0 | road-mid-W | 22% (45% by library) | 78% | 0 | 15.4 | — |
| T3×road | Varro Flamebrand (varro) @16/0 | road-mid-B | 19% (53% by library) | 81% | 0 | 18.4 | — |
| T3×road | Varro Flamebrand (varro) @16/1 | road-mid-W | 27% (33% by library) | 73% | 0 | 17.0 | — |
| T3×road | Varro Flamebrand (varro) @16/1 | road-mid-B | 31% (29% by library) | 69% | 0 | 18.5 | — |
| T3×road | Varro Flamebrand (varro) @16/2 | road-mid-W | 42% (21% by library) | 58% | 0 | 15.8 | — |
| T3×road | Varro Flamebrand (varro) @16/2 | road-mid-B | 36% (33% by library) | 64% | 0 | 18.0 | — |
| T3×road | Varro Flamebrand (varro) @20/0 | road-mid-W | 28% (39% by library) | 72% | 0 | 17.1 | — |
| T3×road | Varro Flamebrand (varro) @20/0 | road-mid-B | 24% (50% by library) | 76% | 0 | 20.6 | — |
| T3×road | Varro Flamebrand (varro) @20/1 | road-mid-W | 35% (31% by library) | 65% | 0 | 18.0 | — |
| T3×road | Varro Flamebrand (varro) @20/1 | road-mid-B | 33% (33% by library) | 67% | 0 | 19.9 | — |
| T3×road | Varro Flamebrand (varro) @20/2 | road-mid-W | 45% (27% by library) | 55% | 0 | 16.4 | — |
| T3×road | Varro Flamebrand (varro) @20/2 | road-mid-B | 44% (43% by library) | 56% | 0 | 19.7 | — |
| T3×road | High Warden Sorrel (sorrel) @12/0 | road-mid-W | 12% | 88% | 0 | 13.3 | — |
| T3×road | High Warden Sorrel (sorrel) @12/0 | road-mid-B | 14% | 86% | 0 | 16.8 | — |
| T3×road | High Warden Sorrel (sorrel) @12/1 | road-mid-W | 19% | 81% | 0 | 15.2 | — |
| T3×road | High Warden Sorrel (sorrel) @12/1 | road-mid-B | 33% | 67% | 0 | 17.5 | — |
| T3×road | High Warden Sorrel (sorrel) @12/2 | road-mid-W | 30% | 70% | 0 | 14.9 | — |
| T3×road | High Warden Sorrel (sorrel) @12/2 | road-mid-B | 37% | 63% | 0 | 16.6 | — |
| T3×road | High Warden Sorrel (sorrel) @16/0 | road-mid-W | 13% | 87% | 0 | 15.4 | — |
| T3×road | High Warden Sorrel (sorrel) @16/0 | road-mid-B | 21% | 79% | 0 | 20.5 | — |
| T3×road | High Warden Sorrel (sorrel) @16/1 | road-mid-W | 25% | 75% | 0 | 16.6 | — |
| T3×road | High Warden Sorrel (sorrel) @16/1 | road-mid-B | 39% | 61% | 0 | 18.8 | — |
| T3×road | High Warden Sorrel (sorrel) @16/2 | road-mid-W | 34% | 66% | 0 | 16.1 | — |
| T3×road | High Warden Sorrel (sorrel) @16/2 | road-mid-B | 41% | 59% | 0 | 18.2 | — |
| T3×road | High Warden Sorrel (sorrel) @20/0 | road-mid-W | 16% | 84% | 0 | 17.0 | — |
| T3×road | High Warden Sorrel (sorrel) @20/0 | road-mid-B | 24% (4% by library) | 76% | 0 | 22.4 | — |
| T3×road | High Warden Sorrel (sorrel) @20/1 | road-mid-W | 27% | 73% | 0 | 18.1 | — |
| T3×road | High Warden Sorrel (sorrel) @20/1 | road-mid-B | 42% | 58% | 0 | 20.9 | — |
| T3×road | High Warden Sorrel (sorrel) @20/2 | road-mid-W | 39% | 61% | 0 | 17.0 | — |
| T3×road | High Warden Sorrel (sorrel) @20/2 | road-mid-B | 41% | 59% | 0 | 19.6 | — |
| T3×road | Thornmother Ysolde (ysolde) @12/0 | road-mid-W | 20% | 80% | 0 | 11.3 | — |
| T3×road | Thornmother Ysolde (ysolde) @12/0 | road-mid-B | 22% | 78% | 0 | 14.7 | — |
| T3×road | Thornmother Ysolde (ysolde) @12/1 | road-mid-W | 33% | 67% | 0 | 11.5 | — |
| T3×road | Thornmother Ysolde (ysolde) @12/1 | road-mid-B | 41% (2% by library) | 59% | 0 | 15.2 | — |
| T3×road | Thornmother Ysolde (ysolde) @12/2 | road-mid-W | 55% | 45% | 0 | 11.0 | — |
| T3×road | Thornmother Ysolde (ysolde) @12/2 | road-mid-B | 55% (2% by library) | 45% | 0 | 14.3 | — |
| T3×road | Thornmother Ysolde (ysolde) @16/0 | road-mid-W | 32% | 68% | 0 | 12.4 | — |
| T3×road | Thornmother Ysolde (ysolde) @16/0 | road-mid-B | 36% (3% by library) | 64% | 0 | 16.7 | — |
| T3×road | Thornmother Ysolde (ysolde) @16/1 | road-mid-W | 45% | 55% | 0 | 12.5 | — |
| T3×road | Thornmother Ysolde (ysolde) @16/1 | road-mid-B | 50% (2% by library) | 50% | 0 | 16.3 | — |
| T3×road | Thornmother Ysolde (ysolde) @16/2 | road-mid-W | 60% | 40% | 0 | 11.7 | — |
| T3×road | Thornmother Ysolde (ysolde) @16/2 | road-mid-B | 61% (2% by library) | 39% | 0 | 15.2 | — |
| T3×road | Thornmother Ysolde (ysolde) @20/0 | road-mid-W | 43% | 57% | 0 | 13.3 | — |
| T3×road | Thornmother Ysolde (ysolde) @20/0 | road-mid-B | 41% (2% by library) | 59% | 0 | 18.0 | — |
| T3×road | Thornmother Ysolde (ysolde) @20/1 | road-mid-W | 53% | 47% | 0 | 13.1 | — |
| T3×road | Thornmother Ysolde (ysolde) @20/1 | road-mid-B | 56% (2% by library) | 44% | 0 | 17.3 | — |
| T3×road | Thornmother Ysolde (ysolde) @20/2 | road-mid-W | 67% | 33% | 0 | 12.1 | — |
| T3×road | Thornmother Ysolde (ysolde) @20/2 | road-mid-B | 63% (2% by library) | 37% | 0 | 15.8 | — |
| T3×road | Magister Quill (quill) @12/0 | road-mid-W | 8% (25% by library) | 92% | 0 | 10.3 | — |
| T3×road | Magister Quill (quill) @12/0 | road-mid-B | 18% (39% by library) | 82% | 0 | 14.4 | — |
| T3×road | Magister Quill (quill) @12/1 | road-mid-W | 29% (34% by library) | 71% | 0 | 11.3 | — |
| T3×road | Magister Quill (quill) @12/1 | road-mid-B | 22% (64% by library) | 78% | 0 | 14.6 | — |
| T3×road | Magister Quill (quill) @12/2 | road-mid-W | 43% (40% by library) | 57% | 0 | 12.1 | — |
| T3×road | Magister Quill (quill) @12/2 | road-mid-B | 35% (51% by library) | 65% | 0 | 16.0 | — |
| T3×road | Magister Quill (quill) @16/0 | road-mid-W | 14% (29% by library) | 86% | 0 | 11.8 | — |
| T3×road | Magister Quill (quill) @16/0 | road-mid-B | 27% (52% by library) | 73% | 0 | 16.2 | — |
| T3×road | Magister Quill (quill) @16/1 | road-mid-W | 35% (31% by library) | 65% | 0 | 12.3 | — |
| T3×road | Magister Quill (quill) @16/1 | road-mid-B | 31% (58% by library) | 69% | 0 | 16.8 | — |
| T3×road | Magister Quill (quill) @16/2 | road-mid-W | 50% (36% by library) | 50% | 0 | 12.7 | — |
| T3×road | Magister Quill (quill) @16/2 | road-mid-B | 40% (58% by library) | 60% | 0 | 17.6 | — |
| T3×road | Magister Quill (quill) @20/0 | road-mid-W | 18% (39% by library) | 82% | 0 | 12.9 | — |
| T3×road | Magister Quill (quill) @20/0 | road-mid-B | 30% (53% by library) | 70% | 0 | 17.9 | — |
| T3×road | Magister Quill (quill) @20/1 | road-mid-W | 46% (35% by library) | 54% | 0 | 13.3 | — |
| T3×road | Magister Quill (quill) @20/1 | road-mid-B | 35% (60% by library) | 65% | 0 | 18.4 | — |
| T3×road | Magister Quill (quill) @20/2 | road-mid-W | 57% (35% by library) | 43% | 0 | 13.3 | — |
| T3×road | Magister Quill (quill) @20/2 | road-mid-B | 47% (53% by library) | 53% | 0 | 19.0 | — |

### Aggregate — the references' win rate by life × entrance (tier 3; mean over 5 mages × 2 references)

| life \ basics | 0 | 1 | 2 |
|---|---|---|---|
| 12 | 85% (turns 13.8; by library 0%) | 73% (turns 14.7; by library 0%) | 62% (turns 14.7; by library 0%) |
| 16 | 79% (turns 15.9; by library 0%) | 66% (turns 16.3; by library 0%) | 56% (turns 16.1; by library 0%) |
| 20 | 74% (turns 17.5; by library 0%) | 61% (turns 17.6; by library 0%) | 52% (turns 17.1; by library 0%) |

### Per mage — the references' win rate by cell (tier 3; mean over both references)

| mage | 12/0 | 12/1 | 12/2 | 16/0 | 16/1 | 16/2 | 20/0 | 20/1 | 20/2 |
|---|---|---|---|---|---|---|---|---|---|
| Lord Corvane | 89% | 80% | 72% | 88% | 73% | 63% | 83% | 68% | 59% |
| Varro Flamebrand | 84% | 75% | 68% | 80% | 71% | 61% | 74% | 66% | 56% |
| High Warden Sorrel | 87% | 74% | 67% | 83% | 68% | 63% | 80% | 66% | 60% |
| Thornmother Ysolde | 79% | 63% | 45% | 66% | 53% | 40% | 58% | 46% | 35% |
| Magister Quill | 87% | 75% | 61% | 80% | 67% | 55% | 76% | 60% | 48% |

## 8b. The matrix — tier 2 mages at life {10, 12, 14} × entrance {0, 1 basics} vs the mid-road references (the mage at journeyman; the references at 12 / journeyman with a basic in play)

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S31 |
|---|---|---|---|---|---|---|---|
| T2×road | Mistress Vael (vael) @10/0 | road-mid-W | 20% | 80% | 0 | 15.7 | — |
| T2×road | Mistress Vael (vael) @10/0 | road-mid-B | 61% (26% by library) | 39% | 0 | 30.7 | — |
| T2×road | Mistress Vael (vael) @10/1 | road-mid-W | 31% | 69% | 0 | 16.3 | — |
| T2×road | Mistress Vael (vael) @10/1 | road-mid-B | 63% (19% by library) | 37% | 0 | 29.5 | — |
| T2×road | Mistress Vael (vael) @12/0 | road-mid-W | 25% | 75% | 0 | 17.0 | — |
| T2×road | Mistress Vael (vael) @12/0 | road-mid-B | 65% (29% by library) | 35% | 0 | 32.1 | — |
| T2×road | Mistress Vael (vael) @12/1 | road-mid-W | 34% | 66% | 0 | 17.2 | — |
| T2×road | Mistress Vael (vael) @12/1 | road-mid-B | 65% (18% by library) | 35% | 0 | 29.9 | — |
| T2×road | Mistress Vael (vael) @14/0 | road-mid-W | 31% | 69% | 0 | 19.0 | — |
| T2×road | Mistress Vael (vael) @14/0 | road-mid-B | 69% (35% by library) | 31% | 0 | 34.6 | — |
| T2×road | Mistress Vael (vael) @14/1 | road-mid-W | 39% | 61% | 0 | 17.9 | — |
| T2×road | Mistress Vael (vael) @14/1 | road-mid-B | 69% (22% by library) | 31% | 0 | 31.7 | — |
| T2×road | Kessa Emberhand (kessa) @10/0 | road-mid-W | 7% | 93% | 0 | 12.7 | — |
| T2×road | Kessa Emberhand (kessa) @10/0 | road-mid-B | 9% | 91% | 0 | 16.9 | — |
| T2×road | Kessa Emberhand (kessa) @10/1 | road-mid-W | 21% | 79% | 0 | 13.7 | — |
| T2×road | Kessa Emberhand (kessa) @10/1 | road-mid-B | 16% | 84% | 0 | 17.7 | — |
| T2×road | Kessa Emberhand (kessa) @12/0 | road-mid-W | 11% | 89% | 0 | 13.5 | — |
| T2×road | Kessa Emberhand (kessa) @12/0 | road-mid-B | 12% | 88% | 0 | 18.7 | — |
| T2×road | Kessa Emberhand (kessa) @12/1 | road-mid-W | 24% | 76% | 0 | 14.5 | — |
| T2×road | Kessa Emberhand (kessa) @12/1 | road-mid-B | 17% | 83% | 0 | 19.6 | — |
| T2×road | Kessa Emberhand (kessa) @14/0 | road-mid-W | 14% | 86% | 0 | 14.6 | — |
| T2×road | Kessa Emberhand (kessa) @14/0 | road-mid-B | 14% | 86% | 0 | 20.4 | — |
| T2×road | Kessa Emberhand (kessa) @14/1 | road-mid-W | 27% | 73% | 0 | 14.9 | — |
| T2×road | Kessa Emberhand (kessa) @14/1 | road-mid-B | 19% | 81% | 0 | 20.9 | — |
| T2×road | Adept Maelin (maelin) @10/0 | road-mid-W | 6% | 94% | 0 | 10.0 | — |
| T2×road | Adept Maelin (maelin) @10/0 | road-mid-B | 16% (13% by library) | 84% | 0 | 16.0 | — |
| T2×road | Adept Maelin (maelin) @10/1 | road-mid-W | 11% | 89% | 0 | 10.9 | — |
| T2×road | Adept Maelin (maelin) @10/1 | road-mid-B | 27% (11% by library) | 73% | 0 | 17.8 | — |
| T2×road | Adept Maelin (maelin) @12/0 | road-mid-W | 8% | 92% | 0 | 10.7 | — |
| T2×road | Adept Maelin (maelin) @12/0 | road-mid-B | 20% (10% by library) | 80% | 0 | 17.9 | — |
| T2×road | Adept Maelin (maelin) @12/1 | road-mid-W | 13% | 87% | 0 | 11.8 | — |
| T2×road | Adept Maelin (maelin) @12/1 | road-mid-B | 34% (15% by library) | 66% | 0 | 20.1 | — |
| T2×road | Adept Maelin (maelin) @14/0 | road-mid-W | 10% | 90% | 0 | 11.8 | — |
| T2×road | Adept Maelin (maelin) @14/0 | road-mid-B | 21% (10% by library) | 79% | 0 | 19.2 | — |
| T2×road | Adept Maelin (maelin) @14/1 | road-mid-W | 21% | 79% | 0 | 12.5 | — |
| T2×road | Adept Maelin (maelin) @14/1 | road-mid-B | 37% (11% by library) | 63% | 0 | 21.4 | — |
| T2×road | Brennor of the Glade (brennor) @10/0 | road-mid-W | 16% | 84% | 0 | 11.1 | — |
| T2×road | Brennor of the Glade (brennor) @10/0 | road-mid-B | 21% (24% by library) | 79% | 0 | 20.2 | — |
| T2×road | Brennor of the Glade (brennor) @10/1 | road-mid-W | 22% | 78% | 0 | 11.8 | — |
| T2×road | Brennor of the Glade (brennor) @10/1 | road-mid-B | 23% (4% by library) | 77% | 0 | 18.7 | — |
| T2×road | Brennor of the Glade (brennor) @12/0 | road-mid-W | 18% | 82% | 0 | 11.7 | — |
| T2×road | Brennor of the Glade (brennor) @12/0 | road-mid-B | 22% (18% by library) | 78% | 0 | 21.0 | — |
| T2×road | Brennor of the Glade (brennor) @12/1 | road-mid-W | 31% | 69% | 0 | 12.3 | — |
| T2×road | Brennor of the Glade (brennor) @12/1 | road-mid-B | 24% (4% by library) | 76% | 0 | 19.8 | — |
| T2×road | Brennor of the Glade (brennor) @14/0 | road-mid-W | 24% | 76% | 0 | 12.2 | — |
| T2×road | Brennor of the Glade (brennor) @14/0 | road-mid-B | 22% (18% by library) | 78% | 0 | 22.1 | — |
| T2×road | Brennor of the Glade (brennor) @14/1 | road-mid-W | 35% | 65% | 0 | 12.7 | — |
| T2×road | Brennor of the Glade (brennor) @14/1 | road-mid-B | 25% (4% by library) | 75% | 0 | 20.8 | — |
| T2×road | Pell of the Shallows (pell) @10/0 | road-mid-W | 6% (100% by library) | 94% | 0 | 9.6 | — |
| T2×road | Pell of the Shallows (pell) @10/0 | road-mid-B | 7% (100% by library) | 93% | 0 | 12.0 | — |
| T2×road | Pell of the Shallows (pell) @10/1 | road-mid-W | 17% (53% by library) | 83% | 0 | 10.6 | — |
| T2×road | Pell of the Shallows (pell) @10/1 | road-mid-B | 21% (90% by library) | 79% | 0 | 14.3 | — |
| T2×road | Pell of the Shallows (pell) @12/0 | road-mid-W | 6% (100% by library) | 94% | 0 | 10.2 | — |
| T2×road | Pell of the Shallows (pell) @12/0 | road-mid-B | 12% (100% by library) | 88% | 0 | 13.2 | — |
| T2×road | Pell of the Shallows (pell) @12/1 | road-mid-W | 20% (60% by library) | 80% | 0 | 11.3 | — |
| T2×road | Pell of the Shallows (pell) @12/1 | road-mid-B | 28% (93% by library) | 72% | 0 | 15.4 | — |
| T2×road | Pell of the Shallows (pell) @14/0 | road-mid-W | 11% (82% by library) | 89% | 0 | 11.1 | — |
| T2×road | Pell of the Shallows (pell) @14/0 | road-mid-B | 15% (100% by library) | 85% | 0 | 14.2 | — |
| T2×road | Pell of the Shallows (pell) @14/1 | road-mid-W | 25% (60% by library) | 75% | 0 | 11.9 | — |
| T2×road | Pell of the Shallows (pell) @14/1 | road-mid-B | 32% (94% by library) | 68% | 0 | 16.0 | — |

### Aggregate — the references' win rate by life × entrance (tier 2; mean over 5 mages × 2 references)

| life \ basics | 0 | 1 |
|---|---|---|
| 10 | 83% (turns 15.5; by library 0%) | 75% (turns 16.1; by library 0%) |
| 12 | 80% (turns 16.6; by library 0%) | 71% (turns 17.2; by library 0%) |
| 14 | 77% (turns 17.9; by library 0%) | 67% (turns 18.1; by library 0%) |

### Per mage — the references' win rate by cell (tier 2; mean over both references)

| mage | 10/0 | 10/1 | 12/0 | 12/1 | 14/0 | 14/1 |
|---|---|---|---|---|---|---|
| Mistress Vael | 60% | 53% | 55% | 51% | 50% | 46% |
| Kessa Emberhand | 92% | 82% | 89% | 80% | 86% | 77% |
| Adept Maelin | 89% | 81% | 86% | 77% | 85% | 71% |
| Brennor of the Glade | 82% | 78% | 80% | 73% | 77% | 70% |
| Pell of the Shallows | 94% | 81% | 91% | 76% | 87% | 72% |

## 9. The tier-2/3 beasts vs the mid-road references at catalog life, +4 and +8 (no roots; the beast at its catalog profile)

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S31 |
|---|---|---|---|---|---|---|---|
| beast×road | The Cunning Tactician (beast:tactician) @+0 | road-mid-W | 2% | 98% | 0 | 10.1 | — |
| beast×road | The Cunning Tactician (beast:tactician) @+0 | road-mid-B | 15% | 85% | 0 | 13.2 | — |
| beast×road | The Cunning Tactician (beast:tactician) @+4 | road-mid-W | 4% | 96% | 0 | 11.8 | — |
| beast×road | The Cunning Tactician (beast:tactician) @+4 | road-mid-B | 22% | 78% (3% by library) | 0 | 16.4 | — |
| beast×road | The Cunning Tactician (beast:tactician) @+8 | road-mid-W | 8% | 92% | 0 | 13.0 | — |
| beast×road | The Cunning Tactician (beast:tactician) @+8 | road-mid-B | 25% | 75% (4% by library) | 0 | 18.6 | — |
| beast×road | The Boggart Warband (beast:warband) @+0 | road-mid-W | 14% | 86% | 0 | 9.2 | — |
| beast×road | The Boggart Warband (beast:warband) @+0 | road-mid-B | 27% | 73% | 0 | 11.6 | — |
| beast×road | The Boggart Warband (beast:warband) @+4 | road-mid-W | 29% | 71% | 0 | 10.6 | — |
| beast×road | The Boggart Warband (beast:warband) @+4 | road-mid-B | 36% | 64% | 0 | 13.8 | — |
| beast×road | The Boggart Warband (beast:warband) @+8 | road-mid-W | 39% | 61% | 0 | 11.4 | — |
| beast×road | The Boggart Warband (beast:warband) @+8 | road-mid-B | 41% | 59% | 0 | 15.2 | — |
| beast×road | A Vampire Nighthawk (beast:nighthawk) @+0 | road-mid-W | 27% | 73% | 0 | 13.5 | — |
| beast×road | A Vampire Nighthawk (beast:nighthawk) @+0 | road-mid-B | 62% | 38% (42% by library) | 0 | 26.3 | — |
| beast×road | A Vampire Nighthawk (beast:nighthawk) @+4 | road-mid-W | 38% | 62% | 0 | 14.7 | — |
| beast×road | A Vampire Nighthawk (beast:nighthawk) @+4 | road-mid-B | 67% | 33% (61% by library) | 0 | 29.4 | — |
| beast×road | A Vampire Nighthawk (beast:nighthawk) @+8 | road-mid-W | 45% | 55% | 0 | 15.9 | — |
| beast×road | A Vampire Nighthawk (beast:nighthawk) @+8 | road-mid-B | 68% | 32% (72% by library) | 0 | 30.7 | — |
| beast×road | The Living Gale (beast:gale) @+0 | road-mid-W | 6% | 94% | 0 | 11.0 | — |
| beast×road | The Living Gale (beast:gale) @+0 | road-mid-B | 26% | 74% | 0 | 15.0 | — |
| beast×road | The Living Gale (beast:gale) @+4 | road-mid-W | 15% | 85% | 0 | 12.9 | — |
| beast×road | The Living Gale (beast:gale) @+4 | road-mid-B | 36% | 64% | 0 | 17.5 | — |
| beast×road | The Living Gale (beast:gale) @+8 | road-mid-W | 21% | 79% | 0 | 14.5 | — |
| beast×road | The Living Gale (beast:gale) @+8 | road-mid-B | 47% | 53% (2% by library) | 0 | 19.3 | — |
| beast×road | The Siege-Gang (beast:siegegang) @+0 | road-mid-W | 20% | 80% | 0 | 10.6 | — |
| beast×road | The Siege-Gang (beast:siegegang) @+0 | road-mid-B | 31% | 69% | 0 | 14.2 | — |
| beast×road | The Siege-Gang (beast:siegegang) @+4 | road-mid-W | 33% | 67% | 0 | 11.7 | — |
| beast×road | The Siege-Gang (beast:siegegang) @+4 | road-mid-B | 39% | 61% | 0 | 16.4 | — |
| beast×road | The Siege-Gang (beast:siegegang) @+8 | road-mid-W | 39% | 61% | 0 | 12.6 | — |
| beast×road | The Siege-Gang (beast:siegegang) @+8 | road-mid-B | 49% | 51% | 0 | 18.1 | — |
| beast×road | The Hypnotic Specter (beast:specter) @+0 | road-mid-W | 5% | 95% | 0 | 12.0 | — |
| beast×road | The Hypnotic Specter (beast:specter) @+0 | road-mid-B | 14% | 86% (5% by library) | 0 | 13.9 | — |
| beast×road | The Hypnotic Specter (beast:specter) @+4 | road-mid-W | 10% | 90% | 0 | 13.4 | — |
| beast×road | The Hypnotic Specter (beast:specter) @+4 | road-mid-B | 16% | 84% (7% by library) | 0 | 15.8 | — |
| beast×road | The Hypnotic Specter (beast:specter) @+8 | road-mid-W | 14% | 86% | 0 | 14.6 | — |
| beast×road | The Hypnotic Specter (beast:specter) @+8 | road-mid-B | 17% | 83% (8% by library) | 0 | 17.7 | — |
| beast×road | The Serra Angel (beast:serra) @+0 | road-mid-W | 51% | 49% | 0 | 15.9 | — |
| beast×road | The Serra Angel (beast:serra) @+0 | road-mid-B | 68% | 32% (9% by library) | 0 | 21.1 | — |
| beast×road | The Serra Angel (beast:serra) @+4 | road-mid-W | 61% | 39% | 0 | 17.1 | — |
| beast×road | The Serra Angel (beast:serra) @+4 | road-mid-B | 76% | 24% (13% by library) | 0 | 22.1 | — |
| beast×road | The Serra Angel (beast:serra) @+8 | road-mid-W | 66% | 34% | 0 | 17.4 | — |
| beast×road | The Serra Angel (beast:serra) @+8 | road-mid-B | 78% | 22% (18% by library) | 0 | 22.7 | — |
| beast×road | A Rumbling Baloth (beast:baloth) @+0 | road-mid-W | 16% | 84% | 0 | 10.7 | — |
| beast×road | A Rumbling Baloth (beast:baloth) @+0 | road-mid-B | 11% | 89% (2% by library) | 0 | 15.0 | — |
| beast×road | A Rumbling Baloth (beast:baloth) @+4 | road-mid-W | 26% | 74% | 0 | 12.1 | — |
| beast×road | A Rumbling Baloth (beast:baloth) @+4 | road-mid-B | 12% | 88% (2% by library) | 0 | 18.3 | — |
| beast×road | A Rumbling Baloth (beast:baloth) @+8 | road-mid-W | 33% | 67% | 0 | 13.0 | — |
| beast×road | A Rumbling Baloth (beast:baloth) @+8 | road-mid-B | 17% | 83% (4% by library) | 0 | 20.9 | — |
| beast×road | The Faerie Formation (beast:formation) @+0 | road-mid-W | 18% | 82% (2% by library) | 0 | 12.8 | — |
| beast×road | The Faerie Formation (beast:formation) @+0 | road-mid-B | 47% | 53% (9% by library) | 0 | 18.2 | — |
| beast×road | The Faerie Formation (beast:formation) @+4 | road-mid-W | 28% | 72% (1% by library) | 0 | 14.9 | — |
| beast×road | The Faerie Formation (beast:formation) @+4 | road-mid-B | 59% | 41% (17% by library) | 0 | 20.2 | — |
| beast×road | The Faerie Formation (beast:formation) @+8 | road-mid-W | 37% | 63% (5% by library) | 0 | 16.1 | — |
| beast×road | The Faerie Formation (beast:formation) @+8 | road-mid-B | 67% | 33% (39% by library) | 0 | 22.1 | — |
| beast×road | The Pelakka Wurm (beast:wurm) @+0 | road-mid-W | 30% | 70% | 0 | 10.8 | — |
| beast×road | The Pelakka Wurm (beast:wurm) @+0 | road-mid-B | 41% | 59% | 0 | 14.4 | — |
| beast×road | The Pelakka Wurm (beast:wurm) @+4 | road-mid-W | 44% | 56% | 0 | 11.9 | — |
| beast×road | The Pelakka Wurm (beast:wurm) @+4 | road-mid-B | 54% | 46% | 0 | 16.5 | — |
| beast×road | The Pelakka Wurm (beast:wurm) @+8 | road-mid-W | 54% | 46% | 0 | 12.7 | — |
| beast×road | The Pelakka Wurm (beast:wurm) @+8 | road-mid-B | 68% | 32% | 0 | 18.9 | — |

### Aggregate — the references' win rate by life delta (mean over 10 beasts × 2 references): +0: 73% · +4: 65% · +8: 58%

   **The reads the planner asked for.**
   - **The entrance is the stronger lever.** Tier 3, averaged: one basic is worth about twelve points off the reference (85 → 73 at 12 life), two about twenty-two (85 → 62); four life is worth about six (85 → 79), eight about eleven (85 → 74). Turns lengthen with life (13.8 → 17.5) and barely with basics (13.8 → 14.7) — life makes the game longer, the roots make the mage's plan arrive.
   - **Where the 55–65 band sits (tier 3)**: **16 life + 2 basics = 56%**, **20 + 1 = 61%**, **12 + 2 = 62%**. Nearest above: 16 + 1 (66%), 12 + 1 (73%); nearest below: 20 + 2 (52%). Three cells qualify; 16/2 is the one where the mage plays its own game rather than a longer one.
   - **Corvane turns on the roots, not on life**: at no basics he is flat across life (89 / 88 / 83 — the reference's win rate) — a deck that dies to a plan, not a race; with two basics he moves (72 / 63 / 59). The Rituals plus two roots put Buried Alive on turn one and Zombify on turn two. He reaches the band only at 20/2 (59%); at 16/2 he is 63%. ADR-113's question — does the reanimator turn at 16 or 20 — is answered "at 20 with two roots, nearly at 16 with two". The archetype is not wrong for the tier; it is a two-root deck.
   - **Flat across life (list problems after all)**: Corvane at 0 basics (89 → 83) and Sorrel at 0 basics (87 → 80) — both black-red/white-black decks that lose to the road's curve before their plan; both move with basics (Sorrel 87 → 67 at 12/2). **Ysolde moves most** (79 → 58 across life; 45 → 35 with two basics — already past the band at 12/2: the aggro mage wants life, not roots). Quill and Varro sit in between (87 → 48, 84 → 56 at the corners).
   - **Tier 2 does not reach the band in the cells measured**: the best aggregate is 14/1 = 67%; Vael alone is inside it everywhere (60 → 46 — the lifegain deck beats the road already; 14/1 puts her BELOW the band), while Kessa, Maelin, Brennor and Pell sit 70–94. Two basics were not in the tier-2 grid; the tier-3 slope (−10 to −12 per basic) puts 14/2 near 57 and 12/2 near 61 — the cells to measure next (the sweep takes `--part 8` with the grid edited in one line).
   - **The beasts (part 9)**: aggregate 73% at catalog life, 65% at +4, 58% at +8 — the beasts do reach the band on life alone (+8), which the mages do not. Per beast: the Serra is past the band already (49 / 32 at +0 — the top of the bestiary is a real fight for a mid-road player); the Nighthawks and the Wurm reach it at +4 (62 / 33, 56 / 46); the Siege-Gang and the Warband at +8 (61 / 51, 61 / 59); the Specter and the Tactician are flat (95 → 86, 98 → 92 against the white road — plan decks that die to the curve; they would need something other than life); the Baloths and the Gale never get there against the black road.
   - **The white road is the harder reference everywhere** (the mage-side columns run 10–20 points worse against road-mid-W than road-mid-B) — the same weenie-over-40-cards read as the five roads.

2. **The implementer's read of the number.** Standard tier 3 = **16 life + 2 basics** (56%; the mage's own game, 16 turns); Hard one cell harder = 20 + 2 (52%); Easy one cell easier = 16 + 1 (66%) or 12 + 2 (62%). Tier 2 needs the two-basic cells measured before its number is picked; on the slope, Standard tier 2 ≈ 14 + 2 or 12 + 2. Beasts: +8 at Standard puts the aggregate at 58% with the plan beasts still folding and the Serra already past the band — the beasts may want per-beast deltas rather than a tier one (the Specter and the Tactician are the cases). Tier 1 stays 8 / none (the brief).
3. **Part 4 — the blue re-read.** Brainstorm per copy: Tessaly 0.33 (S31: 0.32), Kessa 0.25 (0.27), Pell 0.31 (0.28), Varro 0.35 (0.30), Quill 0.35 (0.28) — no material change from the window opening. Where it is cast now: their END step 8–28%, in response to their spell 29–49%, their turn elsewhere 2–6%, **our own turn 17–59%** — and of the own-turn casts, **56–92% are cast over the caster's OWN spell on the stack** (Concern 4). No blue deck's tier standing moved from the window alone; the S32 deltas were the Escort.
4. **The S28 window has a second defect**: the "in response" test is `view.stack.length > 0`, which is true right after we cast our own spell and get priority back — so Brainstorm (and the Escort's gate, which copies the rule) fires on our own turn over our own Crab. The fix is one clause (an opponent's item on the stack) plus a ladder run; not made this session. The S32 numbers carry it as the S31 numbers carried the first defect.
5. **`facts.returned` is not in the matrix tables** — part 8 reports win rates, turns and library wins per the brief; Corvane's return rates per cell would sharpen the "two-root deck" read (a two-line addition to `pairing()` if wanted).
6. **The white road as the harder reference** (read 1, last bullet) means a Standard cell picked on the aggregate is ~5 points easier against a black-road player and ~5 harder against a white-road one; if the dial wants a per-road term that is the legacy hook's sibling (Part 6).

## Part 6 — Scoping the matchup resolver (no build)

**How a duel's setup is resolved today.** (a) *Encounter duels* (`prepareDuel`, `packages/world/src/journey.ts`): the enemy's life is the catalog template's `worldLife` (`data/world/opponents.json`, per row — tier-1 8, tier-2 8–10, tier-3 12, the Heart's petals and lords by their own rows) plus situational terms (`lairResidentLifeBonus` for a lair resident; the Barrage's negative delta, floored at 1); the AI profile is the template's `difficulty` (apprentice / journeyman / master) through the `heuristic:<difficulty>` agent factory (`difficultyProfile` in the agents package); the ante is `knobs.anteCount`; the modifiers are the enemy's `startingLife` plus the PLAYER's manalinks (`manalinkModifiers(world)` — the player's roots; the enemy has none). (b) *Dungeon interiors* (`dungeonDuelSpec`): the same template life plus the empowerment clock (`dungeonEmpowermentTiers` by steps — life, a basic, a token, a card; lords read `lordEmpowermentTiers` and the global `lordGrowthLife`). (c) *Sieges* (`siegeDuelSpec`): template life, no bonus. (d) *The Corolla* (`petalDuelSpec` / `mirrorDuelSpec` / `heartDuelSpec`): the petals at their rows; the Heart at the `heartLife` knob — **the one place the difficulty mode sets an enemy's life today (35 / 40 / 45)** — with the five roots (`heartRootModifiers`) and the card in hand. (e) *The mode itself*: `world.difficulty` (easy / standard / hard) reaches duels only through the `DIFFICULTIES` knob bundle (`anteCount`, `lossLifePenalty`, `heartLife`, the empowerment tables, `lordGrowthLife`, prices) and the starters' variants (`starterDecklist`); **an enemy's tier life and profile do not read the mode anywhere.** (f) *The sweep*: `TIER_LIFE` / `TIER_PROFILE` in `mage-sweep-cli` (now `--tier-life`), independent of the catalog.

**The resolver.** `resolveMatchup(opponent: OpponentTemplate, mode: DifficultyName, legacy: Legacy | null, knobs: KnobValues) → { life: number; profile: Difficulty; entrance: string[]; ante: number }` in `packages/world/src/matchup.ts`:
- **Tables in the knobs registry** (the registry's per-mode bundles already exist): `tierLife: Record<1|2|3, number>` and `tierEntrance: Record<1|2|3, number>` (basics count) for mages, `beastLifeDelta: Record<1|2|3, number>` for beasts (no entrance — Part 1), each with an easy/standard/hard value in `DIFFICULTIES`; the registry renders them into `docs/knobs.md` as today.
- **life** = the table's cell for a mage (or the catalog `worldLife` + the beast delta for a beast, the lords/petals/Heart untouched), and the situational terms (lair bonus, empowerment, the Barrage) stay in their callers, applied to the resolver's result.
- **profile** = the template's `difficulty`, unchanged (ADR-103: the dial is not AI sophistication).
- **entrance** = N basics of the mage's colours by pip count (the sweep's `mageColorsByPips` moves into `sim/mage-decks` as data — a `primaryColors` per mage computed once — so world and sweep read the same order), emitted as `permanentOnBattlefield` modifiers for player 1 (the S33 fixture's path).
- **ante** = `knobs.anteCount` (already mode-bundled).
- **The legacy hook**: `legacyTerm(legacy, opponent) → { lifeDelta: number; entranceDelta: number }`, called inside the resolver, returning zeros today; phase two fills it ("the player holds N ministers / M powers → +X"), and a per-road term (Concern 6) is the same shape.

**What moves**: `prepareDuel`, `dungeonDuelSpec`, `siegeDuelSpec` call the resolver for the enemy's life/entrance/ante (the Corolla keeps `heartLife` and its roots); the catalog's `worldLife` stays as the beasts' base and the mages' rows become documentation (or are dropped from the mage rows — planner's call); the telegraph/parley gains the entrance line the planner writes; `docs/reference/enemies.md` renders per mode.

**Tests it needs**: the resolver's table lookup per mode and tier (a table test); a prepared encounter duel carrying the mage's two basics in colour order and the right life at each mode (the world.test pattern at line ~857, which already asserts `permanentOnBattlefield` modifiers on a dungeon spec); the replay byte-exact fixture (S33's, re-pointed at `prepareDuel`); the `enemies.md` sync test per mode; the existing `worldLife` pins re-based.

**What the sweep needs**: `--mode easy|standard|hard` reading the same tables through the resolver (replacing `--tier-life` and the CLI's `TIER_LIFE`), so a sweep row is "the catalog at this mode" and parts 1–9 can be run per mode without editing the CLI; the S33 baseline files keyed by mode.

## Registry entries added/changed

None (no words, no cards, no knobs). ADRs 112–115 in `docs/decision-updates/s33.md`. Sim: `mage-sweep` parts 8–9, `--tier-life`, `mageAt`/`beastAt`/`mageColorsByPips`, `pairing()` returns its numbers; `s33-entrance.test.ts`. Implementer-notes: S32–S33 lessons.

## Test status

Default tier **576 passed / 2 skipped** (56 files; +3 entrance tests). `pnpm typecheck` clean. No fuzz beyond the entrance path (the brief); the entrance replays byte-exact. No AI change, so no ladder run. Sweep: parts 8 (15,000 games) and 9 (6,000); part 4's 1,000-game read.

## Suggested next

1. **Chris / planner**: the number — tier 3 at 16/2 (Standard), 20/2 (Hard), 16/1 or 12/2 (Easy) from the table; tier 2's two-basic cells to measure first; the beasts' per-beast vs per-tier delta.
2. **Planner (S34)**: the resolver brief from Part 6; the S28 window's second defect (Concern 4 — one clause + a ladder run); Corvane's return rates per cell if the "two-root deck" read wants sharpening.
3. **Implementer smalls**: tier-2 cells at two basics (`--part 8` with the grid edited); `facts.returned` in the matrix rows.

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm typecheck
pnpm mage-sweep --games 100 --part 8      # the matrix (~12 min); --part 9 the beasts (~5 min); parts 1–7 as before, --tier-life 8,10,12
FUZZ_FULL=1 pnpm exec vitest run packages/sim/src/ladder-smoke.test.ts / pnpm ladder --games 100
pnpm reference / pnpm knobs:doc / pnpm art:fetch
pnpm viewer → /gallery · /play → any mage vs any mage
```
