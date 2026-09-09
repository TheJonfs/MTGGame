# Handoff — after Session 35 (2026-09-08)

## State of the world

**Cinquefoil v1 is live on Vercel; the deploy playtest continues. The tuning arc is closed.** Session 35 ratified the tier tables (ADR-117: mages 8/0 · 12/1 · 16/2 at Standard, beasts +0/+2/+4; the ⚠ is off), amended ADR-116, added the four row offsets (ADR-119: Ysolde −4, the Nighthawks −4, the Gale +4, the Serra −4 standing), let the lifegain walls stand (ADR-120; the Part 4 trims withdrawn), ran and saved **the baseline of record** (`analysis/runs/s35_standard_final.json` — the stock starters against the roster at the final Standard cells, 15,500 games on the final code), and fixed the apprentice's first land (Part 3: measured, not guessed — the softmax, not the mulligan; a class gate at every profile, pinned as book 51, both ladder gates green). Pool 194 (unchanged); `docs/knobs.md` and `docs/reference/` regenerated. The planner's next brief is phase two.

## Done this session

- **Part 0**: `docs/decision-updates/s35.md` — ADR-117 ratified, ADR-116 amended, ADR-119, ADR-120, filing notes. The ⚠ removed from the three knobs' descriptions and R-095.
- **Part 1**: the four offsets on the catalog rows (`worldLifeOffset`: `mage:ysolde` −4, `beast:nighthawk` −4, `beast:gale` +4, `beast:serra` −4); `pnpm knobs:doc && pnpm reference`; the mage rows' `worldLife` sync holds (the offset is a separate field); `enemies.md` shows the offset rows' cells per mode (Ysolde 10 / **12** / 16 with two basics; the Nighthawks 4 / **6** / 8; the Gale 14 / **16** / 18; the Serra 10 / **12** / 16); the Lab reads them (its mage/beast defaults add the row offset).
- **Part 2**: the baseline of record — `--mode standard --part 2/5/6`, 100 games both seats, **re-run in full on the final code** (the first pass had straddled the Part 3 fix: the three parts run as separate processes and the gate landed between them — the unchanged rows moving under identical seeds was the tell). Converted to `analysis/runs/s35_standard_final.json` (the Lab loads and compares it). Tables in Concern 1.
- **Part 3**: measured over 1,000 Oriel-apprentice openings against the five starters (a probe agent wrapping `chooseAction`): keeps on zero-landers 0 of 8, on one-landers 0 of 74 (the mulligan policy is innocent); on the first own main phase with a land in hand, **the land was dropped 753 of 1,000 times — 247 passes**, every one with the offered actions exactly {pass, playLand} (or two land drops and pass): the softmax at 1.2 over a small gap. **The fix**: when every candidate is a land drop or a pass, the pass is never a candidate — the single land is taken outright, a choice of lands goes to the softmax without the pass; any competing play leaves the whole choice to the softmax. At every profile. Re-measured: **1,000 of 1,000**. Book 51 pins it (all three profiles, forty draws each; a castable spell beside the land un-forces it; two lands offered never pass). The FUZZ_FULL ladder gate held and the vs-random ladder PASSES.
- One test re-based for the fix's side effect: the Channeler's chooseMode test counted only the human's nonland permanents when deciding whether the bounce mode should be offered — the predicate is any player's, and the AI (developing on schedule now) had a creature out at a seed where it used to have none. The test counts both boards.

## Deviations from the brief

None. (Part 2 was run twice; the second run is the record.)

## Concerns

1. **The baseline of record** (`analysis/runs/s35_standard_final.json`; the STARTER's win %, 100 games per pairing, both seats; mages at 8/0 · 12/1 · 16/2 with the row offsets, beasts at +0/+2/+4 with the row offsets; the starters stock at 10 / journeyman / no basics):

| tier means (the starters' win %) | mages S34 → **S35 final** | beasts S34 → **S35 final** |
|---|---|---|
| T1 | 59 → **57** | 72 → **69** |
| T2 | 36 → **36** | 44 → **44** |
| T3 | 21 → **22** | 34 → **34** |

| offset row (ADR-119) | Standard cell | white | blue | black | red | green | mean S34 → **S35** |
|---|---|---|---|---|---|---|---|
| Thornmother Ysolde | 16 − 4 = 12 life, 2 basics | 26 | 9 | 24 | 12 | 13 | 13 → **17** |
| A Vampire Nighthawk | 8 + 2 − 4 = 6 life | 50 | 31 | 13 | 38 | 27 | 18 → **32** |
| The Living Gale | 12 + 2 + 4 = 18 life | 67 | 59 | 37 | 52 | 54 | 68 → **54** |
| The Serra Angel | 12 + 4 − 4 = 12 life (unchanged) | 23 | 20 | 13 | 12 | 30 | 19 → **20** |

The 28 unchanged rows S34 → S35 (same seeds; the only code change is the land-drop gate): mean Δ -1.1, sd 3.9 over 140 cells.

**The starters against the mages at the final Standard cells (the STARTER's win %, 100 games each, both seats)**

| starter | Sister Oriel T1 | Tessaly Reed T1 | Pale Edric T1 | Brann the Scorched T1 | Old Hask T1 | Mistress Vael T2 | Kessa Emberhand T2 | Adept Maelin T2 | Brennor of the Glade T2 | Pell of the Shallows T2 | Lord Corvane T3 | Varro Flamebrand T3 | High Warden Sorrel T3 | Thornmother Ysolde T3 | Magister Quill T3 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Dawn Levy (W) | 48 | 84 | 75 | 70 | 81 | 37 | 44 | 59 | 49 | 40 | 33 | 30 | 20 | 26 | 37 |
| Tidal Grimoire (U) | 25 | 41 | 46 | 51 | 41 | 17 | 21 | 42 | 31 | 29 | 25 | 14 | 13 | 9 | 16 |
| Pallid Court (B) | 42 | 65 | 35 | 67 | 81 | 20 | 45 | 46 | 61 | 28 | 36 | 26 | 29 | 24 | 31 |
| Ember Warband (R) | 41 | 69 | 46 | 66 | 61 | 21 | 45 | 29 | 25 | 34 | 15 | 16 | 26 | 12 | 13 |
| Verdant Trail (G) | 45 | 79 | 45 | 66 | 65 | 29 | 42 | 44 | 35 | 30 | 15 | 26 | 24 | 13 | 19 |

**The starters against the beasts at the final Standard deltas and offsets**

| starter | A Grizzly Bear T1 | The Deadly Recluse T1 | A Bloom of Man-o'-War T1 | The Cunning Tactician T1 | A Plague of Rats T1 | A Gray Ogre T1 | A Savannah Lion T1 | The Boggart Warband T2 | A Vampire Nighthawk T2 | The Living Gale T2 | A Rumbling Baloth T2 | The Siege-Gang T3 | The Hypnotic Specter T3 | The Serra Angel T3 | The Pelakka Wurm T3 | The Faerie Formation T3 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Dawn Levy (W) | 86 | 70 | 92 | 83 | 83 | 79 | 64 | 51 | 50 | 67 | 57 | 33 | 72 | 23 | 37 | 50 |
| Tidal Grimoire (U) | 75 | 56 | 64 | 66 | 60 | 70 | 27 | 36 | 31 | 59 | 56 | 35 | 60 | 20 | 29 | 46 |
| Pallid Court (B) | 70 | 72 | 65 | 70 | 76 | 82 | 38 | 51 | 13 | 37 | 68 | 31 | 67 | 13 | 17 | 20 |
| Ember Warband (R) | 64 | 81 | 74 | 76 | 70 | 83 | 43 | 33 | 38 | 52 | 29 | 20 | 54 | 12 | 24 | 17 |
| Verdant Trail (G) | 71 | 56 | 68 | 80 | 66 | 83 | 46 | 44 | 27 | 54 | 33 | 33 | 50 | 30 | 18 | 30 |

   **The reads.**
   - **The tier means did not move from S34** (57 / 36 / 22 for the mages against 59 / 36 / 21; 69 / 44 / 34 for the beasts against 72 / 44 / 34) — the offsets touched four rows and the land-drop gate is worth about a point to the mages across the board (mean Δ −1.1 on the 140 unchanged cells; the apprentice's turn-one land was a fifth of Oriel's openings, so the tier-1 mean moved most, 59 → 57). The shape the arc set out to produce — high, even-ish, unfavourable — is now the ladder's shape from the stock starters' side: **57 / 36 / 22**.
   - **The offsets landed where ADR-119 aimed**: the Nighthawks from 18 to 32 for the starters (a wall softened to a hard fight; black still 13 — lifelink against a deck with no fliers), the Gale from 68 to 54 (the soft tier-2 beast brought to even), Ysolde from 13 to 17 (still the hardest tier-3 mage for a raw starter — an aggro master at 12 with two basics; her row is the one to watch in world play), the Serra 20 (unchanged, as ruled).
   - **The walls stand as ruled**: Oriel 40 → 41 (48 / 21 / 41 / 43 / 51), Vael 24 → 25 (37 / 15 / 20 / 28 / 26). ADR-120's reading — Chris's three wins over Oriel at Standard — is the human bound; the roster's number is the AI's.
   - **Tidal Grimoire is still the hard road at every tier** (T1 44, T2 27, T3 14 against the mages); Dawn Levy the gentle one (69 / 46 / 29). ADR-118 stands: both are the AI's blue and white, not the lists'.
2. **The land-drop gate is a class rule, not a temperature change** — nothing else in the softmax moved. If Chris sees other first-turn oddities from the apprentice (a one-drop not cast with the mana up), the same probe pattern (`scratchpad/first-land.mts`, documented in implementer-notes S35) measures them in two minutes before any policy edit.
3. **Two baselines now live in `analysis/runs/`**: `s34_standard.json` (pre-fix, pre-offsets) and `s35_standard_final.json` (the record). The Lab's "compare" overlays either; the S34 file is history, not a reference.
4. **Phase two will want the resolver's `legacyTerm`** filled (ministers/powers → the enemy's setup) and the per-road term beside it — both are zeros with the shape in place (R-095).

## Registry entries added/changed

R-095's row: the cells ratified, the four offsets named. No pool changes. ADRs 117 (ratified) / 116 (amended) / 119 / 120 in `docs/decision-updates/s35.md`. Knobs: descriptions only (the ⚠ off; `docs/knobs.md` regenerated). Catalog: four `worldLifeOffset` rows. Agents: `landOnlyCandidates` in `priorityChoice`; book 51. UI test: the Channeler's mode-availability count. Docs: implementer-notes S35 lessons; `enemies.md` regenerated.

## Test status

Default tier **583 passed / 2 skipped** (57 files; +1 book pin; the Channeler test's count corrected; docs in sync). `pnpm typecheck` clean. **The FUZZ_FULL ladder gate held and the 100/cell vs-random ladder PASSES** with the land-drop gate. Measurements: 1,000 apprentice openings before and after the fix; the baseline of record 15,500 games (run twice; the clean run is the file).

## Suggested next

1. **Planner**: phase two — the resolver's `legacyTerm` and the per-road term (R-095's hooks), the mage entrance's telegraph line if wanted (the parley speaks it; the rail does not), the Lumberjack's home.
2. **Chris**: world play at the ratified cells — Ysolde at 12/2 and the Nighthawks at 6 are the two rows the offsets moved most; the dev `/play` setup reproduces any cell for a hand-piloted read.
3. **Implementer smalls**: none outstanding from the brief.

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm typecheck
pnpm mage-sweep --games 100 [--mode easy|standard|hard] [--part 1..9] [--baseline none]
FUZZ_FULL=1 pnpm exec vitest run packages/sim/src/ladder-smoke.test.ts / pnpm ladder --games 100
pnpm reference / pnpm knobs:doc / pnpm art:fetch
pnpm viewer → /lab (the Matchup Lab) · /play (dev: the Lab's dials on a duel) · /gallery · /world
```
