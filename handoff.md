# Handoff — after Session 52 (2026-10-05)

## State of the world
**The Convocation has a Constructed event.** `/convocation` now offers the Open beside the Draft and the two Sealed events: sixteen seats, five rounds, the Umbel; the field's fifteen decks built by select-and-repair from the authored lists; the player's deck built in the editor over every card the Open allows, taken from "Suggest a deck", or brought as a saved deck from the journey and checked by the format. The builder passes its tests in seven formats (the Open, Pauper, the five gates). The rating pipeline has a test. The drafter's pack-reading term was built as ruled, measured in seven variants, never beat the rule without it, and **ships switched off**. S46–S52 are committed locally and **not pushed**. `pnpm typecheck`, `pnpm test` (877) and `pnpm build:web` pass.

## Done this session
- **Part 0**: rulings filed (`docs/decision-updates/s52.md`). **ADR-151** — the rating's arithmetic is now a pure function (`world/rating-compute.ts`) with a fixture test: two runs whose decks share names keep their records apart; the bug's own shape pinned for the record (the same games pooled give +0.3 and −0.3 where the truth is zero); a lift recomputed by hand; the pinned output. The live table rebuilds byte-identical through it. The lord, guardian and petal sims re-run on pilot 92.
- **Part 1 — the builder** (`world/constructed-builder.ts`): select (legal share, ties by measured strength, the top five, a seeded pick), repair (cut what the rule forbids; fill role for role inside the list's colours; the floors), noise (two or three same-role swaps within 0.5 of rating; a land ±1), check. `pnpm constructed:report`. Seven formats in `CONSTRUCTED_FORMATS`; a new rule field `maxTier` for Pauper.
- **Part 2 — the Constructed event**: `newConstructedEvent`, `suggestedConstructedDeck`; the controller's legal-pool collection, the saved decks (read from the journey's save, never written), the door's fourth option. **Walked in the browser**: a saved journey deck loaded (refused at 30 cards with the format's one line; padded to sixty and registered — round one posted); a second event with a suggested deck, game one won, a reload resuming between games, the round finished to the standings (the field's seven series: 1.5 s with sims running alongside). No console errors.
- **Part 3 — the drafter reads what is passed**: `colourSignals` (perfect memory of every pack; flow and cut), a term in `pickValue`, a tuning hook for the sim. Measured; off. Below.
- **Part 4 — measured**: the Open's field in a round-robin; the campaign's three sims.

## The builder, by format (40 seeded builds each, from the 112 authored lists)

| format | legal | started from | mean cut | mean added | distinct decks |
|---|---|---|---|---|---|
| The Open | 40/40 | coin 10 · wurmspeaker 10 · warband 8 · levy 6 · muster 6 | 0.0 | 0.0 | 40 |
| Pauper | 40/40 | beast:rats 11 · beast:ogre 11 · beast:lion 7 · beast:recluse 6 · mage:oriel 5 | 1.1 | 29.9 | 38 |
| Bodies (24 creatures) | 40/40 | the Open's five | 2.7 | 2.7 | 40 |
| Nothing Small (power ≥ 2) | 40/40 | guardian:drana 10 · road:chrisRoadB 10 · flood:dredger 8 · open:tally 6 · corolla:faldor 6 | 0.0 | 19.5 | 40 |
| Nothing Sudden (no instants) | 40/40 | flood:ovna 10 · open:enchantress 10 · beast:wurm 8 · open:wurmspeaker 6 · beast:warband 6 | 0.0 | 15.5 | 40 |
| Half Ground (half lands) | 40/40 | the Open's five | 7.5 | 7.5 | 40 |
| Nothing Dear (mana value ≤ 4) | 40/40 | open:tally 10 · open:muster 10 · open:enchantress 8 · open:levy 6 · open:undertow 6 | 0.0 | 0.0 | 40 |

Every build is a legal sixty. A thirty-card starter and the campaign's forties repair to sixty in their own colours with their own share of lands (tested).

## The Open's field of fifteen in a round-robin (seed 52; 2,100 games)

| list | seats | mean win rate | range within the list |
|---|---|---|---|
| open:levy | 6 | 55% | 50–60% |
| open:wurmspeaker | 4 | 53% | 51–55% |
| open:warband | 3 | 44% | 41–47% |
| open:coin | 1 | 44% | — |
| open:muster | 1 | 34% | — |

- **The archetypes spread unevenly by chance** — five lists at equal weight, fifteen draws: six Levies, one Coin.
- **The variation within an archetype is real**: the six Levy seats span ten points on three or four cards each.
- **No list is broken by the repair** (the Open cuts nothing). What the noise does badly is swap by rating alone: a Pyroclasm into a weenie deck, a Blaze into the Warband, Graceful Restoration into the Levy. The first run also took a Black Lotus out and put an off-colour Mox in; noise now never moves a free card.

## The drafter reads what is passed — three numbers, and what they mean

| | the rule alone | with the term (the best of seven variants) |
|---|---|---|
| drafted decks against six-pack Sealed decks | **46%** | 45% (the others 42–44%) |
| pods with four or more seats on black | 29 of 50 | 30 (29–34 across variants) |
| the pod's spread | 48 points | 50 (50–53) |

The term does not reach 50% and does not thin black's crowd, so its weights are zero. Why it fails, as far as I can see: **the signal follows the rating.** Black's cards rate highest, so black cards are what is "still there" in any pack and black always reads as flowing — the flow term herds seats *toward* black (four-or-more-on-black rose in most variants). Normalising each colour by its own average did not rescue it, and the cut term alone was neutral.

**The builder-on-45 read the brief asked for — it is not the lever either.** A drafted seat ends with 32 playables in its pair (a Sealed seat has 36); no seat of 400 was short of 23; the curve mends cost 0.01 of mean rating. The builder plays what it is given.

**What the 46% actually is: card supply.** A Sealed seat has six packs to itself; a draft seat ends with three packs' worth, contested. Against Sealed decks built from **three** packs — the same number of cards — **the drafted decks win 66%** (mean rating 1.57 against 1.37). The drafter builds a much better deck than an equal pool hands it; it cannot match a pool twice the size. The brief's target compares a three-pack deck with a six-pack one.

## The campaign's baselines on pilot 92 (`results/s52/`, local)
- **`lord-sim`**: every cell within ±2 of S45's (15 cells).
- **`guardian-sim`**: within ±2, except **Drakuseth** +4 at the two lower tiers (59 → 63, 68 → 72).
- **`petal-sim`**: within ±1.

## After the handoff (2026-10-05, Chris's four tweaks)

**1. Thirty-two seats in the five-round events** (the Draft, the big Sealed, the Open) — no rematch in five Swiss rounds, the Umbel from thirty-two. A Draft is **four pods of eight**: the player's pod drafts live, the other three draft headless when the event begins. Names come from a builder (`world/convocation-names.ts`): the planner's sixteen first, then given × family names in the same register (926 available). In the browser: the event is made in 0.2 s, a round's fifteen other series take 1.2–1.4 s, the save is 82 KB.

**2. The Open's field draws on all twelve lists**, and the noise has a noise: a seat is *stock* (a quarter — the list as written), a *light* tinkerer (half — one or two swaps and a land) or a *heavy* one (a quarter — four to six swaps and a land). A 31-seat round-robin (5,580 games): eleven of the twelve lists appeared; against its own list's mean a stock seat is +0.8 points, a light one −0.1, a heavy one −0.6 (small samples, the expected direction).

**3. Learning from the variations — `pnpm tinker --list open:warband`.** The list as written plays the other eleven Open lists (20 games each); then 24 variants, each ONE same-role swap, play the same gauntlet on the same seeds; a swap's delta carries a paired standard error. Run on the Warband, the Levy and the Larder:
- **A single swap is below the noise at this size.** With 220 games a swap the standard error is about 2.5 points, and a one-card change in sixty moves a list by one or two. Of 71 swaps, one cleared |z| ≥ 2 (about three would by chance): Zombify → Pacifism in the Larder, −5.9.
- So there is signal, but not free at 220 games: resolving a two-point swap needs about 1,400 games on it. The cheaper route to the same information is the one the rating already uses — log what was in hand across many varied decks and read the lift; the Constructed field's tinkered seats are exactly that sample. I have not wired Constructed games into the rating.
- Each run is saved (`analysis/runs/tinker_<list>.json`: every swap, its delta, its error, by opponent).
- **It found an engine bug.** A Larder variant with the Warden crashed against the Undertow: a stack item whose one target spec holds several targets ("tap up to two target creatures") crashed at resolution when its FIRST target had left (bounced in response). Fixed (the spec is now read by the target's flat index — CR 608.2b), with two fixtures (`multi-target-fizzle.test.ts`). The study now reports an engine error per variant instead of dying.

**4. The pod as the unit — `pnpm draft-sim --pods 100 --games 4`** (800 seats, 11,200 games, each seat against its own pod):

| | seats | win rate |
|---|---|---|
| a seat sharing its more crowded colour with 2 / 3 / 4 / 5 / 6+ seats | 13 / 138 / 387 / 207 / 55 | 55 / 53 / 50 / 49 / 48% |
| black seats, with 2 / 3 / 4 / 5 / 6+ black seats in the pod | 22 / 96 / 136 / 80 / 43 | 49 / 45 / 46 / 47 / 47% |
| the seats NOT on black, in those pods | 66 / 160 / 136 / 48 / 13 | 50 / 53 / 54 / 56 / 59% |
| in a pod with four or more on black, a seat whose first three picks included black: **left black** / stayed | 42 / 212 | **53% / 46%** |
| colours settled by pick 3 / picks 4–8 / picks 9–15 / pick 16 or later | 329 / 296 / 78 / 97 | 51 / 50 / 46 / 50% |
| the only seat on its pair / shares its pair | 431 / 369 | 51 / 48% |

- **Black loses wherever it sits** (45–49%), crowded or not; the seats that avoid it win more the more crowded it gets (up to 59%).
- **Leaving black is worth about seven points** in a crowded pod, and the pick rule almost never does it (42 seats of 254).
- **A late change of colours costs** (46% for seats settling at picks 9–15): the pivot worth making is the early one.
- A deck's mean rating explains more than its crowding (r = 0.32 against −0.10), and crowding lowers the rating (r = −0.18) — the mechanism is fewer good cards each.
- The read for the pick rule: the fault is not that seats fail to *read* the table but that the rating tells every seat black is best while black's decks are the pod's worst. A correction to black's rating would do what the pack-reading term could not.

### Chris's Draft and Open playtest (2026-10-05) — "it was great"; his first match losses (one in the Swiss, one in the quarter-final)

- **Three Essence Scatters at one creature spell** — the AI saw its own first counter on the stack and countered the same spell again, twice. **Book 94**: a counter is aimed only at a stack item that is still going to resolve; an item is answered when a live counter of the other side targets it, read down the stack from the top — so when the opponent counters our counter, the spell is live again and either is a target.
- **A Bonesplitter passed back and forth** — book 86's rule was only a lower score ("unchanged", a quarter-point under passing), and under the softmax a quarter-point is still picked about one window in ten. **Book 93**: an equip the predictor calls unchanged is refused outright. A 200-game probe: equipment moves 154 → 16, all of them off a creature that cannot attack onto one that can.
- **The life buffs are suppressed** (Chris: wait until a full tournament has been played). `convocationEntrance` and `convocationBracketEntrance` are flat at every difficulty; the wiring and its tests stay; ADR-148's rows are kept as `CONVOCATION_ENTRANCE_ADR148`.
- Ladder mirror gate PASS after books 93–94.

### Black's rating — a colour term, measured and not adopted

- `rating:build --colour` (in `rating-compute.ts`, with a test): a colour's rate is the mean (result − ½) of its mono-coloured cards' Sealed sightings, added as ½ × rate/σP; gold cards take the mean of their colours. Built from fresh Sealed runs on pilot 94 (40,000 games): **W +3.3 · U +2.8 · B +0.1 · G +0.6 · R −3.3 points** — in Sealed, black is level.
- The term moves each card about ±0.26, and the builder's pair choice is a threshold, so it swings decks hard: **red in Sealed decks 27% → 2%**, white 45% → 65%, black 56% → 54%; the median deck's win rate is flat (51% → 50%).
- The draft A/B (100 pods): black's seats 47% → 44% of seats, and black still wins 47%; red falls to 23% of seats; the crowding of the most-drafted colour gets worse (six or more seats: 49 → 105). Drafted decks win 65% against three-pack Sealed either way.
- The read: black's problem is not its cards' rating (in Sealed it is level) but the crowd in a pod. The candidates `card-rating-v12base.json` / `card-rating-v12.json` and their reports are left uncommitted in `data/convocation/`; `card-rating.json` is still v1.1. Chris: the candidates deleted; try the crowding penalty.

### The crowding penalty — built, measured, shipped off

- **The signal must be read at the wheel.** Counting what a pack is missing on its first pass (against a fresh pack's colour shares) correlates with the upstream seats' colours at r = 0.02 — a pack's own mix swamps the few picks taken from it. The same pack seen again eight picks later lost exactly what the other seven took: r = 0.41 against how many of them end on a colour (black 0.46). `colourCrowding` reads every wheel by count, never by rating.
- **Two levers**, `crowdWeight` (a crowded colour's cards are worth less) and `crowdRanks` (a crowded colour's picks count for less when the seat picks its two colours); 100 paired pods each:

| | rule alone | w2 | w4 | r2 | r4 | w2r2 | w4r4 |
|---|---|---|---|---|---|---|---|
| seats on black | 47% | 47% | 47% | 47% | 47% | 47% | 47% |
| black seats win | 46% | 46% | 46% | 46% | 46% | 46% | 46% |
| pods with 6+ on black | 7 | 6 | 6 | 6 | 3 | 4 | 4 |
| settled by pick 8 | 78% | 78% | 76% | 73% | 66% | 73% | 66% |
| drafted vs three-pack Sealed | 65% | 65% | 65% | 65% | 65% | 65% | 65% |

- The ranks lever thins the worst pods and delays commitment; nothing moves black's share or its win rate. **The finding that matters: black's seats win 45–49% at every crowding level, two black seats in the pod included.** Black's draft decks lose whether or not they are crowded, while black's Sealed decks are level — the crowding read of the pod analysis was the arithmetic of a big losing group (the others win more as it grows), and "left black wins 54%" is a selection effect. Weights zero; the code and two tests stay (`--terms crowdWeight=…,crowdRanks=…`).

### Three-pack Sealed and the per-card test (Chris: dive in before the next session)

- **Three-pack Sealed** (`sealed-sim --packs 3`, seed 48, against the six-pack run on the same pilot): black's share of decks 56% → 39%, its win rate 50% → 48% — the depth effect is real but small, and drafted black (46%) is below it. Drafters land on black at 47% where the builder, shown the same number of cards, chooses it at 39%. (Three-pack decks are short of playables: 134 of 200 fill with basics, so read the shares as direction.)
- **`pnpm draft-cards`** — 300 pods, 33,600 games, each game's sightings recorded; per card: mean pick, deck rate, the decks' result, its lift in draft games beside its lift in Sealed (`analysis/runs/draft_cards.md`).
- **No black card is oversold to the drafter as a pick.** Black's cards lift their draft decks as they lift Sealed decks (mean +0.8 against +0.7); the early-and-weak list is empty.
- **Black's decks carry dead filler.** Nonland slots per deck in a colour whose draft lift is below −1 point: W 0.4 · U 0.5 · R 0.8 · G 1.1 · **B 2.3**. The cards: Entomb (in the deck at 64% of picks, cast when drawn 21%, lift −3.1), Waste Not (−3.7), Buried Alive (cast 8%), Duress, Reassembling Skeleton, Dark Ritual, Unearth/Zombify (about zero). Black decks holding each win 4–7 points less than black decks without (confounded — a thin deck is the one that plays them — but every one points the same way).
- **Why the builder plays them: the tier prior.** Entomb rates 1.28 — above Typhoid Rats (1.14) and Gravedigger (1.08) — because its tier-2 prior (1.5) outweighs evidence worth −0.2: the signal moves a card about a quarter-point per standard deviation, and Constructed presence (one reanimator list) is part of it. Black holds seven tier-2 Constructed-package cards (Entomb, Buried Alive, Zombify, Unearth, Waste Not, Dark Ritual, Duress).
- Entomb's swing, chased: under v1.0 no Sealed deck played it (0 sightings in sealed50); v1.1's +1.2 came from 81 sightings in the noise run (± about 5 points). v1.1 then lifted it into decks, and 6,700 sightings now read −3.4. Thin evidence fed back into the next rating — the case for weighing evidence by its amount.

### Limited and Constructed rated apart (Chris: "both 1 and 2") — the v2 candidate, not adopted

- **One table, two scores.** Each row keeps `rating` (now the Constructed score) and gains `limited`. `limitedView(table)` hands the Limited score to every Limited path: the Limited builder, the drafter, Sealed and draft events (`event.ts`), the AI's sideboarding in a Limited event, the player's Limited "suggest a deck", and the Limited sims. The Constructed builder, the Open and the tinker read `rating`. A table without `limited` (v1.1) reads exactly as before.
- **Constructed** = the v1.1 formula on the authored lists only, re-run on pilot 94 (`authored94`, 13,440 games: 112 lists × 40 opponents × 6 games — fewer games than S47's run; not A/B'd against the Open yet).
- **Limited** = `computeLimitedRating`: empirical Bayes on Limited games only (sealed53, noise53, draftcards — 73,600 games, pilot 94). Each tier's prior is its cards' measured mean lift (1: +0.7 · 2: +0.9 · 3: +1.9 · R: +1.5 points); τ = 1.6 points; a card moves from its tier's mean by τ²/(τ² + se²) of its own lift; scaled to mean 1.8 and spread 0.8 over the pack cards. Tested (two cases).
- **Why the tier is only the shrink target**, measured out of sample (posterior from the two Sealed runs, scored on 2,400 drafted decks): a deck's mean tier prior predicts its win rate at r = −0.06; v1.1 0.34; prior plus evidence at one tier per τ 0.55; the posterior alone 0.59.
- **The A/B on fresh seeds** (draft seed 54, 200 pods; Sealed seed 49, 200 pools):

| | v1.1 | v2 |
|---|---|---|
| draft: seats on black / black seats win | 47% / 46% | 34% / 52% |
| draft: colours' seat win rates | 46–54% | 47–52% |
| draft: dead-filler slots a deck (lift under −1 pt) | 2.6 (black 1.9) | 1.0 (black 0.15) |
| Sealed: colours' share of decks | W 46 · U 28 · B 63 · R 26 · G 38 | W 34 · U 67 · B 29 · R 30 · G 41 |
| Sealed: colours' decks win | 47–54% | 49–51% |
| Sealed: deck rating against win rate, r | 0.44 | 0.61 |
| **head to head: v2's decks against v1.1's** | | **draft 52.1% ± 0.5 · Sealed 53.8% ± 0.8** |

- Concerns: blue is now in 67% of Sealed decks (two in three) and games end by decking 17% of the time (7% before) — the builder's pull to blue control is a variety question; red is still last (its v2 decks 48.5–50% head to head). The same-seat comparisons (the same packs or pool read both ways) are 49.8% and 50.5% — inside their larger error (800 and 200 meetings), but not the clear edge the whole-field figure shows.
- Tools: `pnpm rating:build <authored shards> --limited a,b,c --candidate <name>`; `pnpm rating-ab --draft A B` / `--sealed a.json b.json` / `--report` (the head to head). The candidate `card-rating-v2.json` and its report sit uncommitted in `data/convocation/`.
- **Adopted, the Limited half (Chris, 2026-10-05)** — `card-rating.json` is v1.3: every row keeps v1.1's `rating` (the Constructed score, unchanged) and carries v2's `limited` fields; `run.limited` records the runs. The Constructed half waits on its own check (a larger authored run, then the Open).

## Deviations from the brief
1. **The pack-reading term ships switched off.** Built to the ruling (the whole pack remembered, each time); it lowered the field's quality in every variant tried, and the process rule says such a change reverts. The code and the tuning hook remain. *Rule on*: whether to keep trying it, and against which measure (Deviation 2).
2. **The 50% target is measured against six-pack Sealed decks**, which a three-pack draft deck should not be expected to beat; against three-pack Sealed decks the drafter is at 66%. I report both and changed neither the target nor the entrance.
3. **The draft event does not store the AI seats' pack memory** — with the term off there is nothing to read it. If the term returns, `event.draft` grows a `seen` list per seat (about 40 KB a draft).
4. **Bodies asks 24 creatures**; the gate formats are "the Open plus the gate" (its pool and restricted list). The formats doc leaves both open.
5. **No sideboarding in a Constructed event** this session, for the player or the field.
6. **Noise never moves a free card** — not in the brief; added after the first round-robin.
7. **"Suggest a deck" for the human is the same select-and-repair** as the field's, on the human seat's own seed — so the suggestion is one of the five strongest lists with a few swaps.
8. **A saved deck is offered whatever its legality**, with "(not legal here)" beside it; it loads into the editor, where the legality panel says why. Registration still refuses an illegal deck.

## Concerns
1. **The Open's field is five lists.** Select takes the top five by measured strength, and in the Open every list is fully legal, so the field is always the Levy, the Wurmspeaker, the Warband, the Coin and the Muster — never the Loop, the Ford, the Enchantress, the Tally, the Locks, the Undertow or the Larder. That is the brief's rule working as written; it makes the Open a five-deck format for the AI. A wider candidate set (ten), or a weight by strength rather than a cut-off, would show the player the format's range.
2. **The noise swaps by rating, not by role in the deck.** "Same role" is land / creature / spell; a sweeper and a token-maker are both spells. Within one list the seats span ten points. A finer role (removal, pump, card advantage, mana) would need a small table of effect shapes — the sideboarding rules already classify three of them.
3. **Black is over-rated, and that is now the draft's main fault.** Black seats win 46% in drafts and four seats crowd into it in most pods; reading the table cannot fix a rating that tells every seat black is best. A per-colour correction to the rating (so each colour's mean rating matches its measured deck win rate) is a small, testable change and the likeliest way to spread the seats.
4. **The Open's first turn is Vintage's.** The entrance is the Sealed table's life rows; I did not measure whether a few points of life mean anything against a deck with a Lotus. The brief flags this; it wants its own rows after someone plays it.
5. **The player's editor shows 234 cards** in the Open — the whole pool, with the filters the editor already has. It works; it is a lot to scroll. A "start from a list" picker (the twelve Open lists as starting points) would serve a player better than an empty deck.
6. **A saved journey deck is almost never legal in the Open** (thirty or forty cards against sixty). The path works and will matter once the campaign linkage exists; today "bring a saved deck" mostly reports "not legal here".
7. **ADR-150's watch**: no new noise run this session, so Entomb, Waste Not and the Adept were not re-observed.

## Registry entries added/changed
- No R-numbers (no rules mechanics). Pool registry unchanged. Knobs unchanged.
- `DeckRule.maxTier` (new field, validated and described).

## Test status
`pnpm test`: 91 files passed, 1 skipped; **877 tests passed, 2 skipped** (the standing two). New: `rating-compute.test.ts` (4), `constructed-builder.test.ts` (4), the Constructed event headless and the two pack-reading tests in `event.test.ts`, the Open through the controller in `convocation-controller.test.ts`. No AI heuristic changed (the pack-reading term is the drafter's and is off), so no ladder run. No fuzz — no new card. About 58,000 sim games raised no engine error.

Not verified: a full Open event played to the Umbel in the browser (one round was walked); the six other Constructed formats as events (the builder's tests only); the production build in a browser.

## Suggested next
**S53 — the full ladder.** Estimate: **one to two sessions.** The pieces exist separately (a draft, Limited rounds, Constructed rounds, a bracket); what is new is an event with **stages** — today `ConvocationEvent` has one `formatId`, one pool and one deck. It needs: a stage list (format, rounds), the player's deck and pool per stage, the standings carried across stages, a second draft mid-event, the bracket in a chosen format, the entrance table indexed across stages, and prizes by finish. The save grows accordingly; I would version it (`convocation-event-v2`) and refuse a v1 save rather than migrate one.

Before it, cheaply: the per-colour rating correction (Concern 3) and a wider Open field (Concern 1) — both change what the ladder's field looks like.

## How to run
```
pnpm viewer                                   # /convocation — "The Open (Constructed)" on the door
pnpm constructed:report                       # the builder, by format
pnpm constructed:rr --format open --seed 52   # the field of fifteen in a round-robin
pnpm draft-sim --pods 50 --vs-sealed                     # the rule as shipped (the term off), against six-pack Sealed
pnpm draft-sim --pods 50 --vs-sealed --sealed-packs 3    # like for like
pnpm draft-sim --pods 50 --vs-sealed --terms signalFlow=0.06,signalCut=0.08   # the pack-reading term on
npx vitest run packages/world/src/rating-compute.test.ts packages/world/src/constructed-builder.test.ts
pnpm typecheck && pnpm test
```
