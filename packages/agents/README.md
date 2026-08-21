# @shandalar/agents

Agents implement the engine's one `Agent` interface (ADR-015: agent-internal
randomness is a private seeded PRNG, never the game's logged RNG).

- **RandomAgent** — uniform over legal actions; the engine-correctness fuzzer.
- **SanePolicyAgent** — the ratified eight-rule filter floor (ADR-045 as
  amended); ladder rung 1.
- **HeuristicAgent** — evaluator-scored policy with simulated combat and
  softmax selection (ADR-049..051, ADR-056); ladder rung 2.

## Profile knobs (S9 Part 3 — the overworld's difficulty dials)

An `AiProfile` is `{ archetype, opponentDecklist, temperature, holdTricks, constants }`:

| knob | effect |
|---|---|
| `archetype` | evaluator exchange rates (`aggro`/`midrange`/`control` weights for life/material/hand) and combat damage pricing |
| `opponentDecklist` | ADR-051 known-list input: counter-hold threat counting; never hidden zones |
| `temperature` | ADR-050 softmax noise: near-ties are coin flips; higher = blunder more |
| `holdTricks` | whether pass earns counter-hold / flash-hold bonuses; when true, further conditioned on board posture (ADR-060.2: behind by more than `constants.posture.behindThreshold` → develop instead of holding) |
| `constants` | S11 (ADR-060.3) `EvalConstants`: every evaluator constant (archetype weights, keyword bonuses, deterrence, posture threshold) carried per profile so agents with different vectors can share a game. Default `DEFAULT_CONSTANTS` (journeyman's hand-tuned vector); `pnpm weight-search` searches a master vector |

**Deterrence (S11, ADR-060.1):** `evaluate` credits each untapped own
creature the profit of its best threatened trade against the opponent's
creatures (deathtouch trades up with anything; walls earn a fraction), and
the attack sim debits the same term per non-vigilance attacker — so "hold
the deathtoucher at home" and "attack into a death for nothing" finally
price differently. Zero on an empty enemy board.

`difficultyProfile(difficulty, deckArchetype, opponentDecklist)` builds the
three named tiers:

| difficulty | archetype | temperature | holdTricks | constants |
|---|---|---|---|---|
| `apprentice` | always `aggro` (flat, punchy) | 1.2 | no | defaults |
| `journeyman` | the deck's | 0.35 | yes | defaults |
| `master` | the deck's | 0.12 | yes | defaults (ADR-061: the S11 searched vector measured zero held-out edge and was reverted) |

The sim layer accepts `heuristic:apprentice` / `heuristic` (= journeyman) /
`heuristic:master` anywhere an agent kind goes (`pnpm fuzz --agents`,
`pnpm ladder --challenger/--baselines`). Monotonicity is demonstrated on the
ladder (mirrors, 500/cell): apprentice < journeyman < master — numbers in the
S9 handoff.
