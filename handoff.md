# Handoff — after Session 04 (2026-08-19)

## State of the world

M3a is done: the removal suite (targeted, mass, exile-with-value-ref), all three discard modes, the first trigger conditions beyond `self`, optional triggers, parameterized static scopes, and the ATTACHED event are all live, and mono-black Deck D brings the pool to 58 cards + 2 tokens, everything `tested`. Six pairings fuzz clean (500/pairing in the committed suite, 1,000/pairing CLI — 6,000 games, zero exceptions), replay byte-identical ×3 seeds ×6 pairings. 109 tests green. Every S4 mechanic slotted into existing machinery — the condition object, scope parameters, and value refs all landed as data extensions to structures that already existed, which is what ADR-020/021/028 were designed to guarantee.

## Done this session

- **Part 0:** ATTACHED event with all four causes (ADR-026), wired into the EVENT stream; optional triggers as accept/decline DecisionRequests at resolution (ADR-027), never silent; value refs with an LKI snapshot taken at resolution start (ADR-028, CR 608.2h) plus `who: controllerOfTarget`; six pairings in fuzz and replay, committed suite at 500/pairing per the brief's timing rule (suite is ~22s).
- **Part 1:** targeted `destroy` (indestructible-aware) and `exile` (no DIES, 700.4); predicates `nonartifactNonblackCreature` and `opponentPlayer` (Duress targets an *opponent*; flagging the addition per protocol); discard ×3 modes with filters, hand-reveal-in-request, and RNG-logged random mode; DEALS_DAMAGE_TO_PLAYER trigger event with battlefield-scan collection and ADR-021 condition evaluation (`source: attached`, `player: opponentOfController`); scope parameters `{subtype, cardType, other}`; a granted-haste bug fix (the enumerator's tap-ability sickness check read printed keywords, not characteristics — Chieftain-granted haste exposed it).
- **Part 2:** sixteen cards encoded, Scryfall re-verified — the planner's table was again error-free on card facts.
- **Part 3:** Deck D mono-black; A/B swaps; all four decklists recorded in the pool registry.
- **Protocol:** fuzz-before-fixtures ran first (1,800 games, clean) and earned its keep — every subsequent fixture failure was a fixture bug, not an engine bug.
- The resolver pipeline went async to carry discard's decision requests (`resolveEffect` returns a Promise; `EffectContext.discard` is the one async op). This touches ADR-012's seam shape; flagged below for ratification.

## Deviations from the brief

1. **Fixture 12 is impossible as written: Vampire Nighthawk has flying**, so a vanilla 4/4 can't block it (CR 702.9c — same class of slip as S3's fixture 6, now caught by principle 10 review before implementation). Implemented mirrored: the Nighthawk *blocks* an attacking 4/4 — identical keyword-composition assertions (deathtouch kills the 4/4, 4 kills the 2/3, lifelink gains 2).
2. **Fixture 9 needed a second legal Nekrataal target** to produce a visible choice — with exactly one candidate the pick is forced and silent per ADR-014. Added Grizzly Bears to the board; the 603.3d no-target case and black-never-offered cases are as specified.
3. **New target predicate `opponentPlayer`** added for Duress ("target opponent" ≠ "target player") — the S3 precedent ("add to the predicate set if absent") applied, but it wasn't pre-listed, so noting for ratification.
4. **Hand reveal implemented as request payload, not GameView change** — the brief asked how reveal interacts with view redaction (see Concerns 2); the answer I shipped is "it doesn't touch the view at all."

## Concerns

1. **The async resolver seam (ADR-012 amendment wanted).** Discard's mid-resolution DecisionRequests forced `resolveEffect` and one EffectContext op to become async. It's mechanical and every existing resolver is unchanged in behavior, but the seam's signature is now `Promise`-shaped and future words (S5's reanimation targeting, legend-rule keeps) will lean on it. Planner should bless the shape in an ADR line so it's not an accident of implementation.
2. **Hand reveal semantics — ratify the request-payload answer.** The revealed hand rides on the DecisionRequest (`revealed: [{objectId, cardId}]`), visible to the chooser for that decision only. GameView redaction is untouched, replay is unaffected (the pick is a logged action). The alternative (a stateful "revealed cards" view layer) buys nothing until a card has an ongoing reveal ("play with your hand revealed" — not in the ceiling). Recommend ratifying as the standing pattern.
3. **Condition-object growth pressure: none yet — report as instructed.** Curiosity fit `{source, player}` exactly. The unexercised fields (`controller`, `type`, `subtype`) are validated but untested by any card; S5's Mystic Snake needs a SPELL_CAST event, not a richer condition. The first real pressure I can see is "whenever another creature you control dies" (aristocrats, post-S5) — still within the object. No predicate language needed.
4. **Value refs: no arithmetic wanted yet.** `targetPower` covered Swords; Drana (S5) is `{X}{B}{B}` activation — X machinery, not value refs. Resist arithmetic until a card demands it (none in the ceiling does).
5. **B–D fuzzes into grindy mirrors: 14.3% of games deck out** (vs ~0.5–6% elsewhere), mean 47 turns. Two removal-dense decks under random play trade everything and stall. Nothing is wrong — terminations are 100% — but (a) M4's evaluator baseline should expect pairing-dependent game shapes, and (b) if the planner wants fuzz games shorter, trimming D's removal density is the lever. Data point, not a defect.
6. **The `sba-unattach` ATTACHED cause is unreachable by legal play today** (host-left detachment happens in moveObject first). It's tested via forced state and kept as defense-in-depth; a future effect that makes a host stop being a creature (excluded layer-4 territory) would be its first legal trigger. Noted so nobody hunts for a missing code path.
7. **Suite time is ~22s** (fuzz-dominated). Fine for now; if S5 adds pairings or heavier decks, consider moving the big fuzz behind an env flag and keeping a 100-game smoke in the default suite.

## Registry entries added/changed

- rules-registry: R-016 (conditions + damage events), R-017 (parameterized scopes + granted-haste fix), R-021 (token-color note closed) rewritten; new rows R-035 (targeted destroy/exile), R-036 (discard), R-037 (optional triggers), R-038 (value refs), R-039 (ATTACHED).
- pool-registry: S4 rows → `tested` with fixture references; Deck D + A/B swaps recorded; rotated-out list updated.

## Test status

109 passing / 0 skipped / 0 flaky, 8 files: core (7), cards (11), engine units (14), S1 (14), S2 (19), S3 (22), S4 (19), sim (3). `pnpm typecheck` clean. Suite ~22s.

Fuzz summary (CLI, seeds 90000–90999, 1,000 games per pairing; handoff-only per Chris):

| Pairing | LIFE | DECKED | Mean turns |
|---|---|---|---|
| A–B | 958 | 42 | 41.0 |
| A–C | 996 | 4 | 35.7 |
| A–D | 973 | 27 | 41.7 |
| B–C | 938 | 62 | 41.4 |
| B–D | 857 | 143 | 46.7 |
| C–D | 903 | 97 | 43.2 |

Committed suite: 500/pairing at seeds 1–500, clean. Fuzz-before-fixtures smoke (1,800 games) was clean — zero engine bugs found by fixtures this session.

## Suggested next

S5 per roadmap M3b: Control Magic (the S1 owner/controller split finally cashes in — watch summoning-sickness reset on control change, R-011's note), Zombify + Gravedigger (first graveyard targeting; `returnFromGraveyard` resolver and `cardInYourGraveyard` predicate exist untested), Rancor (graveyard-return trigger — a DIES-adjacent trigger on the aura itself), legend rule SBA (first SBA-with-a-choice; the DecisionRequest pattern is proven), Drana (activated X with modifyPT), Mystic Snake (flash exists; SPELL_CAST trigger event is the new piece — needs cast-time collection like DAMAGE got this session). The async resolver seam (Concern 1) should be ratified in the S5 ADR batch. Worth pre-verifying in the S5 brief: Gravedigger vs Zombify wording (hand vs battlefield), Drana's actual oracle text (it's "+X/+0 and target gets −0/−X" variants are commonly misremembered), and Mystic Snake's flash+ETB counter timing.

## How to run

```
pnpm install          # Node >= 22
pnpm test             # full suite incl. 500 games x 6 pairings (~22s)
pnpm typecheck        # strict tsc across all packages
pnpm fuzz --games 1000 --seed 1   # fuzzer CLI, six pairings, errors reported with seed
```
