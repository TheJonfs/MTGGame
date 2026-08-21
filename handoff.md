# Handoff — after Session 12, Parts 0–2 (2026-08-21)

## State of the world

Session 12 delivered **Parts 0–1 of the M6a brief and the Part 2 carving Chris ratified**: the engine ante rule (R-043), `startingLife` on the view with the `max(8, startingLife/2)` race rule, the ADR-061 riders, the knobs registry — and now the **headless world core**: catalog v0 (`data/world/`), a seeded generator with a 200-seed invariant fuzz, `WorldState` + `world-save-v1` round-trip, the duel seam (`parley` → `prepareDuel` builds the `MatchSpec` from world state → the engine's `runMatch` → `applyDuelResult` moves ante/gold/world life), the play client generalized to take an explicit spec, five opponent portraits rendered, and a ladder at world life 10 showing the difficulty tiers still separate. **Nothing visual for the world exists yet** — that is S13 (map, parley screen, shop, save/load UI, Chris playing). 180 tests default tier; FUZZ_FULL green (see Test status). The acceptance journey runs headless end-to-end through real duels.

## Done this session

- **Carving (Chris ratified):** S12 = Parts 0–1 + headless Part 2 ((a) catalog/generator/state/save, (b) duel seam + client generalization, (c) portraits); S13 = the walkable loop UI with director rounds; M6b = deck editor; card batches deferred to their own half-session.
- **Part 0 — ante (R-043)**, `GameView.startingLife` + race rule (zero-delta proved: S11 mirror seeds reproduce 1361/2000 exactly), riders (`info/per-deck`, master → `DEFAULT_CONSTANTS`, opt-in blockers pause). Details in the previous handoff section below the line — kept verbatim.
- **Part 1 — knobs registry** (`packages/world/src/knobs.ts`, `docs/knobs.md` generated + test-pinned). Two knobs added for Part 2 — `startingGold` (20) and `fleeOddsByTier` ({1:.6, 2:.5, 3:.4}) — registry first, per the brief's rule.
- **Part 2a — catalog v0 + generator + state + save:**
  - `data/world/{regions,towns,opponents}.json` (catalogVersion `v0`): 6 region templates (3 civilized, 2 approach, 1 wild, each with a colour and preferred town names), 14 town names, **15 opponents** = decks A–E × tiers 1/2/3 (apprentice/journeyman/master), each named, with a portrait slug, `worldLife` (8/10/12 by tier), colour identity, and knob overrides (tier 3 carries `anteCount: 2`). `catalogFrom()` validates browser-safely (deck keys exist, tiers, knobs via `assertKnobSource`); `@shandalar/world/loader` is the fs subpath, mirroring cards.
  - `generateWorld(seed, catalog, opts)`: L1-Voronoi regions around spaced hearts (connected by construction), 3 civilized + 2 approach + 1 wild, rough terrain at 10% then **carved** so every town is reachable from the start and every region has a reachable cell, towns as fixed points with spacing (≥2 guaranteed), `placeFixedPoints` API present for strongholds (count 0 in the slice), opponent rosters per region from tier tables (civilized 1/1/1/2, approach 2/2/3/1, wild 3/3/2). `WorldRng`: the same mulberry32 with **explicit serializable state** (core's `SeededRng` has none), so a save resumes its stream exactly. Generation is a pure function of the seed; the journey RNG is a separate stream so regenerating a map never perturbs a saved journey.
  - `WorldState` (`world-save-v1`): catalogVersion, seed, difficulty, map, player (position, worldLife, gold, collection as cardId→count, activeDeck, basicLand, stepsTaken), opponent instances (defeated flag), rng state, duel records (each carries the full `shandalar-log-v1` payload — every duel log is viewable), gameOver. `newWorld` starts in town 0 with world life 10, gold 20, collection = starter deck + `starterSpares` (half basics of the deck's colour, half its cheapest nonland commons). `serializeWorld`/`deserializeWorld` round-trip byte-identically; other formats rejected.
  - **Invariant fuzz (200 seeds):** ≥2 towns, all towns reachable, no orphan region, towns never adjacent, every region has a roster, deterministic per seed (20 seeds compared byte-for-byte).
- **Part 2b — the duel seam (`journey.ts`):** `advance(world, catalog, path)` walks one cell per step (the clock), rolls an encounter per non-town step by the region's `encounterRatePerStep`, picks from the region's undefeated roster, stops at the first encounter; `walkTo` = BFS path + advance. `parley(world, catalog, enc, choice)`: **buy-off** = `buyOffBase × tier` gold (refused when broke); **flee** = the ante is forfeit either way (world picks `anteCount` random nonland cards of the deck, the way the engine would), then a seeded contest at `fleeOddsByTier` — success escapes, failure means the fight happens anyway (stakes compound, by design); **fight** = `prepareDuel`: `MatchSpec` with the player's deck vs the catalog deck, `agent: heuristic:<difficulty>`, `rules.startingLife = world life`, `rules.ante = anteCount` (opponent layer applied), and the enemy's world life as a `startingLife` **modifier** on seat 1 — the ADR-002 hook's first real use, no engine change (the per-player modifier already existed). `applyDuelResult`: win → collection += their ante, gold += `goldRewardByTier`, opponent defeated; loss → **forfeit your ante from collection AND active deck, refill the deck with its basic land (Chris's slice ruling — the deck never drops below the floor)**, world life −`lossLifePenalty` floored at `lifeFloor`, `gameOver` at 0; draw → stakes return. `deckLegal` enforces the 30-floor / 4-cap (basics exempt) at duel start.
  - **Play client generalized:** `MatchController` takes either the slice-deck form or `custom: { human{name,decklist}, enemy{name,decklist,difficulty,archetype,portrait}, rules{startingLife,ante}, modifiers }` — the world's handoff shape. Acceptance test: a custom duel starts at 10 life vs an enemy at 8 (modifier), ante 1 each side, named players, concede → `facts.ante` populated.
  - **Acceptance journey (headless, both halves of the brief's scripted list):** new world → forced encounter (event-layer rate 1) → buy-off (gold deducted or refused by tier) → flee (ante leaves collection+deck, basics refill, deck legal, owned count unchanged) → fight through **real duels** (journeyman player vs catalog enemy) until both a win and a loss are observed: win = their ante in the collection + tier gold + opponent defeated; loss = your ante gone, deck refilled, world life −1; save → load identical after a duel including the log; game-over at the floor; region tiering (civilized rolls tier 1/2 only; you start in a civilized town).
- **Part 2c — portraits:** five opponent subjects (`docs/art/subjects/portrait-opponent-{red,white-blue,green,black,simic}.md`, locked descriptors per `docs/prompts/portraits.md`, two washes each), rendered via the skill, thumbs copied to `packages/ui/public/portraits/`, MANIFEST rows added as *candidate — Chris verdict pending*.
- **Measurement — world life 10** (`pnpm ladder --life 10`, 200/cell mirrors, seed 1): journeyman vs sane **PASS every mirror** (A 67.5/64.0, B 68.5/73.5, C 76.0/54.0, D 74.5/60.0, E 71.0/55.0; games 10–23 turns vs 16–30 at life 20); apprentice vs journeyman 26.5–50% (aggregate ~39%; the known E-on-the-play cell sits at exactly 50); master vs journeyman 45–60%, aggregate **+2.05%** (thin, as at 20 life; B mirrors 47.5/47.5 are where it slips). **The tiers still separate at 10 life; the race-rule fix did its job (no all-in-from-turn-one).**

## Deviations from the brief

1. **Scope = Parts 0–2 headless** (Chris's carving); Part 3 UI and the human half of Part 4 are S13.
2. **Engine touch is exactly Part 0** (ante + `startingLife` on the view). The enemy's world life uses the existing per-player `startingLife` modifier — no engine change.
3. **Two knobs added** (`startingGold`, `fleeOddsByTier`) — the brief's "add to the registry first" path; both in the generated doc.
4. **Flee forfeits are world-picked** (random nonland cards of the active deck, seeded) because no duel happens to set an ante zone — the only way "fleeing forfeits yours" can be literal. A failed flee then fights **and** antes again (compounding stakes); say so if the planner wants failed-flee to reuse the forfeited stake instead.
5. **Human sits seat 0 in world duels** (on the play) for the slice; the on-the-play/draw choice is a one-line world option later.
6. **`GameView.startingLife` / `GameRules.ante` required / race threshold** — as in the Parts 0–1 handoff (ratify).
7. **Generator fuzz asserts "every region has a reachable cell"** rather than "every passable cell reachable" — carving guarantees towns and regions, not every pocket of terrain; pockets are harmless (nothing is placed in them) and would cost a flood-fill per seed to forbid.

## Concerns

1. **S13 is the visible half and will draw director rounds** — the cartographic map is new art. Everything it sits on (knobs, ante, duel seam, save format) is now frozen and tested; the map can iterate freely.
2. **Save format is live from here:** `world-save-v1` ships with this commit; any schema change must be a `v2` with a migration (brief's rule). The S13 UI must not reach into the world state in ways that need new fields without versioning — list needed fields in S13's handoff.
3. **Difficulty at 10 life:** master's edge is +2% — at world life the "scarier top tier" is worldcraft (tier-3 decks, modifiers, ante 2), exactly as manifest §1.1 says; ADR-062's surgical 2-ply remains the only AI lever.
4. **The opponent catalog is thin by design** (15 entries, slice decks): names and portraits are per colour; tier badges will have to carry the tier visually in S13. Boss decks from the full pool are M6b+ content.
5. **`data-model.md §5`** still needs `rules.ante` and `MatchFacts.ante` (planner-maintained).
6. **What the WorldState wanted that the manifest didn't name** (DoD concern, answered early): `basicLand` per player (the refill rule), `defeated` on opponent instances (so rosters thin as you win — otherwise regions never clear), a separate journey RNG stream from the generator's, and `gameOver` as explicit state rather than derived (the UI needs one flag).
7. **For M6b's editor:** the collection model is `cardId → count` plus the active decklist; the editor needs (a) ownership minus cards in decks as the "spares" view, (b) basics as infinite (the collection holds counts for bookkeeping but they should never gate), (c) deck legality = `deckLegal`. Nothing here precludes it.

## Registry entries added/changed

- **R-043 Ante** (S12 Part 0). No pool changes. New package `@shandalar/world` with `./loader` subpath; new `data/world/` catalog; new `docs/knobs.md` (generated).

## Test status

Default tier: **180 passing / 2 tier-skipped, ~11s** (adds 12 world tests incl. the 200-seed fuzz and the real-duel acceptance, + 1 controller custom-path test, on top of the ante/knobs tests). FUZZ_FULL: **180 passing, exit 0, ~101s**. Typecheck clean. Ladder: life-10 tables above; the zero-delta identity check from Parts 0–1 stands.

## Suggested next

**S13 — walk it:** `/world` route: cartographic map (wash per region tier, ink borders, town glyphs, player chip, path preview, steps ticking), encounter reveal + parley screen (Fight/Flee/Buy off with the real prices/odds), duel launch into the play client via `custom` and return through `applyDuelResult`, collection browser (gallery filtered to owned), town + shop (seeded stock by region colour, knob pricing — the one headless piece still unbuilt), save/load (autosave on town entry, manual, download/upload), game-over. Then Chris plays the loop. Budget two director rounds.

## How to run

```
pnpm test                          # default tier ~11s (world tests included)
FUZZ_FULL=1 pnpm test              # full tier, exits 0
pnpm knobs:doc                     # regenerate docs/knobs.md (test-pinned)
pnpm ladder --life 10 --mirrors    # world-life duels measurement
pnpm viewer                        # /play unchanged; /world is S13
```

---

### Parts 0–1 detail (from the mid-session handoff, kept for the record)

- **Ante (R-043):** `GameRules.ante` (default 0), `ZoneName "ante"` + `PlayerState.ante`, `Game.setAside` after shuffle/before hands (first n nonland from the top; lands skipped), `ANTE_SET` → `facts.ante`, replay/viewer carry it; 6 fixtures.
- **`GameView.startingLife`** + race mode at `life ≤ max(8, startingLife/2)`; evaluator life term uses it; zero-delta proved (1361/2000 identical at 20 life).
- **Riders:** ladder `info/per-deck`; master → `DEFAULT_CONSTANTS`; default-off "blockers, even with no legal block" stop.
- **Knobs registry** with generated, test-pinned `docs/knobs.md`; ADR-058 wording re-applied after the planner's file overwrote it.
