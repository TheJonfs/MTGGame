# Session 42a brief — the Cinquefont

*Planner → Implementer. 2026-09-21. Follows the running handoff.md (after S41). The first half of S42; the mage inversion is S42b. Process rules unchanged: appends to `docs/decision-updates/s42a.md`; fuzz before fixtures; every AI change carries a ladder delta or reverts; re-verify the one real card by curl.*

## Part 0 — Rulings and ADR appends
- **S41 Deviations 1–9 ratified.**
- **ADR-131 — The flood's capstone is not the Manafleur.** The Manafleur stilled the plane's source; cut, it let the source rise. The capstone is that source, seen: **the Cinquefont**. The Manafleur's identity is kept whole for the unification act (the player's eventual copy). The Chronicle's line at the fount's fall is the first line of phase three's premise.
- **ADR-132 — The tide.** The fount's laws accumulate one a turn in the order **U G W B R** (the Risen Tide, the Season, the Intake, the Tithe, the Toll); when five stand at its end step, all are exiled and the sequence begins again. The full tide stands for one turn cycle. Controlling or blinking the fount turns the tide.
- **ADR-133 — The deep water's prize is Time Walk** (⚠ verify: {1}{U} Sorcery — Take an extra turn after this one. Alpha). prizeOnly, one copy, the flood's only Power. The Manafleur copy waits for phase three.
- **The lords' rows** (S41 Concern 1): measure {30, 34} × {no basics, three basics of the triad} in `flood-sim`; the planner expects **30 + three basics** as Standard and 34 + three as Hard; ratify from the table.
- **Odile's shell**: −1 Curiosity, −1 Air Elemental → +2 Wall of Air (twelve creatures kept); `--only odile`.
- **The Reaper's shell**: −2 Skirk Prospector, −1 Hordeling Outburst → +1 Llanowar Elves, +1 Rampant Growth, +1 Wood Elves; `--only reaper`. If he still does not harvest, he is a beatdown lord and that stands.
- **The Observatory's gate takes no size cap** — a fifty-basic deck is a worse deck and is losing to it.
- **The phase-two column**: tier 2 → **16 / 1** (one basic fewer); tier 3 stays 20 / 3; re-run `mage-sweep --part 11 --phase 2`.
- **Region names**: the flood gets its own five (Part 5); "The Emberford" region no longer collides with the seat.

## Part 1 — The Cinquefont
> **The Cinquefont** — {W}{B}{R}{U}{G} Legendary Creature — Elemental, 7/7
> At the beginning of your end step, if there are five or more laws on the battlefield, exile all laws. Then create the next law in the tide's order.

- prizeOnly (it is the fount's own signature; the player's copy comes as the capstone's card, as the Manafleur's did). Three copies in the sixty (the legend rule as the Manafleur's).
- **The deck**: the Manafleur's sixty with the three Manafleurs replaced by three Cinquefonts — the ring's conceit unchanged (every gold, dual and Mox; the five defensive slots stay). The planner will amend if the tide wants different slots after the read.
- **The entrance**: five roots (one basic of each) and the card in hand, as the Heart's — the spring rises from all five colours; a turn-one fount is certain. The accumulating ring (`heartLawsPersist`) is superseded by the tide mode for the fount; the knob stays for phase-one experiments.
- **Words**: a `lawSequence` mode `tide` beside `rotate` and `accumulate`: order U G W B R; at the fount's end step, if laws on the battlefield ≥ 5, exile all, then create the next in order (the order pointer continues — after the fifth, the first). "Laws on the battlefield" counts both sides (a stolen law is still a law; a player who took the Intake with Control Magic sees it wash too). Half a word: the mode and the count-then-wash.
- **Fixtures**: the order; the wash at five and the restart at U; a stolen law counted and washed; a Disenchanted law lowers the count (four stand → no wash, the fifth comes); the fount blinked (Restoration Angel under the player's control) re-enters and the end step trigger is the new object's — the order pointer is the duel's, not the card's (say so in the def); the legend rule; the Season's counter on the fount itself.
- **Art**: the card through the image skill (a fount, five-coloured, rising — subject from the lore lines in Part 5); a battle portrait; the as-printed face to Chris.

## Part 2 — The flow
The Heart's telegraph / fight / victory / Chronicle, re-keyed from the petals to `floodHeartOpen` (the five lords' falls). The centre's knock after the fifth lord speaks `flood.heartOpens`; the telegraph names the fount (Part 5); the fight at `floodHeartLife` (knob, ⚠ 50 / 45 / 55 from ADR-127's read — measured in Part 4); no ante (as the Heart); the victory pays Time Walk and the Cinquefont's card; the Chronicle writes the flood's capstone (`kind: "fount"`, no cutting counted) and the profile's legacy gains a second row: `floodSurvived: true` (one flag; what it unlocks is phase three's). After the capstone the world continues (the courts still stand as prizes; the map is open); the start screen's "Enter the Flood" stays available for new phase-two runs.

## Part 3 — AI
The Manafleur master's policy carries over (the tide changes nothing about how the body plays); the tide's trigger is automatic. Pin: the fount attacks as the flower did; a Control Magic on the fount is countered when a counter is up (the S28 Disenchant/Counterspell rules already do this for the flower). The Cinquefont-aware master stays on the shelf.

## Part 4 — Measure
`heart-sim` gains `--tide` beside `--persist`: the fount at `floodHeartLife` {45, 50, 55} × roots {5} against `chris-road-B`, `salvage-WR+legends`, `salvage-UB+legends`; 100 games a cell. Report as S38: kill rate, T1 fount rate, mean turns, the law count at the player's death (mean; max — five is the full tide), the fount removed and by what. The read: how much harder the tide is than the rotating ring at 40 (S28: 80% vs road-B), and where 55–65% for road-B sits — that ratifies `floodHeartLife`. Also the lords' grid and the two shells (Part 0) and part 11 at the cooled column.

## Part 5 — Text (planner; Chris's pen)
- **The telegraph** (the centre, the lords fallen): *The deep water is not deep any more. It is rising. From the middle of it, where the flower stood, something is coming up that the flower stood on — five colours, and none of them still. The Cinquefont.*
- **The parley**: *It does not speak. The water speaks: one law, then another, then all of them, then none, then one.*
- **The fall** (Chronicle, the capstone): *The fount is stopped. The water falls back to where it was, and it was never still. Something must be planted here.*
- **Time Walk's prize line**: *A moment the tide did not take.*
- **The flood's regions** (five, replacing phase one's on a phase-two map; the seats keep their names): white — **the Chalkwater**; blue — **the Deepreach**; black — **the Blackwash**; red — **the Cinderflats**; green — **the Rushlands**.

## Handoff
The fount as built, the heart-sim table, the lords' grid, the two shells' reads, part 11, the region names in, deviations, concerns, and the implementer's estimate for S42b (the mage inversion: ten lists over the tier-2/3 mages in the still pairs — the planner drafts them against the pool).
