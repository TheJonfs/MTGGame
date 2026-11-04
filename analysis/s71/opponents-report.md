# The opponents' side (S71, Part 1's option 3; Chris) — 2026-11-03

`pnpm pilot-probe --opponents --recorded <run> --event <seed> --archetype <a> --games 8`: for every game of Chris's run, the pilot (master, temperature 0.12) in his seat with his deck as recorded — the sideboarded deck in games two and three — against the opponent's deck **as recorded** (the field's seat: built from its list, sideboarded against him) and against that list's **registered** deck, under the recorded rules and modifiers; eight games each way, the same seeds, the start alternating. Per run: `opponents-<run>.md`.

| run | games | Chris won | the pilot, against the decks as recorded | the pilot, against the registered lists | cards apart, recorded from registered |
|---|---|---|---|---|---|
| WB Basilisk (Peasant) | 14 | 79% | 59% (112) | 39% (112) | 6.1 |
| Temur Control (Temur) | 18 | 89% | 44% (144) | 47% (144) | 3.7 |
| Sour Worms (Bant) | 18 | 89% | 49% (144) | 40% (144) | 3.7 |
| BW Massacrats (Abzan) | 18 | 89% | 49% (144) | 54% (144) | 4.6 |
| the Pinnacle's run (Open) | 19 | 84% | 41% (152) | 38% (152) | 0.8 |
| **all** | 87 | 86% | 48% (696) | 44% (696) | 3.7 |

(± about 8 points a run at 144 games, ± 4 over all.)

## What it says
1. **The field plays Chris no softer than it plays the pilot.** On Normal his opponents are the master AI, with no life or entrance edge (Hard only adds the AI's life); they read his deck as they read the pilot's.
2. **The decks the field seats are close to the registered lists** — 3.7 cards apart on average (0.8 in the Open, whose seats play the registered sixties; 6.1 in Peasant, whose builder tinkers more) — and **about as strong**: the pilot wins 48% against them and 44% against the registered lists. Peasant is the exception (+20 for the recorded decks, 59 to 39): its seats' tinkering costs them, so WB Basilisk's 11–3 had softer opponents than its table.
3. **The gap stays in the seat.** Against the same opponents with the same decks under the same conditions, Chris won 86% and the pilot 48%: 38 points, every run between 20 (WB Basilisk) and 45 (Temur Control).
4. **With the consequence probe**, the two say: no one shape of decision the pilot misprices (Part 1), and no opponents' edge (this) — the gap is the sum of many small decisions (about +1 to +2 points each, twenty to thirty a game), with what neither probe separates: mulligans, sequencing over several turns, the plan for the next turn.

## Limits
Eight games a side per recorded game; the pilot plays the recorded sideboarded decks without the sideboarding decision that made them; the Peasant result rests on 14 games.
