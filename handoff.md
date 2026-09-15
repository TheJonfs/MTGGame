# Handoff — after Session 38 (2026-09-16)

## State of the world

**Cinquefoil v1 is live on Vercel; phase two's groundwork is in.** Session 38 — **the resolver's phase column, doors on the sites, the accumulating Heart, the world-UI page** — is done: `world.phase` (1 | 2 | 3, additive, no format bump) and a phase-indexed knob `phaseTierTables` the resolver reads through `tierTablesFor` (phase 1 = the three S34 knobs; phase 2 = the brief's proposed column, ⚠ unratified; phase 3 scarred: it reads phase 2's until authored); the difficulty bundles carry their own phase-two cells; `pnpm mage-sweep --phase 2`, the Lab's and the dev setup's phase selectors, and `enemies.md`'s phase-two column expose it; **no shipped path sets phase 2**. `deckRule?` on `StrongholdContentDef` and `CorollaPetalDef` (validated, rendered, none authored): the stronghold telegraph refuses the DESCENT and the petal's tip refuses the FIGHT of a failing deck, naming the rule, with **Edit your deck** opening the editor on that door and returning to the telegraph (and fixing a latent bug: the editor from a petal tip used to return to the outer map). `heartLawsPersist` = S27's dormant `accumulate` mode behind a knob (true for any phase-two world); the paired heart-sim read is below. `docs/reference/world-ui.md` is written. ADR-124/125/126 filed; S37's deviations ratified. Pool 198 unchanged.

## Done this session

- **Part 0**: `docs/decision-updates/s38.md` — the S37 ratifications, ADR-124 (card-grained unlock), ADR-125 (doors on the sites), ADR-126 (the salvage start, recorded for S39), filing notes.
- **Part 1 — the phase column**: `Phase` and `TierTables` types; `phaseTierTables` knob (standard {2: mages 12/1 · 16/2 · 20/3; beasts +4/+8/+12}; easy 12/16/18 & 1/1/2 & +4/+6/+10; hard 12/18/24 & 1/3/3 & +4/+10/+16 — mirrors of the phase-one offsets, all ⚠ unratified); `tierTablesFor(knobs, phase)`; `resolveMatchup(opponent, knobs, legacy, phase)` — journey, siege and dungeon pass `world.phase`; enemies.md renders the column (a row in "How starting life is set" and a per-opponent "Phase two: life / entrance" column); `pnpm mage-sweep --phase 1|2|3` (the mage path now goes through the resolver too — it re-implemented the arithmetic); the Lab (`labDecks(mode, phase)`, through the resolver — its inline copy is gone) and the dev setup have a phase radio; a saved Lab run records `phase`. Tests: the table lookup at every phase and bundle; one mage per tier and a beast at phase 2; `newWorld({ phase: 2 })` → a prepared duel carries the column's life and entrance; a pre-S38 save reads phase 1 and phase 2 round-trips. The sweep banner at `--phase 2` reads "mage tier life 12/16/20, entrance 1/2/3 basics, beast tier delta +4/+8/+12" (a smoke, not a test).
- **Part 2 — doors on the sites**: `deckRule?` on the stronghold and petal defs (the cheaper honest shape — `doorCheck` already takes any `{ deckRule }`; a template indirection would have added a lookup for nothing); the catalog validator names every field for both; enemies.md notes `door: <label> (<rule>)` on the lord's and the petal's rows. The controller: `doors()` (templates bare, `stronghold:<id>`, `petal:<colour>`), `siteDoor()` (the screen the player stands on), `openEditorForDoor()`, `EditorBack` carrying the telegraph, `returnFrom` re-raising it; `enterDungeon` and `fightPetal` refuse with the notice; both telegraph components show the refusal, shut the primary button, and offer **Edit your deck** whenever the site has a door. Tests (the S10 pattern): the Argent Bastion under a test rule — refused, the editor on the door, Cancel back to the gate, the Serra for a Plains saved back to the gate, the descent; the Tithe petal under a test rule — refused, the editor returning to the tip inside the flower, a legal deck fights. No shipped site carries a rule.
- **Part 3 — the accumulating Heart**: `heartLawsPersist` (default false); `heartLawsPersist(world, knobs)` = the knob OR phase ≥ 2; `heartDuelSpec` passes `{ type: "lawSequence", mode: "accumulate" }` only then (the S27 spec pin stays exact at phase 1). Fixtures (`s38-heart-persist.test.ts`): the ring to six laws (the fifth joins four; the ring closes and keeps going; no exile); the Manafleur's legend rule unaffected (one flower, every law); a Disenchant on the oldest leaves the newer and the next petal grows beside it; the Angel's ETB exiles two of three and the ring grows on. Fuzz-before-fixtures: the accumulate mode was already in `s27-heart-fuzz` (byte-exact replays). heart-sim: `--persist 0|1|both`, a "laws at death (mean; max)" column.
- **Part 4**: `docs/reference/world-ui.md` — the routes, every world screen (what it shows, what the player does, what gates it, the editor's reachability), the single match, the Lab, the gallery, the viewer.
- **Part 5**: the Lab's phase selector beside the mode; the world's phase on the Dev panel (read-only) and in the Continue button's summary (the start screen had no summary line; one was built: name, difficulty, phase, steps; life and decks on hover).

## The heart-sim read (Part 3): the accumulating ring against the rotating one

`pnpm heart-sim --games 100 --lives 40,45,50 --lands 20 --persist both` — the same seeds for both rings; the seven stock references (journeyman at 16) and chris-road-B (master, 17, four basics); the Manafleur master with roots and the flower to hand.

| ring | heartLife | vs | kill % | T1 flower % | mean turns | died at (Intake/Tithe/Toll/Season/Barrage/none) | laws at death (mean; max) | flower removed |
|---|---|---|---|---|---|---|---|---|
| rotating | 40 | road | **86%** | 87% | 9.9 | 8/32/27/3/10/6 | 0.9; 1 | 37/100 |
| accumulating | 40 | road | **88%** | 87% | 9.3 | 10/36/34/2/5/1 | 2.4; 5 | 33/100 |
| rotating | 45 | road | 83% | 88% | 10.9 | 14/27/25/5/5/7 | 0.9; 1 | 53/100 |
| accumulating | 45 | road | 88% | 88% | 10.0 | 11/37/23/3/10/4 | 2.2; 4 | 44/100 |
| rotating | 50 | road | 87% | 87% | 10.8 | 14/24/25/1/13/10 | 0.9; 1 | 39/100 |
| accumulating | 50 | road | 91% | 87% | 10.1 | 14/32/30/0/11/4 | 2.2; 6 | 35/100 |
| rotating | 40 | stock | 100% | 99% | 9.7 | 58/170/301/64/101/4 | 1.0; 1 | 74/700 |
| accumulating | 40 | stock | 100% | 99% | 8.2 | 29/250/321/30/64/4 | 2.9; 13 | 47/700 |
| rotating | 45 / 50 | stock | 99% / 99% | 98% | 9.4 / 9.7 | — | 1.0; 1 | 70 / 69 of 700 |
| accumulating | 45 / 50 | stock | 100% / 100% | 98% | 8.0 / 8.2 | — | 2.8; 11 / 2.9; 14 | 41 / 40 of 700 |

**The read.** Against chris-road-B the accumulating ring is **+2 at 40, +5 at 45, +4 at 50** — the noise floor at 100 games is about ±10 on a cell, so "a little harder, not a different fight": the rotating ring already kills the road deck 86% of the time at 40 (S28's 80% was 30 games on S28's code). What the ring changes is the *shape*: games are 0.6–0.9 turns shorter, the flower is removed less (37 → 33 at 40; Vindicate is the remover in both), and the player dies under 2.2–2.4 laws on average (up to five or six) instead of one — the Tithe and the Toll stacked are what closes. Against the stock references the flower was already at 99–100%; the ring shortens those games by 1.5 turns. **Not passive**: shorter games and the same T1-flower rate say the body attacks as before; the laws stack on top rather than replace the attack. For the phase-two Heart's life the numbers say the ring alone is worth about a life step (≈ +4 over 40 → 45 on the rotating ring) — the planner takes it to Chris; no knob moved.

## Deviations from the brief

1. **The phase column is one phase-indexed knob**, `phaseTierTables`, not "a `phaseTwo` bundle on" the three knobs (Chris, 2026-09-16: a fresh set of knobs read as a function of difficulty and phase, scarred for phase three). The difficulty bundles override the whole knob, so each restates its phase-two column; the resolver takes `phase` as a parameter (the difficulty still arrives through the knobs). Phase 3 reads phase 2's column until one is authored.
2. **The stronghold gate refuses the descent**, the whole run (Chris: part of the challenge is the host of battles; no deck edits inside any dungeon). The lord's chamber is not separately gated.
3. **The petal telegraph gained a `notice`** (the refusal), and the editor's `back` became a union carrying the telegraph (`EditorBack`) — a shape change inside the controller, no save impact.
4. **The Continue summary was built, not "shown"** (the brief's Part 5 assumed a summary line that did not exist).
5. **`heartLawsPersist` reads as true for any phase-two world** regardless of the knob's value (the brief: "default false; true under phase two") — the phase-two Heart is the flood's by design, and a knob that phase two could switch off would contradict §7. If the planner wants the knob to be the only switch, it is one line in `heartLawsPersist()`.

## Concerns

1. **The phase-two column is unmeasured.** The tables are the brief's proposal; the S33/S34 matrix that set phase one's cells was against mid-road references at phase-one life. Phase two's player carries ten legends and a salvage deck (ADR-126) — the reference for measuring the column does not exist yet (the brief's Part 6 names it: the salvage yardstick). Until it does, the Lab's phase selector measures phase-two mages against phase-one rows, which reads harder than the flood will be.
2. **The accumulating ring is a small lever** (+2 to +5 against the road deck). If the phase-two Heart wants to be markedly harder, life (or a sixth petal, §7) does more than the ring; the ring's value is texture — dying under three laws — more than difficulty. Worth saying to Chris before the Heart's phase-two row is authored.
3. **The Dev panel shows the phase read-only.** A "set phase 2" dev button would let Chris feel the tables in play today, but it would be a shipped path to phase 2 (the deploy exposes `?dev=1`), which the brief forbids this session. One line when wanted.
4. **`doors()` lists every ruled site and template**; with ten phase-two doors the picker is ten entries. The pre-selection from a telegraph covers the common case; a "nearest door" default is not built.
5. **The parley's ruled-roamer path and the sites' door share one refusal line** (`quests.json` `door.refused`, the planner's colour line). The courts' shape gates will want their own lines ("you must bring bodies") — the pack's key is `{label}`-substituted only; per-rule lines are a `door.byRule?` map away.
6. **The heart-sim's "died at" column now reads the NEWEST law** on the flower's side (the accumulating ring keeps the older beneath); for the rotating ring that is the same single law as before, so the S28 column is comparable.
7. **The world-UI page is hand-kept** and already 1,700 words; the risk is drift. The rule in its header (the implementer updates it in the session that changes a screen) needs the brief's Part 4-style reminder each session, or a test that at least pins the screen list against `WorldScreen`'s union — not built.

## The implementer's estimate for S39 (the salvage)

- **`newWorld({ salvage: SalvageSpec })`** beside `{ starter }`: `NewWorldOptions` gains a `salvage` branch; `newWorld` skips `starterTemplate`/`starterDecklist` for a collection built from the spec (the ten legends from the legacy — `legacyCarry` already lists them; the five picks; the fifty-five-card pack; basics), `phase: 2`, a purse knob, no manalinks (the legacy's manalink terms skipped), the phase-two seed and town-name list (`generateWorld` takes a name list through the catalog — a `townNamesPhaseTwo` on the towns file or a second file). **~half a session** with tests, given the generator and the collection helpers exist.
- **The pick screen** (a new `WorldScreen` kind, `salvage`): five colour tabs over the pool filtered by `shopTier ≤ 3 && !prizeOnly` and the stronghold prize picker's colour rule (`strongholdPrizeList` does the per-colour filter today — reuse), one pick each, gold-priced cards allowed; then "choose your two colours" (ten pairs); then the editor opens on the assembled default deck (the twenty from the two colours' pack halves + basics to 30, legal by construction — `createDeck`'s shape) with a `mustLeaveLegal` guard (the editor cannot Cancel to a world without a legal active deck — today Cancel is always allowed; a one-flag change in `editorClose`). **~half a session** including the S10-pattern test (the picks bank, the pairs, the editor's forced legality).
- **The pack** as `data/world/salvage-pack.json` validated against the pool (fifty-five ids; ten per colour at tier ≤ 2; five colourless): a loader row and a reference render (`starters.md`'s sibling). Small.
- **The salvage yardstick** in `sim/road-decks` (two decks from the pack + a pick set at 12 life, journeyman, no basics): data the planner authors; the sweep's `road()` helper reads it unchanged. Small.
- **The flood scene** (text, the phase-one deck shown as lost — ADR-126 says nothing salvages from it, so the scene is a reading, not a pick) is a screen before the pick screen: small once the text exists.
- Total: **one session** if the pack and the yardstick lists arrive with the brief; the map's phase-two seed/palette/name list (design §3) is separate content.

## Registry entries added/changed

No R-numbers. Knobs: `phaseTierTables`, `heartLawsPersist` (docs/knobs.md regenerated). ADR-124/125/126 and the S37 ratifications in `docs/decision-updates/s38.md`. World: `Phase`, `TierTables`, `tierTablesFor`, `resolveMatchup(…, phase)`, `WorldState.phase` (+ the migration default, `newWorld({ phase })`), `heartLawsPersist()`, `StrongholdContentDef.deckRule?`, `CorollaPetalDef.deckRule?` (+ validators), enemies.md's phase column and site door notes; `mage-sweep --phase`; `heart-sim --persist` + the laws column. UI: `EditorBack`, `doors()`, `siteDoor()`, `openEditorForDoor()`, `saveSummary()`, the petal telegraph's `notice`, the telegraphs' door blocks, the Dev panel's phase line, the Continue summary; `labDecks(mode, phase)` through the resolver, `LabPhase`, the Lab's and dev setup's phase radios, `RosterSetup.phase`. Engine: nothing (S27's `accumulate` mode). Docs: `docs/reference/world-ui.md` (new), implementer-notes S38 lessons.

## Test status

Default tier **630 passed / 2 skipped (66 files)** (from 618 / 2 at the S37 close: +4 phase, +1 persist knob/spec, +1 site rules, +4 Heart persist fixtures, +1 stronghold door, +1 petal door; baselines: none re-based — the S27 `{ type: "lawSequence" }` spec pin holds at phase 1; enemies.md regenerated for the phase column). `pnpm typecheck` clean. Ladder gates untouched (no AI moved). Fuzz: the accumulate mode was fuzzed in S27 (`s27-heart-fuzz`, three modes, byte-exact replays); no new cards. heart-sim: 4,800 games (above). Sweep: the `--phase 2` banner smoke only (no full sweep owed).

## Suggested next

1. **Planner/Chris**: the Heart read (Concern 2) before the phase-two Heart row; the phase-two column stays ⚠ until the salvage yardstick exists (Concern 1); the per-rule refusal lines (Concern 5).
2. **S39**: the salvage per the estimate above — the pack and the yardstick lists in the brief.
3. **Smalls**: a dev "set phase" toggle when the brief allows; a screen-list pin for the UI page.

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm typecheck
pnpm exec vitest run packages/world/src/phase.test.ts packages/engine/test/s38-heart-persist.test.ts packages/ui/src/world/world-controller.test.ts packages/ui/src/world/corolla-controller.test.ts
pnpm heart-sim --games 100 --lives 40,45,50 --lands 20 --persist both
pnpm mage-sweep --games 100 --mode standard --phase 2 --part 5 --baseline none
pnpm knobs:doc / pnpm reference
pnpm viewer → /world (Continue's summary; a site's door needs a ruled def — none shipped) · /lab (mode + phase) · /play (dev setup: phase)
```
