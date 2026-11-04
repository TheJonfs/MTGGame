# The consequence probe (S71 Part 1, ADR-191) — 2026-11-03

`pnpm play-diff <recorded games> --event <seed> --consequences --playouts 4` over Chris's five runs: every decision where his line and the pilot's (master, his sixty, his view) differ, kept when a trigger, a sacrifice, a token or a death fired within two turns of the actual game; both lines played out by the pilot, four games a side, libraries reshuffled. Per subject: `consequences-<run>.md` (tables, the largest gaps), `.json` (the rows).

| run (event) | games | decisions with a choice | differences | the human's line less the pilot's, all | in lost games |
|---|---|---|---|---|---|
| WB Basilisk (Peasant, 345700) | 14 | 864 | 239 | +2 ± 4 | 26: +4 ± 14 |
| Temur Control (Temur, 507677) | 18 | 2,268 | 576 | +1 ± 3 | 50: −1 ± 10 |
| Sour Worms (Bant, 221140) | 18 | 1,716 | 330 | +1 ± 4 | 15: +2 ± 18 |
| BW Massacrats (Abzan, 19887) | 18 | 2,231 | 570 | +2 ± 3 | 20: +8 ± 15 |
| the Pinnacle's run (Open, 149745) | 19 | 1,464 | 404 | +1 ± 3 | 39: −2 ± 11 |

## By shape (the human's line less the pilot's, played out; the predictor's gap is its own line less the human's, median)

| what fired | WB Basilisk | Temur Control | Sour Worms | BW Massacrats | the Pinnacle |
|---|---|---|---|---|---|
| a death | 174: +2 ± 5 (1.8) | 519: +1 ± 3 (1.6) | 241: +1 ± 4 (1.0) | 373: +2 ± 4 (2.5) | 337: +1 ± 4 (2.9) |
| death payoff | 103: +1 ± 7 (2.9) | — | 8: +6 ± 25 | 390: +2 ± 4 (2.5) | 15: +0 ± 18 |
| enters trigger | 188: +1 ± 5 (1.9) | 293: +1 ± 4 (1.3) | 208: +0 ± 5 (1.0) | 337: +2 ± 4 (3.9) | 208: +1 ± 5 (2.0) |
| token | 14: +5 ± 19 | 159: +1 ± 5 (4.1) | 192: +2 ± 5 (1.5) | 330: +2 ± 4 (2.1) | 110: +3 ± 7 (2.2) |
| sacrifice | — | 11: +0 ± 21 | — | 38: +1 ± 11 (2.0) | 20: −2 ± 15 |
| another trigger | 10: +0 ± 22 | 156: +1 ± 6 (2.6) | 115: +2 ± 6 (1.5) | 339: +2 ± 4 (2.0) | 222: +2 ± 5 (2.5) |

## What it says
1. **No shape ranks.** Every cell is within its noise; no shape of consequence puts Chris's line ahead of the pilot's by more than the others. The planner's expected order (death payoffs, sacrifice outlets, tokens, a spell's chain, the Collar's host) has no support at the level of one decision played out.
2. **The predictor's gaps are ordinary.** Its median preference for its own line is 1–4 points in every shape (it chose its line by that score, so it is positive by construction). The means are pulled up by lethal reads — its +1,000 term: a Massacre, a Blaze or the Ruby Tyrant that kills, where Chris played another line and won anyway (played out 0.00). Those are not blind spots.
3. **The window filter is wide.** In these decks something fires within two turns of nearly every decision, so the consequence rows are most of the differences, and the shapes overlap (a Massacre is a death, a payoff, a trigger).
4. **Where the records come from, then, is not one decision the pilot misprices.** Chris's differing choices are each worth about +1 to +2 points in the pilot's hands, twenty to thirty of them a game; that, his deck choices and sideboarding, mulligans, and the field's AI playing him rather than itself are the candidates the probe does not separate.
5. **Limits:** four playouts a side (±3 to ±25); the pilot plays both lines on (a human line that needs a human's follow-up reads as level); the window reads the seat's view, so an opponent's hidden effects are only seen as their results.

## For the planner
Part 2 was to follow the probe's ranking. With none, building the five rules by the brief's order would be building on an expectation the probe did not confirm. The choice of what Part 2 does is the planner's; candidates: (a) build the rules anyway and measure each on its lists (the brief's fallback); (b) a probe of a different grain — whole turns, or the next turn's plan, against Chris's; (c) the opponents' side — how the field's AI plays against Chris's lists, compared with how it plays against the pilot's.
