# Session 54 brief — the field, after the first Convocation

*Planner → Implementer. 2026-10-04. Follows the running handoff.md (after S53 and the post-S53 work). One session. Process rules unchanged: appends to `docs/decision-updates/s54.md`; every AI change carries a ladder delta or reverts.*

## Part 0 — Rulings and ADR appends
- **S53's deviations and the post-S53 work ratified**: 128 seats; draft rounds inside the pod; the second draft's pods by standings (MTR 7.6's "random" noted as the written rule; the Pro Tour's practice as ours); decklists registered up front and locked through the Umbel; portraits recycled; the block-queue and worker-pool fixes; book 95; the token arts as faces.
- **ADR-155 — Rage Cobra is {1}{R} 2/2**, measured by `card-test`; and **`card-test` is the standard check before a custom card enters the pool** (a paired, same-slot, same-seed measurement against Gray Ogre and Boggart Brute as yardsticks; Sealed hosts measure Limited — a Constructed custom also runs the Open's round-robin).
- **ADR-156 — Contributed lists.** A list from play joins the library (`open-contributed.json`) when it has reached an Umbel; the field draws on it by measured strength like an authored list; a list is retired after three re-measures in the bottom three of its format's round-robin. The planner's document stays the seed. The Sweep (Chris's 19–0 Jund Aristocrats) is the first; its name stands until Chris names it.
- **ADR-157 — The escalation is a mode, default off (Chris, after a second 19–0 with close games).** Every Convocation event — the single Draft, Sealed and Open and the full and short Convocations — carries a difficulty: **Normal** plays everyone straight up (the entrance flat at every round, as today); **Hard** adds the escalating life (`CONVOCATION_ENTRANCE_ADR148`: +0/+2/+4/+4/+6 by Swiss round within a day, the bracket +4/+6/+8, with a per-day scale Day 1 ×0, Day 2 ×0.5, Days 3–4 and the Umbel ×1). Chosen at the door, recorded on the ledger line and the trophy room ("Hard"). The room for a **Very Hard** later (basics in play, a card to hand — the campaign's other entrance kinds) is the same table with more rows; not built. Rationale: the second sweep had close games, and what Chris learned from them went into the AI (books 93–95) — the straight-up field improves by play, and the escalation is for the player who wants the hill.
- **ADR-158 — The field has strength.** A seat's pilot and builder are drawn by seat from a distribution: pilots journeyman (a quarter), master (three quarters); builders stock (a quarter), light (half), heavy (a quarter) for Constructed, and for Limited a rating-noise σ per seat (0 / 0.2 / 0.4 by thirds). The draw is seeded and recorded on the seat; the standings show nothing of it. The measure: deck quality against finish, r = −0.09 today; the read wanted is 0.3 or better, with the Umbel's eight averaging above the field's median.
- **The rating loop**: a noise run follows every rebuild (ADR-150's watch made a rule); no special prior.
- **The ledger's field trims** to the top sixteen plus the player (Concern 5).

## Part 1 — Build
- The difficulty on every event (`difficulty: "normal" | "hard"`, default normal): Normal flat; Hard the ADR-148 tables × the day scale, through the resolver. The door's chooser; the ledger and the trophy room carry it.
- Field strength (ADR-158): `seat.pilot`, `seat.builder`, drawn at the event's creation and used at every stage; the headless series use the seat's pilot; the day's decks use the seat's builder.
- A **short Convocation** on the door: *"two days — a draft and {format}; the Umbel"* (Day 1 draft 3 rounds, Day 2 Constructed 5 rounds, the Umbel) — the stage list makes it data.
- The headless pod drafts at a stage's start on the workers (Concern 6).
- The ledger trim; the trophy room reads the trimmed field.

## Part 2 — Measure
- `pnpm convocation-sim --events 8` with ADR-158: deck quality vs finish (r); the Umbel's mean percentile; the heuristic's finishes; the field's time per stage on workers.
- The Open's round-robin with the Sweep and the twelve (already run on pilot 95 — the baseline for ADR-156's retire rule starts here).
- The noise run after v1.4 (the rule's first instance); v1.5 if the head-to-head holds.

## Part 3 — Text
- The short door: *"A Convocation — two days: a draft and {format}; the Umbel of Eight."*
- The door's difficulty line: *"Normal — the field plays you straight. Hard — the field grows a little each round."* The field's strength (ADR-158) is never announced.

## Handoff
The two ADRs as built and their measures; the short shape walked; the ledger trimmed; the noise run; deviations, concerns — and the implementer's read for the next design conversation: the campaign linkage's one-way write (kept cards into the journey's collection; an entry cost and a prize from the world), as it would be built.
