# Handoff — after Session 59 (2026-10-10)

## State of the world
The two games are joined. A journey's Convocation sits on a clock: every thousand steps the world posts a letter that stands until the next sitting. The Convocation's door reads the letter; entering by it spends it, and the finish sends gold and the kept cards home through an outbox that the journey drains into its own save. A menu event is the same mode and sends nothing. The Open is now read three ways (matches, game one, games two and three); the Pall is a game-one deck (65 → 49 after sideboarding) and the Rabble is not (71 in matches). `pnpm typecheck`, `pnpm test` (1001; 1007 with the work after the session) and `pnpm build:web` pass; the ladder mirror gate passes. **Everything here is pushed.**

## Done this session
- **Part 0 — the smalls.**
  - The removal floor at three: tried on twelve lists, no gain, not shipped (it loses to the Tally's two-drops). Behind `trial: ["removalfloor3"]`.
  - R-031 cites 701.14.
  - The play diff's playouts reshuffle both libraries; the report says what a playout is.
- **Part 1 — the outbox.** `world/convocation-link.ts`. An entry is `{ id, kind: "kept" | "prize" | "spent", invitationId, cards?, gold? }`. The journey applies each of its own entries once, inside its autosave, and deletes it only after the write succeeded.
  - Tests (11 new): a finish posts; the journey drains once; a reload between the post and the drain loses nothing; a page closed between the save and the delete applies nothing twice; two tabs; another journey takes nothing.
- **Part 2 — the clock.** `convocationInterval` (1000) and `convocationShape` (phase one the short Convocation, phase two the four days). The invitation is a window: the unspent one is dropped at the next sitting and the journey is told. `source` is an enum; only `clock` is written.
  - The journey's ribbon shows "✉ the Convocation sits" while a letter stands; the map's prompt carries the sitting, the missed sitting and what came home.
  - The door shows the letter above the menu, with "Break the seal and enter".
  - Every event carries `origin: "menu" | "journey"`; the ledger records it, the invitation and the gold sent.
- **Part 3 — the fence.** A kept card is never one of the fourteen in the packs' power slot: not offered, refused by the controller, refused again at the drain.
- **Part 4 — the prize table.** Three knobs (the bands' gold, Hard ×1.5, a single event half). Only a journey event posts.
- **Part 5 — the text.** The brief's three lines as written.
- **Part 6 — the three-column read.** `open:rr --matches N` and `--matches-report`. 6,800 matches, 16,852 games: `analysis/runs/matches17_s59.md`, and the table in `docs/decision-updates/s59.md`.
- **Before the brief (Chris's playtest note) — book 118.** A mandatory enters-destroy counts legal targets, not creatures: a Nekrataal is not cast when only its caster's side has a creature it can destroy. It is still cast into an empty table.
- Walked in a browser: a journey past step 1000 shows the letter; the door shows it; entering posts the spend; the journey, reopened, marks it spent and the outbox is empty.

## After the session — a Rabble beater, the Manaba, and books 119–120 (Chris, 2026-10-10)
- **Chris's green-red control list** (his Open of seed 745905: 4–1 and a semi-final) measured 38% in matches against the Rabble in the pilot's hands. Trade studies in the Wurmspeaker's seat (scratch; the list is NOT in the Open):
  - Seasoned Pyromancer for Grazing Gladehart: 52.5 against the Rabble. With Pelakka Wurm for Treetop Snarespinner: 60.5, and 63 in matches against the field. With four main-deck Pyroclasm as well: 71 against the Rabble, 61 against the field.
  - Every version loses to the three Usher lists (24–36).
  - **The pilot sideboards his fifteen badly**: against the Rabble its only swap is two Walls of Blossoms for two Chars, and the four Pyroclasms never come in. With its sideboarding off the list gains about eight points against the Rabble. A guide is the fix; it needs the list registered.
- **The Manaba is in the pool** (Chris's card): {G} Creature — Snake 1/1, "Tap an untapped Snake you control: Add one mana of any color. Each opponent gains 1 life." T2 as an interim (Chris has not named a tier). Art: the watercolor of four generated candidates (Chris's verdict); his printed face wired.
  - **R-107**: a mana ability may carry an effect beyond its mana and a tap-a-creature cost. It resolves at once; it is activated deliberately (as the Lotus). A creature that came in this turn can pay the cost.
  - Tried at 0/1, at 1/1 for two life, at 1/1 for one. Chris took the last. In his list (with Rage Cobra and Pelakka Wurm) it measures 64.7 in game one against the field; Llanowar Elves in the same slots, 62.1.
- **Book 119 — a mana ability paid by tapping a creature** is held to three tests: it enables only a card the pilot would cast now; on our own turn it is refused when the tapped blockers let through an attack that takes us to five or less; at the opponent's end step it is taken for its own sake while a permanent of ours pays on their gaining life. `off: ["tapburst"]`. Before it the pilot wasted two taps in three (+3 to +4 points for every Manaba build).
- **Book 120**, two parts:
  - **A tap burst pays into an X spell or an activated ability** the lands cannot reach, when the scorer would take it (`off: ["tapsink"]`). Measured neutral (0.0 ± 0.8, +0.5 ± 0.5, −0.3 ± 0.9 on three builds): on, at Chris's word.
  - **A Lotus (or any burst) is cracked only toward a card the pilot would in fact cast** — the question a Ritual was already asked (`off: ["lotuscheck"]`). Twelve lists, on against off: 0.0 to +0.2, none worse. **Ladder mirror gate PASS.**
- **Tools**: `pnpm narrate` (a recorded game move by move); `open:rr --deck-side` (a build's own fifteen), `--extra-cards dir` (defs outside the pool, for a card under consideration); ability activations are recorded in a run's logs.
- **Concerns:**
  1. **A deliberate mana ability cannot be activated in the middle of paying a cost** (605.3a allows it). The mana is made first and the spell cast after. R-107 records it.
  2. **R-107's rule citations were not re-fetched this session** (605.1a, 605.3b, 302.6); they are long-stable, but principle 10 asks for the check.
  3. **My first version of book 120 recursed without end** (a burst's question asking about the burst) and crashed most of a simulation batch; the suite had not met the case. Guarded, and book 120's test now covers a Lotus beside the card it asks about.
  4. **Under random play the Manaba is tapped at every priority** and games run long: its fuzz runs two games a pairing by default (sixteen at FUZZ_FULL, 768 games, clean).
  5. **The pilot still does not chain several Snakes for one large turn except through an X spell or an ability**, and it never taps for a Rage Cobra on its own turn. The card is under-measured on that side.
  6. **The AI's sideboarding takes Walls of Blossoms out against aggro lists** (the "creatures" rule brings removal in for the lowest-rated card). Chris's list shows it; the Open's green lists may share it.

## Deviations from the brief
1. **The outbox is a key per entry, not one key.** The brief says "`convocation-outbox` (its own key)". One key holding a list is a read-modify-write on both pages, and the brief's own test (two tabs never lose an entry) cannot be guaranteed that way. Entries live at `convocation-outbox:<id>`. *Rule on the shape; the behaviour is the brief's.*
2. **The drain rides every autosave**, not only load and focus. It is also run on load and on focus. A drain is then always followed by the save that makes it durable.
3. **A single-shape invitation is a draft.** The brief names three shapes, not the single event's format. A Constructed single's kept card would come from the whole format's pool. No knob selects `single` today.
4. **Kept cards go home for the champion and the eight only**, per the table. A single event already lets any finisher keep a card for the trophy room; outside those bands it stays there and is not posted.
5. **One line of text is mine**: the journey's notice when the outbox is drained ("From the Convocation: 150 gold, Serra Angel."). *Chris's pen.*
6. **The removal floor of three is left as a trial switch**, not removed.

## Concerns
1. **The Pall's 65 was a game-one number.** In matches it is 57, sixth, and eight lists already beat it after sideboarding. ADR-160's Witch lever does not trigger on the match column. The game-one table (`OPEN_MEANS`) still draws the field's seats; if strength should mean matches, the draw wants the match column.
2. **The Rabble is the format's best deck in matches (71) and sideboarding does not touch it** (−1.3). Only the Sweep gains on it after boarding (+19, to 43). The sweeper control list is needed; the eight sideboarding rules already bring sweepers in and it is not enough.
3. **Three lists get worse after sideboarding beyond the Pall**: the Wurmspeaker (−6.7), the Muster (−6.3), the Levy (−2.8). Either their fifteens are poor or the rules take the wrong cards out. A guide measured row by row is the tool.
4. **Entering by the letter is spent at once and cannot be undone.** Abandoning the event does not return it. That matches "a window, not a stock", but the door says so only in small print.
5. **The clock counts steps, and inn rest spends steps.** A player can sleep to a sitting. Harmless at these prizes; worth knowing before the R-draw card is added.
6. **The journey's ribbon is crowded** at narrow widths with the letter on it.
7. **Book 118 does not weigh Chris's corner case** (trading a 1/1 token for the Nekrataal's body). The cast simply waits.
8. **The reshuffled playouts change the play diff's old numbers.** Reports written before today were one sample a decision.

## Registry entries added/changed
- R-031: the citation (701.12 → 701.14).
- Knobs: `convocationInterval`, `convocationShape`, `convocationPrizeGold`, `convocationPrizeHard`, `convocationPrizeSingle` (`docs/knobs.md` regenerated).
- No pool rows.

## Test status
- `pnpm test`: 1001 passed, 2 skipped. New: `world/convocation-link.test.ts` (4), `ui/convocation/convocation-link.test.ts` (3), book 118, the reshuffle in `sim/s58-replay.test.ts`.
- Ladder mirror gate: PASS (book 118).
- No fixtures re-baselined.

## Suggested next
- **The sweeper control list** (the planner's). My estimate to measure it once authored: about half a session. Game one against the field is 1,600 games (about five minutes); the match read against the sixteen is 800 matches (about fifteen); swap trials run ten at a time in about seven minutes a batch; a guide costs about a minute a row.
- **Guides for the lists that lose ground after sideboarding** (the Wurmspeaker, the Muster), and one for Countersnake.
- **A journey played through a sitting**, to set the interval (1000 against 500) and the prize numbers.
- **Decide whether the field's seat draw reads matches or game one.**

## How to run
```
pnpm viewer                                                    # /world the journey; /convocation the hall; /play a single match
pnpm typecheck && pnpm test
pnpm open:rr --matches 50 --seed 56 --shard i/8 --out analysis/runs/m_$i.json   # the Open in matches; then:
pnpm open:rr --matches-report analysis/runs/m_*.json --out analysis/runs/matches.md
pnpm open:rr --games 100 --seed 56 --shard i/8 --out analysis/runs/rr_$i.json   # the game-one round-robin; then --merge
pnpm open:rr --games 100 --seed 56 --only locks --trial removalfloor3 --trial-for locks --out x.json   # a rule on trial
pnpm play-diff docs/debug_logs/recorded_games/<file>.json --event <seed> [--playouts 8] [--out report.md]
pnpm knobs:doc                                                 # after a knob changes
pnpm open:gen                                                  # after a list changes
pnpm ladder                                                    # the gate for any AI change (run alone)
```
