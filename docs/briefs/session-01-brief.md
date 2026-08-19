# Session 1 Brief — Skeleton and vertical slice (M1, part 1)

Read first: `CLAUDE.md`, `handoff.md`, `docs/mechanics-manifest.md` (§1, §2, §6), `docs/engine-design.md`, `docs/data-model.md` (§1–3, §5–6). Registries: skim both; you will append.

## Goal

Stand up the TypeScript monorepo and implement the Tier 0 skeleton far enough that the two slice decks (manifest §6, pool registry "Session 1 slice") can play complete, legal games against each other with `RandomAgent` on both seats, deterministically, with replay. No UI. No art. No heuristic AI.

This session is about **architecture holding weight**, not card count. Twenty cards that flow through every system correctly beat sixty cards that shortcut one.

## Part 0 — Repo scaffold

- pnpm workspace; packages `core`, `cards`, `engine`, `agents`, `sim` (leave `ui` absent). vitest at root. Strict TS.
- `docs/implementer-notes.md` created with anything a successor needs (how you ran things, gotchas).
- `.gitignore`: `node_modules`, `dist`, `data/art/real/`, `results/`.

## Part 1 — core

- Seeded RNG with a logged `next()`/`shuffle()`/`pick()` API. Every call appends an RNG entry to the action log.
- Typed event bus.
- Id generation, action-log types per data-model §6.

## Part 2 — cards

- Card JSON loader + schema validation (reject unknown effect types, unknown keywords, missing fields).
- Effect vocabulary **types** for everything in data-model §3, and **resolvers** only for the words the slice uses: `damage`, `bounce`, `counter`, `draw`, `modifyPT`, `restrict`, `addMana`. Other resolvers throw `NotImplemented` with the word name — that is the correct behavior, and the validator should warn when a loaded card uses an unimplemented word.
- Slice cards as JSON in `data/cards/`. Token defs folder present but empty.

## Part 3 — engine

Implement in this order; each with tests before moving on:

1. `GameState`, `GameObject` (owner ≠ controller field present), zones, `moveObject` emitting `ZONE_CHANGE`.
2. Turn structure with all steps and priority passing (R-001, R-002).
3. Mana pool, cost parsing (generic/colored/**X**), auto-pay (ADR-004). Lands tap for mana as a non-stack action.
4. Stack: cast spell path (R-003), activate ability path (no S1 card activates, but the path exists for equip later — a test with a synthetic ability is fine), resolution with target re-check and fizzle (R-004).
5. Targeting predicates: `creature`, `anyTarget`, `spell`, `permanent` (Boomerang), plus the legality re-check.
6. SBAs (R-007): lethal damage, toughness ≤ 0, life ≤ 0, empty-library draw, illegal aura attachment. Single routine, looped.
7. Continuous effects + `characteristics()` per ADR-003 with P/T mods (static and EOT) and `restrict`. Pacifism is the test.
8. Combat (R-008): all five steps; flying/reach/first strike/haste/vigilance; assignment and dealing as separate functions; first-strike step only when relevant. Pump-in-response and Bolt-in-response during declare blockers are the tests.
9. Triggered abilities: ETB via `ZONE_CHANGE` to battlefield; goes on stack at next priority; APNAP; deterministic ordering interim for same-controller (log it as an interim in the rules registry, R-016).
10. Legal-action enumerator (engine-design §11).
11. Match runner: MatchSpec → MatchResult, London mulligan simplified, **modifiers hook present and called with an empty array**, win conditions, `maxTurns` guard, facts derived from log.
12. Replay: `replay(log)` reproduces final state; assert byte-identical serialized state.

## Part 4 — agents & sim

- `RandomAgent` choosing uniformly from legal actions; `chooseOne` stub (first option) logged as interim.
- `sim` fuzzer: `pnpm fuzz --games N --seed S` runs random vs random on the two slice decks; reports terminations by reason, mean turns, and any thrown errors with seed for reproduction.

## Scenario fixtures (minimum; write as vitest cases reading small JSON fixtures)

1. Bolt a 2/1 → dies via SBA, not in the damage code.
2. Bolt a 2/2 with Brute Force in response → survives; EOT the pump ends; cleanup clears damage.
3. Counterspell a Bolt → Bolt to graveyard, no damage.
4. Boomerang a creature in response to Pacifism targeting it → Pacifism fizzles, goes to graveyard.
5. Pacified creature cannot be declared as attacker or blocker (enumerator excludes it).
6. Man-o'-War ETB bounces itself when it is the only creature (trigger must target; legality with self).
7. Serra Angel attacks and does not tap; can block next turn.
8. First strike 2/1 blocked by a 2/2 → 2/2 dies first; no damage back.
9. Flying creature cannot be blocked by non-flying/non-reach.
10. Drawing from an empty library → loss at next SBA check.
11. Replay determinism over a 3-game sample with different seeds.
12. Fuzz: 1,000 games, zero exceptions, every game terminates.

## Definition of done

1. All twelve fixtures green; unit tests per engine subsystem.
2. `pnpm fuzz --games 1000` clean; results summarized in the handoff.
3. Replay test is a permanent fixture.
4. Rules registry rows R-001..R-012, R-016, R-017, R-018, R-027 updated to `implemented` with any simplifications noted; new rows appended if you touched anything unlisted.
5. Pool registry: slice cards moved to `implemented`/`tested`.
6. `handoff.md` per template. Concerns section is expected to be non-empty; this is the session most likely to find that a Tier 0 assumption needs adjustment.

## Out of scope

UI of any kind (not even a console renderer beyond a one-line-per-action log dump — a viewer is the most predictable scope creep from an engine session that starts producing fun output). Heuristic AI. Art fetching. Any card not in the slice. Any effect resolver not needed by the slice. Performance tuning beyond "1,000 games finish in reasonable time."

## Escalate, don't decide

- Any rules situation where CR and the manifest seem to disagree, or the manifest is silent → implement the CR reading if unambiguous, log R-entry as interim, flag in Concerns. If ambiguous, stub and flag.
- Any need to add an effect word or keyword not in data-model §3.
- Any temptation to give `engine` knowledge of agents or UI.
- Any slice card that turns out to need a carve-out (e.g., Man-o'-War's self-target edge). Flag; don't special-case.
- Architecture changes to the ADR-003 layer order or the assignment/dealing split.

## Elicitation (questions you may ask Chris at session start)

Node/pnpm versions on his machine; whether to target ESM-only; preferred test file layout.
