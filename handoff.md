# Handoff — after Session 56 (2026-10-06)

## State of the world
Session 56 was the pilot before the lists: three AI changes proposed, each measured before shipping. Two shipped, in altered form; one was measured and not taken.

- **The counter rule** (book 108) ships, but it is not the rule the brief designed. The probe showed the pilot was not declining to counter; it was losing its counters to the colour of its untapped lands and to tapping out. The Locks gain 3.8 points, the Undertow 2.1.
- **Four more sideboarding shapes** ship (sweepers, creature counters, a steal, blockers). Their measured gain is small (+3.0 → +3.4 points from sideboarding). One fix found on the way is large: the Kiln against the Pall goes from 42% to 59%.
- **"Dig harder" was measured and not taken.** It cost the Pall three to seven points. The measurement found where the Pall's turns actually go: mana.
- **The archive exists and the Loop is in it** (ADR-164). The Open's field is sixteen lists.
- **The strength table is now one measurement**: sixteen lists, one pilot, 12,000 games.

`pnpm typecheck`, `pnpm test` (968) and the ladder gate pass. **Nothing from this session is pushed.** After the session proper Chris added a card, Protocol: its own section below.

## For the planner — the decisions waiting
1. **Three places where I built something other than the brief's design** (Deviations 1–3). Each has its numbers; each needs a ruling.
2. **The Pall's speed is a mana question, not a pilot question** (Concern 2). That changes what S57 should try for it, and what the Larder's plan will need.
3. **The Locks lose about one counter a game to their own mana base** (Concern 1). That belongs to the overhaul ADR-165 already scheduled.
4. **The Undertow is at 35** against ADR-165's bar of 38.
5. **The swap trials for S57** are listed under "Suggested next".

## Done this session

### Part 0 — rulings (`docs/decision-updates/s56.md`)
- ADR-163, ADR-164 and ADR-165 filed, with the ratifications and the sequence.
- The hate cards stay in campaign shops: no change needed.

### Part 1 — the counter rule (book 108)
- **A new probe, `pnpm counter-probe`**, written first. Per game it counts counters drawn and cast, and sorts every window (an opposing spell on the stack, a counter in hand) into: cast, passed with the mana, or no mana — and what the mana was lost to.
- **What it found** (the Locks, the old pilot, 320 games):

| a game | |
|---|---|
| counters drawn | 5.2 |
| counters cast | 3.1 |
| windows | 7.2 |
| — cast | 3.0 |
| — passed with the mana (spells of mean mana value 1.2) | 0.7 |
| — no mana: too few lands yet | 0.9 |
| — no mana: the colours are not on the battlefield at all | about 1.0 |
| — no mana: spent on its own turn, or a counter already cast | about 1.6 |

- **What was built:**
  - With a counter held, the pilot pays for a cast by hand, tapping the lands the counter does not need (`agents/reserve.ts`).
  - A play that leaves the counter payable keeps the hold bonus (before, only passing did).
  - A control deck weighs the hold three times as much on its own turn.
- **Measured, each game paired with its old-pilot twin** (1,500 games a list):

| list | old | new | difference | counters cast a game |
|---|---|---|---|---|
| the Locks | 33.0% | 36.8% | **+3.8 ± 2.0** | 3.35 → 3.63 |
| the Undertow | 32.8% | 34.9% | **+2.1 ± 1.4** | 0.92 → 0.97 |
| the Depths | 54.2% | 55.9% | +1.7 ± 1.7 | 1.39 → 1.49 |
| the Kiln | 55.1% | 55.0% | −0.1 ± 0.6 | 0.71 → 0.72 |
| the Tally | 37.7% | 37.7% | +0.1 ± 0.7 | 0.36 → 0.35 |

- **Ladder mirror gate PASS.**

### Part 2 — broader sideboarding
- **Rules 5–8** in `world/sideboard-ai.ts`: sweepers against a wide board; creature counters against a creature deck (Essence Scatter in for a general counter, never the reverse); Control Magic against prizes; blockers against fliers or an aggressive list.
- **The field's fifteen** reserves slots for them.
- **A new tool, `pnpm sideboard:show`**: what a list's AI brings in and takes out against each other list. Reading its output found three faults:
  - Rule 3 brought graveyard exile in as "the best playable left" (a Tormod's Crypt for a Counterspell against the Coin). Fixed.
  - A shape could take out the Lotus. Fixed: a card that only makes mana never leaves.
  - "Flying blockers" included a nine-mana Angel. Fixed: four mana or less.
- **Measured** (`open:rr --sideboarded-one`: each list's sideboarded sixty against the others' registered sixties, 450 games a list, paired with the plain run):

| | mean gain from sideboarding |
|---|---|
| the S55 rules | +3.0 points |
| with rules 5–8 | **+3.4 points** |
| each shape alone | sweepers +0.2 · creature counters +0.3 · a steal +0.7 · blockers 0.0 |

- **The brief's check, the Kiln against the Pall** (300 games): 35% as registered → 42% under the S55 rule → **59%** once the walls leave first. A person's plan measured 60%.

### Part 3 — dig harder: measured, not taken
- The brief's rule and three narrower versions, 600 games each on the same seeds:

| the dig rule | the Pall's win rate | the loop fires |
|---|---|---|
| S55's, as shipped | **68%** | 54% |
| the brief's | 61% | 49% |
| three narrower versions | 64–67% | 52–54% |

- The dig rule is as S55 left it. The measurement is recorded in the code beside it.
- **The Witch at four against one, re-measured** (900 paired games): **+2.3 ± 1.9** (S55: +0.9 ± 1.9).
- **The loop's turn is still 6** (median). Concern 2 says why.

### Part 4 — the archive and the round-robin of record
- The archive is a map in `open-contributed.json`; `open:gen` writes the flag and exports `OPEN_FIELD`; the builder, the round-robin and the probes respect it. A test pins it.
- **The Loop is archived.** It stays in the data and in the authored-lists table.
- **The round-robin of record** (sixteen lists, pilot 108, registered sixties, 12,000 games, `analysis/runs/rr16_s56.json`):

| | | | |
|---|---|---|---|
| pall 71 | levy 62 | hearth 62 | coin 58 |
| sweep 56 | depths 56 | kiln 55 | warband 52 |
| wurmspeaker 50 | muster 47 | enchantress 47 | ford 45 |
| tally 38 | locks 36 | undertow 35 | larder 29 |

- `OPEN_MEANS` is this table.
- **The retire count:** the bottom three are again the Larder, the Undertow and the Locks.

### Part 5 — measured
- **`convocation-sim --events 8`:** a seat's list against its finish r = **−0.55** (S55: −0.50). The Umbel's eight hold lists averaging 60.1; the field 49.1. "Top" seats reach the Umbel 9.6% of the time, "low" seats 0.7%. No rematch.

## After the session — Protocol (Chris, 2026-10-06)

Chris delivered a new custom card with its art and printed face:

> **Protocol** — {U}{U} Enchantment — Aura. Enchant creature. Enchanted creature gets −2/−0. As long as enchanted creature's power is 0 or less, you control enchanted creature.

- **In the pool** (246 → 247), **tier 2**. Chris allowed tier 2 or 3; it measures below the tier-3 Control Magic in every slot tried.
- **One new word (R-105):** a control static conditional on the enchanted creature's power (`{ref: "attachedPower"}`, and `atMost` on a static condition).
- **Fuzz first:** 768 full-tier games beside anthems, pump Auras, Control Magic, Lumen, bounce and Aura removal. No exception; replays byte-exact. Then 7 fixtures.
- **The AI** prices it as a steal on a creature the shrink brings to 0 and as a partial shrink otherwise (book 110). It casts it 0.4–1.1 times a game.
- **`open:rr --swap` now takes a variant** (`protocol~cost={1}{U}~shrink=3`), so a card's parameters can be tested in a real list.

**The sensitivity grid.** Four costs × three shrink sizes, in five slots of four lists, each cell 1,500 games paired by seed with the round-robin of record (93,000 games; the full tables are in `results/s56/protocol-grid.md`, untracked). The change in the list's win rate, averaged over the five slots:

| cost | −1/−0 | −2/−0 | −3/−0 |
|---|---|---|---|
| {U} | -1.7 | +2.5 | +5.0 |
| {U}{U} | -3.5 | +0.2 | +2.3 |
| {1}{U} | -2.4 | +1.9 | +4.2 |
| {1}{U}{U} | -3.8 | -1.0 | +1.1 |

The card as printed ({U}{U}, −2/−0), slot by slot:

| slot | Protocol as printed | Control Magic in the same slot |
|---|---|---|
| the Kiln: in place of its 4 Control Magic | −6.2 ± 2.0 | (the baseline) |
| the Depths: in place of its 2 Control Magic | −3.4 ± 1.6 | (the baseline) |
| the Kiln: in place of 4 Tidewall, beside Control Magic | +4.5 ± 1.9 | not run |
| the Locks: in place of 2 Tidewall + 2 Ponder | +2.2 ± 2.1 | +11.0 ± 2.2 |
| the Undertow: in place of 3 Boomerang | +3.9 ± 1.7 | +8.9 ± 1.8 |

What the grid says:
- **As printed it is a fair card: an addition, not a replacement.** It improves a list when it takes a weak slot and costs the list when it replaces Control Magic.
- **The shrink is the strong dial.** Each point of it is worth about 2 to 4 points of win rate. At −1/−0 the card is a liability; at −3/−0 it approaches Control Magic at half the cost.
- **The second blue pip matters more than the mana.** {1}{U} measures about 1.5 points better than {U}{U} at the same mana value, and nearly as well as {U}. This is Concern 1 again (these lists are short of blue).
- **Nothing in the grid is broken.** The strongest cell tried ({U}, −3/−0) is +5.0 on average and still below Control Magic where both were run.

Two things for Chris and the planner:
- **A rules choice I made (R-105).** The card's condition is a control effect that reads the creature's power, and a creature's power can depend on who controls it. The engine reads the power the creature would have *without* this Aura's control. So an opponent's Glorious Anthem keeps their 2/2 safe (3 − 2 = 1), and our own Anthem does not hand a taken 2/2 back. Under the printed rules the second case has no stable answer; the engine picks the stable one.
- **The printed face shows a stray "2/2"** in the power/toughness box. It is wired as delivered; a corrected render is wanted.

## Deviations from the brief
1. **The counter rule is not the brief's design.** The brief's two clauses (spend held mana at the opponent's end step; cast when the spell's worth exceeds the counter's held value) address what the probe found to be the small parts: the end-step case arises 0.2–0.4 times a game with nothing worth casting, and the pilot already passes only on cheap spells. I built the three things the probe pointed to instead. *The planner should rule on whether the brief's clauses are still wanted.*
2. **"Dig harder" is not shipped.** It measured three to seven points worse in every form tried. *The planner should rule on whether book 109 is closed.*
3. **Two sideboarding rules beyond the brief:** rule 6 does not run against a plan that counterspells answer; against such a plan, graveyard exile takes the walls out first. The second is what made the brief's own check pass.
4. **The thresholds the brief left open are mine:** eight fliers; twelve creatures of mana value two or less for "an aggressive list"; four mana for a blocker; two cards a shape.
5. **A sweeper also needs the opponent's small creatures to be twice our own.** Without it the Muster swept its own board.
6. **The archive lives in the contributed-lists file**, not on the list's own entry: the Loop is a seed list built in code and has no entry of its own there.
7. **An archived list still builds when asked for by key**, so an older save with a Loop seat keeps working.
8. **The Loop stays in the authored-lists table.** The card rating's record and the tinker's "shares a list" rule still read it. No rating rebuild was run.
9. **Rule 3 (counterspells leave against creature decks) was tested off and kept.** I expected it to be wrong for Constructed; it measured right (the Locks' gain from sideboarding fell from +7.6 to +1.6 without it).

## Concerns
1. **Mana bases are costing the control lists their counters.** About one window a game for the Locks is lost because the colours are not on the battlefield at all: Absorb is WUU and Undermine UUB, and ten of the list's twenty-four lands make no blue. The Kiln loses about half a window a game the same way (Counterspell with an Island and a Mountain). No pilot rule reaches this. It is list work for S57.
2. **The Pall is slow because of mana, not because of its pilot's choices.** With the setup resolved and a start in hand, the pilot spent 544 own turns (in 600 games) unable to pay for the start and none declining to. Zombify is four mana and the Usher five in three colours; the list has twenty lands, four of them entering tapped. A person reaches turn 2–3 by sequencing Rituals and Moxes that the AI also holds, so some pilot gain may remain (for instance keeping a Ritual for the start when lands will pay for the setup), but it has not been measured.
3. **Three AI rules this session and last read right and measured wrong** (book 107, the brief's counter clauses, dig harder). Measuring first is now cheap enough to be the rule, as the brief says. The probes are what make it cheap: writing the probe before the rule changed the design of Part 1 completely.
4. **The four sideboarding shapes buy little.** +0.4 points on average, inside the noise. What moved a matchup was the choice of what leaves (the walls against the Pall: +17 points). The rules still take out "the lowest-rated card", which is often the wrong card. A better out-rule is where the next gain is.
5. **The Sweep loses by sideboarding** (−4.4 ± 4.1, and −3.6 under the S55 rules). Its built fifteen and the lowest-rated-out rule do not suit it. It may want a registered fifteen of its own, as the Pall and the Kiln have.
6. **The Witch's number is still weak evidence.** +2.3 ± 1.9 is the pilot's use of her. In games where she stands the loop fires no more often than in games where she does not (50% against 58%).
7. **The plan vocabulary still has one customer** (carried). The Larder's plan in S57 is the test. Concern 2 suggests the Larder will meet the same mana wall.
8. **The take-back's availability leaks a little** (carried from S54).
9. **The rating's feedback loop** (carried). The pilot is now book 108, so every rating run is stale again.

## Registry entries added/changed
- **R-105** — a control static conditional on the enchanted creature's power (Protocol).
- **Pool registry:** `protocol` (Session 56 section; 246 → 247).

## Test status
`pnpm test`: 107 files passed, 1 skipped; **968 tests passed, 2 skipped** (the standing two). `pnpm typecheck` passes. `pnpm build:web` not run (nothing pushed).

New this session:
- Book 108 in `agents/book-of-shame.test.ts` (the payment solver, the hand-tapped cast through `chooseAction`, the kept hold, the control multiple, the old pilot).
- `world/sideboard-s56.test.ts` (5): the shapes read from card data; the fifteen's slots; each shape against the list it is for and not otherwise, across every pairing; the walls leaving first; Limited unchanged.
- The archive test in `world/constructed-builder.test.ts`.
- `sim/s56-fuzz.test.ts` (2), `sim/s56-cards.test.ts` (7) and book 110 for Protocol; three pins moved for the new card (the pool count, the shop-tier tally, the generated reference).
- **Ladder mirror gate PASS** (pilot 108). Book 110 was added after it: it changes only how an Aura with a conditional steal is priced, and no ladder deck holds one.
- About 210,000 sim games this session raised no engine error. The hand-tapped payment is a new action path for the AI and ran through all of them.

**Not verified:** Protocol in a browser (its art, its face, a steal and a release seen on the board); the AI's hand-tapping seen in a browser (the AI now taps lands one at a time before some casts; the log will show it); the two S55 cards in a browser; the Pall played by a person against a boarding field; the tuned Kiln played by a person.

## Suggested next
**The swap trials cheapest to run in S57.** Each is one `open:rr --only <list> --swap …` row beside the round-robin of record: 1,500 games, a minute or two, paired by seed.
- **The Locks' mana** (Concern 1): non-blue lands for blue ones (Scrubland → Watery Grave; a Plains and a Swamp → Islands); Absorb or Undermine → Essence Scatter or a second removal suite. Read with `counter-probe --detail`: the "colours are not on the battlefield" line is the target.
- **The Pall's mana** (Concern 2): Barren Moor → Swamp; a Tendrils or two → lands. Read with `combo-probe --report`: the "could not be paid for" count and the loop's turn.
- **The Kiln's blue** (Concern 1): a Mountain or two → Islands.
- **The Undertow's overhaul** (ADR-165): the bar is 38 and it stands at 35.
- **The Tally, the Ford, the Enchantress, the Muster**: single-card swaps, as the Kiln's were.

Beyond the swaps:
- **The Larder's plan** (ADR-165). Run `combo-probe --list larder` from the first draft: the armed-turn lines will show whether it is mana-bound as the Pall is.
- **A better out-rule for sideboarding** (Concern 4), measured with `open:rr --sideboarded-one`.
- **A registered fifteen for the Sweep** (Concern 5).
- **Chris plays the tuned Kiln, and the Pall against a field that boards** (carried).

## How to run
```
pnpm viewer                                                    # /convocation; /play for a single match
pnpm typecheck && pnpm test
pnpm open:gen                                                  # the lists, their plans and the archive from open-contributed.json
pnpm counter-probe --lists locks,kiln,undertow --games 20 [--detail] [--off counter]   # what a pilot does with its counters
pnpm sideboard:show --list kiln [--vs pall,levy] [--shapes none]                        # what the AI brings in and takes out
pnpm combo-probe --games 40 --shard i/5 --out analysis/runs/x_$i.json ; pnpm combo-probe --report analysis/runs/x_*.json
pnpm open:rr --games 100 --seed 56 --shard i/10 --out analysis/runs/rr_$i.json          # then --merge; the field only (--with-archived for the Loop)
pnpm open:rr --games 100 --seed 56 --only locks --off counter --off-for locks --out x.json   # the old pilot's twin of the same games
pnpm open:rr --games 60 --seed 56 --sideboarded-one [--shapes none|sweepers,steal] --out x.json   # one seat sideboards a game; pair with a plain run
pnpm open:rr --games 100 --seed 56 --only kiln [--vs levy,pall] [--swap "kiln:mountain:2:island"] --out x.json   # a swap trial
pnpm open:rr --games 100 --seed 56 --only locks --swap "locks:ponder:2:protocol~cost={1}{U}~shrink=3" --out x.json   # a card variant in a real list
pnpm convocation-sim --events 8 --seed 56 --shard i/8 --out analysis/runs/convocation56_shard$i.json   # then --report
pnpm ladder                                                    # the gate for any AI change (run alone; about twelve minutes)
```
