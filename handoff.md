# Handoff — after Session 12, Parts 0–1 (2026-08-21)

## State of the world

Session 12 was deliberately cut to **Parts 0 and 1 of the M6a brief** (Chris's call after the carving discussion: prove the seams, then check in before Part 2). Both are done and green: the engine has the **ante rule** (`rules.ante: n`, new `ante` zone, `ANTE_SET` event → `MatchResult.facts.ante`, R-043), `startingLife` rides on the `GameView` so the AI's race heuristic keys off the real starting life (Chris's `max(8, startingLife/2)` rule — a proven **zero-delta** at 20 life: the S11 mirror run reproduces byte-identically, 1361/2000), the ADR-061 riders landed (ladder `info/per-deck`, master → `DEFAULT_CONSTANTS`, the opt-in blockers pause), and `packages/world` exists with the **knobs registry** (`knobs.ts`, precedence merge, difficulty bundles, `docs/knobs.md` generated and test-pinned). 167 tests FUZZ_FULL, exit 0. Nothing from Part 2 onward has started. The planner's new `decisions.md` had silently reverted the ratified ADR-058 wording; re-applied (verified edit).

## Done this session

- **Carving discussion (Chris ratified):** S12 = Parts 0–1; check-in before Part 2; S13 = the walkable loop with room for director rounds; deck editor opens M6b; card batches deferred to their own half-session between M6a and M6b.
- **Part 0.1 — Ante (R-043):** `GameRules.ante` (default 0; `DEFAULT_RULES.ante = 0`; `MatchSpec.rules.ante?` → `runMatch`). New `ZoneName "ante"` + `PlayerState.ante: string[]` + `zoneArray` case — a separate per-player array that nothing iterates, so it is invisible to every predicate, scope, and count by construction (`librarySizes`, draws, bottoming, searches all read `library`). `Game.setAside(player, n)` after the shuffle, before hands: scan the library top-down, move the first n NONLAND cards via `moveObject` to `ante` (lands are skipped, not moved); all-lands ⇒ fewer/zero. `ANTE_SET {player, cardIds, objectIds}` event, logged by `wireFactEvents`; `deriveFacts` fills `facts.ante: [string[], string[]]`. Replay carries `ante` through `GameRules`; the viewer bridge passes `spec.rules.ante ?? 0`; `MatchController` passes the engine default (the world passes its knob in S13). **Fixtures** (`packages/engine/test/ante.test.ts`, engine-only pass-first agent): n=1, n=2, all-lands (facts `[[],[]]`), ante 0 = no-op, replay byte-identical + same-seed same stakes, nonland-only check.
- **Part 0.1 (agent, Chris's rule):** `GameView.startingLife` (from `GameState.startingLife`, set by `initialGameState`); heuristic race mode at `life ≤ max(8, startingLife/2)`; evaluator's life term uses `startingLife` instead of the literal 20. **Zero-delta proof:** mirrors-only 200/cell seed 1 vs sane = 1361/2000 (68.05%), E-E 62.0/59.0 — identical to the S11 run. No-peeking key list updated (`startingLife` is public information).
- **Part 0.2 — riders:** (a) ladder output `gate/aggregate` → `info/per-deck (… NOT a gate; ADR-061)`, field `perDeckMajority`; (b) master → `DEFAULT_CONSTANTS` (one line; `MASTER_CONSTANTS` stays exported as the record of the search only; README row updated); (c) **default-off** menu stop "blockers, even with no legal block" — pauses the declare-blockers step when no block is legal but the human controls an untapped creature (prompt: "No legal blocks (menace or evasion) — confirm to continue"); persisted; browser-verified.
- **Part 1 — knobs registry** (`packages/world`, browser-safe, depends only on `core`): `KNOBS` (the 10 v0 knobs with default/unit/description), `resolveKnobs(layers)` merging `defaults < difficulty < region < dungeon < opponent < event` **whole-value per key**, `assertKnobSource` rejecting unknown keys loudly (authored JSON typos), `DIFFICULTIES` easy/standard/hard (standard = defaults; easy/hard UNTUNED placeholders, flagged in code and doc), `docs/knobs.md` **generated** by `pnpm knobs:doc` with a test asserting the file matches the generator (principle 11 — the doc cannot drift). Tests: defaults by value, precedence, unknown-key rejection, bundles, doc sync.
- **Housekeeping:** ADR-058 wording re-applied after the planner's file overwrote it.

## Deviations from the brief

1. **Session scope cut to Parts 0–1** — by agreement with Chris after the carving discussion (the M6a brief is 2–3 sessions of work; seams first).
2. **`GameView.startingLife` is a new view field** — needed for the race rule Chris directed; public information, but it widens the ADR-048 view shape. Ratify.
3. **Race threshold `max(8, startingLife/2)`** (Chris's refinement of my relative-only proposal) — an agent change during the parked AI workstream (ADR-062), labeled correctness: identical at 20 life (proved), only differs when `startingLife ≠ 20`.
4. **`GameRules.ante` is required** (with `DEFAULT_RULES.ante = 0`) rather than optional — two test call sites updated; `MatchSpec.rules.ante` is optional at the contract edge. Keeps the engine's rule object total.
5. **Knob merge is whole-value per key** (tier maps replace, not deep-merge) — simplest to author and reason about; documented. If the planner wants "override just the wild tier", that's a deliberate registry rule change, not a bug.

## Concerns

1. **Ante soft-lock in the slice (ruled, not yet built):** ante losses shrink the collection; with the active deck fixed and no editor, a few losses put the deck under the 30-floor and dueling is blocked. Chris ruled: **slice = auto-replace ante'd-away deck cards with basics of the deck's colour between duels; full game = fork into the deck editor before any duel when below the floor** (add a basic, or swap in a spare). Goes into the Part 3 handoff logic in S13; recording here so the planner can ratify the interim.
2. **`data-model.md §5` needs `rules.ante`** and `MatchFacts.ante` (planner-maintained; not edited).
3. **World life 10 and the AI**: the threshold fix removes the "all-in from turn one" failure mode, but the AI has never been *measured* at 10-life duels — expect short, burn-heavy games; whether the difficulty tiers still separate at 10 life is an open measurement for the world session (cheap: ladder with `startingLife: 10`).
4. **Difficulty bundles easy/hard are placeholders.** Only `standard` is meaningful; the brief said so, the doc says so, the code says so — but anyone reading `DIFFICULTIES` should not mistake them for tuned.
5. **`startingLife` leaks nothing new** but the no-peeking key list is now the canonical view shape — future view additions must touch that test deliberately.
6. **Part 2 carving suggestion for the check-in:** (a) catalog v0 + seeded generator + invariant fuzz + `WorldState` + `world-save-v1` round-trip, all headless; (b) the headless duel seam — `buildMatchSpec(world, encounter)` → `runMatch` → `applyMatchResult` (ante transfer, gold, life/floor) + the play client generalized to take an explicit spec (decklists, profile, names/portraits, `startingLife`, `ante`, modifiers) — with the scripted acceptance journey as DoD; (c) opponent portraits via the render skill in parallel. Then S13 is map + parley + shop + save/load UI + Chris playing.

## Registry entries added/changed

- **R-043 Ante** (CR 407 lineage; nonland-only top-n after shuffle; separate zone; `ANTE_SET` → facts) — added to `rules-registry.md`.
- No pool changes.

## Test status

Default tier: **165 passing / 2 tier-skipped, ~11s** (adds 6 ante fixtures + 5 knobs tests). FUZZ_FULL: **167 passing, exit 0, ~95s**. Typecheck clean (incl. the new `world` package). Ladder identity check: 1361/2000 reproduced exactly. Browser-verified: blockers-pause toggle in the menu; ante 0 / startingLife 20 in a live play-mode game; no console errors.

## Suggested next

Check-in with Chris on the Part 2 carving (Concern 6); then the headless world core. Everything the map UI will sit on — knobs, ante, the duel seam, save format — should be frozen before a pixel of map is drawn.

## How to run

```
pnpm test                   # default tier ~11s (ante + knobs included)
FUZZ_FULL=1 pnpm test       # ~95s, exits 0
pnpm knobs:doc              # regenerate docs/knobs.md from the registry (test-pinned)
pnpm ladder / pnpm viewer   # unchanged
```
