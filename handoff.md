# Handoff — after Session 42b (2026-09-21)

## State of the world

**Cinquefoil v1 is live on Vercel; phase two's roaming opponents now mirror phase one's courts.** Session 42b — **the mage inversion** — is done. In a phase-two world the ten tier-2/3 mages keep their names, portraits, epithets and tiers, keep one colour and turn the other: they play the five **still** pairs (Vael WB→WR, Kessa UR→UB, Maelin BR→BG, Brennor WG→GR, Pell UG→UW; Corvane WB→BG, Varro UR→UB, Sorrel BR→RW, Ysolde WG→WU, Quill UG→GR). The lists are the planner's ten (`docs/mage-inversion-lists.md`, validated against the pool by script before a line of code: all ten clean), **generated** into `packages/sim/src/mage-decks-flood.ts` by `pnpm mage-inversion:gen` and pinned to the document by a sync test; `mageListFor(key, phase)` is the one switch, and the phase is now a *required* parameter of `enemyDeck` and `entranceFor` so no caller can field phase one's list on a phase-two world by omission. The parley pips, the renown a mage fears and pays, and the entrance basics all follow the pair worn now (`colorsPhaseTwo`, `opponentColors`). Each of the ten says one more line in the flood ("the water changed me, too", in ten voices — `parley.linePhaseTwo`). The Lumberjack has its home (Brennor, Quill); the pool stays at 227. **Part 0 installed**: ADR-134 (the lords' rows: Standard 30 + 2, Easy 30 + 1, Hard 34 + 3), the fifteen region names (the Emberford collision ends), Odile stands, ADR-135 measured but not moved. **The smalls**: the dev menu's "Fell the five lords" on a phase-two world (the flood's falls, not just the seals — golds, chronicle); `heart-sim --roots` and `--hand 0`; the two post-lords references; the scripted phase-two stronghold run (S41 Deviation 9 closed — and it taught something, Concern 1). The S42b brief and lists are committed with this session.

*Not pushed. `pnpm build:web` not run this session (no UI beyond the parley line, the pips and the dev menu changed; the push is Chris's call).*

## Done this session

- **Part 0**: `docs/decision-updates/s42b.md` (the ratifications, ADR-134/135, Odile, the regions, the clause, the kickoff rulings). **ADR-134 installed**: `floodLordBasics` 2 (easy 1 / hard 3), new `floodLordLifeBonus` (0; hard 4), `flood.json` `baseLife` 34 → 30 ×5; `lordStartingLife` and the lord status rows add the bonus for a flood lord only; `flood-sim`'s default lord cell is the ratified row. **The fifteen names** as `namePhaseTwo` on the region templates, read by `regionName(tmpl, phase)` at generation; "The Emberford" is a phase-one name only. **The clause**: ten `linePhaseTwo` lines in `opponents.json`, rendered by `parleyLines(tmpl, phase)` after the phase-one greeting.
- **Part 1 — the inversion**: `MAGE_FLOOD_LISTS` (generated), `mageListFor`, `parseMageInversionLists`, `pnpm mage-inversion:gen` (validates 40 / 17, the pair, no gold, no prizeOnly, the kept colour; computes `primaryColors` by pips). `enemyDeck(catalog, ref, phase)` / `entranceFor(deck, n, phase)` — phase REQUIRED; fourteen call sites threaded (journey, dungeon minions, siege, quietus, the controller's lair guardian, the sweep, the reference docs, tests). Catalog rows: `colorsPhaseTwo` (validator: must equal the flood list's colours; a non-mage may not carry it); `opponentColors(op, phase)` feeds renown-felt, renown-paid, spoke-kill credit and the parley pips. `enemies.md` gains a "Phase two: pair" column and the ten flood lists. **Fuzz before fixtures**: `s42b-mage-inversion.test.ts` — 1,800 games (45 × 10 lists × a mage and a slice deck × both seats at the phase-two column with the entrance in play), zero exceptions; three byte-exact replays; then the pins (the document sync, the S29 rules, the switch). World-level: Corvane at phase one reanimates angels behind swamp + plains, at phase two wurms behind swamp + forest + swamp; tier 1 untouched; renown in the colours worn now; a 30-duel fuzz through `prepareDuel` on a phase-two world at every mode with replays.
- **Part 2 — measure**: tables below (parts 1, 12 = the mirror, 11, 13 = post-lords; cast counts in `results/s42b/`).
- **Part 3 — AI**: nothing changed; the ladder gate PASS (100 games). The plans execute (below).
- **Part 4 — smalls**: dev "Fell the five lords" (phase-two dev rows are the five lords only — no Mox courts or power dungeons exist on that map; the shortcut records the flood's fall: golds to the shops, the chronicle, the card, the seal; tested through the controller to the fount's telegraph); `heart-sim --roots 5,4,3 --hand 0|1 --refs postlords`; `salvage-WR+lords` / `salvage-UB+lords` (43 cards, 12 life, two basics in play; pinned); `flood-sim --refs postlords`; `mage-sweep --part 13`; the scripted phase-two stronghold run (two tests: the floor deck's loss path live over six seeds; the post-lords deck walked to the Bailiff live, his duel played live, the fall's hooks exercised).
- Docs: pool-registry (the Lumberjack's note closed; the S42b section), implementer-notes S42b, `knobs.md` / `enemies.md` regenerated.

## The inversion — `pnpm mage-sweep --games 100 --phase 2 [--lists 1]`

**Part 1 (tier by tier, at the phase-two column).** Flood lists — tier 2: Vael 55/55/57/44, Kessa 45/48/34/51, Maelin 45/52/73/48, Brennor 43/66/27/36, Pell 56/49/52/64. Tier 3: Corvane 54/58/43/61, Varro 46/38/23/36, Sorrel 42/62/35/20, Ysolde 57/77/65/53, Quill 39/64/79/47. Phase one's lists at the same column, for the paired read — tier 2: Vael 60/65/72/42, Kessa 40/51/29/58, Brennor 28/71/51/47; tier 3: Corvane 71/65/58/51, Varro 29/64/43/52, Sorrel 35/36/37/45, Ysolde 42/57/63/58.

**Part 12 (the mirror: each flood list vs its phase-one self, both at the phase-one column).** Vael **36%**, Kessa **35%**, Maelin 63%, Brennor **33%**, Pell 46%, Corvane 51%, Varro **36%**, Sorrel 74%, Ysolde 46%, Quill 49% — mean 47%, min 33%.

**Part 11 (vs salvage + legends).** References' win rate: **tier 2 41%** (phase one's lists at this column: 47%) · **tier 3 23%** (24%). Per mage (the reference's rate, WR / UB): Vael 43/43, Kessa 40/47, Maelin 49/41, Brennor 48/40, Pell 33/25; Corvane 24/34, Varro 32/27, Sorrel 23/16, Ysolde 16/11, Quill 17/34.

**Part 13 (vs the post-lords references).** References' win rate: **tier 2 73%** · **tier 3 47%** — Vael 73/63, Kessa 79/87, Maelin 74/67, Brennor 76/61, Pell 72/74; Corvane 43/50, Varro 69/77, Sorrel 48/37, Ysolde 40/35, Quill 33/39.

**The read against the brief's bars.** (1) *No fold a tier did not have*: phase one's deepest folds at this column were 28–29% (Brennor vs Vael, Kessa vs Brennor); the flood's are **Sorrel vs Quill 20%** and **Varro vs Ysolde 23%** — two points deeper at tier 3, otherwise comparable. Sorrel's and Varro's flood lists are the tier's soft rows (36–40% row means). (2) *Every flood list ≥ 40% against its phase-one self*: **four miss** — Brennor 33, Kessa 35, Vael 36, Varro 36. Brennor's is the clearest case: the RG list is a Lumberjack-and-burn aggro deck against a WG protected-healer midrange with Spirit Links and an Anthem; it wins by turn 11 or not at all. Kessa's UB mill against her own UR burn: mill needs the game long, burn keeps it short. (3) *Tier 2 near even, tier 3 unfavourable against salvage + legends*: tier 2 41% (six points under phase one's 47), tier 3 23% — near the S42a numbers as asked. **The lists play as a different deck, not a weaker one, at six of ten; the four below the bar are for the planner to amend or accept** (the mirror read is one deck's matchup against one other, not a strength measure — Part 1 has Brennor's flood list at 66% over Kessa's and Vael's flood list ahead of three of four).

**The plans execute** (casts per game in 200 games, part 11): Brennor's Lumberjack 0.28 and Quill's 0.35 (with Rancor 0.98, Blanchwood 0.47, Rampant Growth 0.86); Corvane's Buried Alive 0.63 and Zombify 0.92, returns Artisan 0.33, Aristocrat 0.26, Recluse 0.20, Wood Elves 0.20, Pelakka 0.14, Baru 0.13, Gaean 0.10 (the Artisan is the top return; the wurms are cast more than returned — Gaean 0.80/game); the Crabs 1.24–1.58 and the Altar 0.39–0.45 in the three mill lists; Char 0.26–0.41. No card in the ten lists is never cast.

## The lords' rows and the fount — the smalls' measurements

**ADR-134 as installed** (`flood-sim --games 100 --lords 1`, the lord's win rate): Bailiff 98 / 96 / **58**, Reeve 86 / 95 / **54**, Fordkeeper 97 / 98 / **48**, Dredger 89 / 88 / **50**, Reaper 100 / 99 / **54** (vs salvage-WR+legends / salvage-UB+legends / chris-road-B) — the S42a grid's 30 + 2 column, reproduced. The courts unchanged (Odile 96 / 85 / 20).

**The post-lords references** (ADR-135's (b); 43 cards, 12 life, two basics in play): the lords hold **76–93%** against them (Bailiff 79/76, Reeve 65/54, Fordkeeper 82/89, Dredger 69/59, Reaper 90/93) — between the floor and road-B, nearer the floor.

**The fount's entrance** (`heart-sim --games 100 --tide 1 --lives 50 --lands 20 --roots 5,4,3`; the fount's kill rate, turn-one-fount rate):

| roots | flower in hand | vs chris-road-B | vs salvage-WR+lords | vs salvage-UB+lords |
|---|---|---|---|---|
| 5 | yes | **87%** (T1 87%) | 94% (99%) | 92% (98%) |
| 4 | yes | **79%** (T1 20%) | 90% (30%) | 88% (32%) |
| 3 | yes | **73%** (T1 1%) | 82% (0%) | 76% (2%) |
| 5 | **no** | **81%** (T1 17%) | — | — |

**The read.** The entrance is the lever the tide's life was not: one root is worth 7–8 points against road-B (ten points of life were worth three), and the card out of hand is worth six at five roots. The brief's 55–65% for road-B sits near **two roots** by extrapolation, or three roots with the card not in hand (~67%); against the post-lords deck the fount is 76–94% everywhere — that deck, at 12 life with two lands, does not beat a turn-three 7/7 either. Nothing moved (ADR-135); the axes exist for the planner's call.

## Deviations from the brief

1. **The post-lords reference is two colours, and the ten are the pair's** (Chris, kickoff): the lords' cards are triads and three of the brief's five golds are off-pair; Static Sphere replaced Char in the brief's gold list, and neither casts in WR. Filed in s42b.md.
2. **Corvane's Artisan of Kozilek stays** (Chris): R-table, not a tier-3 title.
3. **The parley clause varies by mage** (Chris: "have some fun") — ten lines, one sense.
4. **The scripted stronghold run's fall is scripted when the lord holds.** Twenty seeds with the post-lords deck reached the Bailiff in one (after minions felled live) and lost his duel live in every seed of a hundred tried during development; the fall's hooks are exercised by feeding a win to the finisher, as the S22b test does, and the test says so in its name. See Concern 1.
5. **The sweep's part 3 (children vs parents) was not run**; the brief's intent — "a different deck, not a weaker one" — is the mirror (part 12: the flood list against its phase-one self), which is what the brief's own sentence describes. Part 3's parents are phase one's parent LINES, which the inverted lists no longer descend from.
6. **`newWorld({ starter, phase: 2 })` now generates a phase-two map** — a pre-existing seam (only the salvage path passed the phase to the generator); dev/test worlds from a starter at phase 2 had a phase-one map with phase-two knobs. No shipped path used it.
7. **`heart-sim`'s table gained a `roots` column** (every row, including the old rings) — the S42a numbers reproduce at roots 5.

## Concerns

1. **A live stronghold run is much harder than the seat-alone sim says.** The scripted run shows the mechanism: interior life carries from the minions to the lord, and the player arrives at 3–22 life with no basics in play (no manalinks in a salvage world), against a lord at 30 + two basics + the law + the signature in hand. `flood-sim`'s post-lords cell (12 life, two basics, fresh) gives the Bailiff 79%; live, over twenty seeds, the post-lords deck reached him once and never beat him. ADR-134's grid was measured seat-alone; **the row the player actually meets is the seat plus the interior**, and phase one's lords had the same shape but a phase-one player with manalinks and a bought deck. Whether that is "hard is hard" or a row that needs the interior counted (fewer minions on a flood stronghold's floor, or the entrance basics only when no minion was fought) is the planner's — the scripted run is the instrument for it now.
2. **Four flood lists lose the mirror** (Brennor 33, Kessa 35, Vael 36, Varro 36). The bar ("at least 40%") is a matchup read, not a strength read; Part 1 shows the same lists mid-table in their tier. If the bar stands, the planner amends the four; the likeliest levers are Brennor's curve (his RG list is all-in; two Wall of Blossoms or a Baloth would slow it) and Kessa's counters (Essence Scatter ×2 + Counterspell against her own burn does nothing). A substitution is a document edit + `pnpm mage-inversion:gen`.
3. **Sorrel's and Varro's flood lists are tier 3's soft rows** (row means 40% and 36% in part 1; Sorrel 20% vs Quill). Neither is under phase one's floor (Sorrel's phase-one row mean was 38%), but Sorrel's flood list — Pyromancers, Lions, an Anthem — is a tier-2 shape with a Serra.
4. **The tier-3 entrance at the phase-two column is three basics** (`phaseTierTables[2].mageTierEntrance[3]` = 3; tier 2 is 1). My fuzz and the world test assumed 2 at first and were corrected by the code; the S42a handoff's "16 / 1" ruling touched tier 2 only. Worth a planner glance that 20 / 3 at tier 3 is intended beside 16 / 1 at tier 2 — a two-basic step between adjacent tiers is the largest in either column.
5. **`primaryColors` puts the turned colour first for Sorrel (RW)** — his entrance leads with a Mountain though he "keeps R" by the assignment table; the pip rule (S34) decides, and R has more pips. Consistent, but the table's "keeps" column and the entrance disagree on which colour is his.
6. **The phase-two parley clause is data on the catalog row**, not in `quests.json` with the flood's other text. If the planner wants all phase-two voice in one file, it is a move, not a change.
7. **The post-lords deck is a guess at what the player holds.** It beats tier 2 73% and is even with tier 3 (47%) — far above salvage + legends (41 / 23). If the real post-lords collection is closer to salvage + legends + the lords' triads (uncastable in a pair), the fount's and the courts' honest yardstick is nearer the S41 references than this one.

## Registry entries added/changed

No R-numbers (no rules changed). Pool-registry: the S42b section; the Lumberjack's ADR-101 note closed. ADR-134/135 and the rulings in `docs/decision-updates/s42b.md`. Knobs: `floodLordBasics` 0 → **2** (easy 1 / hard 3; ratified), **`floodLordLifeBonus`** (new: 0; hard 4). Data: `flood.json` `baseLife` 34 → 30 ×5; `opponents.json` `colorsPhaseTwo` ×10, `parley.linePhaseTwo` ×10; `regions.json` `namePhaseTwo` ×15. Types: `RegionTemplate.namePhaseTwo`, `OpponentTemplate.colorsPhaseTwo`, `ParleyVoice.linePhaseTwo`, `MageFloodList`, `MageDeck`. Functions: `mageListFor`, `parseMageInversionLists`, `opponentColors`, `parleyLines`, `regionName`; `enemyDeck` / `entranceFor` / `renownAgainst` take `phase`. Sim: `MAGE_FLOOD_LISTS` (`@shandalar/sim/mage-decks-flood`), `ROAD_DECKS.salvageWRLords` / `salvageUBLords`, `s42b-mage-inversion.test.ts`. CLIs: `pnpm mage-inversion:gen`; `mage-sweep --lists`, parts 12 (the mirror) and 13 (post-lords), the `~flood` side names; `heart-sim --roots`, `--hand`, `--refs postlords`; `flood-sim --refs postlords` and the ratified default cell. UI: the parley's phase-two line and pips; the dev menu's "Fell the five lords" (phase-two rows are the lords only). Validator: `colorsPhaseTwo` must equal the flood list's; `namePhaseTwo` non-empty.

## Test status

Default tier **733 passed / 2 skipped (75 files)** (from 718 / 2: +5 `s42b-mage-inversion.test.ts`, +5 matchup.test S42b, +1 flood.test ADR-134, +1 salvage.test post-lords, +1 phase.test regions, +2 controller S42b runs). Re-based with reason: `flood.test.ts` lord base 34 → 30 (ADR-134). `pnpm typecheck` clean. **Fuzz before fixtures**: `FUZZ_FULL=1` S42b — 1,800 games, zero exceptions, three byte-exact replays — before the first pin. **Ladder**: `pnpm ladder --games 100` PASS (no AI change). Sims: mage-sweep 2,000 (part 1 ×2) + 1,000 (mirror) + 2,000 (part 11 ×2) + 2,000 (part 13); heart-sim 900 + 100; flood-sim 3,000 + 1,500 — no errors. The scripted stronghold run plays ~8 interior duels live per test run (deterministic seeds). **Not walked in the browser**: the parley line, the pips and the dev button are covered by the controller tests and typecheck; `pnpm build:web` not run.

## Suggested next

1. **Planner**: Concern 1 (the interior's row) before ADR-134 is called done; Concern 2 (the four mirrors) — amend or accept; the fount's entrance (roots 2–3, or the card out of hand) now that the axis exists; Concern 7 (what the post-lords deck should be).
2. **Chris**: the fount by hand — a phase-two world, Dev → "Fell the five lords", walk to the centre, knock.
3. **S43 candidates** (the brief's list): the Calyx's tiles and the flood's art round; the shops' phase-two stock read (the purse at 100 is still ⚠); the courts against the post-lords references (`flood-sim --refs postlords` without `--lords 1` — not run this session).
4. **Smalls**: `pnpm build:web` + push; a `--part 3` variant that pairs each flood list against its still-pair court (the seat it mirrors) if the planner wants that read.

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm typecheck
FUZZ_FULL=1 pnpm exec vitest run packages/sim/src/s42b-mage-inversion.test.ts
pnpm exec vitest run packages/world/src/matchup.test.ts packages/world/src/flood.test.ts packages/world/src/phase.test.ts packages/ui/src/world/world-controller.test.ts
pnpm mage-inversion:gen     # after editing docs/mage-inversion-lists.md
pnpm mage-sweep --games 100 --part 1|11|12|13 --phase 2 [--lists 1] --baseline none
pnpm heart-sim --games 100 --tide 1 --lives 50 --lands 20 --roots 5,4,3 [--hand 0] --refs road|postlords
pnpm flood-sim --games 100 --lords 1 [--refs postlords]
pnpm ladder --games 100 ; pnpm reference ; pnpm knobs:doc
results/s42b/                # this session's sweep and sim outputs
```
