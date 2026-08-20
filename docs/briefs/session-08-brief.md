# Session 8 Brief — M4a: agent-facing view, evaluator v1, ladder, first custom card

Read first: `CLAUDE.md`, `handoff.md`, `docs/decisions.md` ADR-045(amended)..053, `docs/data-model.md` (CardDef `text`), `docs/prompts/card-art.md`, pool append. S7 handoff Concerns 1–2 are design input for Part 2.

## Goal

A HeuristicAgent v1 that beats SanePolicyAgent from every deck's seat, measured on the ladder, with its known-dumb moves pinned by tests — plus the first custom card through the full pipeline. This is M4a; tuning beyond "beats sane everywhere" is M4b.

## Part 0 — The view (ADR-048; engine work, do first)

1. `GameView` gains `combat` (attackers, blocks-so-far, step), `mulliganCount`, and live characteristics (effective P/T + keywords) on every visible object.
2. Target-choice requests (spells, abilities, **triggers**) carry `sourceCardId` + an effect-classification summary; trigger targets chosen when the ability goes on the stack (identity added to the request; no rules change).
3. Permanent **no-peeking test**: seat views never contain the other seat's hand/library contents. 
4. Retire SanePolicyAgent's per-instance memory (S7 deviations 1–2) and give its rule 8 trigger-target preference (S7 concern 6). Re-run `agent-stats` sane baselines; note any drift in the handoff.

## Part 1 — Evaluator v1 (in `agents`, sharing rule 8's classification table)

`evaluate(view, profile) → number`, one function, archetype weight profiles (`aggro | midrange | control`, declared in the AI profile; opponent decklist known per ADR-051):

- Terms: board material (mana-value-weighted, keyword bonuses), own/opponent life (weights differ by archetype), hand size, board presence vs known opponent archetype (e.g., discount going wide when the known list has Wrath/Pyroclasm — implement as a simple "sweeper risk" dampener when opponent's list contains mass removal and own board exceeds N).
- **Book of shame** (permanent scenario tests over the evaluator; score-ordering assertions, noise-immune per ADR-050): self-Control-Magic ≈ 0 gain; re-equipping the same host ≈ 0; burn at own face < any other use; chump-block into nothing < no block; tapping own creature with Tactician for no benefit < passing.

## Part 2 — Action policy + combat

- Score candidate actions by evaluating the resulting state where computable without hidden info (land, cast permanent, activation with deterministic effect); hand-written scores where not (holding counterspell mana: small bonus for passing with counter + mana up while opponent's list has threats ≥ N mana).
- **Combat is simulated**: candidate attack sets evaluated against the opponent's greedy best-response block using the engine's real assignment/dealing functions on a copied state (perfect information once declared). Greedy per-creature construction, O(attackers × blockers); same for own blocks. This is the one place the agent runs engine code forward — document the seam.
- Selection: softmax over scores, per-profile temperature (ADR-050), agent PRNG.

## Part 3 — Ladder (ADR-049)

`pnpm ladder`: heuristic-v1 vs sane and vs random, all 10 pairings **both seatings reported separately** (two-number), 1,000 games/cell CLI (100/cell committed smoke). Ship gate: beats sane in every deck's hands, both seatings; no rung regressions. Full tables in the handoff.

## Part 4 — Cunning Tactician (ADR-052/053; separable to next session if this one runs long — say so in the handoff rather than rushing it)

1. `tapTarget` resolver (first user); CardDef `text` field (validator: required iff `source: custom`); card JSON per the append; frame renders `text` for customs.
2. Fixtures: tap-before-declare prevents the block; tap-after-declare does **not** remove the blocker; vigilance attack + activate in the same combat; rule-8/evaluator prefers opponent-side targets.
3. Art: four candidates per `docs/prompts/card-art.md`, **stop for Chris's pick**, crop 5:4, wire via `art.asset`, gallery caption reads "custom · [style] · 2026".
4. Deck B swap per append; sane + heuristic baselines re-run after.

## Riders

Inline text field for gallery notes (replace window.prompt); `pnpm gallery` alias; W-glyph contrast pass on light name bands (planner accepted S7 concern 3).

## Definition of done

1. Parts 0–3 complete; ladder gate met (or the honest tables showing where it isn't — do not tune past the session budget; M4b exists).
2. Book-of-shame suite green and permanent; no-peeking test permanent.
3. Part 4 done or explicitly deferred with reason.
4. All prior tests green; sane baselines re-run post-Part-0.
5. `handoff.md`; Concerns expected: which evaluator terms carried the win rate and which were dead weight, where greedy combat search visibly misplays (feed M4b), profile/temperature defaults.

## Out of scope

Multi-ply search, difficulty profiles beyond default temperature, opponent hand modeling, new real cards, overworld. Evaluator sophistication past "beats sane everywhere" — M4b tunes.

## Escalate, don't decide

Any evaluator input not available from the ADR-048 view + known decklists; any engine change beyond Part 0; any second custom card.
