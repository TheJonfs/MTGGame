# Handoff — after Session 02 (2026-08-19)

## State of the world

M2a is done: every S1 protocol interim is retired in favor of the ratified ADRs, and the trigger/token/anthem/counter/X cluster is in — each landed as a rule added to an existing step, no step restructured. Three decks now fuzz in all three pairings (A red, B white-blue, C mono-green), 1,000 games each, zero exceptions, with replay byte-identical across seeds on every pairing. 68 tests green. The pool is 31 cards + 1 token def, all `tested`. The skeleton absorbed everything this session threw at it; the one flex point was exactly where ADR-013 predicted (declarations), and that's now incremental and linear.

## Done this session

- **Part 0 (all six):** incremental attack/block declarations with staged-then-commit semantics (ADR-013; `ENUM_CAP` deleted); trigger ordering, blocker damage ordering, and mulligan bottoming as enumerated-action choices (ADR-011); `ZONE_CHANGE` carries `controllerBefore` and DIES/LTB triggers use it (ADR-016) — stolen-creature test passes; stack-item-less `EffectContext` so `effectAtStart` modifiers resolve (ADR-012), with the brief's ruling that initialization triggers are discarded implemented and tested; X enumeration 0..max for casts *and* activated abilities (ADR-017); dedup-scope unit test (hand only, never battlefield).
- **Part 1:** resolvers `createToken`, `addCounters`, `gainLife`, `destroyAll`; 704.5q counter annihilation in the SBA pass; trample as a pure assignment rule (including the blocked-no-blockers exception and multi-block excess); anthem statics via existing scope machinery; DIES/LTB trigger events live; `LAND_ENTERS_UNDER_YOUR_CONTROL` emitted (R-030 slot); `soldier_1_1` token def; twelve pool additions with texts verified against Scryfall.
- **Part 2:** Deck C mono-green; A/B adjustments per brief; fuzzer runs all three pairings; replay test covers ×3 seeds ×3 pairings.
- Fixtures S2-1..15 green (see Deviations for two the brief's numbers didn't support as written); registries, implementer notes updated.

## Deviations from the brief

1. **Rhox Brute → Rumbling Baloth.** Scryfall says Rhox Brute is {2}{R}{G} — uncastable in a 17-Forest deck. Chris approved Rumbling Baloth ({2}{G}{G} 4/4 vanilla, same role) mid-session. Pool registry row notes it; planner to ratify.
2. **Fixture 7's arithmetic doesn't work as written.** "Bolt on a 2/1 under Anthem does not kill" — a 2/1 under Anthem is 3/2 and Bolt deals 3. Implemented the clear intent (survives on the bonus, dies via SBA when Anthem leaves) with Centaur Courser: 3/3 → 4/4 under Anthem, bolted for 3, survives; Anthem removed → dies.
3. **Fixture 2's "Bolt ×2" is 6 damage against toughness 7.** Used Bolt + Bolt + Shock (8) stacked in one priority window.
4. **Pool registry "Session 2 additions" section didn't exist** (brief references it as a read). Built it from the brief's Part 2; marked implementer-derived.
5. **Fixture 9 "both orders replay correctly"** implemented as both orderings scripted and asserted correct (the ordering *actions* also ride through full-game replay in the pairing tests); there is no per-fixture log replay, since fixtures aren't full games.
6. **Single-target `destroy` resolver not added** — the brief asked only for `destroyAll`; "Anthem destroyed (test-only)" uses direct state manipulation. `destroy` stays NotImplemented until Doom Blade's session.

## Concerns

1. **Planner card data needs oracle grounding.** Two of this brief's card facts were wrong (Rhox Brute's color identity, fixture 7's Bolt arithmetic). I now verify every real card against Scryfall before encoding — cheap and it caught both. Suggest card-batch briefs carry mana cost / P&T / oracle text from Scryfall rather than memory, or explicitly delegate verification to me as a standing step.
2. **Token color is invisible.** Colors are derived from mana cost; token defs have `""`, so every token reads colorless. Harmless today (no color predicate meets a token), wrong the day Doom Blade or Terror faces a black token, and our own `soldier_1_1` is nominally white. Recommend an optional `colors` field on card/token defs (data-model §1/§4) before the S3/M3 removal suite lands. Small, but it's a schema decision — planner's call.
3. **Static scopes: no predicate language yet, and I don't think S3 needs one.** `creaturesYouControl` / `allCreatures` / `attached` cover everything scheduled through M2b (equipment statics are `attached`). The first real pressure is tribal ("Goblins you control get…", manifest ceiling): my recommendation when it arrives is a parameterized scope — `{scope: "creaturesYouControl", subtype: "Goblin"}` — not a general predicate language. Flagging now so it can be a deliberate vocabulary decision rather than a session improvisation.
4. **Trigger conditions are still `self`-only.** M3's repeatable draw triggers (Curiosity-style "whenever equipped/this deals damage", "whenever you cast") and any "whenever another creature enters" card need a condition vocabulary on triggers. Same shape of decision as scopes; suggest the planner sketch it in data-model §2 before M3.
5. **Choice-as-action held with one cosmetic wart:** `orderTrigger` log entries carry `{index, cardId}`; when two pending triggers share a cardId the entry is unambiguous to the engine (index) but not to a human reading the log. A replay viewer will want source object ids in these entries. Not urgent.
6. **RandomAgent's combat behavior changed shape** with incremental declarations: attack-set sizes are now geometric-ish (each pick has ~1/k chance of "done") rather than uniform over subsets — mean game length dropped ~2 turns. No correctness impact; worth remembering when M4 baselines "beats RandomAgent ≥95%".
7. **Anthems + counters slotted cleanly into ADR-003** — the brief said a layer-order strain would be the headline concern; there wasn't one. The ordering (static P/T → resolved P/T → counters) produced the CR-correct answer in every fixture, including annihilation interleaved with lethal-damage checks in one SBA pass.

## Registry entries added/changed

- rules-registry: R-008, R-016, R-017, R-027, R-029 rewritten with S1 interims retired; R-013 (trample), R-021 (tokens), R-022 (X), R-024 (counters) → `implemented`; new R-030 (landfall event, slot-only). Remaining flagged interims: R-006 mono-producer auto-pay only.
- pool-registry: new "Session 2 additions" section (12 rows, all `tested`, Baloth substitution noted); test-only cards section updated per ADR-018 (+`test_wrath`).

## Test status

68 passing / 0 skipped / 0 flaky, 6 files: core (7), cards (11), engine units (14), S1 scenarios (14), S2 scenarios (19), sim (3: replay ×3 seeds ×3 pairings, same-seed identity, fuzz 1,000/pairing). `pnpm typecheck` clean.

Fuzz summary (CLI, seeds 50000–50999, 1,000 games per pairing — handoff-only per Chris):

| Pairing | LIFE | DECKED | Mean turns |
|---|---|---|---|
| A–B (red vs. skies) | 998 | 2 | 36.4 |
| A–C (red vs. green) | 999 | 1 | 34.2 |
| B–C (skies vs. green) | 998 | 2 | 33.9 |

The committed suite runs its own 1,000/pairing at seeds 1–1000: also clean.

## Suggested next

S3 = M2b per roadmap: sacrifice-as-cost (Siege-Gang Commander + goblin token), equipment on the existing attach system (Bonesplitter, Loxodon Warhammer), deathtouch/lifelink/double strike/menace (each attaches to one of the two combat functions per ADR-006), fight, mana rocks (Mind Stone — first non-land producer, still mono-output so R-006's interim holds), and real hexproof/shroud/indestructible cards onto the already-live hooks. Before or with that brief: planner rulings on Concerns 2 (colors field — Doom Blade is getting close) and 3–4 (scope/condition vocabulary direction), and ratification of the S2 pool rows + Baloth. If the planner writes the S3 card list, oracle-verified stats in the brief would close Concern 1.

## How to run

```
pnpm install          # Node >= 22
pnpm test             # full suite incl. 1,000 games x 3 pairings (~15s)
pnpm typecheck        # strict tsc across all packages
pnpm fuzz --games 1000 --seed 1   # fuzzer CLI, all three pairings, errors reported with seed
```
