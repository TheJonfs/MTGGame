# CLAUDE.md — Shandalar-like

## What this project is

A single-player game inspired by MicroProse's *Magic: The Gathering* (1997, the Shandalar game): an overworld where the player travels, takes quests, and grows a collection, with battles resolved as games of Magic played from a **curated pool of real cards**. Two coupled engines: a **rules engine** (this phase) and an **overworld engine** (later). The rules engine is a library the overworld calls; it never knows about the world.

The guiding constraint: *the pool is designed to the engine, not the engine to the pool.* No single-card carve-outs. Ever. If a card needs one, the card is cut or the vocabulary grows deliberately.

## Roles and workflow

**Chris — Director.** Owns all decisions: pool composition, what mechanics enter the ceiling, what gets deferred. Carries context between planner and implementer.

**Planner Claude (claude.ai chat).** Architecture, design docs, registries, card-pool curation, session briefs, roadmap. Reviews handoffs with Chris and scopes the next session.

**Implementer Claude (Claude Code — you, if reading this in a repo).** Executes the current session brief. Writes code and tests, updates the handoff, surfaces concerns. You implement decisions; you don't relitigate them — but **flag concerns in the handoff** when implementation reveals problems the planning missed. That feedback loop is wanted and has historically been the most valuable part of the handoff.

## Session protocol

At session start, read in this order:
1. This file.
2. `handoff.md` — state of the world at the end of the last session.
3. Your session brief: `docs/briefs/session-NN-brief.md` (highest-numbered unless Chris says otherwise).
4. Whatever the brief tells you to read (typically `docs/engine-design.md`, `docs/data-model.md`, and named registry entries).

**Fuzz before fixtures.** Whenever a session integrates new cards into the slice decks, run a fuzz smoke (≥300 games across all pairings) *before* writing scenario fixtures. Cost/payment/enumeration bugs live in random-line territory; fixtures rarely find them (S3 concern 1: `canPay` counted an ability's own tap-cost source as a producer, caught at seed 32).

At session end, **overwrite `handoff.md`** using the template at the bottom of this file, and commit. Git history is the archive; never create `handoff-2.md` variants.

## Non-negotiable engineering principles

1. **Determinism.** All *game* randomness goes through the seeded RNG service (shuffles, random discard, coin flips); agent-internal randomness is separate (ADR-015). Same seed + same actions ⇒ identical game. Replay from log is a permanent test.
2. **Skeleton first.** Tier 0 systems in `docs/mechanics-manifest.md` §2 exist from Session 1 even when no card uses them. Adding a mechanic later must mean adding a rule to an existing step, never restructuring a step. *Trample is a rule about damage assignment, not a rewrite of combat.*
3. **Cards are data.** Card definitions compose a fixed effect vocabulary (`docs/data-model.md`). Any card that can't be expressed is escalated, not scripted.
4. **One zone-move primitive.** Every object movement between zones goes through `moveObject`, which fires events. No direct array manipulation of zones anywhere else.
5. **SBAs in one place.** Nothing outside the state-based-actions routine decides that a creature is dead or a player has lost.
6. **Engine never imports overworld.** And never imports UI. Agents (human/AI/random) sit behind one interface.
7. **Escalate, don't decide.** Rules ambiguities, mechanics not in the manifest, and card-pool changes go in the handoff's Concerns, not into code. Interim choices are allowed only when the brief says so, and must be logged.
8. **Tests are the spec.** Scenario fixtures (board state → actions → assertions) accompany every mechanic and every card batch.
9. **Oracle grounding.** No real-card fact (mana cost, P/T, types, text) is ever taken from memory — planner or implementer. Briefs carry Scryfall-verified stats; the implementer re-verifies against Scryfall before encoding and flags any mismatch with the brief. (S2 concern 1; two planner errors were caught this way.)
10. **Rules grounding.** Any non-obvious rules interaction asserted in a brief or fixture cites the Comprehensive Rules section. The implementer verifies cited rules the way it verifies Scryfall stats and flags disagreement rather than implementing the brief's reading. (S3 deviation 1 was a planner rules error on 510.1c.)

## Repository map

- `CLAUDE.md` — this file.
- `handoff.md` — implementer-owned; overwritten each session.
- `docs/mechanics-manifest.md` — ratified scope: skeleton, ceiling, exclusions, representative cards. Planner-maintained; read, don't edit.
- `docs/engine-design.md` — architecture: packages, game loop, stack, effects, combat, agents.
- `docs/data-model.md` — card schema, effect vocabulary, MatchSpec/MatchResult, modifiers, action log.
- `docs/roadmap.md` — milestone sequence; planner-maintained.
- `docs/decisions.md` — architecture decision record (ADR-NNN); planner-maintained.
- `docs/implementer-notes.md` — **yours**; practical notes for your successors. Create in Session 1.
- `docs/registries/rules-registry.md` — R-numbered entries: which Comprehensive Rules mechanics we implement, how, and known simplifications. Repo-canonical; you append, planner reviews.
- `docs/registries/pool-registry.md` — the card pool: every card's status (planned / implemented / tested / cut) and the vocabulary words it uses. Repo-canonical.
- `docs/briefs/` — numbered session briefs; never edit existing ones.
- `packages/` — TypeScript monorepo (see engine-design §1). Tests: `pnpm test` = smoke fuzz; `FUZZ_FULL=1 pnpm test` = full (ADR-034).
- `data/cards/` — card definition files. `data/art/` — images (gitignored except custom-card folder).
- `assets/` (later) — build-time fetched art.

## Working style

Chris oscillates between **explanatory mode** (explain the implementation, teach the concept) and **implementation mode** (write the code, keep him at the integrated-vision level). He'll signal which; when in doubt, ask. Be direct about tradeoffs and disagreements. Don't refactor outside the brief's scope without asking.

## handoff.md template

```
# Handoff — after Session NN (YYYY-MM-DD)

## State of the world
One paragraph: what works, what's wired, how to run it.

## Done this session
Bulleted, mapped to the brief's definition-of-done items.

## Deviations from the brief
Each: what, why, what the planner should rule on.

## Concerns
Things implementation revealed that the planning missed. Rules ambiguities, architecture smells, cards that strained the vocabulary. This is the most important section.

## Registry entries added/changed
R-numbers, pool-registry rows.

## Test status
Counts, any skipped/flaky, any re-baselined fixtures (with reason).

## Suggested next
Your view of what Session NN+1 should do, for the planner to consider.

## How to run
Exact commands.
```
