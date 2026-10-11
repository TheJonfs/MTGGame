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

## After the session — a Rabble beater, the Manaba, and books 119–120 (Chris, 2026-10-10; pushed)
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

## After the session — Reaper Control joins the Open; the tables with eighteen lists (Chris, 2026-10-10; pushed)
- **Reaper Control is the eighteenth list** (Chris's Jund Snake Control, his name): his sixty and fifteen from the Open of seed 611853 (5–0 in the Swiss, a quarter-final lost to the Kiln). Midrange pilot. 57 in game one, 60 in matches (fourth of eighteen). Against the Rabble: 50 in fifty matches on the table, 58 in a hundred beside it.
  - 27 single-slot swaps moved nothing more than two points; the list is left as he registered it.
- **Guides, extended (data, attached to a list's fifteen as before):**
  - Two new opponent shapes a row may name: `small` (fifteen or more creatures of toughness two or less) and `someGraveyard` (four or more graveyard cards — the Coin and the Hearth, where `graveyard` at eight reaches only the Pall).
  - `guidesOnly` in `open-contributed.json`: a guide named there is the whole plan — the rules do not run after it.
  - **Reaper Control's guide**, measured row by row at 200 matches a pairing: Crypts for Twisters against graveyard decks (37.7 with, 33.2 without: the Pall +10); Char, Recluse and Putrefy for Twisters and Bolts against control (56.6 with, 51.2 without). **A third row was measured and removed**: Pyroclasm for Bolts against small-creature decks (66.1 with, 71.1 without; nothing against the Rabble, worse against the Wurmspeaker and the Muster).
  - Guide only, rules only, and guide then rules came out level against the field (60.4 / 59.6 / 60.2, ±2.3). The guide is kept as the whole plan: it is the best of the three against the Rabble (58 against 51).
- **The Manaba for Birds of Paradise, tried and not adopted**: Countersnake −2.5 ± 1.8 (four), −1.0 ± 1.4 (two); the Sweep −2.5 ± 1.5, −1.6 ± 1.1.
- **The tables of record, eighteen lists, pilot book 120** — game one (`analysis/runs/rr18_s59.json`, 15,300 games; `OPEN_MEANS` updated) and matches (`analysis/runs/matches18_s59.md`, 7,650 matches):

| list | matches | game one (100 a pairing) | games two and three less game one |
|---|---|---|---|
| the Rabble | 71.4 | 65 | +0.9 |
| the Hearth | 60.9 | 52 | +5.6 |
| the Writ | 60.9 | 54 | +1.7 |
| **Reaper Control** | **60.2** | **57** | +0.7 |
| the Coin | 59.5 | 53 | +9.5 |
| Countersnake | 56.1 | 59 | −1.3 |
| the Pall | 55.1 | 64 | −15.3 |
| the Depths | 50.0 | 46 | +2.9 |
| the Levy | 49.2 | 51 | −0.3 |
| the Muster | 48.5 | 48 | −7.5 |
| the Kiln | 47.6 | 48 | −1.4 |
| the Warband | 47.2 | 48 | +3.6 |
| the Sweep | 43.4 | 47 | −3.2 |
| the Tally | 42.2 | 47 | −3.1 |
| the Wurmspeaker | 37.9 | 42 | −1.0 |
| the Ford | 37.5 | 38 | +4.1 |
| the Locks | 37.2 | 39 | +4.2 |
| the Enchantress | 35.3 | 39 | −0.2 |

  - The Rabble is still 71 in matches. Reaper Control is level with it, not ahead: the question ADR-171 put to the planner (a sweeper control list) is still open, with one list now at parity.
  - A grid of every pairing was published for Chris as a private page (the match, game-one and post-sideboard figures by cell).
- **Concerns:**
  1. **Sweepers do not beat the Rabble in the pilot's hands.** The Pyroclasm row was neutral there and harmful elsewhere; the earlier fixed-sixty tests said the same. Either the pilot plays sweepers poorly or the Rabble rebuilds through them (twelve burn spells and token makers). Worth a probe before the planner's sweeper list is authored.
  2. **The rules still take Walls of Blossoms out for removal** for every unguided green list. Reaper Control is shielded by its guide; the Wurmspeaker is not (37.9 in matches, 42 in game one).
  3. **`small` reads toughness, the rules' sweeper shape reads power.** Two definitions of the same idea now exist.
  4. **Reaper Control's quarter-final plan against the Kiln** (every Manaba and Rage Cobra out) is not in the guide: one game, unmeasured.

## After the session — the reference files, for the planner (Chris, 2026-10-10)
- **`docs/reference/open-lists.md`** now carries the table of record with its matches columns (matches, game one, the change after sideboarding, and whether a list's fifteen is registered, guided or built), each list's sideboard guide in words, the active lists in the table's order and the archived lists after them.
- **`docs/reference/cards.md`** opens with the custom cards gathered by colour and tier.
- **`docs/reference/README.md`** is rewritten: what each file holds, its sources, and the commands that refresh the Open's tables.
- The matches table is tracked data now: `data/convocation/open-matches.json`, written by `pnpm open:rr --matches-report … --record`.

## After the session — the field by match rate; the Tollgate measured (Chris and the planner, 2026-10-10)
- **The field's seat draw reads a list's MATCH win rate** (Chris), not its game-one mean: `openStrength` = the recorded matches table (`OPEN_MATCH_MEANS`, generated from `data/convocation/open-matches.json`) where a list has a figure, else `OPEN_MEANS`. Over 300 fields of 32: the Pall 2.09 seats → 1.54; the Rabble 2.28 → 2.55; the Hearth 1.60 → 1.82; Countersnake 1.77 → 1.43. The cap stands on top.
- **The Tollgate (the planner's overhaul of the Ford), measured in the Ford's seat — NOT registered; Chris and the planner to rule:**
  - Game one 46.9 against the Ford's 38.3 (+8.6 ± 3.1, paired); matches 44 against the Ford's 37.5. Control and midrange pilots level.
  - It is polar. It beats the Tally (82–90), Reaper Control (80), the Kiln (78 in matches) and the Muster (70+); it loses to the Hearth (4 in matches), the Coin (6), the Wurmspeaker (6) and, in game one, the Pall (15) and the Locks (17). The Rabble: 42–54.
  - The guide as authored, the rules alone, both, and the graveyard row widened to the Coin and the Hearth: level (44.1 / 43.5 / 43.5 / 44.2, ±3.3).
  - Chris's mana creatures: worse. Four Birds or Elves for two Bolts and two lands −2.5 ± 2.0; Manaba −4.1; Birds with no Pyroclasm −0.9; Birds for the Helixes and Bolts −9.9.
  - Sacred Helix and the Minefield carry it (Helix → Bolt −6.5; two Minefields → Bolts −2.9). Small and unproven: Forerunner to four +1.3 ± 1.6; Lumen for the Forerunners +1.9 ± 1.7.
- **Tools**: `open:rr --deck-guide file.json` (a guide for a build under test's fifteen, without registering it).

## After the session — the Tollgate replaces the Ford; the tables again (Chris, 2026-10-10)
- **The Tollgate is in the Open in the Ford's place** (Chris's ruling); the Ford is archived (38 in game one, 37.5 in matches at its last measure). The planner's sixty and fifteen as written; control pilot.
- **Its guide, the whole plan**, with one change from the planner's at Chris's word: against graveyard decks (`graveyard` or `someGraveyard`: the Pall, the Coin, the Hearth) the three Crypts and two Macabres come in for the four **Minefields** and a Pyroclasm, not for the Pyroclasms and a Wrath. Measured: cutting Minefields was better against all three (the Pall 40 against 34 in matches; the Hearth 10 against 2).
- **Graveyard hate does not fix the Coin and the Hearth**: with eleven pieces in the sixty from game one the Tollgate reached 19 and 23 against them (50 against the Pall). They cast the Usher from hand and win long games on Blood Artist, Altar and Angel engines that do not attack into a Minefield.
- **The tables of record, again** (`analysis/runs/rr18_s59b.json`, `matches18_s59b.md`; `OPEN_MEANS` and `data/convocation/open-matches.json` updated; the field's seat draw reads the matches column):

| list | matches | game one | | list | matches | game one |
|---|---|---|---|---|---|---|
| the Rabble | 69.4 | 63 | | the Muster | 47.0 | 48 |
| the Hearth | 61.4 | 54 | | the Warband | 46.6 | 47 |
| the Coin | 59.6 | 55 | | the Levy | 45.4 | 49 |
| the Pall | 59.3 | 65 | | **the Tollgate** | **44.9** | **47** |
| Countersnake | 56.5 | 58 | | the Wurmspeaker | 42.3 | 44 |
| the Writ | 56.3 | 52 | | the Sweep | 42.1 | 47 |
| Reaper Control | 55.6 | 54 | | the Tally | 39.1 | 43 |
| the Depths | 52.6 | 48 | | the Enchantress | 38.1 | 40 |
| the Kiln | 47.7 | 46 | | the Locks | 35.9 | 37 |

  - Reaper Control fell from 60 to 56: the Tollgate beats it about four games in five (the Minefield against small Snakes).
  - The Pall is 59 in this sample (55 in the last); the two are inside each other's intervals.
- **Concern:** the Tollgate is polar by construction (90 against the Tally, under 10 against the Coin and the Hearth). A field with several of it or several Mardu lists will feel very different seat to seat.

## After the session — Reaper Clio replaces Reaper Control; book 121; the tables again (Chris, 2026-10-11) — NOT PUSHED
- **Reaper Clio is in the Open in Reaper Control's place** (Chris's ruling); Reaper Control is archived (54 in game one, 55.6 in matches at its last measure; its guide left with it). His sixty and fifteen from the full Convocation of seed 858052 (10–0 in the Constructed Swiss, a semi-final lost to the Rabble). Midrange pilot. No guide: the rules sideboard it.
- **It is the best list in the field by a distance, and Chris brought it in knowing so** — "a new pillar/top target; figuring out how to take it down will be a fun deckbuilding challenge." **75.1 in matches, 70 in game one. Over ADR-171's 65 line: for the planner.** Its worst pairings in matches: the Coin 50, the Tollgate 54; the Rabble 78.
  - Clio carries it (−7.4 in game one without her). A second Reeve, which Chris wants, measured neutral in the pilot's hands (+0.6 for a Reaper; −1.1 for Time Walk). Elvish Visionary for Wall of Blossoms +2.1 ± 1.5. The list is as he registered it.
- **Book 121 — two-on-one blocks** (Chris: the AI "turns down the opportunity to trade two 1/1 tokens for a 2/2 with abilities"). The pilot had no pair block outside menace; an attacker no single blocker would take is now offered a pair, priced as the menace pair is, taken at a margin of 0.5, never against first strike. Our blocks and the attack sim's model of theirs. `off: ["gangblock"]`.
  - Off, on fourteen lists (1,700 games each): the Wurmspeaker −1.7 ± 0.8, the Coin −0.8 ± 0.6, the rest within ±0.5. **Ladder mirror gate PASS.**
  - In Chris's 162 recorded games the exact case (two idle blockers that kill an attacker neither takes alone, at a profit) arose in one combat of 516. The gap was real; it was rare.
- **The tables of record, again** (`analysis/runs/rr18_s59c.json`, `matches18_s59c.md`; `OPEN_MEANS` and `open-matches.json` updated):

| list | matches | game one | | list | matches | game one |
|---|---|---|---|---|---|---|
| **Reaper Clio** | **75.1** | **70** | | the Warband | 45.6 | 47 |
| the Rabble | 68.9 | 62 | | the Muster | 45.4 | 47 |
| the Hearth | 60.6 | 53 | | the Levy | 44.6 | 49 |
| the Coin | 60.4 | 54 | | the Sweep | 42.9 | 47 |
| the Pall | 57.9 | 65 | | the Tollgate | 41.6 | 44 |
| the Writ | 55.4 | 52 | | the Wurmspeaker | 40.5 | 41 |
| Countersnake | 55.2 | 55 | | the Tally | 38.9 | 43 |
| the Depths | 50.0 | 48 | | the Enchantress | 36.1 | 39 |
| the Kiln | 46.2 | 45 | | the Locks | 34.8 | 36 |

- **Concerns:**
  1. **Two lists are now over 65 in matches** (Reaper Clio 75, the Rabble 69). The cap holds each to a tenth of a field; the seat draw leans to both.
  2. **Reaper Clio loses 3.4 points after sideboarding**, and against the Rabble the rules take three Walls of Blossoms out for Putrefys — the same flaw as before. A guide from Chris's swaps is the next thing to measure.
  3. **The pilot may underplay the Reeve** (two activated abilities, one of them a reanimation from either graveyard): Chris's read of the card and the pilot's number disagree.

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
