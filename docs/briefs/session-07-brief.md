# Session 7 Brief — Instrumentation: SanePolicyAgent, card gallery, riders (M3.75)

Read first: `CLAUDE.md` (principle 11 is new), `handoff.md`, `docs/decisions.md` ADR-042..046, `docs/art-direction.md` §3 (hand-frame change, ADR-043), `docs/art/printings.md` (Rager override).

## Goal

Make the project inspectable by a human before M4: an agent whose games are worth watching, and a gallery that puts every card and its art in front of Chris for aesthetic review. Plus the small riders ratified in ADR-044. No evaluator, no search, no new rules, no new cards.

## Part 1 — SanePolicyAgent (ADR-045)

In `packages/agents`, sharing RandomAgent's PRNG conventions (agent-internal randomness, ADR-015). Random choice within a filtered action set; every filter is a pure function over `(view, request)`:

1. **Mulligan:** keep 7-card hands with 2–5 lands; below 7, keep at 2+ lands; never mull below 5. Bottoming: bottom the highest-cost nonland cards first, ties by cardId (deterministic).
2. **Land:** if a play-land action is legal, take one (random among them).
3. **Mana discipline:** never `tapForMana` standalone. Tap only as part of choosing a cast/activation this policy intends (rely on auto-pay: choose the cast action; do not pre-tap).
4. **Casting:** when at least one cast/activation is affordable, pass with only 20% probability; otherwise cast (random among affordable, random among enumerated targets/X — no evaluation, that's M4's job).
5. **Combat:** attack with every creature whose power ≥ 2 or that has evasion (flying/menace/trample) unless it has a block-relevant keyword worth holding back — implement the simplest version: attack with all non-defenders whose power ≥ 1 except walls; blocks: block lethal-threatening attackers where the block kills the attacker or saves ≥ 2 damage, chosen greedily; otherwise no block. Keep it *simple and documented* — this is a fuzzing/sparring floor, not the AI.
6. **Choices:** trigger ordering / damage order / sacrifice / legend keep: first option (deterministic); optional triggers: accept.
7. Everything else: uniform random over the filtered set.

Wire into `pnpm fuzz --agents sane,sane|sane,random|…` (default stays random,random) and `pnpm play-random --agents`. **The engine-correctness fuzz suites keep RandomAgent** (ADR-045); add one committed smoke: 100 games/pairing sane-vs-sane, clean.

Report in the handoff: sane-vs-random win rates per deck (1,000 games, a pairing table), sane-vs-sane termination/turn stats next to S5's random baselines, and — the number I most want — casts-per-game of the ≥5-mana cards (Siege-Gang, Pelakka, Serra, Drana, Wrath) under random vs sane, as a direct measure of the coverage gap Chris spotted.

## Part 2 — Card gallery (ADR-046)

`/gallery` route in `packages/ui`:

- Every pool card (pool registry is the source; exclude test-only cards) in our frame; toggle to printed scan (`normal`); tokens included.
- Caption: name · set/collector · artist (from the printings section / `oracle.json`).
- Group/filter: by color, by type, by session batch, by deck membership; text search.
- Click → the existing inspector at full size.
- **Art note button** per card: appends `{cardId, note, date}` to `docs/art/art-notes.md` via the dev endpoint (download fallback), one bullet per note under a per-card heading. Create the file with a short header explaining its lifecycle (Chris writes, planner converts to printings overrides / frame fixes, entries struck through when resolved).
- Hand-frame variant (ADR-043: no oracle text) shown somewhere in the gallery — a size-comparison strip (battlefield tile / hand frame / inspector frame side by side) so Chris can judge the §3 typography decision with his own eyes.

## Part 3 — Riders (ADR-044)

1. DAMAGE event payloads gain `targetCardId` (and `sourceCardId` if absent); viewer log panel uses names.
2. Transport glyphs redrawn as ink SVGs in the icon pipeline (reuse `docs/prompts/icons.md` transport row; trace like the others; update MANIFEST).
3. Rager: apply the printings.md `apc` override — refetch, update the registry row, confirm the PMEI files are replaced.
4. Registry hygiene: confirm R-007/R-025 fix from S6 Part 0.0 survived (principle 11 now applies).

## Definition of done

1. Sane-vs-sane games are *watchable*: load one in the viewer and confirm by eye — no mull-to-0, lands played every turn, spells cast, combat happens. Bundle one such game as a second sample log.
2. The stats tables from Part 1 in the handoff.
3. Gallery renders all pool cards + tokens with captions and filters; art-note flow writes to `docs/art/art-notes.md`; size-comparison strip present.
4. Riders done; 100-game sane smoke committed; all existing tests green.
5. `handoff.md` per template. Concerns expected: which policy rules most distorted behavior vs RandomAgent (for M4's baseline notes), anything the gallery revealed about frame rendering at scale (64 cards on one page).

## Out of scope

Evaluator, search, archetype logic (M4). New cards. New rules. Play-mode UI. Any policy sophistication beyond the seven rules — resist making Sane good; it needs to be *legible*, not strong.

## Escalate, don't decide

Any policy rule that can't be a pure filter over the legal-action list (that's a sign it belongs in M4); any engine change beyond Part 3.1's event payload; frame redesign (notes go to art-notes.md for the planner).
