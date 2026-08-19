# Handoff — after Session 05 (2026-08-19)

## State of the world

**The manifest ceiling is complete.** Every mechanic in mechanics-manifest §3 now has at least one real, tested pool card: control change, reanimation, regrowth, the legend rule, activated X with self-reference, flash, and the aura-with-a-dies-trigger all landed this session, each inside machinery that has existed since S1–S2. The pool is 64 cards + 2 tokens across five 40-card decks; ten pairings fuzz clean (10,000 CLI games this session, zero exceptions since S3's one fuzz-caught bug), replay byte-identical everywhere. 130 tests green; suite restructured per ADR-034 (13s smoke / 56s full). The three oldest architectural bets all paid out at face value: the S1 owner/controller split absorbed Control Magic without touching a single "you control" call site, ADR-007's SBA-choice hook took the legend rule as designed, and ADR-006 meant Drana/Rancor/Snake needed zero combat or stack changes.

## Done this session

- **Control change (R-020, ADR-033):** `syncControl` computes effective control (baseController overridden by control statics, latest timestamp wins) and writes it back to `obj.controller` at the top of every SBA pass — every existing reader untouched. Steal and reversion both set summoning sickness (302.6); zone moves route by owner (400.3); the opponent's equipment keeps buffing a stolen creature (301.5c); stolen tokens can be sacrificed by the thief and cease.
- **Legend rule (R-025):** first SBA-with-a-choice. Per-controller name groups ≥2 issue a keepLegend DecisionRequest; rest to owners' graveyards. `runSBAs` is now async with an optional requester.
- **Reanimation/regrowth (R-040):** `returnFromGraveyard` resolver + `creatureCardInYourGraveyard` predicate; Zombify to battlefield (new object, ETB fires, enters sick), Gravedigger optional-ETB to hand, fizzle on raced-away targets.
- **Scope `self` (R-041):** resolves to the item's source wherever it now is — Drana pumps herself on the battlefield; Rancor returns itself from the graveyard. Enabler: DIES/LTB triggers now carry the card's current (graveyard) identity as sourceId.
- **Drana:** `"-X"`/`"X"` P/T deltas on modifyPT (resolved at resolution; statics remain literal-only, validator-enforced); single-target fizzle means no self-bonus (608.2b).
- **Mystic Snake:** flash path (in the enumerator since S1) gets its first card; ETB counter is pure stack timing as the brief ruled — no new event.
- **Deck E (Simic), B/C/D swaps, ten pairings, ADR-034 suite structure.** Fuzz-before-fixtures: 3,000-game smoke clean before any fixture was written; zero engine bugs found by fixtures this session (second session running).
- Fixtures S5-1..12 green as 21 tests.

## Deviations from the brief

1. **Fixture 9c's bounce assertion direction:** the bounced creature goes to its owner's hand (400.3), the owner being the Rancor player's own side in that fixture — trivial fixture-authoring slip on my side, corrected in the test, no rules dispute.
2. **Fixture 7's "Gravedigger racing" variant** implemented as the brief's other option (test-only removal from the graveyard while Zombify is on the stack) — nothing in the pool touches graveyards at instant speed, so the race is staged directly on the stack. Fizzle path asserted exactly.
3. None otherwise — the brief's card table and rules citations were error-free (S4's pre-verification suggestions were incorporated; the Drana/Gravedigger/Snake pre-flags from my S4 handoff all checked out against Scryfall).

## Concerns

1. **Control-layer recomputation wants no caching yet — measured, not guessed.** `syncControl` is O(battlefield² × abilities) per SBA pass in the worst case, but the 10,000-game CLI run finished at the same ~88s/10k pace as S4's per-game cost. The brief asked whether `characteristics()` wants caching: fuzz timing says no. Revisit only if M4's lookahead (which will call `characteristics` in loops) measures hot.
2. **Legend-rule ordering subtlety, for the record:** the keep-choice interposes at the end of an SBA pass rather than strictly inside the "simultaneous" set (CR 704.3). With the current pool there is no observable difference (nothing else in a pass can interact with the choice). Noted in R-025; a future card that cares (none in sight) would need the choice hoisted into the collection phase.
3. **Zone-aware predicates held, one asymmetry noted.** Graveyard targeting reused the existing predicate/zone machinery without change. The asymmetry: battlefield/stack candidates are enumerated by scanning shared zones, graveyard candidates by scanning the targeting player's own graveyard — fine while every graveyard predicate is "your graveyard" (the manifest guarantees this), but an opponent-graveyard card would need `targetCandidates` generalized. Manifest excludes those; flagging so the exclusion is understood as load-bearing.
4. **`baseController` is now state that test authors must know about.** A raw `controller` flip gets reverted by syncControl; the honest test-steal sets both fields. Implementer-notes documents it; the one S2 test that flipped raw control was updated. If the planner ever ratifies Threaten-style effects, they'll be a *third* control input (timed override), and ADR-033's model should be extended then, not before.
5. **B–D deck-out rate keeps climbing: 24.6%** (14.3% in S4) — Zombify/Gravedigger recursion plus dense removal under random play. Games still terminate (mean 50 turns, cap 100). This is now clearly a property of the matchup, not noise; M4's baseline tables should treat decking as a legitimate outcome, and the replay viewer (M3.5) will make these grindy games actually watchable for diagnosis.
6. **Suite time management worked** (ADR-034): 13s default, 56s full, CLI for handoff numbers. No action needed; recording that the structure held at ten pairings.

## Registry entries added/changed

- rules-registry: R-011 (control-change note closed), R-020 (control change), R-025 (legend rule) → `implemented`; new rows R-040 (reanimation/regrowth), R-041 (self-referencing effects), R-042 (flash first card). No remaining `slot-only` rows except excluded-by-manifest ones; R-006's single-symbol-producer note is the only live interim.
- pool-registry: S5 rows → `tested`; five decklists recorded; **ceiling-anchors section replaced with the ceiling-complete note** per the planner's instruction.

## Test status

130 passing / 0 skipped / 0 flaky, 9 files: core (7), cards (11), engine units (14), S1 (14), S2 (19), S3 (22), S4 (19), S5 (21), sim (3). `pnpm typecheck` clean. Suite 13s default / 56s FUZZ_FULL.

Fuzz summary (CLI, seeds 110000–110999, 1,000 games per pairing):

| Pairing | LIFE | DECKED | Mean turns | | Pairing | LIFE | DECKED | Mean turns |
|---|---|---|---|---|---|---|---|---|
| A–B | 943 | 57 | 42.4 | | B–D | 754 | 246 | 50.1 |
| A–C | 1000 | 0 | 32.5 | | B–E | 821 | 179 | 45.7 |
| A–D | 971 | 29 | 41.5 | | C–D | 958 | 42 | 38.8 |
| A–E | 973 | 27 | 38.6 | | C–E | 977 | 23 | 35.0 |
| B–C | 954 | 46 | 38.1 | | D–E | 879 | 121 | 44.0 |

FUZZ_FULL suite (500/pairing) also clean.

## Suggested next

M3.5, the replay viewer — and the engine side is ready for it: the EVENT stream already carries damage, zone changes, attachments, life, casts, and draws; the ACTION log carries every decision with object ids (the S4 orderTrigger fix was for exactly this). Two small engine affordances the viewer session might want, both cheap: (a) a `stepIndex`/sequence number on EVENT entries so a viewer can align events to the ACTION timeline without re-simulating, or alternatively a documented "reconstruct by replay" recipe (the replayer already produces every intermediate state — the viewer could ride it); (b) the fixtures-inbox format ("flag this → seed+turn") should be specified by the planner so the viewer writes what future briefs can consume. Beyond M3.5: the pool can now grow to ~100 with pure card batches (no vocabulary work), which can interleave with viewer/AI sessions at low risk.

## How to run

```
pnpm install                       # Node >= 22
pnpm test                          # smoke suite: 100 games x 10 pairings (~13s)
FUZZ_FULL=1 pnpm test              # full: 500/pairing (~56s)
pnpm typecheck
pnpm fuzz --games 1000 --seed 1    # CLI, ten pairings, errors reported with seed
```
