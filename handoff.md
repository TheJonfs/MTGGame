# Handoff — after Session 41 (2026-09-20)

## State of the world

**Cinquefoil v1 is live on Vercel; phase two now has its ten seats on a map of its own.** Session 41 — **the seats** — is done. A phase-two world generates a NEW map (Chris: no Mox courts, no power dungeons, no Corolla, no Vault, no Mox rumour chains): larger, the rings pushed out, and at the centre **the Calyx** — impassable deep water with **five High Grounds** (the courts' islands, each between its pair's two shores), a **ford** from each shore and inward to the centre, and the Heart's site in the middle. The five stronghold sites carry **the flood's lords** (Tidelock Weir, Marrowfen, Emberford, Lockmere, Harrowmoor) on the phase-one machinery — descent, law, signature in hand, five picks (across the triad) — behind their colour gates; their falls **add the pair's two golds to the shops**. **The five courts** are single duels at world life on their islands, the law AND the High Ground on the court's side, behind the five shape gates speaking the planner's own lines; a fall pays the ground and the minister. **The Heart opens when the five lords have fallen** (its content is S42's; the centre's knock changes line). The ten lists live in the catalog (`data/world/flood.json`), generated from the working document and pinned to it by a test. Walked live on the dev server: the flood's start, the map, a court's telegraph, a roamer encounter — no console errors. **S40's art is closed** (sixteen card arts + Meliyan's, two token plates, ten portraits, seventeen printed faces — all installed); the seats' text is the planner's delivered `docs/flood-seats-text.md`.

## Done this session

- **Part 0**: `docs/decision-updates/s41.md` — the S40 ratifications, ADR-129, ADR-130, Chris's four rulings of 2026-09-20 (the Heart's gate confirmed; a phase-two map is a new map; the golds reach the shops by the lords' falls; Shadow Summoning keeps LTR), Ovna's swap. **The Reaper's harvest** loosened to half (one constant; book 62 re-pinned; both ladder gates PASS) — see Concern 3: it did not change how often he harvests.
- **Part 1 — the lists**: the document's two amendments were already in; **a third was needed** — Ovna's list carried a Swords to Plowshares (an Instant) against her own gate; −1 Swords, +1 Pacifism (Chris). `flood.test.ts` pins ADR-129 for all ten seats (every court passes its own gate; every lord sits inside his triad).
- **Part 2 — the door lines**: `door.bySite` (the five courts' words, numbers included) → `door.byRule` (number-free fallbacks) → the colour line; `doorRefusalText(…, siteId)`; the S37/S38 controller tests and the S40 legality tests re-based; the catalog validates that every by-site key names a real site.
- **Part 3 — the ten sites**: `data/world/flood.json` (decks + five `FloodStrongholdDef`s = the phase-one content shape + `triad` + `golds`, + five `FloodCourtDef`s) with `packages/world/src/flood.ts` (types, validation, `strongholdContentFor(catalog, phase)` — the ONE switch between phase one's seats and the flood's — `courtDuelSpec`, `applyCourtDuel`, `recordFloodLordFall`, `floodHeartOpen`, `parseFloodLists`); `lord:<key>` / `court:<key>` deck refs through `enemyDeck`; **`flood-decks.ts` deleted** (the S40 fuzz reads the JSON; `flood-sim` reads the catalog). A court is **its own def, not a `CorollaPetalDef`** (that type is keyed by the five colours and lives inside the flower map). `FixedPoint.contentId` (additive) ends the kind+colour+tier site matching for new classes. Life rows: lords `baseLife` 34 ⚠ through the phase-one growth/hunt formula; courts 34 ⚠ (`floodCourtLife` knob overrides). Prizes: a lord pays his card + five picks over the triad (its duals are on that list) and unlocks his two golds in the shops of towns sharing their colour (one copy an epoch at the old R shelf's price — the only R-tier stock a shop ever carries); a court pays its High Ground and its minister (a held minister is withheld for coin — the petal's rule), the purse, the stake. The falls are kept in `gauntlet.flood.falls`; the seat's `fall` line speaks on the victory screen and the map notice.
- **Part 4 — the map**: `generateWorld(…, { phase: 2 })` — `floodMapScale` 1.2, `floodRingRadii` (0.36 / 0.6 / 0.84), `calyxRadius` 0.2; the deep water laid BEFORE anything is placed (towns, lairs and carves keep to the shore; `carveTo` never crosses it); islands at the angular midpoint of the pair's spokes at 0.6 of the radius; straight 4-connected fords (`map.deepFord`, its own channel) to the nearest shore cell of each pair colour and to the centre; rivers end at the shore; town density normalised by the added area (16–20 towns, phase one's count; eight placeholder flood names added — 28). `calyx.test.ts`: placement per territory, the Calyx's invariants, every ground reachable from BOTH shores, everything reachable from the start, five seeds; phase one as before. UI: the Calyx's three tones, the island sprite, no terrain glyphs in the water, the court telegraph and victory screens, the ford's first-crossing line, the Heart's knock.
- **Part 5 — text**: the planner's file parsed into `quests.json` (`flood.seats` by site id, `flood.fords`, `flood.heartOpens`, `flood.chronicleFifth`, `door.bySite`); the catalog refuses a flood site without its text.
- **Part 6/7 — measure**: `ROAD_DECKS.salvageWRLegends` / `salvageUBLegends` (the yardsticks + the pair's two guardians and minister, 33 cards); `pnpm flood-sim` reworked to the seats AS BUILT with the courts' intruders cut to legality; `mage-sweep --part 11`. Tables below.
- `docs/reference/world-ui.md` (the flood's seats), `enemies.md` (two new sections, generated), `knobs.md`, implementer-notes S41.

## The rows — `pnpm flood-sim --games 100` (the seat's win rate; 100 games in each seat; master vs journeyman)

Lords: 34 life, the law, the signature in hand. Courts: 34 life, the law and the High Ground in play; the intruder is the reference's nearest legal cut for that gate.

| seat | vs salvage-WR+legends | vs salvage-UB+legends | vs chris-road-B | turns | legend casts / activations per game |
|---|---|---|---|---|---|
| Tidelock Weir — the Bailiff | 86% | 74% | **24%** | 18.4 / 20.0 / 16.8 | 0.70–1.39 / — |
| Marrowfen — the Reeve | 63% | 80% | 39% | 16.5 / 18.8 / 13.8 | 0.41–1.19 / 0.51–1.90 |
| Emberford — the Fordkeeper | 89% | 96% | **26%** | 17.5 / 17.4 / 13.0 | 0.56–1.32 / pings 0.24–2.92 |
| Lockmere — the Dredger | 67% | 70% | **27%** | 18.6 / 24.6 / 18.2 | 0.78–1.88 / 0.71–1.71 |
| Harrowmoor — the Reaper | 88% | 90% | **29%** | 15.1 / 16.4 / 13.3 | 0.54–1.01 / **0.02–0.03** |
| Tallyflame Court — Odile | 96% | 83% | **20%** | 16.2 / 17.0 / 14.7 | 0.78–1.36 / the Court 0.69–1.29 |
| the Wrackroot Shallows — Zinnia | 97% | 90% | 42% | 17.4 / 20.4 / 17.0 | 0.93–1.45 / Wrackroot 0.68–1.50 |
| Shevelport Green — Ovna | 96% | 98% | 49% | 12.1 / 12.5 / 13.4 | 0.69–0.98 / Shevelport 0.15–0.26 |
| the Obsidian Observatory — Isaura | 98% | 95% | **68%** | 11.5 / 12.6 / 13.5 | 0.73–0.96 / 1.21–1.73; the ground 0.62–0.72 |
| Cairnbrand Pyre — Meliyan | 99% | 100% | **67%** | 10.1 / 10.3 / 13.9 | 0.51–0.69 / Cairnbrand 0.02–0.21 |

**The legal cuts** (what changed in the intruder): Wrackroot × WR −Suntail Hawk, Soul Warden, Fencing Ace, Youthful Valkyrie → basics; × UB −Typhoid Rats → Island. Shevelport × WR −Swords, Bolt, Shock, Abrade → Master Decoy + 3 basics; × UB −Brainstorm, Counterspell, Essence Scatter, Terror, Doom Blade → 5 basics; × road-B −2 Bolt, Abrade → Young Pyromancer, Goblin Piker, Boggart Brute. **The Observatory: +9 basics (42 cards) for the salvage decks, +20 basics (50 cards) for road-B.** Cairnbrand × WR −the Ruby Tyrant → Master Decoy; × UB −Air Elemental, the Sapphire Sage → basics; × road-B −the Ruby Tyrant, 2 Serra Angel, the Usher, the Stoker → five cheap creatures. Tallyflame needed none (every reference already carries twelve creature cards).

**The read against the planner's targets** (lords and courts 40–55% against a finished phase-one deck, 70–85% against salvage + legends):
- **Against salvage + legends the seats are at or above the band**: lords 63–96% (the Reeve and the Dredger inside it, the other three above), courts 83–100% (all above). The floor player with three legends loses to every court nine times in ten.
- **Against a finished deck the LORDS are below the band — 24–39%** — and *lower than S40's table* (38–56%), which sat them at 20 life with three basics in play. **Fourteen more life and the signature in hand is worth less than three lands on turn one.** If the planner wants 40–55%, the lever the data points at is an entrance (basics), not life.
- **The courts split**: Odile 20% (unchanged by her list amendment — her fire still needs a slower opponent), Zinnia 42% and Ovna 49% in the band, **Isaura 68% and Meliyan 67% above it — but those two numbers are the gate's, not the court's**: road-B plays fifty cards with thirty-two lands at the Observatory and loses its five best cards at Cairnbrand. The gates are doing what they were designed to do; the rows should be read beside the cut.
- **`mage-sweep --part 11 --phase 2`** (the phase column against salvage + legends): tier 2 **36%**, tier 3 **24%** for the references — against S39's 34% / 23% without the legends. Three legends move the floor two points. The phase-two column is as hot for the lived deck as it was for the bare one.

## Deviations from the brief

1. **A court is a `FloodCourtDef`, not a `CorollaPetalDef`/`CalyxDef` on the petal's shape** — the brief offered the choice; the petal's def is keyed by colour and bound to the flower's interior map.
2. **The stronghold "pays the triad's duals" through the picker**, as phase one's seats pay theirs: five picks from a list now spanning the triad (its duals on it). No automatic dual grant — phase one's strongholds never made one (the petals did). If the planner meant a fixed grant of the three duals, it is a one-line addition in `finishInteriorDuel`.
3. **The golds**: ten, not five, and they reach the shops by the falls (Chris's ruling) — the brief's two sentences on this disagreed.
4. **No ferry**: a ford is a walkable causeway cell; "ferry" is a word for the same tile. The fords also run inward to the centre, so the Calyx is a (slow) crossing between territories and the Heart's site is reachable.
5. **The map grew** (`floodMapScale` 1.2) and the rings moved out — the brief placed the Calyx "inside the flooded centre", but phase one's civilized hearts sit at 0.18 of the radius: a Calyx big enough for five islands would have drowned every home town. Town density is normalised so the count stays phase one's.
6. **The colour gates are not applied to the Lab's references** (a UB deck cannot enter Tidelock Weir at all); only the courts' shape gates are cut to legality, as the brief says.
7. **The salvage + legends references are 33 cards** (three legends added, nothing cut).
8. **No dedicated Chronicle page for the falls**: the fall lines speak on the victory screens and map notices and are stored (`gauntlet.flood.falls`); the Chronicle page is still the cuttings' ledger. `flood.chronicleFifth` is in the pack, unused until the Heart.
9. **A stronghold's descent was not played through live or by a scripted duel this session** — its threshold, gate, content switch, deck source and fall hooks are tested through the controller; the descent itself is the S22b machinery unchanged. A full scripted run (the S22b acceptance test's shape, at phase 2) is the first small for S42.

## Concerns

1. **The lords are under their band against a finished deck, and the S40 table says why** (above). 34 is provisional; I changed nothing. A row of "34 + three basics of the triad" is one `entranceModifiers` call in `startInteriorDuel` and would be the first thing I'd measure.
2. **Region names collide with the flood's seats**: a phase-one RED region is named "The Emberford", and the red stronghold is "Emberford" — the header read "You · The Emberford" on the live walk. The flood still wears phase one's region names, roamers, lairs, quests and rumour text (S39 Concern 2); the names are the most visible.
3. **The Reaper still does not harvest** (0.02–0.03 a game at half, as at three-fifths). The rule is not what stops him: before combat he rarely has the mana ({B}{R}{G}) AND a body whose power makes the arithmetic work — the list wins by attacking. To make him *play* like the Reaper the list needs a reason to sit behind snakes (or the gate needs the haste line, which needs summoning sickness in the view).
4. **Old phase-two saves** (made between S39 and S41, dev only) keep their old map — no Calyx, and Mox/power sites that no longer belong. Nobody has one but us; a note, not a migration.
5. **The Calyx's look is functional, not finished**: flat tones on hard cell edges where the rest of the map has washed, feathered regions; the island borrows the blue islet terrain sprite; the centre borrows the Corolla's door. Art-round work (the flood's tiles were already on that list).
6. **"Roaming now 145"** on the live flood map — the roamer population scales with the larger map (phase one's is about 100). Encounter density per step should be similar, but it is unmeasured.
7. **Isaura's gate prices itself oddly against big decks**: "half your deck is land" is met by ADDING basics, so a 30-card deck becomes 42 and a Moxen deck 50. A player will do exactly this. If the intent was "cut spells", the rule wants a `maxCards` beside it.
8. **The flood's towns stock no R cards until a lord falls**, and then at four times price — with a 100-gold purse the first gold is a long way off. Unmeasured; the purse is still ⚠.
9. **`flood.json` is generated** by a script that lived in this session's scratchpad (the parser is `parseFloodLists` in flood.ts; the site tables were inline). The sync test will catch drift in the lists; a `pnpm flood:gen` would make regeneration a command instead of a memory. Small.

## Registry entries added/changed

No R-numbers (no engine change). ADR-129, ADR-130 and the four rulings in `docs/decision-updates/s41.md`. Knobs: `floodCourtLife`, `floodMapScale`, `floodRingRadii`, `calyxRadius`. Data: `data/world/flood.json` (new), `quests.json` (`flood.seats`, `flood.fords`, `flood.heartOpens`, `flood.chronicleFifth`, `door.bySite`, number-free `door.byRule`), `towns.json` (+8 flood names), the working document (Ovna's list). World: `flood.ts` (new), `Catalog.flood`, `OpponentDeckRef` `lord:`/`court:`, `FixedPointKind` `ground`, `FixedPoint.contentId`, `WorldMap.deep` / `deepFord`, `JourneyEvent` `courtEntry`, the generator's phase-two branch, the shop's gold rows, no Mox chains at phase 2, `flood-sim-cli.ts` reworked, `mage-sweep --part 11`, the enemies reference's two sections. Sim: `flood-decks.ts` deleted; `ROAD_DECKS.salvageWRLegends` / `salvageUBLegends`. Agents: the harvest constant. UI: screens `courtTelegraph` / `courtDuel` / `courtVictory`, `EditorBack` court arm, `fightCourt` / `declineCourt` / `continueAfterCourtVictory` / `courtDef` / `seatText`, the flood lords through `strongholdDef`, the triad's picker, the fall lines, the Heart's knock, the ford's line; `WorldMap.tsx` `CALYX` tones and the `ground` sprite.

## Test status

Default tier **703 passed / 2 skipped (72 files)** (from 688 / 2: +9 `flood.test.ts`, +4 `calyx.test.ts`, +2 controller). Re-based with reason: the two "no shipped door" pins (now exactly ten, all the flood's); the door-line tests (number-free fallbacks; the by-site line pinned); book 62 (the harvest at half). `pnpm typecheck` clean. **Ladder**: `pnpm ladder --games 100` PASS and the FUZZ_FULL ladder smoke 2/2 after the harvest change. **Fuzz**: the S40 fuzz re-run against the catalog's lists (the three amended lists included) — zero exceptions, replays byte-exact. Lab: `flood-sim` 6,000 games, `mage-sweep --part 11` 4,000 games, no errors. Browser: the flood's start → the map → a court's telegraph → a roamer's parley, across two seeds, no console errors.

## Suggested next

1. **Planner/Chris**: ratify or move the rows (Concern 1 — life vs an entrance for the lords; Odile); the region names (Concern 2); whether the Observatory's gate wants a size cap (Concern 7); Deviation 2 (the duals).
2. **S42 — the mage inversion and the Heart's phase-two content. Estimate: one and a half sessions; split it.** *The Heart* (one session, well-scoped): the site exists and its gate is built; it needs a def (the phase-two Manafleur or its successor, its list, its life row — ADR-127's 50 is still unmeasured), the accumulating ring (built in S38, on for any phase-two world), the telegraph/fight/victory flow (the phase-one Heart's, re-keyed from petals to `floodHeartOpen`), the prize (the open question in the document's §6), the cutting's Chronicle entry and what "the next road" means after the flood. *The mage inversion* (half to a full session depending on its definition — the brief will need to say what inverts: the roster's colours per territory, the tiers per ring, or new lists): the resolver and the phase column are ready; new mage lists are catalog-and-sim work with a fuzz and a sweep; if it is fifteen new lists it is a session by itself.
3. **Smalls**: a scripted phase-two stronghold run (Deviation 9); a `pnpm flood:gen`; the flood's Chronicle page; the Calyx's tiles in the next art round; the Reaper's list (Concern 3).

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm typecheck
pnpm exec vitest run packages/world/src/flood.test.ts packages/world/src/calyx.test.ts packages/world/src/legality.test.ts
pnpm exec vitest run packages/ui/src/world/world-controller.test.ts -t "S41"
pnpm flood-sim --games 100            # --only odile for one seat
pnpm mage-sweep --games 100 --part 11 --phase 2 --baseline none
pnpm ladder --games 100
pnpm reference / pnpm knobs:doc
pnpm viewer → /world?dev=1 (a new game → Dev → "+ cutting" ×5 → reload → "Enter the Flood")
```
