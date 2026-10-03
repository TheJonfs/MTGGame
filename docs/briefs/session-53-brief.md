# Session 53 brief — the full Convocation

*Planner → Implementer. 2026-10-06. Follows the running handoff.md (after S52 and the post-S52 work) and `docs/convocation-plan.md` stage 5. One to two sessions. Process rules unchanged: appends to `docs/decision-updates/s53.md`; every AI change carries a ladder delta or reverts.*

## Part 0 — Rulings and ADR appends
- **S52's nine deviations and the post-S52 work ratified** as a block: thirty-two seats, the Open's field from all twelve lists with stock/light/heavy tinkerers, `pnpm tinker` (and the fizzle fix it found), the pod analysis, books 93–94, the flat entrance (`CONVOCATION_ENTRANCE_ADR148` kept), the black investigation, the Constructed checks, the plan rules off, the pack-reading term off (its code stays, with its reason: a signal built on the rating follows the rating).
- **ADR-153 — Limited and Constructed are rated apart.** One table, two scores: `rating` (Constructed — v1.1's authored presence plus Sealed lift) and `limited` (an empirical-Bayes posterior on Limited games only, the tier as the shrink target). Every Limited path reads `limited`; the Constructed builder, the Open and the tinker read `rating`. The evidence: a deck's mean tier predicts Limited win rate at r = −0.06, v1.1 at 0.34, the posterior at 0.59; head to head the Limited score's decks win 52% in draft and 54% in Sealed. Supersedes ADR-145's single number. **The tier ladder is shop and pack rarity, not Limited quality**; no card is re-tiered on the Limited score.
- **ADR-154 — The Sealed builder varies its pair.** A seeded weighted choice over the top three pairs by score (the Constructed select's rule), not the argmax — so a field is a field. Measure: blue's share of Sealed decks (67% today), the colours' win-rate spread (49–51% today), decking (17%).
- **The 50% draft target is measured against three-pack Sealed** (the drafter wins 65–66% there); six-pack Sealed is a deeper pool by construction.
- **Red stays last and tracked**; a future red round is judged on the Limited score.
- **A noise run on v1.3** re-measures the Limited score on the decks it now builds (ADR-150's watch); report the twenty movers; adopt as v1.4 if the head-to-head holds.

## Part 1 — The staged event
`newConvocation({ seed, stages, seats, top8Format })` — the full event is a list of stages, each `{ kind: "draft" | "sealed" | "constructed", format?, set?, recipe?, rounds }`; the default (the Pro Tour's shape, thirty-two seats): **draft (Plane/Classic) 3 rounds → the Open 5 rounds → draft 3 rounds → a second Constructed format 5 rounds → the Umbel in the last Constructed format** (the day's formats chosen at the door from the seven; a second draft's set may differ).
- **Standings carry across stages** (one record for the event; the Swiss pairs on it; a stage's first round pairs by the carried record, no rematches across the event where avoidable).
- **A Limited stage** gives every seat a fresh pool (its pod drafts; a Sealed stage deals); the build between stages is the editor over that pool; the AI seats build as now.
- **A Constructed stage** registers a deck at the stage's start (the player's by ADR-152 — the editor over the format's legal pool, a suggestion, or a saved deck that passes); the field by select-and-repair. The same deck plays the stage's rounds; sideboarding as built.
- **The Umbel** in `top8Format` (the last stage's by default): the eight by the carried standings; the player outside the eight watches it resolve.
- **The entrance** flat (Chris) — the per-round tables stay wired for a later ruling.
- **The save**: `convocation-event-v2` (the stage list, the stage index, the per-stage pools and decks, the carried record, the bracket); resumable at any point; a v1 event still loads.
- **The door**: the full Convocation beside the three single events; a stage chooser for the two Constructed formats (the seven); the single events unchanged.

## Part 2 — Prizes by finish (planner's default; Chris reshapes — the linkage is deferred, so these are ledger-and-trophy prizes)
- **The ledger** records the event (the stages, the formats, the seed, the field, the finish, every deck the player registered).
- **Titles** on the ledger line and the finish screen: 1st *"Champion of the Umbel"*; 2nd *"the Umbel's second stalk"*; 3rd–4th *"a semi-finalist"*; 5th–8th *"an Umbel seat"*; the rest their place of thirty-two.
- **A card kept** for the eight: from the last Limited stage's pool, the player's choice (the eight get one; the champion two) — into the ledger as a trophy today; into the campaign's collection when the linkage exists.
- **A trophy screen** on the door: the events played, the finishes, the kept cards, the champion's decks — the shape the linkage will later read.

## Part 3 — Smalls
- The player's Constructed editor opens with a **"start from a list"** picker (the twelve Open seeds; the gate formats' seats) over the empty deck (S52 Concern 8).
- Sideboarding in a Constructed event for the player (the field's rules as built) — if cheap.
- The thirty-two-seat Draft and the Open walked once in the browser to the Umbel after the rating change (not verified since).

## Part 4 — Measure
A full default Convocation headless with a heuristic in the player's seat (four stages, the Umbel), saved and resumed between stages and inside a stage; the field's time per stage; the champion's seat's deck quality across stages (does the carried record find the strong seats?). Then Chris plays one through.

## Part 5 — Text
- The door: *"The Convocation — four days: a draft, the Open, a draft, {format}; the Umbel of Eight."*
- Between stages: *"Day {n} ends. The table stands at {record}. Tomorrow: {stage}."*
- The Umbel's opening: *"Eight remain. The Umbel opens in {format}."*
- The champion: *"Champion of the Umbel."*

## Handoff
The staged event walked (headless and by hand); the prize screens; the save v2; the pair-variety measure; the noise run and whether v1.4 was adopted; deviations, concerns — and the implementer's read of what remains of the Convocation plan after this (the worker for a hundred seats; the campaign linkage's hooks as they stand).
