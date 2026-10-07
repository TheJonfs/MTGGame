# Handoff — after Session 57 (2026-10-07)

## State of the world
Session 57 was the revision round. Six lists were revised by measured swaps, the Larder got its plan, and the Open has a new strength table.

- **Six lists changed**, each by a swap that gained at least two points clear of its error: the Locks, the Undertow, the Tally, the Muster, the Ford and the Warband.
- **Nothing in Part 1 (mana) was adopted.** The planner's mana fix for the Locks measured as a loss.
- **The Larder is a combo list now**, piloted by a plan. It needed two new plan fields. It gains about three points and is still last.
- **The better out-rule for sideboarding was built, measured and left off.** It bought nothing; one part of it cost a point.
- **The new table is tighter:** thirteen of sixteen lists sit between 45 and 58.

`pnpm typecheck` and `pnpm test` (971) pass. `pnpm build:web` passes. **Everything here is pushed.** After the session proper Chris revised the Undertow again, archived the Larder and added a mono-red list: its own section below, with the table of record as it now stands.

## For the planner — the decisions waiting
1. **The Undertow and ADR-165's bar: settled after the session.** Chris revised it again; it stands at 41 (the section below).
2. **Four near-misses under a strict reading of the bar** (Deviation 1). If the bar is meant more loosely, these are the next to take: the Tally's Control Magics, the Enchantress's fourth Pacifism, the Pall's Swamps, the Locks' two Islands.
3. **Flametongue Kavu is now in five lists** (Concern 1).
4. **The Locks now lose seven points by sideboarding** (Concern 3).
5. **The planner's document** needs the six revisions folded in; they live in code for now (`sim/open-lists.ts OPEN_REVISIONS_S57`).
6. **Still owed by Chris:** the Sweep's registered fifteen; a hand read of the tuned Kiln; the Pall against a boarding field.
7. **The Cinder is 8–0 in Chris's hands and last in the AI's** (40%). That gap is the next pilot question (the section below has the first probe).
8. **The Undertow's title** ("Simic Mill (U G)") no longer describes it.

## Done this session

### Part 0 — rulings (`docs/decision-updates/s57.md`)
- ADR-166 and ADR-167 filed, with the ratifications and the bar.
- **Ten of the brief's trials named cards the lists no longer hold or would pass the copy cap** (the brief was written against the planner's document; the lists were amended in S46 and on 2026-10-01). The decision file has a table of each and what was run instead.

### Part 1 — mana first: nothing adopted

| trial | change against the field |
|---|---|
| the Locks: the full change (22 blue sources) | −2.0 ± 2.3 |
| the Pall: Barren Moor → Swamp | +2.1 ± 1.3 |
| the Pall: Tendrils → lands | +1.1 ± 1.6 |
| the Kiln: 2 Mountain → 2 Island | +2.4 ± 1.1, then +0.4 ± 1.2 on a second seed |
| the Undertow: Forest → Island | −0.9 ± 1.5 |

- **The Locks:** more blue cost them their white (−15 against the Muster).
- **The Pall:** the loop's turn did not move (median 6), so the fuel option was measured anyway and changed nothing (68% → 68%; the Larder 33% → 33%). `fuelKeptForStart` exists as a plan field and is on no plan.

### Part 2 — the swap trials
Forty-odd trials, 1,500 games each, paired by seed. Adopted:

| list | swap | gain at the trial | old table → new |
|---|---|---|---|
| the Locks | −2 Tidewall −2 Ponder → +4 Control Magic | +11.0 ± 2.2 | 36 → 45 |
| the Undertow | −3 Boomerang → +3 Control Magic | +8.9 ± 1.8 | 35 → 36 |
| the Tally | −2 Arc Mage −2 Abrade → +4 Flametongue Kavu | +13.0 ± 2.0 | 38 → 46 |
| the Muster | −2 Vitalist −2 Suntail Hawk → +4 Flametongue Kavu | +10.0 ± 1.9 | 47 → 53 |
| the Ford | −2 Savage Twister → +2 Flametongue Kavu; −2 Restoration Angel → +2 Rage Cobra | +5.1 ± 1.8 | 45 → 46 |
| the Warband | −2 Boggart Brute → +2 Flametongue Kavu; −1 Restoration Angel → +1 Lumen | +3.9 ± 1.5 | 52 → 52 |

- Not adopted for any list: the Enchantress, the Wurmspeaker, the Kiln, the Pall.
- Every trial's number is in the decision file, list by list.
- The planner's headline trials that failed: the Muster's four Sharpshooters (+1.6 ± 1.6), the Enchantress's Vitalists (−1.8 and −2.6), the Locks' Essence Scatters for Absorb (−3.8).

### Part 3 — the Larder's plan
- **Two new plan fields:** `goal: "once"` and `pieces`. One piece in the graveyard is set up; a start beside it is the plan assembled. A `loop` plan is untouched (the Pall plays as before).
- A seed list's plan lives in `open-contributed.json` under `plans`.

| the Larder against the field (600 games) | old pilot | with its plan |
|---|---|---|
| win rate | 28% | 33% |
| a piece lands | 58% of games | 64% |
| on its own turn (median) | 6 | 5 |
| fuel spent on nothing | 131 times | 9 |
| armed turns unable to pay for the start | 380 | 535 |

- In the round-robin, paired with the old pilot: +3.4 ± 2.2. It stands at 31 in the new table.

### Part 4 — a better out-rule: built, measured, left off

| what leaves | mean gain from sideboarding (the revised sixteen) |
|---|---|
| the lowest-rated card (as shipped) | +2.06 |
| dead cards first | +2.08 |
| four-ofs kept | +1.01 |
| all parts, with a ninth rule for dead cards | +1.08 |

- The parts stay in `sideboard-ai.ts` behind `outRule`, off.
- The Sweep's loss from sideboarding is unchanged (−3.1 ± 4.2).

### Part 5 — the new table
Sixteen lists, pilot 110, registered sixties, 12,000 games (`analysis/runs/rr16_s57.json`). In brackets, the change from S56's table.

| | | | |
|---|---|---|---|
| pall 69 (−2) | levy 58 (−4) | hearth 58 (−4) | coin 56 (−2) |
| kiln 54 (−1) | muster 53 (+6) | warband 52 (0) | sweep 52 (−4) |
| depths 52 (−4) | wurmspeaker 47 (−3) | tally 46 (+8) | ford 46 (+1) |
| locks 45 (+9) | enchantress 45 (−2) | undertow 36 (+1) | larder 31 (+2) |

- `OPEN_MEANS` is this table.
- **The retire count:** the bottom three are the Larder (30.8), the Undertow (36.1) and the Locks (44.5). The Locks are under a point from three other lists.
- **`convocation-sim --events 4`:** a seat's list against its finish r = −0.53; the Umbel's eight hold lists averaging 56.9, the field 49.6; two rematches in four events.

## After the session — the Undertow again, the Larder archived, the Cinder (Chris, 2026-10-07)

**The Undertow, revised a second time** (Chris: the "and friends" part needs help, and help against graveyard decks). Trials against the S57 table, 1,500 games each:

| trial | change |
|---|---|
| +4 Faerie Macabre main (for the Man-o'-Wars and the Temporal Springs) | 0.0 ± 2.2 (the Pall +17, the Larder +15, the Wurmspeaker −18) |
| +2 Gravitational Shift (for Essence Scatters, or for Crabs) | −0.8 ± 1.4, −1.3 ± 1.7 |
| −3 Zinnia +3 Vampire Nighthawk, 2 Forest → 2 Swamp (the implementer's) | +5.8 ± 1.9 |
| **the Nighthawks, and 2 Macabres for the Temporal Springs — ADOPTED** | **+6.0 ± 2.3** (no matchup lost; the Pall +13) |
| the Nighthawks and all four Macabres | +5.1 ± 2.5 |
| the Nighthawks, four Macabres, two Shifts | +4.7 ± 2.6 |

- The list no longer holds green, or Zinnia, its namesake. Its title still reads "Simic Mill (U G)": the planner's to rename.
- Not tested: four Crypts in its sideboard. A seed list cannot carry a registered fifteen yet.

**The Larder is archived** (Chris; ADR-165's exit). What was tried first, against its 30.8:

| trial | change |
|---|---|
| 6 mana creatures (for the Reeves, Baru, the Gaean Wurm, Duress) | −1.6 ± 1.7 |
| the same with the blue lands out | −0.4 ± 1.8 |
| 8 mana creatures | +0.4 ± 2.0 |
| 4 Mind Stone | +0.6 ± 1.4 |
| Rampant Growth and Birds | −2.2 ± 1.8 |
| the Wurmspeaker with black, 4 Zombify, 4 Buried Alive (or Entomb), 2 Artisan | −7.0 ± 2.5, −5.2 ± 2.5 (against the Wurmspeaker's 46.8) |

- When a piece lands on its turn 3 or earlier it wins 82%; turn 4, 59%; turn 5, 51%; nothing lands in 36% of games.
- Acceleration bolted on does not buy that speed (9 of its 23 lands make green), and the rebuilt deck is worse than mono-green.
- Its plan stays in the data as the second customer of the plan vocabulary. Book 111 still pins it.

**The Cinder** (Chris's 8–0 mono-red list, `docs/debug_logs/convocation-8-0-red.json`; a working name) is the sixth contributed list, with its fifteen.
- **In the AI's hands it is last: 40%.** Best: the Tally 57, the Locks 57, the Enchantress 55. Worst: the Levy 25, the Coin 29, the Ford 29, the Hearth 30.
- **A first probe** (300 games): it empties its hand (1.1 cards left when it loses) and loses with the opponent at 11 life (median). It sends 2.4 burn spells a game at the face and 1.35 at creatures, and declares 4.2 attackers a game. So it is not holding burn back; it runs out of cards short of twenty damage. No rule has been written for it (ADR-167: this is the probe).

**The table of record, again** (sixteen lists: the Larder out, the Cinder in; pilot 111; 12,000 games; `analysis/runs/rr16_s57b.json`):

pall 67 · hearth 58 · levy 57 · coin 56 · muster 53 · kiln 53 · sweep 52 · warband 51 · ford 50 · depths 48 · wurmspeaker 47 · enchantress 42 · undertow 41 · tally 41 · locks 41 · cinder 40.

- The pairings' seeds moved with the list order, so single cells are not comparable with the S57 table; the means are, to about a point and a half.
- The Undertow is at 41, over ADR-165's bar of 38.
- The bottom three are the Cinder, and the Locks, the Tally and the Undertow level at 41.

## Deviations from the brief
1. **The bar is read strictly:** the gain less its 95% error is at least two points. Four trials fall just short and are not adopted: the Tally's −2 Blaze +2 Control Magic (+3.2 ± 1.5, and +3.1 ± 1.5 stacked), the Enchantress's fourth Pacifism (+1.9 ± 0.7 pooled over two seeds), the Pall's Swamps (+2.1 ± 1.3), the Locks' two Islands on top of the Control Magics (+1.6 ± 1.4). *The planner should say whether the strict reading is the one meant.*
2. **The Undertow is not archived.** By the trial it reached 43.8; in the new table it is 36. The brief's rule ("if no combination reaches 38: archive") does not say which measure. *The planner's to rule.*
3. **Two adopted swaps are pairs where neither half clears the bar alone** (the Ford's, the Warband's). Each half is a planner's trial; the pair clears.
4. **Ten trials were substituted or not run** because the list had changed since the planner's document (the table is in the decision file). Three adopted swaps come from substitutes or additions of mine: the Muster's Kavus (the brief's Helix slot is two Vitalists today; two more for two Hawks), and the stacking of the Tally's two Kavu trials.
5. **The Larder's plan differs from the brief's sketch in four places:** no Thought Scour to dig with (cut in S46); the Angel's plainscycling is not a setup in the plan (the older rule still cycles her); the Artisan's own cast is not a start; there is no "bounce" answer field.
6. **`fuelKeptForStart` was measured although the Pall's turn did not move** (the brief made it conditional). It was cheap, and the answer is now known.
7. **"Four-ofs kept" and a ninth rule were my additions to Part 4.** Both measured no better.
8. **Part 4's "graveyard exile against a list without a graveyard" and "counterspells against a plan that names them not" are not built.** No list mains graveyard exile, and every plan names counterspells.
9. **The revisions are in code, not in the planner's document** (`OPEN_REVISIONS_S57`, applied after the S46 amendments).

## Concerns
1. **Flametongue Kavu is carrying the revision.** It is now in five lists (the Kiln 3, the Tally 4, the Muster 4, the Ford 2, the Warband 2), and it was the best or second-best trial in every red list. The AI pilots it well (a body with removal attached needs no judgment). The lists are converging on it. If that is not wanted, the lever is the card or a cap, not more trials.
2. **Control Magic is the same story in blue** (the Kiln 4, the Locks 4, the Undertow 3, the Depths 2). Between them the two cards are in all six adopted revisions.
3. **The Locks lose 6.9 ± 5.3 points by sideboarding** since the revision. Their built fifteen brings removal in for their counterspells. Keeping the counters in was worse (−14.1: then the win conditions leave). The field's builder does not suit a control list; the Locks may want a registered fifteen, as the Sweep does.
4. **The mana diagnosis from S56 did not survive measurement.** The probe was right that the Locks lose counters to colour, but fixing the colour cost more elsewhere than it gained. A probe says where turns go; it does not say what a fix is worth.
5. **A trial's gain against the old field overstates its place in the new one.** The Undertow gained 8.9 at the trial and 1 in the table, because six of its fifteen opponents changed too. The bar should probably be read on the final table for a list near a threshold.
6. **The Larder's problem is not its pilot.** With the plan a piece lands in 64% of games and it wins 33%. It arms early and then waits for four mana in four colours; when the body lands it is often answered. This is a list question (and the same wall as the Pall's).
7. **The plan vocabulary held for a second customer, with two fields added.** `once` and `pieces` were enough. A third shape (a plan that wins without the graveyard) has not been tried.
8. **Sideboarding by rule has stopped paying.** The mean gain is +2.1; no out-rule moved it. The remaining gains are list-specific (a registered fifteen), not rule-shaped.
9. **The rating's feedback loop** (carried). The pilot is now book 111 and six lists have changed, so every rating run is stale.

## Registry entries added/changed
None. No rule of the game and no card changed this session.

## Test status
`pnpm test`: 107 files passed, 1 skipped; **971 tests passed, 2 skipped** (the standing two). `pnpm typecheck` passes. `pnpm build:web` passes.

New this session:
- Book 111 (the Larder's plan: `once`, the setup wanted and refused, the start's target, the opponent's Crypt, `fuelKeptForStart` on no plan).
- The out-rule's test in `world/sideboard-s56.test.ts` (its parts work, and are off).
- Two S56 sideboarding pins moved with the lists (the Locks main their Control Magics; the Larder has a plan).
- **No ladder run.** The agent changes are confined to decks with a plan (`plan-play.ts`), and no ladder deck has one. For the Pall's `loop` plan they change nothing: its 560 probe games against the fourteen lists other than the Larder are identical to S56's, game for game.
- About 150,000 sim games this session raised no engine error.

**Not verified:** anything in a browser this session (no UI change). Carried: Protocol on the board; the AI's hand-tapping; the tuned Kiln and the Pall in a person's hands.

## Suggested next
- **Rule on the four near-misses and the Undertow** (the decisions above).
- **Registered fifteens** for the Sweep and the Locks: the two lists that lose by sideboarding.
- **The Larder as a list:** its mana (four colours for a four-mana start) and what protects the body once it lands. `combo-probe --list larder` reads both.
- **The Enchantress and the Wurmspeaker** took nothing from the planner's trials. They need different ideas, not more of the same.
- **Decide what to do about the Kavu** (Concern 1) before another revision round, or the next round will find it again.
- **Chris's hand reads** when they come.

## How to run
```
pnpm viewer                                                    # /convocation; /play for a single match
pnpm typecheck && pnpm test
pnpm open:gen                                                  # the lists (with the S57 revisions), the plans and the archive
pnpm open:rr --games 100 --seed 56 --only tally --swap "tally:blaze:2:control_magic" --out x.json   # a swap trial; pair with the same list's plain run
pnpm open:rr --games 100 --seed 56 --shard i/10 --out analysis/runs/rr_$i.json          # the round-robin; then --merge
pnpm open:rr --games 60 --seed 56 --sideboarded-one [--out-rule none|dead,four,rule9] --out x.json   # sideboarding, one seat at a time
pnpm combo-probe --list larder --games 40 --shard i/5 [--no-plan] --out analysis/runs/x_$i.json ; pnpm combo-probe --report analysis/runs/x_*.json
pnpm counter-probe --lists locks --games 20 --detail
pnpm sideboard:show --list locks [--vs muster,coin]
pnpm convocation-sim --events 4 --seed 57 --shard i/4 --out analysis/runs/convocation57_shard$i.json   # then --report
pnpm ladder                                                    # the gate for any AI change outside plan-play (run alone)
```
