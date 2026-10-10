# Session 59 brief — the bridge between the two games

*Planner → Implementer. 2026-10-09. Follows the running handoff.md (after S58 and the week's work) and its linkage read (S54's design against the code as it stands). One session for the linkage; the format's boarded read beside it. Process rules unchanged: appends to `docs/decision-updates/s59.md`; every AI change carries a ladder delta or reverts; probe before rule (ADR-167).*

## Part 0 — Rulings and ADR appends
- **S58's deviations and the week's work ratified as a block**: the lists in code with the generated reference; the Locks' guide at four pairs (the guide mechanism beyond the brief); the Writ for the Undertow and the Rabble for the Cinder (both archived with their histories; the mill seed leaving the field is noted); books 112–117; the field cap at a tenth (ADR-158 amended); the Forerunner at T2 as printed (R-106); Countersnake as the seventeenth list; the single match's setup screen; the editor's filters.
- **ADR-167 amended — the recorded-play path is named**: record, diff, read the commonest difference, measure a candidate on the lists it is for, ship behind a switch. Books 112–117 are the first six. A guide is a rule for this purpose (Concern 1): measured row by row before it ships.
- **ADR-171 — A pairing is reported three ways (Chris).** The standard instrument for any pairing is N best-of-three matches, reporting **the match win rate, the game-one win rate and the game-two-and-three win rate**, each with its spread, and the game-one → game-two/three delta — because a combo or aggro deck that wins game one and loses the sideboarded games is a thing the format should be able to see. The round-robin of record gains the three columns (`open:rr --matches`); the game-one table stays as one of them. ADR-160's levers are read on the **match** column and the delta, never on game one alone. Two lists at 66 and a third at 58 that beats one of them is the Open's shape today: the Rabble is a fair deck whose predator is a sweeper control list the field lacks; the Pall's predators exist. Over 65 in matches: the Rabble → the planner authors the sweeper control list first (the Locks' overhaul, ADR-165) and restricts nothing; the Pall → the Witch, as ruled.
- **Smalls ruled**: the removal hold's floor at three gets a trial (book 117); R-031's fight citation → 701.14; the play-diff's playouts reshuffle the unseen cards, and its report says a playout count means one sample until they do.
- **ADR-172 — The linkage** (Parts 1–4): the outbox; one invitation route (the clock) with the others' machinery recorded, not built; the fence; a minimal prize table; the event's origin.

## Part 1 — The outbox (first; everything rides it)
`convocation-outbox` (its own key): entries `{ id, kind: "kept" | "prize" | "spent", cards?, gold?, invitationId? }`, appended by the Convocation at a finish or an entry. The journey drains it on load and on focus; each id applied once (provenance `"convocation"`); an entry deleted only after the world's own save succeeds. A phase-one and a phase-two save each drain into their own collection. Tests: a finish posts; the world drains once; a reload between post and drain loses nothing; two tabs (a Convocation posting while a journey autosaves) never lose an entry.

## Part 2 — Invitations: one route, built so others can follow (Chris)
- **The Convocation sits on a clock.** Every `convocationInterval` steps of a journey (knob, ⚠ 1000 — journeys run 1,400–2,300 steps a phase, so one or two sittings a journey; 500 is the other value to read), the world posts an invitation to an additive save field `invitations[]`; the door reads it. **An invitation is valid until the next sitting** — a window, not a stock: miss it and it is gone; they do not accumulate. The shape it admits (single / short / four days) is a knob by phase (⚠ phase one the short; phase two the four days). The Convocation is "an interesting auxiliary that is still meaningful when it happens", not a second economy.
- **The machinery is built for other routes but only the clock is enabled**: `invitation.source` is an enum (`clock` | `board` | `quest` | `grant`); the board, the courier and the boss grant are *not* built this session (ADR-165's lesson — don't pre-build what phase three may reshape). Recorded as the three candidates for after phase three.
- **Origin is recorded on every event**: `origin: "menu" | "journey"`. A menu event is the same mode and posts nothing to the outbox (no journey to pay); a journey event enters by invitation and posts. A hook stays for later: a menu finish may one day unlock something for a journey (`menuUnlocks`, empty).
- The door shows the sitting ("The Convocation sits. {shape}. Until step {n}."); entering posts "spent" with the id; the ledger records it.

## Part 3 — The fence (a), as ruled
A kept card is never one of the fourteen in the packs' power slot (the Lotus, the five Moxen, Time Walk, the five High Grounds, the Manafleur, the Cinquefont). The filter at the choice; the trophy room unchanged.

## Part 4 — The prize table (provisional; gold and the kept cards only this session)
Chris is not settled on what comes home until the invitation's place in the journey is read, so the table ships **minimal and as knobs**: gold by band and the kept cards (already the Umbel's prize); the R-draw card for the champion is held.
| band | gold (knob) | cards |
|---|---|---|
| the champion | 300 | the two kept cards |
| the Umbel's eight | 150 | the kept card |
| the top quarter | 75 | — |
| everyone else | 25 | — |
Only a journey-origin event posts. Hard ×1.5 (knob). A single event pays half the band. The bands and numbers are the planner's placeholders against the phase-two purse (100 gold buys nine tier-1 cards); set after a journey with a sitting in it.

## Part 5 — Text (planner; Chris's pen)
- The sitting (the door, and a map notice at the step): *"The Convocation sits. A letter under seal admits you — {shape}. It stands until step {n}."*
- The sitting missed (the notice at the next): *"The Convocation sat, and you were elsewhere."*
- The finish, when prizes post: *"The purse and the cards go home with you."*

## Part 6 — The three-column read (ADR-171)
`open:rr --matches` for the seventeen lists (or the two pillars against the fifteen if the full run is long): the match, game-one and game-two/three columns with spread and the delta per pairing; the round-robin of record carries them from here. The read: the pillars' match rates; the lists whose delta is largest (a game-one deck the field catches after boarding, or the reverse). Report; the planner acts on it.

## Handoff
The outbox and its tests; the clock and its window; the origin on events; the fence; the minimal prize table; the text; the three-column read; deviations, concerns — and the implementer's estimate for the sweeper control list's measurement once the planner authors it.
