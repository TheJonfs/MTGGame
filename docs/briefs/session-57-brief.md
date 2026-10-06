# Session 57 brief — the revision round

*Planner → Implementer. 2026-10-07. Follows the running handoff.md (after S56). The lists are revised against the round-robin of record (pilot 108) with `open:rr --swap`, paired by seed, 1,500 games a trial; a swap is adopted when it gains two points clear of its error against the field *and* does not lose the matchups the list is for. The planner's trials are below; the implementer may add its own and says which. Process rules unchanged: appends to `docs/decision-updates/s57.md`.*

## Part 0 — Rulings and ADR appends
- **S56 Deviations 1–9 ratified**: the counter rule as built (book 108; the brief's clauses closed as measured small); book 109 closed (dig harder measured worse in every form); rules 5–8 with the two beyond the brief; the thresholds; the archive in the contributed file; rule 3 kept.
- **ADR-166 — Protocol enters at tier 2** (R-105), with the wording settled: the control condition reads the power the creature would have if we did not control it. An addition, not a replacement; the shrink is the dial.
- **ADR-167 — Probe before rule.** An AI rule for a list or a matchup is designed from a probe of what the pilot does and measured on the matchups it is for before it ships. Books 107 and 109 and the brief's counter clauses are the record.
- **The revision's bar**: +2 points clear of error against the field; the list's defining matchups not lost; its identity kept (a swap that turns a list into another list is a new list, not a revision).

## Part 1 — Mana first (the cheapest swaps; Concerns 1–2)
- **The Locks**: 4 Scrubland → 4 Watery Grave; 2 Plains + 2 Swamp → 4 Island (blue sources 14 → 22 of 24; white 10 through Tundra, Fountain). Read with `counter-probe --detail`: the "colours not on the battlefield" line.
- **The Pall**: Barren Moor → Swamp; 2 Tendrils of Corruption → 2 lands (20 → 22); read with `combo-probe --report`: the "could not be paid for" count and the loop's turn. Then, if the turn moves: a Ritual kept for the start when lands pay the setup (a plan `fuel` option, measured).
- **The Kiln**: 2 Mountain → 2 Island.
- **The Undertow**: 1 Forest → 1 Island (its {U}{U} costs).

## Part 2 — The planner's swap trials, list by list (each row one trial; adopt by the bar)
- **The Locks** (36): −2 Tidewall −2 Ponder → **+4 Control Magic** (measured +11.0 ± 2.2 in S56's Protocol grid — the single largest number in the round); −4 Absorb → +4 Essence Scatter (the WUU cost is the colour wall); −4 Absorb → +2 Essence Scatter +2 Protocol; −1 Wrath → +1 Protocol.
- **The Undertow** (35; the bar 38): −3 Boomerang → **+3 Control Magic** (measured +8.9 ± 1.8); −3 Boomerang → +3 Protocol (+3.9 ± 1.7); −4 Cathartic Adept → +2 Wall of Air +2 Control Magic; −2 Essence Scatter → +2 Clio (if under four). If no combination reaches 38: archive (ADR-165).
- **The Tally** (38): −2 Abrade → +2 Flametongue Kavu; −2 Arc Mage → +2 Flametongue Kavu; −2 Blaze → +2 Control Magic (the Kiln's lesson; the Tally keeps its burn identity at two); −3 Ponder → +3 Thought Scour (the Kiln kept Scour).
- **The Ford** (45): −2 Savage Twister → +2 Flametongue Kavu; −2 Wood Elves → +2 Lightning Bolt; −2 Restoration Angel → +2 Rage Cobra (the Cobra at {1}{R} 2/2 is red's best common now, and the Ford's own lifegain never feeds it — only the opponent's); −1 Sacred Helix → +1 Powerstone Minefield.
- **The Enchantress** (47): −2 Timberland Guide → **+2 Vitalist** (Spirit Link on a hexproof host feeds her counters onto that host); −2 Glare of Subdual → +2 Pacifism; −1 Giant Growth → +1 Angelic Destiny (four); −2 The Emerald Keeper → +2 Vitalist.
- **The Muster** (47): −2 Fencing Ace −2 Suntail Hawk → **+4 Shocking Sharpshooter** (a token deck pings per body; red's best common in white's best shell); −2 Sacred Helix → +2 Flametongue Kavu; −1 Glorious Anthem → +1 Swords.
- **The Wurmspeaker** (50): −2 Treetop Snarespinner → +2 Rampaging Baloths (four); −2 Prey Upon → +2 Flametongue? no (mono-G) — +2 Wood Elves (six).
- **The Warband** (52): −1 Restoration Angel → +1 Lumen (three); −2 Boggart Brute → +2 Flametongue Kavu.
- **The Depths, the Sweep, the Hearth, the Coin, the Levy, the Kiln, the Pall**: no planner trials (contributed or at the top); the Sweep gets a **registered fifteen** authored by Chris (Concern 5).

## Part 3 — The Larder's plan (ADR-165; the vocabulary's test)
```
piece:   Artisan of Kozilek | Angel of the Ruins   (reanimated once — not a loop)
setup:   Buried Alive → the graveyard: Artisan, Angel, Pelakka Wurm; Entomb → the Artisan; the Angel's plainscycling
start:   Zombify | Graceful Restoration on the piece; the Artisan's own cast trigger
dig:     Thought Scour, Demonic Tutor
fuel:    Dark Ritual, Black Lotus, the Moxen
answers: a counter on the start; exile the piece from the graveyard; a bounce for the Artisan after it lands
```
If `piece` cannot say "once" the plan needs a field (`goal: "loop" | "once"`); the implementer adds it and says so. `combo-probe --list larder`: the armed-turn lines first (Concern 2 predicts a mana wall: Zombify at four in four colours), then the win rate against the field (29 today). The Larder's mana trials: 1 Evolving Wilds → 1 Underground Sea; 2 Barren Moor → 2 Swamp.

## Part 4 — A better out-rule (Concern 4; measured with `--sideboarded-one`)
The out-rule takes "the lowest-rated card"; what moved a matchup seventeen points was *which* card left. Design from the matchup: cards that are dead against this list leave first — removal against a list with fewer than eight creatures, walls against a list that doesn't attack, graveyard exile against a list without a graveyard, counterspells against a plan that names them *not* (rule 3's reverse) — then the lowest-rated. Measure: the mean gain from sideboarding (+3.4 today) and the Sweep's (−4.4).

## Part 5 — Measure
Every adopted swap into the lists (`open-contributed.json` for the contributed; the planner's document and `open-lists.ts` for the seeds — the planner's document is updated by the planner from the handoff); `open:gen`; the round-robin of record re-run once at the end (sixteen lists, the same pilot) as the new table and the retire count's next measure; `convocation-sim --events 4` once.

## Handoff
Each trial's number; the adopted swaps per list; the Larder's plan and its probe; the out-rule's gain; the new round-robin; deviations, concerns — and Chris's hand reads when they come (the tuned Kiln; the Pall against a boarding field).
