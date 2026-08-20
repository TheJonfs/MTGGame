# Handoff — after Session 08 (2026-08-20)

## State of the world

M4a is delivered: HeuristicAgent v1 (evaluator + view-prediction + simulated combat + softmax selection) beats SanePolicyAgent in **every deck's mirror, both seatings, 55–77%** at 1,000 games/cell, and beats random 99.5%+ everywhere; the ladder (`pnpm ladder`) measures it with pairing cells, mirror cells, and two explicit gates. The ADR-048 agent-facing view shipped (combat, mulligan count, live characteristics, trigger-source identity) with a permanent no-peeking test, and Cunning Tactician — the first custom card — is in deck B end to end: `tapTarget` resolver, `text` field, fixtures, Chris-picked classical-oil art in the frame, gallery caption "custom · classical oil · 2026". 148 tests green. One planner ruling wanted: which reading of the ship gate is canonical (see Concern 1).

## Done this session

- **Part 0 (ADR-048):** `GameView` gains `combat` (attackers + staged blocks), `mulliganCount`, and live characteristics (effective P/T + keywords) on every battlefield object; `ActionRequest` gains `source` (cardId + pending effects) on trigger-target requests — targets were already chosen at stack time, this adds identity only. Sane's S7 per-instance memory retired (pure functions again); rule 8 now covers trigger targets through the shared classification module. Permanent no-peeking test: seat views never contain opponent hand or either library, verified against ground-truth states across replayed games.
- **Part 1 (evaluator v1):** `evaluate(view, profile)` in `agents` — mana-value-weighted board material with keyword bonuses and live-P/T deltas, archetype-weighted life/hand terms (aggro/midrange/control), and a vocabulary-driven sweeper-risk dampener (opponent's known list has destroyAll/damageAll → creatures beyond the 3rd carry half value). Shares rule 8's classification table. **Book of shame: five permanent score-ordering tests — three failed against the fresh policy and drove real fixes** (a mis-aimed aura claimed its own board value → self-Control-Magic scored positive; self-face burn was cheaper than any creature at aggro life weights → explicit self-damage penalty; no-benefit taps cost nothing → tap-cost friction).
- **Part 2 (policy + combat):** priority actions scored by predicting the resulting view (view-sim: damage/removal/bounce/draw/tokens/counters/pumps — targeted `modifyPT` models Drana lethality, which alone took the D mirror from 46% to 72%); pass holds counter mana while the known opponent list threatens (ADR-051); softmax selection at profile temperature (ADR-050, default 0.35). Attacks: greedy set construction, each candidate set played through **the engine's real assignment/dealing/SBA functions on a throwaway state** (combat-sim, the one documented engine seam; synthetic defs carry the view's live stats so `characteristics()` reproduces them). Blocks: greedy per-creature gain, chumps only under lethal threat.
- **Part 3 (ladder, ADR-049):** `pnpm ladder` — challenger vs baselines over all 10 pairings both seatings, plus **mirror cells** (same deck both sides, deck-neutral skill), two gates reported. Committed smoke: 100/cell vs sane with flake-resistant bounds (every mirror >40%, overall mirror majority; the 1,000/cell CLI is the gate authority). Full tables below.
- **Part 4 (Cunning Tactician, ADR-052/053):** `tapTarget` resolver + `tap` context op (first user); CardDef `text` (validator: required iff custom, forbidden on real — rippled into the harness's five synthetic cards and both token defs); card JSON; deck B swap (−1 Savannah Lions, −1 Fencing Ace, +2 Tactician; registry decklist updated, Lions to rotated-out list); fixtures s8-01..03 (tap-before-declare denies the block CR 509.1a; tap-after-declare doesn't remove it; vigilance attack + same-combat activation CR 702.21b) + text-field validation + rule-8 tapTarget preference test; four art candidates rendered per card-art.md (`--no-style` added to the gemini-image skill for the ADR-052 exemption), **Chris picked #1 (classical oil)**, cropped 5:4, wired via `art.asset`, kept/rejected logged in MANIFEST.
- **Riders:** inline gallery note field (replaces window.prompt; Enter saves, Esc cancels), `pnpm gallery`, chip contrast lift (subtle ring+shadow) on light bands.

## Ladder (1,000 games/cell, seeds 1..; reproduce with `pnpm ladder`)

**Heuristic vs sane — mirrors (deck-neutral skill):** A 66.2/72.4, B 69.1/69.7, C 73.1/66.9, D 77.2/76.7, E 60.0/54.6 (seat0/seat1 %). **Mirror gate: PASS.**

**Heuristic vs sane — pairing cells (heuristic's deck in parentheses):**

| pairing | seat0 | seat1 |
|---|---|---|
| A-B | 74.3% (A) | 62.9% (B) |
| A-C | 55.4% (A) | 80.5% (C) |
| A-D | 22.0% (A) | 94.1% (D) |
| A-E | 80.5% (A) | 51.4% (E) |
| B-C | 59.7% (B) | 77.4% (C) |
| B-D | 33.4% (B) | 92.3% (D) |
| B-E | 80.4% (B) | 41.5% (E) |
| C-D | 31.9% (C) | 91.4% (D) |
| C-E | 91.3% (C) | 35.9% (E) |
| D-E | 98.7% (D) | 4.3% (E) |

Per-deck aggregate: A 58.0%, B 59.1%, C 70.3%, D 94.1%, E 33.3% → **aggregate gate: FAIL (E)**. Context: in the sane-vs-sane baselines E's pairings run 1.3–43% for whichever agent pilots E (E vs D is 987-13); every heuristic pairing cell beats its sane-vs-sane baseline (e.g. E vs D 4.3% vs 1.3% baseline, A vs D 22.0% vs 8.1%).

**Heuristic vs random:** 99.0–100% in every pairing cell and mirror; both gates PASS. No rung regressions (random < sane < heuristic everywhere).

## Baselines re-run

- **Post-Part-0 (pre-swap) sane drift:** vs random per-deck 99.3/97.8/99.6/100.0/99.4 (S7: 99.3/97.3/99.3/100.0/99.2) — trigger-target rule 8 (Nekrataal no longer shooting its own creatures) is worth ~+0.3–0.5. Sane-vs-sane shifts within a point or two of S7.
- **Post-swap (final) sane baselines:** vs random A 99.3 / B 96.1 / C 99.6 / D 100.0 / E 99.5. Sane-vs-sane: A-B 577-423, B-C 311-689, B-D 129-871, B-E 683-317 (rest unchanged). The swap costs *sane*-B a little (random targeting wastes Tactician taps; the curve got heavier) — the heuristic ladder above already includes the swap.
- **≥5-mana casts/game (sane):** Siege-Gang 0.232, Pelakka 0.164, Serra 0.323, Drana 0.276, Wrath 0.143 — S7 coverage holds post-swap.

## Deviations from the brief

1. **The ladder ships two gates because "beats sane in every deck's hands" has no achievable per-pairing reading** (see Concern 1). I implemented: (a) per-deck aggregate over pairing cells, (b) per-mirror majority. Mirror passes, aggregate fails on E. The brief's DoD anticipated honest tables over forced tuning, so I stopped tuning at the session budget.
2. **The committed ladder smoke asserts flake-resistant bounds, not the exact gate** — at 100 games/cell a true-55% mirror fails a >50% check ~16% of the time; the smoke asserts every mirror >40% plus overall mirror majority, and the 1,000/cell CLI remains the gate authority. Documented in the test header.
3. **The gemini-image skill gained `--no-style`** (card art is ADR-052-exempt from style.md but the skill hard-wires the preamble; extending the script is the sanctioned path vs bypassing it). SKILL.md documents the only-for-card-art rule.
4. **Trigger/discard/sacrifice choices in the heuristic use ranked heuristics, not full view-prediction** (max-value opponent target for harmful, min-value own card for discard/sacrifice) — cheap, legible, and sufficient for v1; full prediction there is M4b surface.
5. **Spot-check re-baseline:** the deck B swap changed random-game trajectories, so the three S6 viewer spot-checks were re-hunted (same behaviors: Siege-Gang sacrifice seed 300@247, Control Magic steal 301@215 — now Grizzly Bears, Pacifism fizzle 568@834). Noted in the test header.
6. **Token defs carry `text: ""`** — the validator's required-iff-custom reads tokens as customs (they are). Empty string; frames fall back to derived text.

## Concerns

1. **The ship gate needs a planner ruling (the M4a headline).** "Beats sane in every deck's hands, both seatings" (ADR-049) can mean: (a) every pairing cell — unachievable, deck imbalance dominates (sane-E loses E-D 987-13 to sane-D; no pilot overcomes that to >50%); (b) per-deck aggregate over pairings — currently fails on E at 33.3% even though every E cell beats its sane-baseline; (c) every mirror, both seatings — passes 54.6–77.2%. I recommend (c) as the skill gate plus "every pairing cell ≥ its sane-vs-sane baseline" as the no-regression rider (which v1 also satisfies). ADR text wants updating either way.
2. **Which evaluator terms carried the win (for M4b):** targeted-removal prediction and the combat sim carry most of it; the Drana `modifyPT` fix alone was worth 26 mirror points, and the book-of-shame friction terms (aura standing-value subtraction, self-damage penalty, tap costs) each cured a visible pathology. **Dead weight so far:** the sweeper dampener (no measurable effect in any table — candidate for removal or a real risk model in M4b) and the counter-hold bonus (E still wins mirrors but 54.6–60.0% is the weakest — holding counters is modeled too crudely; E is where M4b should start).
3. **Where greedy combat search visibly misplays (M4b feed):** (a) menace attackers are never blocked by the greedy model (pair-planning unimplemented) — fine defensively at this pool size, but the attack sim also assumes the *opponent* never pair-blocks, overvaluing Boggart Brute attacks; (b) the block model ignores lifelink denial (blocking a Nighthawk is undervalued by the 2 life the opponent doesn't gain); (c) attack sets are evaluated against one greedy response, not the opponent's actual policy — good enough vs sane, not vs itself.
4. **Heuristic games are ~3× slower than sane games** (~9ms vs ~3ms; combat sim dominates). Ladder full run ~9 min. Fine for now; M4b tuning loops will feel it — memoizing attack-set sims within a combat is the cheap 2–3×.
5. **`chooseSacrifice` requests carry no source identity** (unlike chooseTarget after ADR-048) — the heuristic sacrifices its lowest-value permanent, which is right for costs, but a future "sacrifice unless you pay" effect would want the source. Note for whenever ActionRequest grows again.
6. **The evaluator counts aura/equipment standing value as material for both players symmetrically** — crude but unbiased; flagged because the view-sim already subtracts it for casts, so the two disagree philosophically. M4b should pick one story.

## Registry entries added/changed

- pool-registry: S8 section (cunning_tactician `tested`), deck B decklist row updated with the swap note, Savannah Lions moved to rotated-out.
- rules-registry: no new rows — `tapTarget` is vocabulary (data-model), not a rules mechanic; combat/mulligan/view changes are engine surface, not rules simplifications. (Flag if the planner wants an R-row for the ADR-048 view contract.)

## Test status

148 passing / 0 skipped / 0 flaky, 18 files: S1–S8 scenarios (14+19+22+19+21+4), engine units 14, core 7, cards 11 (re-baselined: pool 67, tapTarget→untapTarget as the unimplemented-vocab example), agents (rule-8 classification 2, book of shame 5), sim (replay+fuzz 3, sane smoke 1, ladder smoke 1, no-peeking 1, viewer reconstruction 1, viewer spot-checks 3 re-hunted). Suite ~50s (the ladder smoke is 33s of it — ADR-034 budget question for the planner if that grates). `pnpm typecheck` + `tsc -p packages/ui` clean.

Fuzz: 1,000-game random and 1,000-game sane smokes clean post-swap; FUZZ_FULL 5,000-game run clean; the 60,000-game ladder and 50,000-game agent-stats runs surfaced zero engine errors.

## Suggested next

**M4b tuning** with the ladder as the loop: start with deck E (weakest mirrors; counter-hold and tempo modeling), lifelink-aware blocks, menace pair-planning, and the Concern 1 gate ruling written into ADR-049. Also worth considering: retire the sweeper dampener or make it real (Concern 2), and an `agents`-level perf pass (Concern 4) before tuning loops. Separately, the art pipeline is now proven end to end for customs — future custom cards are a data+art exercise (ADR-052 candidate rounds worked well; the `--no-style` flag is in).

## How to run

```
pnpm install
pnpm ladder                                   # heuristic vs sane + random, 1,000/cell (~9 min); --games 50 for a look
pnpm fuzz --games 100 --agents heuristic,sane # any of random|sane|heuristic per seat
pnpm agent-stats                              # sane baselines + big-spell coverage
pnpm gallery                                  # gallery (Cunning Tactician under S8 batch)
pnpm viewer                                   # replay viewer
pnpm test                                     # 148 tests (~50s incl. 100/cell ladder smoke)
```
