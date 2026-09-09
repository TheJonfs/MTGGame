# Session 34 brief (draft) — the matchup resolver and the tier tables

*Planner → Implementer, via Chris. 2026-09-08. Follows the running handoff.md (after S33). Becomes the brief once the ⚠ cells are ratified. Process rules unchanged; this session builds the resolver and switches the tables on.*

## Where we are

Two yardsticks now exist and they agree on the shape: the tier ladder as shipped does not separate from the player. The S33 matrix (mid-road references) says the mage entrance is the lever that moves a tier — one basic ≈ twelve points, two ≈ twenty-two, where eight life ≈ eleven — and that tier-3's 55–65 band sits at 16/2, 20/1 or 12/2. Chris's Lab run (stock starters vs the roster, 200 games a cell) says a shift of −2 / +2 / +2+1 basic lands 21 of 30 tier aggregates in his raw-starter bands, with the two misses the white and blue roads in opposite directions. The resolver (Part 6 of the S33 handoff) is scoped. This session builds it and populates its tables from the cells below.

## Part 0 — Rulings and ADR appends (docs/decision-updates/s34.md)

- **ADR-116 — Two yardsticks, one ladder.** The tier tables are read against both: the mid-road references (a starter plus eight shop cards, one basic in play, 12 life, journeyman) for tiers 2–3, and the stock starters for tier 1 and as the "walked in early" bound at tiers 2–3. Standard is the cell where a mid-road journeyman wins 55–65% and a stock starter is unfavourable but winnable (roughly 25–40%). Easy is one cell easier, Hard one harder, on the entrance axis first (the strong lever), life second.
- **ADR-117 — The tier tables (⚠ cells for ratification, Part 2).**
- **ADR-118 — The white and blue roads are not tuned off the sim.** Dawn Levy overperforms and Tidal Grimoire underperforms in every table by about the same margin, and Chris's read of the cause is right: the heuristic AI executes a weenie curve well and plays instants and counters badly. The human pilots the starter; the sim's blue numbers understate what a person does with Tidal Grimoire, and the white numbers overstate a curve the player will have to leave behind at the first boss (ADR-114). Both roads stand; their felt difficulty is read from Chris's own play, not the roster.
- **The S28 window's second defect** (Concern 4: "in response" is true over our own spell) — **fix it**: an opponent's item on the stack, one clause, both gates, ladder run. Recorded as the second erratum to S28.
- **The Lab** is the exploratory surface; the ledger records ratified cells from a named saved run (`analysis/runs/<name>.json`), never from an unsaved grid.

## Part 1 — Build the resolver (S33 Part 6, as scoped)

`resolveMatchup(opponent, mode, legacy, knobs) → { life, profile, entrance, ante }` in `packages/world/src/matchup.ts`, called from `prepareDuel`, `dungeonDuelSpec`, `siegeDuelSpec` (the Corolla keeps `heartLife` and its roots). Tables in the knobs registry with easy/standard/hard bundles: `mageTierLife`, `mageTierEntrance`, `beastTierLifeDelta`. Profile unchanged (ADR-103). Entrance basics by the mage's pip order (`primaryColors` computed once in `sim/mage-decks`, read by world and sweep). `legacyTerm()` returns zeros (the phase-two hook); a per-road term is the same shape and also zero. Situational terms (lair, empowerment, the Barrage) stay in their callers on top of the resolver's result. Catalog: the beasts keep `worldLife` as base; the mage rows' `worldLife` becomes documentation of the Standard cell (regenerated, not hand-kept). `pnpm mage-sweep --mode` replaces `--tier-life`; `enemies.md` renders the three modes.

Tests as scoped: the table lookup per mode and tier; a prepared encounter carrying the basics in colour order and the right life at each mode; the S33 replay fixture re-pointed at `prepareDuel`; `enemies.md` sync per mode; the `worldLife` pins re-based.

## Part 2 — The tables (⚠ ratify)

Life / basics in play. Beasts: life delta on the catalog row, no entrance.

| tier | Easy | **Standard** | Hard | evidence |
|---|---|---|---|---|
| Mages T1 | 8 / 0 | **8 / 0** | 8 / 0 | the teachers; ADR-103's band holds at 8 (Chris's −2 improved the aggregate but the two misses were Oriel and blue, neither a life problem). ⚠ Chris ran 6; the planner prefers 8 and a list trim for Oriel (Part 4). |
| Mages T2 | 12 / 0 | **12 / 1** | 14 / 2 | mid-road at 12/1 = 71% (above band — tier 2 is *meant* to be beatable by a mid-road deck); stock starters at 12/0 ≈ 44–63 (Chris's run). 14/2 and 12/2 to be measured first (Part 3). |
| Mages T3 | 14 / 1 | **16 / 2** | 20 / 2 | mid-road 16/2 = 56%, 20/2 = 52%, 14/1 ≈ 70% (interpolated). Stock starters at 14/1 = 26–37 (Chris's run, in his band); at 16/2 they will sit lower (~20–30) — the wilds should punish a raw starter. |
| Beasts T1 | +0 | **+0** | +0 | fodder by design; the early ring |
| Beasts T2 | +0 | **+2** | +4 | Nighthawks already past the band at +4 (33 vs road-B); the Warband/Gale/Baloths need +8 — a per-beast spread, not a tier |
| Beasts T3 | +2 | **+4** | +8 | aggregate 65% at +4; the Serra is past the band at +0 (49/32) and should get a **per-row** −4 offset; the Specter is flat on life (a plan beast — a list note, not a knob) |

Per-row offsets live on the catalog row (`worldLifeOffset`, applied after the tier delta): the Serra −4; nothing else this session.

## Part 3 — Measure before switching tier 2 on
Sweep part 8 at tier 2 with the two-basic cells added (12/2, 14/2) against the mid-road references; the stock-starter roster (the Lab's roster mode or `--part 2/5` under `--mode standard`) at the Part 2 Standard cells for all three tiers, saved as `analysis/runs/s34_standard.json`. If tier 2's 12/1 reads above 75% for the mid-road references *and* below 40% for the stock starters, that's the tier-2 shape we want (beatable once upgraded, hard walked into early); otherwise report the nearest cell.

## Part 4 — The two walls (⚠ Chris)
Sister Oriel walls the stock starters (24–48) at 8 life and still at 6; Mistress Vael (18–48) at 12. Both are lifegain, and the AI races lifegain badly. The tier lever cannot reach them (S33 read). Planner's list trims for ratification: **Oriel** −1 Soul Warden, −1 Spirit Link → +1 Suntail Hawk, +1 Raise the Alarm (the wall thins; the fliers still teach). **Vael** −1 Soul Warden, −1 Spirit Link → +1 Suntail Hawk, +1 Swords to Plowshares. Both re-read in Part 3's roster.

## Part 5 — Text
The parley line gains an entrance clause when the resolver emits basics. Archaic register, one line each, planner's draft: one basic — *"The ground is already theirs; a land lies ready before the first word."*; two — *"Two lands lie ready. This one has walked the roads before you."* The telegraph names nothing (as the Heart's roots did not on the rail).

## Part 6 — Smalls
`facts.returned` in the matrix rows (Corvane's per-cell return rate). The Lab reads the resolver's tables as its defaults per mode (a mode selector beside the roster's columns) so a saved run names the mode it measured.

## Verification & handoff
Fuzz encounter duels at all three modes for the fifteen mages (the entrance path live in `prepareDuel`), replays byte-exact; the ladder gate for the window fix; baselines re-based. Handoff: the Part 3 tables, the resolver's registry rows, `enemies.md` per mode, deviations, concerns.
