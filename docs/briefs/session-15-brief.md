# Session 15 Brief — the tutor half-session: search, shuffle, Lotus

Read first: `CLAUDE.md`, `handoff.md`, `docs/decisions-append-S15.md` (ADR-067..068 — append it to decisions.md first, verify per principle 11), `docs/data-model.md` §3 (searchLibrary row — planner-updated in this drop), mechanics-manifest amendment note below. Oracle texts: Rampant Growth "{1}{G} Sorcery — Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle." Demonic Tutor "{1}{B} Sorcery — Search your library for a card, put that card into your hand, then shuffle." Black Lotus "{0} Artifact — {T}, Sacrifice this artifact: Add three mana of any one color." **Re-verify all three against Scryfall (principle 9).**

## Part 0 — Docs

Append `decisions-append-S15.md` into `docs/decisions.md` (verified edit); add the two amendments to `mechanics-manifest.md` §3 as a dated "Amendments" subsection (planner text in the append file — copy verbatim); regenerate knobs doc after Part 3's knob.

## Part 1 — Engine (R-rows for both)

1. **`searchLibrary` resolver** per Amendment 1: chooser's DecisionRequest carries the library's matching candidates (`revealed` pattern) + a decline option; chosen card moves via `moveObject` (battlefield destination honours `entersTapped` as the sanctioned special ETB rule); **shuffle always follows, logged RNG, replay-covered**. Fixtures: Growth basic-to-battlefield-tapped (tapped asserted; landfall event fires; ETB triggers of the searched card fire on battlefield destination), Tutor any-card-to-hand, decline still shuffles, empty/no-match library, shuffle determinism under replay, opponent's log/EVENT stream never contains the unchosen candidates.
2. **Mana-ability colour choice** per Amendment 2: enumerator emits one activation per colour for Lotus; auto-pay never implicitly activates it; the pool receives three mana of the chosen colour. Fixtures: turn-1 Lotus → Serra Angel off Lotus+lands (synthetic hand), choice logged and replayed, sacrifice-as-cost interaction (DIES-class trigger of a test-only artifact ordering correctly — Lotus itself has none).

## Part 2 — Cards, pool, decks

Three cards encoded (Scryfall re-verified; `art:fetch` printings: Growth default rule; Tutor — planner suggests the Douglas Shuler LEA art, default rule resolves it; **Lotus: LEA, Christopher Rush** — the point of the exercise). Pool registry: three rows + **the `prizeOnly` column** (Lotus true; everything else false/blank); shop stock generation filters `prizeOnly`. Deck swaps per ADR-068. Gallery: Lotus appears (browsing = printed default per ADR-066-as-clarified — enjoy it).

## Part 3 — Agents, UI, world

1. **Agent tutor policy (ranked heuristic, v1):** Growth → a basic of the deck's colours (most-common colour short in play); Tutor → the highest evaluator-scored castable-soon card (reuse the discard/sacrifice ranking machinery inverted). Book-of-shame entry: Tutor never picks a land while the hand holds ≥3 lands.
2. **Search dialog (play client):** card-grid picker over the request's candidates (chooser only), decline button, chosen card animates to its destination; the play-by-play masks the pick for the opponent ("searches their library and shuffles" — destination reveals what it reveals).
3. **World:** `shopRowCopies` knob (dev-3 follow-up, registry-first); shop generation honours `prizeOnly`; world-sim re-baselined for decks C and D post-swap (report the deltas — Growth should soften C's tier-2 wall a little; say honestly if it doesn't).

## Part 4 — Acceptance

Scripted: a full duel in which Growth and Tutor both resolve through the dialog path (scripted human), replay byte-identical; Lotus turn-1 line through the play client. Ladder: mirrors at 200/cell for C and D pre/post swap (deltas reported; gates not re-run unless a mirror moves >3 points — then full gates). Human: Chris casts Demonic Tutor for exactly the card he wants, once, and reports whether the dialog made it feel like the real thing.

## Out of scope

Lotus as obtainable world treasure (it exists, `prizeOnly`, unreachable until boss/lair prize tables — M6b content); Timetwister/Time Walk (future amendments); quests/dungeons; AI beyond the ranked tutor policy.

## Escalate, don't decide

Any search predicate beyond the two amended; any reveal semantics beyond the request payload; any additional prizeOnly cards without a planner row.
