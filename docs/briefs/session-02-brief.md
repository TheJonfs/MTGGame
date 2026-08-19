# Session 2 Brief — Protocol fixes and vocabulary expansion 1 (M2a)

Read first: `CLAUDE.md`, `handoff.md`, `docs/decisions.md` (ADR-011..017 — all new, all ratifying or redirecting your S1 work), `docs/engine-design.md` §4, §5, §11, §12 (updated), `docs/data-model.md` §3, §5 (updated), pool registry "Session 2 additions".

## Goal

Land the planner rulings from the S1 handoff, then prove the skeleton absorbs the trigger/token/anthem/counter/X cluster by adding a rule to an existing step each time. A third slice deck (mono-green) joins fuzz so the new vocabulary is exercised in thousands of games, not just fixtures.

## Part 0 — Protocol changes (do these first; each ships with tests)

1. **Incremental declarations (ADR-013).** Replace composite attack/block actions and `ENUM_CAP` with `declareAttacker(obj)` / `doneDeclaringAttackers`, `declareBlocker(blocker, attacker)` / `doneDeclaringBlockers`. Validate per-declaration and at "done" (e.g., menace later). Update RandomAgent, fuzz, replay, fixtures. Delete the cap; R-029 updated.
2. **Choice-as-action (ADR-011) for:** same-controller trigger ordering, blocker damage assignment order, mulligan bottoming. Each is a `DecisionRequest` with enumerated Actions. Retire the three S1 interims in the registry.
3. **`ZONE_CHANGE` carries pre-move controller (ADR-016).** DIES/LTB triggers use it. Test: a creature whose controller ≠ owner dies → trigger belongs to the controller (use a test-only control flip; Control Magic itself is M3).
4. **Stack-item-less `EffectContext` (ADR-012)** so `effectAtStart` modifiers resolve. Test: a MatchSpec with `effectAtStart: [{type:"createToken",...}]` and with `{type:"draw"}`.
5. **X enumeration (ADR-017).** One action per affordable X. Test with Blaze.
6. **Dedup scope (R-029).** Confirm cardId deduplication applies to hand actions only, never to battlefield objects; add a unit test if one doesn't exist.

## Part 1 — Vocabulary

Resolvers and rules for: `createToken`, `addCounters` (+1/+1; −1/−1 type present, annihilation rule 704.5q implemented since it's one line), `gainLife`, trample (assignment rule), static `modifyPT` with `scope: creaturesYouControl` (anthem), DIES and LEAVES_BATTLEFIELD trigger events, LAND_ENTERS_UNDER_YOUR_CONTROL event (emit it; no S2 card uses it), `damage` with `"X"`.

Token definitions: `soldier_1_1` (white). Tokens cease to exist when leaving the battlefield (moveObject already handles; test it).

Cards: the twelve in pool registry "Session 2 additions." Add them to JSON with full fidelity — no simplifications; if one needs a word not listed, stop and escalate.

## Part 2 — Third slice deck

Deck C, mono-green (40): 17 Forest / 4 Grizzly Bears / 3 Elvish Visionary / 3 Timberland Guide / 4 Centaur Courser / 3 Rhox Brute / 2 Pelakka Wurm / 4 Giant Growth. Blaze, Raise the Alarm, and Glorious Anthem go into the existing decks (A: −1 Shock −1 Brute Force +2 Blaze; B: −1 Divination −1 Boomerang +1 Raise the Alarm +1 Glorious Anthem). Fuzz runs all three pairings (A–B, A–C, B–C). Decklists live in `sim/src/slice-decks.ts`; record in pool registry.

## Scenario fixtures (minimum)

1. Pelakka Wurm dies by combat damage → controller draws (via DIES trigger).
2. Pelakka dies by Bolt ×2 / lethal noncombat damage → draws.
3. Pelakka dies by SBA toughness ≤ 0 (test-only −X/−X effect) → draws.
4. Pelakka dies by a mass-destroy (test-only `destroyAll`) → draws. (Wrath itself is M3; the resolver is one line — implement it, leave the card out.)
5. Pelakka ETB gains 7; trample over a 2/2 chump assigns lethal to blocker and rest to player; with Giant Growth on the blocker, assignment recomputes; if the blocker is bounced before damage, the trampler assigns all 7 to the player (the trample exception to R-008's "blocked, no blockers, no damage").
6. Raise the Alarm at instant speed mid-combat creates two 1/1s that can block nothing this combat (already declared) but block next turn; tokens bounced by Boomerang cease to exist.
7. Glorious Anthem: tokens and creatures get +1/+1; Bolt on a 2/1 under Anthem does not kill; Anthem destroyed (test-only) → SBA kills a damaged creature that was surviving on the bonus.
8. Timberland Guide ETB counter on itself (only creature) and on a token; counters survive Anthem leaving; +1/+1 and −1/−1 annihilate.
9. Two ETB triggers same controller (Elvish Visionary + Timberland Guide simultaneously via test-only setup) → ordering request issued; both orders replay correctly.
10. Blocker damage order: 4/4 blocked by 2/2 + 3/3 → controller chooses order; lethal assignment rule respected; trample assigns excess only after all blockers lethal.
11. Blaze: X enumerated 0..max; X=3 to face and to a creature; replay identical.
12. Stolen creature (test-only flip) dies → DIES trigger for controller, not owner.
13. Incremental declarations: a 6-attacker / 6-blocker board produces no cap warnings and every legal single block is enumerable.
14. `effectAtStart` modifier with createToken and draw; `permanentOnBattlefield` Pelakka does **not** trigger ETB (initialization is not a zone change from the stack — decide: it *is* a moveObject, so ETB would fire; planner ruling: **modifiers apply before the first turn and triggers collected during initialization are discarded**; implement and test that).
15. Replay ×3 seeds on all three pairings; fuzz 1,000 games per pairing clean.

## Definition of done

1. Part 0 complete; S1 interims R-006/R-008/R-016/R-027 retired or re-scoped; R-029 rewritten; no `ENUM_CAP` in the codebase.
2. Fixtures 1–15 green; unit tests per new resolver/keyword.
3. Fuzz clean ×3 pairings; summary table in handoff (terminations, mean turns, per pairing).
4. Registries updated (new R rows for tokens, counters, trample, DIES/LTB, anthem statics, X enumeration, incremental declarations; pool registry statuses).
5. `implementer-notes.md` updated.
6. `handoff.md` per template. Concerns expected: where the choice-as-action pattern strained, whether static scopes want a general predicate language, and anything tokens revealed about object identity.

## Out of scope

Sacrifice-as-cost, equipment, deathtouch/lifelink/double strike/menace, fight, rocks (all S3). Control Magic, reanimation, discard, legend rule (M3). UI, art, heuristic agent. Any card not listed.

## Escalate, don't decide

New effect words or scopes beyond `creaturesYouControl` / `attached` / `allCreatures`; any card needing simplification; any change to ADR-003 layer order when anthems and counters interact (they should slot cleanly — if they don't, that's the headline Concern); payment-model changes.

## Elicitation

Whether Chris wants the fuzz summary as a committed `results/` artifact or handoff-only.
