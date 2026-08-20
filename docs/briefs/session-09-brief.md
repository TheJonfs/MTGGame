# Session 9 Brief — M4b: tuning, combat-model fixes, difficulty profiles

Read first: `CLAUDE.md`, `handoff.md`, `docs/decisions.md` ADR-049(amended)..056. S8 handoff Concerns 2–4 are the work list; this brief mostly schedules them.

## Goal

Close M4: fix the measured combat-model gaps, make E a credible pilot, ship difficulty profiles on the existing temperature/weight machinery, and land the suite/perf plumbing — with the ladder as the loop and the corrected gates as the bar. "Tuning" means: every change justified by a before/after ladder delta or a book-of-shame test, never by vibes.

## Part 0 — Plumbing (first)

1. **Suite tiers (ADR-055):** ladder smoke → FUZZ_FULL; default suite gains the 20/cell mirror sanity check; default ≤ ~15s.
2. **Combat-sim memoization** (S8 concern 4): cache attack-set evaluations within a combat; report the speedup (`pnpm ladder --games 50` before/after is fine).
3. **Evaluator accounting per ADR-056:** live-stats material, auras/equipment ≈ 0 standing, symmetric term removed. Book-of-shame suite must stay green (self-Control-Magic ordering now follows from accounting rather than a patch — verify, and keep the test).
4. **Sweeper dampener: removed** (S8 concern 2 — no measured effect). If E tuning later wants real risk modeling, that's a measured re-add, not a revert.

## Part 1 — Combat model (S8 concern 3)

1. **Lifelink-aware blocks:** blocking/killing a lifelinker credits the denied lifegain; letting one through debits it.
2. **Menace pair-planning, both directions:** own blocks may commit two blockers to a menace attacker when the exchange evaluates positive; the *opponent model* in attack sim also considers pair-blocks (stop overvaluing Boggart Brute attacks).
3. Re-run mirrors after each; report deltas separately.

## Part 2 — Deck E / counter-tempo (S8 concern 2's "start here")

E's mirrors are the weakest (54.6–60.0). Measured improvements to try, in order, each with mirror deltas: (a) counter-hold modeling that keys on *castable threats given opponent's known list and untapped mana*, not a flat bonus; (b) flash-timing value (Snake as an end-of-turn play); (c) bounce as tempo (Boomerang/Man-o'-War valued by mana-cost differential and sickness reset, not raw material). Stop when E mirrors reach the band of the other decks (~65%+) or the session budget says stop — report honestly either way.

## Part 3 — Difficulty profiles (roadmap M4 item)

Three named profiles on existing machinery, no new systems: `apprentice` (high temperature, aggro-ish flat weights, no counter-hold), `journeyman` (default), `master` (low temperature, tuned weights). Ladder cells journeyman-vs-apprentice and master-vs-journeyman (mirrors, 500/cell CLI) demonstrating a monotone skill ladder; these become the overworld's difficulty dials. Document profile knobs in one place (`agents` README or a short doc section).

## Riders

`pnpm ladder --cell A,B --games N` single-cell loop for tuning; S8 concern 5 noted in code comment where ActionRequest is defined (no implementation).

## Definition of done

1. Parts 0–2 with before/after ladder tables per change (mirror gate + baseline-floor rider re-verified at 1,000/cell for the final configuration).
2. Part 3's monotone profile ladder demonstrated.
3. Default suite ≤ ~15s; FUZZ_FULL documented; all tests green.
4. `handoff.md`; Concerns expected: which Part 2 items moved E and which didn't, whether the opponent model's pair-blocking changed A's numbers (Boggart Brute), any evaluator term newly exposed as dead weight, and your view of what M4c would contain if we ever want one (or whether M4 is done).

## Out of scope

Multi-ply/tree search, opponent hand inference, pool/deck changes (curation is parked, ADR-054), new cards, UI changes, overworld.

## Escalate, don't decide

Any new evaluator input beyond the ADR-048 view + known decklists; any change to gates; any deck edit however tempting the E fix looks from the deck side.
