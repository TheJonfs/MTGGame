# Session 51 brief — the draft

*Planner → Implementer. 2026-10-04. Follows the running handoff.md (after S50) and `docs/convocation-plan.md` stage 3. One session. Process rules unchanged: appends to `docs/decision-updates/s51.md`; every AI change carries a ladder delta or reverts.*

## Part 0 — Rulings and ADR appends
- **S50 Deviations 1–8 ratified.** The Sharpshooter as Scryfall has it; the Kavu's hold on an empty table (CR 603.3d); Hard's rows; the rating not updated on mixed evidence; the racing term dropped (the probe found no pilot fault).
- **ADR-150 — The rating is rebuilt from post-fix evidence only.** Sealed games played before books 88–91 are archived, not pooled: v1′ = the authored-list presence term (unchanged) + the lift term from S50's 20,000 games and a fresh noise run (σ 0.4, a third of the decks). It replaces v1 if red's share of Sealed decks rises without red's win rate falling; the twenty movers reported. Future updates pool only runs played on the current pilot (the runs carry a `pilotVersion` — the book count at the time).
- **The commitment slope**: full slope 0.50 → 0.35, the cut at pick 8; target 20–30% of seats changing colours after the cut. If missed, the cut moves to pick 10 (one change at a time).
- **Red's old commons stay in the packs**; Dragon Fodder is judged after more games.
- **The campaign re-baselines** after books 88–92: `flood-sim --refs postlairs`, `heart-sim --tide 1 --refs postlairs`, `mage-sweep --part 5` at Standard, once each, as the new baselines (a red seat that holds burn for creatures is a different opponent).

## Part 1 — The draft as a screen
- **The pod**: eight seats — the human and seven AI on the pick rule (S50's), three Classic packs from the set, left-right-left; the AI seats' picks on the main thread as the human picks (seven picks a step — instant).
- **The screen**: the pack's cards (the frame grid the editor uses), the human's picks so far by colour, pick N of 45, pack 1/2/3; a card is picked by click; no take-backs (a draft's rule); a hover shows the card. The AI seats' picks are hidden (a real draft); the pack returns with fewer cards. A "what's been passed" memory is the human's own.
- **After the draft**: the human's 45 picks are the event's pool (basics free) → the existing build (the editor over the pool, "Suggest a deck") → rounds → the Umbel. `newDraftEvent({ seed, set, recipe, seats, rounds, top8 })` beside `newSealedEvent`; the save key carries the draft in progress (the packs, the picks, the pod's picks) and resumes mid-draft.
- **The AI seats' decks** are built by the Limited builder from their picks (as the draft sim does).
- **Rotisserie** is not this session (the drafter's easiest case, but a different screen).

## Part 2 — Measure
- `pnpm draft-sim --pods 50` at v1′ with the slope: the colour table, red's seats' win rate, black's pods, the commitment share, the spread.
- A headless draft event end to end (the pod drafts, eight decks, five rounds, the Umbel) saved and resumed mid-draft and mid-round.
- The field's pick quality as a check: the AI seats' decks from a draft against the AI seats' decks from a Sealed pool at the same seed (the drafter should build better decks than the pool hands it — a draft concentrates colours).

## Part 3 — Text
- The door: *"A Convocation — Draft, eight seats: three packs, five rounds, the Umbel."*
- The pick prompt: *"Pick {n} of 45 — pack {p}."*; the pass: *"The pack goes left."* / *"right."*
- The draft's end: *"Forty-five picks. Build from them."*

## Handoff
The draft screen walked in the browser (a full draft and event as the human with the dev concession); the rating v1′ and whether it replaced v1; the slope's share; the campaign's new baselines; deviations, concerns; the estimate for S52 (Constructed by select-and-repair against the Open's library — the first Constructed stage).
