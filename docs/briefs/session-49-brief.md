# Session 49 brief — sixteen seats, the colour question, the drafter's data

*Planner → Implementer. 2026-10-03. Follows the running handoff.md (after S48) and `docs/convocation-plan.md` stage 2. One session. Process rules unchanged: appends to `docs/decision-updates/s49.md`; every AI change carries a ladder delta or reverts.*

## Part 0 — Rulings and ADR appends
- **S48 Deviations 1–9 ratified.** The host object's shape; the field on the main thread through sixteen seats (the worker's timing waits for a hundred); the ledger as its own key until the profile's writers are made additive (the rule: a writer keeps what the profile already holds — `recordCutting`'s fix is the model); "Suggest a deck" stays; the stricter splash; no AI sideboarding yet; `poolIsCap`.
- **The tiebreak's floor is verified**: the Magic Tournament Rules floor opponents' match-win percentage at 33% — R-101's "unverified" comes off.
- **ADR-148 — A Sealed event's entrance is life only.** A basic in play distorts a forty-card game; life makes the race honest. `convocationEntrance` for Sealed at Standard: round 1 +0, round 2 +2, round 3 +4 life (Easy flat; Hard +2/+4/+6). ⚠ provisional — read by Chris's next event; a one-line table.
- **The double legality line** (S48 Concern 4): the base floor stands down when a format asks more. Small.
- **The builder's top end** (Concern 7): a cap on four-plus-five-drops together (≤ 9 in forty) beside the six-drop cap.

## Part 1 — The colour question, separated (before the drafter)
Two experiments in `pnpm sealed-sim`:
1. **Forced pairs**: for each of the ten pairs, build 40 decks forced to that pair (the best deck the builder can make in it from pools where the pair is at least third by rated playables), play each against the field's twenty. Report win rate by pair, forced vs chosen. If forced red decks win ~45–50% from red-rich pools, the *rating* under-rates red; if they lose at 38–42% regardless, it's the pool or the pilot.
2. **Rating noise**: build a third of the sim's decks with Gaussian noise on the rating (σ = 0.4), so under-rated cards get played; one more update → **v2**; report the twenty movers and red's share and win rate before/after. The planner reads both; v2 replaces v1 only if the forced-pair table says the rating was the cause.
If the pilot is the cause: a note for the AI ledger (burn at faces in Limited; a term for creature-count when racing is not on), not this session's fix.

## Part 2 — Sixteen seats, five rounds, a Top 8
- `newSealedEvent({ seats: 16, rounds: 5 })`; byes exercised (a fifteen-seat test); the field's seven series on the main thread (measure; if a round exceeds ~3 s, the worker question returns).
- **The Top 8**: single elimination over `MatchSeries` — quarter-finals seeded 1v8 / 2v7 / 3v6 / 4v5 by the standings, semi-finals, a final; the human plays theirs live, the field's headless; a player outside the eight watches the bracket resolve (one screen) and takes their finish. The finish is the bracket's for the eight, the standings' for the rest (9th–16th).
- The entrance table extends to the bracket: Standard +4 / +6 / +8 life (quarter, semi, final) — ⚠ provisional.
- The save key carries the bracket; resume at any point.
- **Prizes stay the ledger** (ADR-147); the finish line names the place; *"The Umbel is yours"* only for the win now that the field is sixteen.
- The AI's sideboarding: the S47 plan's shape-keyed rules (artifact/enchantment removal in against auras seen; creature removal in against ≥ 15 creatures seen; counters out against a creature deck), from the seat's unused playables. Pinned.

## Part 3 — The drafter's data (no drafter yet)
- A **pick-order view** of the rating per set (the Plane / Classic): the top sixty by rating with colour and tier — the planner's read of what an AI will take first.
- A **colour-commitment term** designed in the plan: picks 1–3 by rating alone; from pick 4 a bonus to the two colours with the most rated picks so far, growing by pick; a cut at pick 8 (a third colour's bonus dies); the curve term from pick 20 (a seat short of two-drops rates them up).
- `pnpm draft-sim --pods 50`: eight seats drafting three Classic packs with the term above, the builder on the picks, a round-robin of the pod; report how many seats land on each colour and pair (Concern 1's question: do they fight over black?), and the pod's win-rate spread.

## Part 4 — Text and art
- The field's names: the planner's **sixteen** (replacing the twelve placeholders) — Part 5.
- The Convocation's door plate: Chris's A (the round hall) is installed; the Top 8's screen wants a plate (the Umbel — a flower-cluster seen from above, its eight stalks from one point) — one render for Chris.

## Part 5 — The field's names (planner; the plane's register, mixed colours and origins, no WotC names)
Hesper Lune · Tamsin Vell · Orrin Blackquill · Ilse Marrowgate · Cassian Dray · Nerys Fallow · Dathan Mire · Perpetua Ash · Wyn Cordovan · Sabel Thorne · Ignatius Reed · Mora Tideswell · Corvin Hale · Lirael Stane · Osric Fenn · Ysolt Garrow.

## Handoff
The forced-pair table and the noise update (and whether v2 replaced v1); sixteen seats and the Top 8 walked in the browser (a full event with the dev concession, the human in the eight and outside it); the AI's sideboarding pinned; the draft-sim's colour table; deviations, concerns; the estimate for S50 (the drafter as a screen: pick-and-pass, the human's picks, the pod's picks on the term).
