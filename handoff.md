# Handoff — after Session 03 (2026-08-19)

## State of the world

M2 is finished: every Tier 0 slot now has a real pool card exercising it. Sacrifice-as-cost (Siege-Gang, Mind Stone), equipment on the shared attach system, deathtouch/lifelink/double strike/menace, fight, colorless mana, and real hexproof/shroud/indestructible cards are all in — every one landed as a rule added to an existing step, and the two S2 predictions held: deathtouch and lifelink attached exactly to the ADR-006 assignment/dealing split, and equipment diverged from auras only at the single SBA outcome (unattach vs destroy, R-034). Pool: 42 cards + 2 tokens, all `tested`. 90 tests green; fuzz clean ×3 pairings at two seed ranges; replay byte-identical everywhere.

## Done this session

- **Part 0:** `colors` field (ADR-019) in schema/validator, required on token defs, `soldier_1_1` backfilled `["W"]`, color predicates read it; `orderTrigger` actions carry the source object id (data-model §6); `{C}` as a sixth pool slot — pays generic only, auto-pay spends it first (R-033); fight all-or-nothing in the resolver (ADR-022).
- **Part 1:** sacrifice predicates `self` / `creature` / `creature.subtype:<S>` with chooseSacrifice DecisionRequests, paid pre-stack via moveObject with DIES triggers pending normally; equip as an `equip: true` activated ability (sorcery timing by rule, attach = field mutation, re-equip moves); deathtouch (assignment lethal-1 + SBA destroy mark), lifelink (on dealing, combat and noncombat), double strike (Fencing Ace through the existing step split), menace (commit validation + dead-end-free incremental enumeration); fight via a new `fight` EffectContext op (creatures as sources, so dt/ll apply); "can't be countered" as a counter-resolver no-op; hexproof/shroud/indestructible on real cards through the hooks live since S1.
- **Part 2:** twelve cards + goblin token encoded, Scryfall re-verified (all clean this time — the planner's table was oracle-grounded).
- **Part 3:** all three decklists updated per brief; recorded in pool registry.
- Fixtures S3-1..13 green plus extras (6b, 7b, 8b, 9b); `damageAll` resolver implemented for fixture 10's test-only Pyroclasm (same precedent as S2's destroyAll).

## Deviations from the brief

1. **Fixture 6 misstates the deathtouch assignment rule.** "Deadly Recluse blocks a 5/5 trampler: attacker must assign only 1 as lethal" — CR 510.1c reads the *source's* (attacker's) deathtouch; the blocker's deathtouch never changes the attacker's lethal math. Implemented CR-correct (Pelakka assigns 2 to Recluse, 5 tramples; Recluse's 1 dt damage still kills the wurm), and added fixture 6b — Warhammer'd Recluse, a real-cards deathtouch+trample attacker — which is the interaction the brief was reaching for (1 lethal per blocker, rest tramples, lifelink on all of it).
2. **Fixture 1 split into 1a/1b.** As one scripted line, the activation legally matched in the priority window *before* the commander's ETB trigger resolved — forced self-sacrifice, no tokens yet. Engine behavior is CR-legal; the fixture was ambiguous. 1a covers the ETB, 1b activates with tokens already on the battlefield.
3. **`damageAll` resolver implemented** (M3's Pyroclasm word) because fixture 10 requires the behavior via a test-only card — same one-line precedent as S2's destroyAll ruling in ADR-023.
4. **orderBlocker log entries** already carry both object ids (attacker, blocker) and gained nothing; only orderTrigger needed the object id added. Data-model §6's sentence is satisfied in substance; planner may want to tweak its wording.

## Concerns

1. **The fuzzer caught a real cost-feasibility bug fixtures never would have.** `canPay` counted a {T}-cost ability's own source as an available mana producer — Mind Stone's sac-draw ability looked affordable off its own {C}, then `autoPay` threw mid-game at seed 32 of the first 300-game smoke run. Fixed (exclusion list + regression unit). The lesson worth institutionalizing: **fuzz immediately after deck integration, before fixtures** — cost/payment/enumeration bugs live in random-line territory. I've added it to implementer-notes; consider a line in the session-brief template.
2. **Rules claims in briefs now deserve the same grounding as card facts.** CLAUDE.md principle 9 fixed card data (this brief's table was flawless), but fixture 6's deathtouch-assignment claim was a *rules* error. Suggest fixture specs cite CR numbers for any non-obvious interaction, and I'll verify those the way I verify Scryfall stats.
3. **Attachment changes fire no event.** Equip/re-equip is a bare `attachedTo` mutation — correct today, but any future "whenever ~ becomes attached/equipped" trigger, or a replay viewer wanting to render equips, has nothing to subscribe to. Cheap to add an ATTACHED event when first needed; flagging so M3.5 (viewer) remembers combat/equip state changes that aren't zone moves: attach, tap, counters, damage all have events or EVENT-derivable payloads *except* attach.
4. **`{C}` in costs is unparsed.** Pool-side {C} is done; cost-side {C} symbols (Eldrazi-style "{C}{C}" requirements) are rejected by the parser. No pool or ceiling card needs it; noted in R-033 so it's a known boundary, not an oversight.
5. **Menace × incremental declarations needed real design** — the one place this session where a keyword touched the protocol layer rather than a combat function: "done" is withheld during a violation, lone menace blocks are offered only when a second candidate exists, and violation states restrict choices to fixes. It's dead-end-free (test 9b) but it is *stateful enumeration logic*, and the next blocking-restriction keyword (if any enters the ceiling) should budget for the same. Not a skeleton crack — the step wasn't restructured — but worth the planner knowing where the complexity pooled.
6. **B–C decking rate jumped** (19/1000 vs ~2 elsewhere, seeds 70000+): two draw engines (Mind Stone, Elvish Visionary, Pelakka draws) plus removal-light random play lengthens B–C games. Not a bug — terminations are still 100% — but a data point for M4 baselining and pool balance later.

## Registry entries added/changed

- rules-registry: R-006 rewritten ({C} + tap-cost exclusion), R-010, R-014, R-015, R-019, R-023, R-026 → `implemented`; new rows R-031 (fight), R-032 (can't be countered), R-033 (colorless mana), R-034 (attachment SBA split).
- pool-registry: S3 rows → `tested` with fixture references; S2 section marked ratified (ADR-023); current 40-card decklists recorded; test-only cards + `test_goblin_martyr`, `test_pyroclasm`.

## Test status

90 passing / 0 skipped / 0 flaky, 7 files: core (7), cards (11), engine units (14), S1 scenarios (14), S2 scenarios (19), S3 scenarios (22), sim (3). `pnpm typecheck` clean.

Fuzz summary (CLI, seeds 70000–70999, 1,000 games per pairing; handoff-only per Chris):

| Pairing | LIFE | DECKED | Mean turns |
|---|---|---|---|
| A–B | 996 | 4 | 36.3 |
| A–C | 998 | 2 | 35.2 |
| B–C | 981 | 19 | 37.1 |

Committed suite also fuzzes 1,000/pairing at seeds 1–1000: clean. One mid-session fuzz-caught bug (Concern 1) — fixed with a regression unit before any fixture work.

## Suggested next

M3 is large (removal suite + control change + reanimation + discard + legend rule + ADR-020/021 implementations + Drana + Mystic Snake, pool to ~100); it likely wants the S2-style split into two sessions — a natural seam is "targeted removal + destroy + discard + conditions/scopes" first, "control change + reanimation + legend rule + repeatable triggers" second. The legend-rule SBA will be the first SBA-with-a-choice; the chooseOne-as-DecisionRequest pattern is proven, so it should slot in. Concern 3's ATTACHED event could ride into M3.5's brief. Also worth a planner glance: whether Curiosity-style triggers (M3) want the trigger-condition object (ADR-021) extended with an `event source is attached-to` predicate — that's the first condition beyond `self`/`other`.

## How to run

```
pnpm install          # Node >= 22
pnpm test             # full suite incl. 1,000 games x 3 pairings (~18s)
pnpm typecheck        # strict tsc across all packages
pnpm fuzz --games 1000 --seed 1   # fuzzer CLI, all three pairings, errors reported with seed
```
