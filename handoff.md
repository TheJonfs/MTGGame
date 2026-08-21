# Handoff — after Session 09 (2026-08-20)

## State of the world

M4b is delivered and, in my view, **M4 is done**: HeuristicAgent passes both corrected gates at 1,000 games/cell — every mirror both seatings (56.9–76.5%) and every one of the 20 pairing cells at or above its sane-vs-sane baseline floor — with deck E's mirrors up ~+4 points from measured tuning (64.8/56.9, seat0 reaching the band). Three named difficulty profiles ride the existing temperature/weight/hold machinery: journeyman beats apprentice in all ten mirror cells (55–70%); master's edge over journeyman is real but shallow (+3.8% overall) — the honest finding is that temperature is a weak lever at the top (see Concerns). The suite is tiered per ADR-055 (default 10.8s; FUZZ_FULL ~101s, 149 green), the evaluator follows ADR-056 accounting with the book of shame green *from accounting rather than patches*, and every change this session carries a before/after ladder delta — including two experiments that measured zero and were reverted.

## Done this session

- **Part 0 (plumbing):**
  - `pnpm ladder --cell A,B` and `--mirrors` (single-cell / mirrors-only tuning loops; rider).
  - Combat-sim memoization (attack-set scores keyed by turn+set+life, cleared per turn) — honest speedup ~1%: combat sim isn't the bottleneck at this pool size. The real perf win was replacing `structuredClone` with a hand-rolled view copy (~8%); 200/cell mirrors 26.5s → 24.1s combined.
  - **ADR-056 accounting:** auras 0.05 standing, equipment 0.05 attached / 0.3 salvage unattached, creatures carry buffs via live stats; the S8 aura standing-value patch and equipment-cast discount in view-sim are deleted. **Book of shame green with no patch** — self-Control-Magic ordering now falls out of the accounting, as the ADR intended.
  - Sweeper dampener removed (S8 concern 2; zero measured effect). Mirror delta of the whole accounting change: neutral within noise — correct for a cleanup.
  - **ADR-055 suite tiers:** default = 50/pairing fuzz + 20/cell mirror sanity (loose bounds: overall majority, 25% cell floor) = **10.8s**; FUZZ_FULL = 500/pairing fuzz + 100/cell ladder smoke + 1,000-game sane smoke = ~101s.
- **Part 1 (combat model):** lifelink-aware blocks (denied lifegain credited at 0.25/damage; own lifelink attack gains credited via the sim's real life deltas) and menace pair-planning both directions (own blocks commit pairs when the exchange is positive — lethal-in-order worst-case death model — and the attack sim's opponent model pair-blocks too, so menace attacks are no longer priced against a model that can't answer them). **Mirror deltas: both neutral at 200/cell** — the fixes are correctness, not strength, at this pool size; A's pairing cells vs sane also barely moved in the final run (Boggart Brute overvaluation was smaller than S8 estimated).
- **Part 2 (deck E, each measured at 200/cell mirrors, seed 777):**
  - (a) Counter-hold v2: bonus scales with *castable* threats — copies in the known list with mv 3..(opponent's lands+1) — replacing the flat any-big-card bonus. Control experiment (bonus forced to 0): worth **+4.5 avg on B mirrors, +1.75 on E**.
  - (b) Flash timing: pass on own main earns a small hold bonus while an affordable flash creature is in hand; casting an ETB-counter creature (Mystic Snake) with an opponent spell on the stack is credited the countered spell's mana. **Neutral on mirrors**; kept as modeling (no-cost, principled) — flagged as such.
  - (c) Bounce as tempo: bouncing an opponent permanent charges back half its board value (they recast it); self-bounce unchanged. **E seat1 +1.5.**
  - (d) **E archetype control → midrange** — the biggest E mover: **+4.75 avg** (56.0/53.0 → 60.5/60.5 at 200/cell). Posture beat every modeling change tried.
  - Stopped at budget: E mirrors 64.8/56.9 at the final 1,000/cell (band is ~65 — seat0 is there, seat1 isn't). Reverted at zero delta: a Curiosity-credit term in attack scoring; a NO_COUNTER_HOLD experiment flag.
- **Part 3 (difficulty profiles):** `difficultyProfile(apprentice|journeyman|master)` on existing knobs (archetype, temperature, holdTricks); agent kinds `heuristic:apprentice` etc. accepted everywhere; knobs documented in `packages/agents/README.md`. Measured at 500/cell mirrors: **journeyman > apprentice in all ten cells (55.4–69.8%)**; master(T=0.12) 53.8% overall vs journeyman with 8/10 cells ≥50; the T=0.05 sharpening experiment was **rejected by measurement** — B mirrors collapsed to 41.6% (near-determinism is exploitable).
- **Riders:** `--cell`/`--mirrors` (above); S8 concern 5 noted in a comment at `ActionRequest.source`.

## Final gates (1,000 games/cell, seeds 1..; `pnpm ladder`)

**Mirror gate (ADR-049 amended): PASS** — A 64.4/71.6, B 68.1/68.1, C 73.3/67.0, D 75.0/76.5, E 64.8/56.9 (S8: A 66.2/72.4, B 69.1/69.7, C 73.1/66.9, D 77.2/76.7, E 60.0/54.6 — E +3.5 avg, others flat within noise).

**Baseline-floor rider: PASS** — all 20 pairing cells ≥ their post-swap sane-vs-sane baselines (checked cell by cell; tightest: D-E seat0 98.7% vs baseline 98.7% — exactly at the floor; biggest skill margins remain A-D seat0 20.4% vs 8.1% and B-C seat0 59.0% vs 31.1%).

Vs random (unchanged from S8's 99–100% everywhere; not re-run this session — no change touched the random rung).

## Deviations from the brief

1. **Part 1's combat fixes measured neutral** where the brief expected movement ("stop overvaluing Boggart Brute attacks") — A mirrors and A pairing cells are flat. Kept (they're correctness), reported as such; S8 concern 3's estimate of the pair-block distortion was too high.
2. **E stopped short of the 65 band on one seating** (64.8/56.9). Session budget honored per the brief's stop rule; the on-the-draw gap is the next E lead (see Concerns 2).
3. **Flash-hold/Snake modeling kept despite neutral deltas** — unlike the reverted Curiosity credit, these change *when* E casts (watchability + correctness) at zero measured cost; called out so the planner can overrule the asymmetry with the "revert no-delta" rule if preferred.
4. **The default-tier fuzz smoke dropped from 100 to 50 games/pairing** to hit ADR-055's ~15s target (suite is 10.8s); FUZZ_FULL keeps 500. ADR-034's smoke count is now tier-dependent — flag if that wants an ADR touch-up.

## Concerns

1. **Master needs a real edge, not less noise (the M4c question).** Temperature is a shallow lever at the top: 0.12 buys +3.8% overall, 0.05 *loses* (B 41.6% — a deterministic policy is exploitable by a noisier one at equal evaluation). If a strong "master" tier matters for the overworld, M4c's shape is: a modest evaluator edge for master only (e.g., 2-ply on the handful of highest-stakes decisions, or master-tuned weights fit by ladder search). If the current gentle gradient is enough for difficulty dials, **M4 is done** — my recommendation: ship it, revisit only if playtesting wants a scarier top tier.
2. **E's remaining gap is on the draw** (56.9 vs 64.8 on the play). E's game is tempo; a turn behind, its counter-holds and flash-holds cost development it can't afford. A "when behind, develop; when ahead, hold" posture switch (board-delta-conditioned holdTricks) is the obvious M4c/E lead — it's one condition, but it's a new evaluator input shape, so escalating rather than sneaking it in.
3. **Dead weight found this session:** the sweeper dampener (removed), the Curiosity attack credit (measured 0.0, reverted), and T=0.05 master (rejected). Still unmeasured and suspicious: the keyword-bonus table's exact values (flying 0.7 etc. have never been individually tested) and the archetype hand weights — candidates for an automated weight-search pass if M4c happens.
4. **Archetype-as-knob worked suspiciously well** (E control→midrange +4.75). B is the only remaining "control" deck; if B ever underperforms, try its posture first. Longer-term this suggests archetype should perhaps be *fit* per deck by ladder search rather than assigned by intuition — parked with the ADR-054 curation workstream since deck identity and pilot posture interact.
5. **Vitest worker RPC-timeout noise on FUZZ_FULL** (also seen in S8): all 149 tests pass but the runner exits nonzero after a "Timeout calling onTaskUpdate" unhandled error during the 97s fuzz test. Cosmetic but it would break CI redness-as-signal; likely fixable with a vitest config bump (`teardownTimeout`/fewer workers for the FUZZ_FULL tier) — small follow-up.

## Registry entries added/changed

None — no rules, no cards, no pool changes (tuning only, per the brief's out-of-scope). `DECK_ARCHETYPES.E` changed in `packages/sim` (code, not registry).

## Test status

Default tier: 147 passing / 2 tier-skipped, **10.8s** (ADR-055 target met). FUZZ_FULL: **149 passing / 0 failing**, ~101s (plus the Concern 5 harness noise on exit). Book of shame 5/5 green post-ADR-056 with the patch deleted. `pnpm typecheck` clean. This session's measurement volume: ~90,000 ladder games across tuning deltas, control experiments, profile ladders, and the final gates — zero engine errors.

## Suggested next

Per the roadmap, **M5 (playable UI) is unblocked** and I'd take it next — the agents are good enough to be worth playing against, and the difficulty dials exist. The M4c question (Concern 1) can wait for playtesting evidence. If the planner wants one more agent session first, the ranked E leads are Concern 2's posture switch and a weight-search pass over Concern 3's untested constants.

## How to run

```
pnpm install
pnpm test                                        # default tier, 10.8s
FUZZ_FULL=1 pnpm test                            # full tier (~101s; known harness noise on exit, Concern 5)
pnpm ladder                                      # heuristic vs sane + random, 1,000/cell, both gates
pnpm ladder --games 200 --mirrors                # cheap tuning deltas
pnpm ladder --cell A,B --games 100               # single-pairing loop
pnpm ladder --challenger heuristic:master --baselines heuristic --mirrors --games 500   # profile ladders
pnpm viewer / pnpm gallery
```
