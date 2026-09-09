# Handoff — after Session 34 (2026-09-08)

## State of the world

**Cinquefoil v1 is live on Vercel; the deploy playtest continues.** Session 34 — **the matchup resolver and the tier tables** — is built and wired: `resolveMatchup(opponent, knobs, legacy)` (R-095) turns a roaming template into a duel's life, profile, entrance and ante from three new knobs with easy/standard/hard bundles (`mageTierLife` 8/12/16, `mageTierEntrance` 0/1/2 basics in pip order, `beastTierLifeDelta` +0/+2/+4; the Serra's `worldLifeOffset` −4), called from `prepareDuel`, the siege and the dungeon minion path; the parley speaks the entrance; `pnpm mage-sweep --mode`, `enemies.md` and the Lab read the same tables. **The cells are encoded as drafted and are ⚠ provisional until ratified (Part 2).** The S28 window's second defect is fixed and gated. Part 3 is measured (tables below): tier 2's two-basic cells, the stock starters against the roster at the Standard cells (saved as `analysis/runs/s34_standard.json`). Part 4's trims are measured, not applied — they do not move the walls. Pool 194 (unchanged); `docs/reference/` and `docs/knobs.md` regenerated.

## Done this session

- **Part 0**: `docs/decision-updates/s34.md` — ADR-116/117/118, the second S28 erratum, the Lab-ledger rule, filing notes. **The window fix**: "in response" means an OPPONENT's item on the stack, in both gates (the cantrip window, the flash creature); pins 36 and 49 extended (our own spell on the stack on our turn is not a window); the FUZZ_FULL ladder gate held and the vs-random ladder PASSES.
- **Part 1 — the resolver** (`packages/world/src/matchup.ts`): tables in the knobs registry with the bundles; `worldLifeOffset` on the catalog row (validated); `primaryColors` on every mage row in `sim/mage-decks` (the pip order — sync-tested against the pool); `entranceFor` (one basic per colour in pip order, repeating for a mono mage); `legacyTerm()` zeros; `prepareDuel` / `siegeDuelSpec` / the dungeon MINION path resolve through it (guardians, lords, petals, the Heart untouched, as scoped); `PreparedDuel.enemy.entrance`; the world index exports it. The catalog's mage rows' `worldLife` regenerated to the Standard cell (T2 10 → 12, T3 12 → 16) and sync-tested. `pnpm mage-sweep --mode easy|standard|hard` replaces `--tier-life`; `enemies.md` shows life and entrance per mode for every roaming opponent; the Lab's roster columns take a mode selector and a saved run names its mode. Tests: the table lookup per mode and tier (mages, beasts, the Serra's offset); the entrance order (Corvane swamp then plains; Kessa mountain first; a mono mage repeats); `primaryColors` sync; the mage rows' sync; `prepareDuel` at each mode for Corvane (14/1, 16/2, 20/2 — life, entrance modifiers before the manalinks, master, the ante); the fuzz — every mage at every mode through `prepareDuel` with random pilots (45 duels), replays byte-exact. Two pins re-based (a mage duel's modifiers now carry the entrance; the Warband's life carries the tier delta).
- **Part 2**: the drafted cells encoded (T1 8/0 at every mode — the planner's 8, not Chris's 6). ⚠ For ratification.
- **Part 3**: sweep part 8 with tier 2's two-basic cells (27,000 games) and the stock-starter roster at the Standard cells (`--mode standard --part 2/5/6`, 15,500 games; converted to `analysis/runs/s34_standard.json` so the Lab loads and compares it). Tables in Concern 1.
- **Part 4**: the two trims MEASURED against the five starters (100 games each, both seats, at the Standard cells) without touching the lists — Concern 3.
- **Part 5**: the parley shows the entrance clause (the planner's two lines) from the resolver's cell at parley time; the telegraph names nothing.
- **Part 6**: part 8's rows print the mage's graveyard → battlefield returns per game (Corvane's engine per cell — Concern 4); the Lab's mode selector.

## Director round (Chris, 2026-09-08): the single match's dev setup

**`/play` in the dev server (and `?dev=1`) is the Lab's dials on a duel you pilot; production keeps the plain screen.** The many per-deck buttons collapse into the Lab's grouped picker (every mage, beast, starter, road deck, boss and the custom decks from the editor); each side has life, entrance basics, starting bonuses (in play / to hand / bonus cards / the law ring, "both seats" for a symmetric law) and, for the opponent, the AI profile; a mode selector loads the resolver's defaults (a mage's tier life and entrance, a boss's law and signature, a starter at 10) when a deck is picked; "edit a copy" opens the deck editor (save to `analysis/decks/`, use on either side); play/draw or a coin flip; a seed; zero ante. The match is built as a `CustomMatch` from the same `resolveSide` / `sideModifiers` the Lab's worker uses, so the duel you play is the duel the sweep measured. Rematch keeps the setup and seed. Files: `packages/ui/src/play/DevSetup.tsx`; the Lab's panels moved to `packages/ui/src/lab/lab-panels.tsx` (shared). Verified live: Dawn Levy (10) vs Lord Corvane at the Standard cell — turn one opens with Corvane at 16 and a Swamp and a Plains on his battlefield.

## Deviations from the brief

1. **The resolver takes the knobs, not a `mode` argument**: `resolveMatchup(opponent, knobs, legacy)`. Every caller already holds `worldKnobs(world)` with the bundle applied; a separate mode would have been a second source of truth for the same fact. `enemies.md` and the sweep resolve the three bundles explicitly.
2. **Part 4's trims are not applied.** The brief marks them ⚠ Chris and Chris framed this session as analysis before list changes; measured instead (Concern 3) — and they do not move the walls, so applying them would have been a change without an effect.
3. **The T1 cell is 8** (the planner's preference; Chris ran 6). The tables are data — a one-number edit in `knobs.ts` if the ruling goes the other way.
4. **`s34_standard.json` is converted from the sweep's output**, not run in the Lab: it carries every cell's win rate, games and mean turns but not the seat split or the margins (its notes say so). The Lab's own roster run at Standard reproduces it live in a few minutes.
5. **The Lab's standing description moved to `docs/implementer-notes.md`** ("The Matchup Lab (standing reference)") — the handoff is overwritten each session and the Lab is now infrastructure.

## Concerns

1. **Part 3 — the measurements.**

   **Tier 2 with the two-basic cells (the mid-road references' win rate; mean over the five mages × two references):**

### Aggregate — the references' win rate by life × entrance (tier 2; mean over 5 mages × 2 references)

| life \ basics | 0 | 1 | 2 |
|---|---|---|---|
| 10 | 83% (turns 15.5; by library 0%) | 75% (turns 16.1; by library 0%) | 66% (turns 16.4; by library 0%) |
| 12 | 80% (turns 16.6; by library 0%) | 70% (turns 17.2; by library 0%) | 64% (turns 17.2; by library 0%) |
| 14 | 77% (turns 17.9; by library 0%) | 67% (turns 18.1; by library 0%) | 61% (turns 18.1; by library 0%) |

### Per mage — the references' win rate by cell (tier 2; mean over both references)

| mage | 10/0 | 10/1 | 10/2 | 12/0 | 12/1 | 12/2 | 14/0 | 14/1 | 14/2 |
|---|---|---|---|---|---|---|---|---|---|
| Mistress Vael | 60% | 53% | 47% | 55% | 50% | 44% | 50% | 46% | 42% |
| Kessa Emberhand | 92% | 81% | 70% | 89% | 78% | 69% | 87% | 76% | 64% |
| Adept Maelin | 89% | 81% | 74% | 86% | 77% | 70% | 85% | 71% | 63% |
| Brennor of the Glade | 82% | 77% | 67% | 80% | 72% | 65% | 77% | 70% | 65% |
| Pell of the Shallows | 93% | 82% | 75% | 91% | 76% | 74% | 88% | 72% | 71% |

   **The stock starters (10 / journeyman / no basics) against the mages at the Standard cells (the STARTER's win %, 100 games each, both seats):**

| mage (Standard cell) | Dawn Levy | Tidal Grimoire | Pallid Court | Ember Warband | Verdant Trail | mean |
|---|---|---|---|---|---|---|
| Sister Oriel (T1, 8/0) | 45 | 25 | 41 | 40 | 48 | 40 |
| Tessaly Reed (T1) | 87 | 39 | 72 | 69 | 73 | 68 |
| Pale Edric (T1) | 76 | 52 | 35 | 45 | 55 | 53 |
| Brann the Scorched (T1) | 77 | 55 | 65 | 76 | 66 | 68 |
| Old Hask (T1) | 76 | 50 | 83 | 70 | 63 | 68 |
| Mistress Vael (T2, 12/1) | 35 | 15 | 20 | 24 | 26 | 24 |
| Kessa Emberhand (T2) | 36 | 27 | 45 | 41 | 39 | 38 |
| Adept Maelin (T2) | 60 | 40 | 45 | 35 | 40 | 44 |
| Brennor of the Glade (T2) | 50 | 29 | 62 | 26 | 37 | 41 |
| Pell of the Shallows (T2) | 47 | 30 | 33 | 32 | 35 | 35 |
| Lord Corvane (T3, 16/2) | 34 | 24 | 35 | 13 | 14 | 24 |
| Varro Flamebrand (T3) | 33 | 11 | 28 | 18 | 26 | 23 |
| High Warden Sorrel (T3) | 20 | 13 | 33 | 23 | 22 | 22 |
| Thornmother Ysolde (T3) | 18 | 9 | 19 | 6 | 12 | 13 |
| Magister Quill (T3) | 35 | 19 | 23 | 15 | 19 | 22 |
| **T1 mean** | 72 | 44 | 59 | 60 | 61 | **59** |
| **T2 mean** | 46 | 28 | 41 | 32 | 35 | **36** |
| **T3 mean** | 28 | 15 | 28 | 15 | 19 | **21** |

   **The stock starters against the beasts at the Standard deltas (+0 / +2 / +4; the Serra −4):**

| beast | Dawn Levy | Tidal Grimoire | Pallid Court | Ember Warband | Verdant Trail | mean |
|---|---|---|---|---|---|---|
| A Grizzly Bear (T1) | 90 | 77 | 71 | 71 | 73 | 76 |
| The Deadly Recluse (T1) | 70 | 59 | 73 | 82 | 54 | 68 |
| A Bloom of Man-o'-War (T1) | 92 | 66 | 74 | 81 | 75 | 78 |
| The Cunning Tactician (T1) | 88 | 75 | 69 | 79 | 79 | 78 |
| A Plague of Rats (T1) | 84 | 61 | 77 | 77 | 70 | 74 |
| A Gray Ogre (T1) | 89 | 73 | 78 | 79 | 84 | 81 |
| A Savannah Lion (T1) | 64 | 34 | 46 | 56 | 51 | 50 |
| The Boggart Warband (T2, +2) | 46 | 31 | 44 | 34 | 46 | 40 |
| A Vampire Nighthawk (T2, +2) | 36 | 21 | 9 | 11 | 12 | 18 |
| The Living Gale (T2, +2) | 82 | 69 | 51 | 73 | 67 | 68 |
| A Rumbling Baloth (T2, +2) | 56 | 59 | 69 | 30 | 31 | 49 |
| The Siege-Gang (T3, +4) | 32 | 35 | 28 | 21 | 33 | 30 |
| The Hypnotic Specter (T3, +4) | 70 | 63 | 64 | 58 | 45 | 60 |
| The Serra Angel (T3, +4 −4) | 21 | 20 | 14 | 16 | 25 | 19 |
| The Pelakka Wurm (T3, +4) | 34 | 29 | 20 | 21 | 22 | 25 |
| The Faerie Formation (T3, +4) | 53 | 53 | 22 | 18 | 30 | 35 |
| **T1 beasts mean** | 82 | 64 | 70 | 75 | 69 | **72** |
| **T2 beasts mean** | 55 | 45 | 43 | 37 | 39 | **44** |
| **T3 beasts mean** | 42 | 40 | 30 | 27 | 31 | **34** |

   **The reads.**
   - **Tier 2's shape, against the brief's test** ("12/1 above 75% for the mid-road references AND below 40% for the stock starters"): half met. The stock starters are at **36%** (below 40 ✓); the mid-road references at 12/1 read **70%** (not above 75; the S33 read was 71). The two-basic cells the S33 read lacked: **12/2 = 64%, 14/2 = 61%** — both inside the 55–65 band, where 12/1 sits above it. So tier 2 has two candidate Standards: **12/1** (mid-road 70, starters 36 — "beatable once upgraded, hard walked into early", the brief's wanted shape, with the mid-road a shade over the band) or **12/2** (mid-road 64 in band; the stock starters would land nearer 28 on the tier-3 slope — not measured for stock). The planner's call; the tables are one number each.
   - **Tier 3 at 16/2**: the stock starters win **21%** (ADR-116 asked for "unfavourable but winnable, roughly 25–40") — a shade under, and Ysolde (13) and Varro (11 for blue) are past winnable for the raw starter; Corvane at 16/2 is 24. The mid-road side is in band (56%, S33). If both bounds must hold, **16/1** (mid-road 66, S33; starters unmeasured, ~28 by the slope) or **14/2** (mid-road ~59 interpolated) are the neighbours. As drafted, Standard tier 3 punishes a raw starter a little harder than the ADR's words.
   - **Tier 1 at 8/0 is unchanged** (59% for the starters; 72 for white, 44 for blue — ADR-118's split).
   - **The beasts at the Standard deltas land where the bands point**: T1 72% (fodder, unchanged), **T2 44%** (the 45–55 band, a point under — the Nighthawks at 18 drag it; the Gale at 68 is the soft one), **T3 34%** (inside 30–45; the Serra 19 even at −4, the Specter 60 — the plan beast that life does not touch).
   - **Vael at 12/1 is a wall by the tier's own band**: 24% for the starters (15–35), and 44–60% for the mid-road references at every tier-2 cell (she is the only tier-2 mage already inside the band at 10/0). Oriel at 8/0: 40% (25–48) — the tier-1 wall stands. Neither is a tier problem (Concern 3).
2. **The tables are ⚠ provisional** — encoded as the brief drafted them so the world, the sweep, the docs and the Lab all read one source; changing a cell is one number in `knobs.ts` (plus `pnpm knobs:doc` / `pnpm reference`; the catalog's mage rows follow through the sync test — the S34 filing note says how).
3. **Part 4 — the trims do not move the walls.** Measured at the Standard cells against the five starters, 100 games each both seats:

| variant | starter:white | starter:blue | starter:black | starter:red | starter:green | mean |
|---|---|---|---|---|---|---|
| Oriel as shipped (T1, 8 life, 0 basics) | 50 | 23 | 41 | 47 | 43 | 41 |
| Oriel trimmed (−1 Soul Warden −1 Spirit Link +1 Suntail Hawk +1 Raise the Alarm) (T1, 8 life, 0 basics) | 52 | 26 | 41 | 43 | 37 | 40 |
| Vael as shipped (T2, 12 life, 1 basics) | 30 | 18 | 22 | 18 | 24 | 22 |
| Vael trimmed (−1 Soul Warden −1 Spirit Link +1 Suntail Hawk +1 Swords) (T2, 12 life, 1 basics) | 33 | 18 | 18 | 23 | 21 | 23 |

   Oriel −1 / Vael +1 — inside the noise (±5 on the mean). Two-card trims are below the resolution of the walls' problem: both are lifegain decks and the AI races lifegain badly (S33 read). Either a bigger redesign of the two lists, or accept them as the two walls the roads meet (ADR-103's "unless it also walls the player" — they do, at 24 and 40).
4. **Corvane's engine per cell** (part 8's new rows): returns per game rise with the roots — 0.38 at 12/0, 0.61 at 12/1, 0.84 at 12/2 … 1.32 at 20/2; 0.81 at the Standard 16/2. The reanimator turns once a game at the Standard cell; the S33 "two-root deck" read holds.
5. **The catalog's mage rows' `worldLife` is generated data now** — a hand edit fails the sync test; the number to change is the knob.
6. **The stock starters' tier gradient is now 59 / 36 / 21** (was 60 / 57 / 55 in the baseline): the tiers separate. Whether the middle and bottom sit where Chris wants them is the ratification; the shape the sweep could not produce before the resolver, it produces now.

## Registry entries added/changed

R-095 (the matchup resolver). No pool changes. ADRs 116–118 + the second S28 erratum in `docs/decision-updates/s34.md`. Knobs: `mageTierLife`, `mageTierEntrance`, `beastTierLifeDelta` (+ bundles; `docs/knobs.md` regenerated). Catalog: `worldLifeOffset` (the Serra −4); the mage rows' `worldLife` regenerated (12 / 16). Sim: `primaryColors` on the mage rows; `mage-sweep --mode`, part 8's tier-2 two-basic cells and the returns line. World: `matchup.ts`, `prepareDuel` / `siegeDuelSpec` / dungeon minions through it; `PreparedDuel.enemy.entrance`; `enemies.md` per mode. UI: the parley's entrance clause; the Lab's mode selector. Agents: both gates' "in response" test; pins 36/49. Docs: implementer-notes S34 lessons + the Lab's standing reference.

## Test status

Default tier **582 passed / 2 skipped** (57 files; +6 resolver tests incl. the 45-duel fuzz through `prepareDuel` at three modes with byte-exact replays; two pins re-based — a mage duel's modifiers carry the entrance, the Warband's life carries the tier delta; `docs/knobs.md`, `enemies.md`, `starters.md` regenerated and in sync). `pnpm typecheck` clean. **The FUZZ_FULL ladder gate held and the 100/cell vs-random ladder PASSES** after the window fix. Sweeps: part 8 (27,000 games), the Standard roster (15,500), the walls (4,000). Browser: the Lab's mode selector verified live (Standard 8/0 · 12/1 · 16/2; Hard 8/0 · 14/2 · 20/2; beasts +0/+2/+4 → +0/+4/+8).

## Suggested next

1. **Chris / planner — the ratification**: tier 2 at 12/1 or 12/2 (Concern 1); tier 3 at 16/2 as drafted or a cell easier (16/1 / 14/2) if the raw-starter bound must hold; tier 1 at 8 or 6; the beasts' T2 delta (+2 lands at 44). Then `pnpm knobs:doc && pnpm reference` and the ⚠ comes off.
2. **The walls**: Oriel and Vael need more than a two-card trim (Concern 3) — a redesign brief or a ruling that they stand.
3. **Implementer smalls**: the stock starters at the tier-2/3 neighbour cells (12/2, 16/1, 14/2) if the ratification wants them measured first — the Lab's roster with shifts, or `--mode` with a temporary bundle; the Lab's grid mode could take the mode too (its pickers default to Standard today).

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm typecheck
pnpm mage-sweep --games 100 [--mode easy|standard|hard] [--part 1..9] [--baseline none]
FUZZ_FULL=1 pnpm exec vitest run packages/sim/src/ladder-smoke.test.ts / pnpm ladder --games 100
pnpm reference / pnpm knobs:doc / pnpm art:fetch
pnpm viewer → /lab (the Matchup Lab: grid, roster, differential; mode selector) · /gallery · /play
```
