# Handoff — after Session 01 (2026-08-19)

## State of the world

The Tier 0 skeleton is standing and carries weight: the two slice decks play complete, legal, deterministic games with `RandomAgent` on both seats. pnpm/TS monorepo (`core`, `cards`, `engine`, `agents`, `sim`), 48 tests green including the brief's twelve fixtures (plus two combat-timing ones), replay is byte-identical across seeds, and `pnpm fuzz --games 1000` is clean (a 5,000-game extended run at a different seed range is also clean: zero exceptions, every game terminates — 98.8% by life, the rest by decking, mean ~38 turns). All twenty slice cards are implemented and tested; the effect vocabulary has types for every word in data-model §3 with resolvers for the seven slice words, and unimplemented words throw `NotImplemented` while the validator warns on load.

## Done this session

- Part 0: workspace scaffold, strict TS, vitest, `.gitignore`, `docs/implementer-notes.md`, git initialized (repo had no `.git`; planning docs committed first).
- Part 1: seeded RNG (mulberry32) with logged `int/shuffle/pick`, `ReplayRng` that feeds logged draws back, typed event bus, sequential id generation, action-log types.
- Part 2: card loader + validator (rejects unknown effects/keywords/missing fields; warns on resolver-less vocabulary), full effect-vocabulary types, slice resolvers (`damage`, `bounce`, `counter`, `draw`, `modifyPT`, `restrict`, `addMana`), 20 slice cards as JSON, empty tokens folder.
- Part 3 (all twelve items): GameState/GameObject with owner≠controller, `moveObject` as the only zone mover, full turn structure with CR 117 priority, mana pool + cost parsing (generic/colored/X) + deterministic auto-pay, stack with cast/activate paths and fizzle-on-all-illegal, targeting predicates with re-check, single looped SBA routine, ADR-003 characteristics with static + stored effects, five-step combat with assignment/dealing split and conditional first-strike step, ETB triggers via ZONE_CHANGE with APNAP placement, legal-action enumerator, match runner with modifiers hook (called with `[]`), log-driven `replay()`.
- Part 4: `RandomAgent` (private seeded PRNG — see Concerns 8), fuzzer CLI (`pnpm fuzz --games N --seed S`) reporting terminations/mean turns/errors-with-seed.
- Definition of done: fixtures 1–12 green (files `packages/engine/test/fixtures/*.json` + `scenarios.test.ts`); fuzz clean; replay is a permanent test; registries updated.

## Deviations from the brief

1. **Agent interface shape.** Engine-design §12's `chooseTargets`/`chooseOne`/`mulligan` methods are folded into a single `chooseAction(view, request)` over enumerated actions (mulligan/discard/trigger-target requests are action lists). Every decision is then a loggable, replayable Action. The interface also lives in `engine`, not `agents` — the dependency direction forces it. Ratify or redirect.
2. **Mana payment flow.** Engine-design §6 reads as "agent taps lands, then engine pays from pool." Implemented instead: a cast is enumerated as legal when floating mana + untapped producers cover the cost, and executing it auto-taps deterministically (explicit `tapForMana` actions still exist). Pure pre-tapping would make RandomAgent games nearly cast-free. Ratify.
3. **Resolvers' seam.** Resolvers live in `cards` per engine-design §1, but they mutate state through an `EffectContext` interface that `cards` defines and `engine` implements. New seam, not in the docs; it preserves `engine → cards → core`. Ratify.
4. **Slice decklists** composed by me (Chris pre-approved): A = 17 Mountain / 4 Raging Goblin / 4 Piker / 3 Ogre / 3 Hill Giant / 3 Bolt / 3 Shock / 3 Brute Force; B = 9 Plains / 9 Island / 4 Lions / 3 Hawk / 3 Drake / 2 Serra / 2 Man-o'-War / 2 Seer / 2 Counterspell / 2 Boomerang / 1 Pacifism / 1 Divination. In `packages/sim/src/slice-decks.ts`. Planner should ratify or replace.
5. **Two extra fixtures** (13, 14) for the brief §3.8 combat-timing tests (Bolt/pump during declare blockers). Test-only synthetic cards `test_fs_soldier` and `test_pinger` cover first strike and the activated-ability path the slice lacks.
6. **Modifiers**: `startingLife`, `extraCards`, `permanentOnBattlefield` implemented; `effectAtStart` throws (needs a stack-item-less effect context — escalated, not guessed).
7. **`chooseOne` stub** was never needed: every S1 spot the brief expected it (trigger ordering, bottoming) got a deterministic interim instead, each logged in the rules registry.

## Concerns

1. **Composite block declarations are combinatorially explosive — the planner should rule on the protocol.** Attack subsets are 2^n, block assignments (attackers+1)^blockers; ten blockers vs five attackers is 60M combinations. I enumerate a deterministic prefix capped at 4,096 (`ENUM_CAP`), no-op declaration first. Consequences: on very wide boards the RandomAgent can't see (and the log can't express) some legal blocks, and "everything legal is enumerable" silently becomes "…up to the cap." Options: (a) keep the cap as a documented engine limit; (b) switch declarations to incremental actions (declare-one-attacker/blocker + done), which scales linearly and matches how a UI will want to work anyway, at the cost of more decision points; (c) cap only blocks, not attacks. I lean (b) for M2 — it's also what the heuristic agent will want. This is the one place the skeleton creaked.
2. **Blocker damage order and trigger ordering need the choice hook sooner than M3.** Both are deterministic interims now (declaration order / timestamp). Fine for the slice; wrong the moment a player would order a 2-blocker kill differently. Suggest the `chooseOne`-as-Action pattern (same request/list shape as everything else) in the session that brings multi-trigger cards (Pelakka + anything ETB in M2).
3. **DIES-trigger controller is derived from the post-move object (= owner), not battlefield controller.** Invisible until Control Magic (M3): a stolen creature dying would trigger for the wrong player. The fix is capturing controller in the ZONE_CHANGE payload before the move; cheap now, easy to forget later. Flagging so M3's brief includes it.
4. **Auto-taken decisions aren't logged.** Single-option requests (lone `pass`, forced no-attack, single-candidate trigger targets) are taken silently and re-derived on replay. Keeps logs small and replay honest, but a future log consumer (replay viewer) must know the log is not a complete decision transcript. Ratify as log semantics or ask me to log them.
5. **Auto-pay feasibility assumes mono-color producers.** True for every current and named-ceiling land/rock except none — but a dual land or `{T}: add {G}{G}` rock breaks the greedy check. Registry R-006 carries the note; the fix (bipartite matching or payment enumeration) should ride in with the first such card.
6. **Data-model micro-divergences** made while implementing, all in the validator/types: `fight` takes `targets: [i, j]` (was `target` prose); `who` value `eachPlayer` (was `each` implied); new Scope value `attached` for aura/equipment statics (Pacifism needs it; Rancor/Warhammer will too); `scryfallId` optional until the art session. Planner should fold these into data-model.md or overrule.
7. **Mulligans are sequential, bottoming is deterministic** (last N drawn). London-correct enough for random agents; a human player needs a bottoming choice (it's an Action away). Note for the UI milestone.
8. **RandomAgent's randomness is deliberately outside the logged RNG service.** Decisions already enter the log as ACTIONs; if agent draws used the game RNG, replay (which never calls agents) would desync. This slightly reads against "all randomness through the seeded RNG service" — the principle holds for *game* randomness. Worth one line in engine-design if ratified.

## Registry entries added/changed

- rules-registry: R-001..R-012, R-016, R-017, R-018, R-026, R-027 → `implemented` with notes; interims marked on R-006, R-008, R-016, R-027; new row **R-029** (legal-action enumeration: cap + auto-decisions + dedupe). R-022 note: X supported end-to-end except enumeration.
- pool-registry: all 20 slice cards → `tested`, with fixture references; new "Test-only cards" section (`test_fs_soldier`, `test_pinger`).

## Test status

48 passing / 0 skipped / 0 flaky, 5 files: core RNG/replay (7), cards loader/validator/mana (11), engine units (13), scenario fixtures (14 = brief's 12 + two combat-timing), sim replay determinism ×3 seeds + same-seed identity + 1,000-game fuzz (~5.5s). `pnpm typecheck` clean under strict settings. Fuzz CLI: 1,000 games clean (brief DoD) and 5,000 games at seeds 10000+ clean; no re-baselined fixtures.

## Suggested next

Before new vocabulary: planner rulings on Concerns 1 (block protocol — I'd take incremental declarations), 2 (choice hook timing), and the Deviations 1–3 ratifications, since M2 builds directly on all three. Then M2 per roadmap: dies/LTB triggers with Pelakka Wurm as the canonical fixture (dies-by-combat/spell/SBA/Wrath quadruple test), tokens + anthems (first real static-scope users beyond `attached`), +1/+1 counters, X costs (needs the X-enumeration rule), sacrifice-as-cost, equipment on the existing attach system, and the remaining combat keywords — each should slot into an existing step; if one doesn't, the skeleton failed and we fix the skeleton.

## How to run

```
pnpm install          # Node >= 22
pnpm test             # full suite incl. 1,000-game fuzz (~6s)
pnpm typecheck        # strict tsc across all packages
pnpm fuzz --games 1000 --seed 1   # fuzzer CLI; errors reported with reproducing seed
```
