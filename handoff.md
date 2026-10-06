# Handoff — after Session 55 (2026-10-05)

## State of the world
The Open now has a combo deck, the AI can pilot it and play against it, and the pool has two answers to it.

- **The engine draws a game stuck in a loop** (R-103): a hundred stack items resolved in one turn without the position changing.
- **`combo` is a fourth AI archetype** (ADR-161). A list declares it and carries a plan as data; the pilot reads its own plan and every opponent reads it too.
- **The Pall** (Chris's 5–0 list; the planner's placeholder name) is the fourth contributed list, with its plan and its fifteen.
- **Tormod's Crypt and Faerie Macabre** are in the pool (244 → 246). The field's sideboards hold them and a fourth sideboarding rule brings them in.
- **A Constructed seat's list is drawn by strength** (ADR-158 amended).
- From after S54, also unpushed: the take-back, the repeat, Constructed sideboards, the Hearth.

`pnpm typecheck`, `pnpm test` (949) and `pnpm build:web` pass. **Nothing since `85a413e` is pushed** — the post-S54 work and all of S55 are local commits.

## Done this session

### Part 0 — rulings (`docs/decision-updates/s55.md`)
- ADR-159 to ADR-162 and the planner's three calls filed.
- Both cards and both rules verified against their sources. **Faerie Macabre is {1}{B}{B}, a 2/2 Faerie Rogue with flying** (the brief did not trust its memory of the cost or body). Tormod's Crypt is as briefed.

### Part 1 — the mandatory-loop draw (R-103)
- `engine/game.ts checkLoopDraw`. After each stack item resolves, the position is taken: the step, life totals, floating mana, every zone's cards by name, each permanent's state, the stack by source. No object ids, so a card that left and came back is the same card.
- A position already seen this turn is a repeat; a new one clears the count; at the cap (100) the game is a draw.
- **Fuzz first:** 1,440 full-tier games on the Usher lists and a graveyard-heavy list holding the new cards. No exceptions, no hangs, replays byte-exact, no draws in ordinary play.
- **Fixtures (4):** the Usher loop with cancelling drains is a draw at the cap on turn 1; the Usher's own loop and the Altar's loop never trip it; a Skeleton returned a hundred times by hand does not.

### Part 2 — the combo archetype and the plan
- **The plan is data on the list** (`open-contributed.json`): `piece`, `setup`, `start`, `dig`, `fuel`, `answers`. `pnpm open:gen` validates it and writes `agents/plans.generated.ts`.
- **A plan is matched to a decklist by its cards** (a setup card, a start card, two of the piece). So a player's own build of the deck is recognised when the AI plays against it.
- **Books 100–106, each pinned:**
  - **100:** the setup is cast when a start is in hand, on the battlefield or within two draws by the deck's count; it buries three Ushers; a second Usher cast beside the first is the loop, so the S27 "never a second copy of a legend" rule steps aside for a legend that loops.
  - **101:** the start is aimed at the plan's piece; a fair reanimation waits while the plan is live.
  - **102:** dig while the plan is not assembled (the Witch's draw to a floor over the opponent's power; the Tutor fetches the missing half); a fair card waits while a wanted plan card is castable.
  - **103:** fuel is spent only to make a wanted plan card castable, by colour as well as count, on our own main phase.
  - **104:** against a plan, a counterspell is worth the game at the setup or start.
  - **105:** graveyard exile is held for the moment it answers (below).
  - **106:** against a plan, discard is worth most before the turn the plan names.
- **Two older bugs fixed on the way:** the Ritual check read only a dual land's first colour (a Badlands made no red); and Faerie Macabre's discard was being treated as cycling.

### Part 3 — graveyard hate and the fourth rule
- **One new word:** `exileGraveyard { who }`. `exile` now reaches a card in a graveyard. Faerie Macabre needed nothing else (a hand-zone ability with cycling's discard-self cost, an up-to-two target range across both graveyards).
- **Fixtures (5),** including Faerie Macabre exiling the Usher's target in response: the trigger does not resolve and nobody is drained.
- **The fourth sideboarding rule:** against four or more copies of cards that return a creature card to the battlefield or search one into a graveyard, graveyard exile comes in — whatever the deck's colours, since both cards are used for no mana.
- **The field's fifteen** reserves four slots for them (two of each). The deck builder never mains them.
- **How the AI uses them:** the Crypt as soon as the opponent's graveyard holds the plan's piece, or in response to anything aimed at that graveyard; the Macabre only in response, on the card aimed at, with the next piece as its second target. It is not cast as a 2/2 while the opponent's plan stands.

### Part 4 — measured (reports in `results/s55/`, untracked, and `analysis/runs/`)

**The Pall against the other fifteen** (`pnpm combo-probe`, 600 games a row, master both):

| | win rate | the loop fires | own turn (median) |
|---|---|---|---|
| S54 pilot (no plan) | 58% | 30% of games | 7 |
| the combo archetype, game one | **68%** | 55% | 6 |
| the combo archetype, both sides sideboarded | **56%** | 32% | 6 |

- In the full sixteen-list round-robin (12,000 games, registered sixties) the Pall is **72%**, ten points clear of the Levy and the Hearth (62%).
- Against the sideboarded field, graveyard exile is used in 46% of games and the Pall wins half of those.
- **ADR-160's read:** the brief's measure is the boarded one. **56% is in the 50–65% band: a deck to beat, and an answer. No restriction is proposed.** See Concern 1 for why I would not treat that as settled.
- What the pilot now does: the setup in 75% of games, burying the Usher; Rituals pay only for Buried Alive, the Witch, Zombify and the Tutor; Zombify is aimed at the Usher 300 times in 350.
- What it still does not do: kill early. The loop is on turn 3 or earlier in 2% of games and by turn 4 in 9%. A person does it on turn 2 or 3.

**The Witch at four against one** (three Witches swapped in place for Hypnotic Specters, 900 paired games): **+0.9 ± 1.9 points.** The pilot gets almost nothing from her, so this number says nothing about what she does for a person. The limit the brief asked to be noted is the whole result.

**The list draw by strength** (`convocation-sim --events 8`, 1,016 AI seats):

| list draw | seats | mean finish | in the Umbel |
|---|---|---|---|
| top | 263 | 50.8 | 11.8% |
| any | 489 | 62.3 | 5.7% |
| low | 264 | 82.6 | 1.5% |

- A seat's list (its measured Open mean) against its finish: **r = −0.50**. The Umbel's eight hold lists averaging 59.9; the field 49.6.
- Deck quality by card rating against finish: r = −0.28 (S54: −0.25); the Umbel's eight at the 61st percentile.
- Two rematches in eight events (S54: none).

**The Open's round-robin, sixteen lists:** pall 72 · levy 62 · hearth 62 · coin 59 · sweep 56 · wurmspeaker 54 · muster 53 · loop 53 · warband 51 · depths 51 · ford 48 · enchantress 46 · tally 38 · undertow 34 · locks 32 · larder 28. `OPEN_MEANS` updated.

**The retire count reached three** for the Larder, the Locks and the Undertow. Their reviews are in `docs/proposals/retire-reviews-s55.md`: give the Larder a plan (it is an unpiloted reanimator), overhaul the Locks in family, overhaul the Undertow or accept it as the field's floor.

## After the handoff — the Pall's matches, the sideboard dial and the Coin study (Chris, 2026-10-05)

**Two sideboarding bugs found and fixed** (a test pins both):
- The field's other rules ran after the graveyard rule and swapped the hate cards back out (unrated, they read as the deck's worst). The black lists kept one of four.
- **The rules did not read plans.** The Pall's own sideboarding cut two Buried Alives for two Tendrils against every creature deck; the Locks took their counterspells out against the Pall. Now a deck never sideboards out a card of its own plan, and against a plan that names counterspells the counters stay.
- Part 4's boarded figure (56%) was measured before both fixes.

**`pnpm combo-probe --matches N [--hate C:M] [--only k]`**: best-of-three matches (game one registered, then sideboarded, the loser playing first), with the opponent's Crypt and Macabre counts as a dial.

**The Pall's match win rate against the field: 61.2%** (1,800 matches, after the fixes).
- Best: the Undertow 90%, the Larder 79%, the Locks 78%.
- Worst: the Coin 41%, the Loop 48%, the Hearth 49% — the three other Usher decks.

**The dial, against those six** (240 matches a cell, the same seeds; the Pall's match win rate):

| the opponent's graveyard exile | all six | best three | worst three |
|---|---|---|---|
| 2 Crypt + 2 Macabre (current) | 67.5% | 85% | 50% |
| 4 Crypt + 0 Macabre | 68.8% | 87% | 51% |
| 0 Crypt + 4 Macabre | 68.3% | 85% | 52% |
| 4 Crypt + 2 Macabre | 63.7% | 82% | 46% |
| 2 Crypt + 4 Macabre | 63.9% | 81% | 46% |
| 4 Crypt + 4 Macabre | 62.6% | 83% | 42% |

- The mix does not matter; the count does, a little: eight hate cards of fifteen cost the Pall five points.
- The loop is cut hard (about 30% of sideboarded games to about 16%), but the Pall wins most of those games anyway.
- The extra hate bites most where the Pall is already losing (the Usher decks: 50% → 42%), and hardly at all where it is winning.

**Why the Usher decks beat it — 300 games each of game one and sideboarded against the Coin:**
- **Whoever lands the first Usher wins.** Game one: the Pall first, 188 games, wins 89%; the Coin first, 79 games, the Pall wins 13%; neither, 33 games, the Pall wins 6%.
- **The Coin's loop runs on the Pall's graveyard.** Of the Coin's 48 loop wins in game one, 42 began by returning an Usher from the *Pall's* graveyard, and the Pall had cast Buried Alive in 42 of the 48. The Usher's text reaches either graveyard: the Pall's setup is the opponent's too.
- **Most of the Coin's wins are not the loop.** 72 of its 120 game-one wins are ordinary damage and drain, typically ending on turn 13 of the game; in 56 of those the Pall never had an Usher on the battlefield.
- **After sideboards the Coin lands the first Usher more often** (112 games against 79) and answers the Pall's (Vindicate 20, Swords 11, Sacred Helix 8), and the Pall drops to 40%.
- The Witch's digging is not the problem: the Pall won more of the games where it paid eight or more life (66% against 57% in game one).

**Chris walked the repeat's buttons** during his Pall run: they behaved, with an occasional refusal that the next offer or a different trigger order resolved. Concern 7 is closed.

## After the handoff — the combo rules in their own module, and a rule that was tried and left off (Chris, 2026-10-06)

- **`agents/plan-play.ts`** now holds every rule of the combo archetype (Chris: keep the combo logic separable from the broader AI). The agent calls in at named points and keeps thin methods of the same names. No behaviour changed: the books pass and 600 probe games are byte-identical.
- **What keeps it from becoming bespoke** (the module's header says so): every rule runs only for a deck with a plan or against one; the conditions come from the plan's data and from card data, never a card's name in code; a rule one deck needs and another does not is a *field on the plan*.
- **Book 107, a plan option: `holdSetupAgainstPiece`** — against a list that also holds the piece (and has the mana for it), hold the setup until the start can follow the same turn.
- **Measured against the Coin, the Hearth and the Loop (720 matches, the same seeds) and LEFT OFF for the Pall:**

| | match win across the three |
|---|---|
| no hold (as shipped) | 49.7% |
| hold from turn one | 40.7% |
| hold only once the opponent can cast an Usher | 47.2% |

- **Why it fails:** the Coin study said whoever lands the first Usher wins. Holding the setup gives up that race. The AI is better off arming both players and trying to be first.
- The option, its test and its fuel rule stay in the module for a plan it suits. With it off, the Pall plays exactly as it did before (600 games byte-identical).

## After the handoff — the Mardu grid and the Kiln (Chris, 2026-10-06)

**Are the four Mardu lists redundant?** From the saved sixteen-list round-robin (game one, registered sixties, 100 games a cell):

| row beats column | the Pall | the Hearth | the Coin | the Loop | against the other twelve |
|---|---|---|---|---|---|
| the Pall | — | 69 | 66 | 73 | 73.0% |
| the Hearth | 31 | — | 42 | 53 | 67.3% |
| the Coin | 34 | 58 | — | 52 | 61.9% |
| the Loop | 27 | 47 | 48 | — | 55.6% |

- **The Loop is the redundant one.** It shares 31 of its 37 nonland cards with the Coin; their matchup profiles correlate at r = 0.88; the Coin is level or better against eleven of the other twelve (the Loop is better only against the Tally) by six points on average. The Hearth is level or better than the Loop against all twelve.
- **The other three are distinct.** No pair shares more than 16 nonland cards. The Coin beats the Hearth head to head (58%) while the Hearth does better against the field; the Pall leads all three in game one but loses *matches* to the Coin (41%).
- **Recommendation for the planner: archive the Loop.** Not done: the Loop is a planner's seed list, and there is no archive mechanism yet (a flag on a list that keeps it in the data and out of the field would be enough).

**The Kiln** (Chris's 5–0 Izzet list, `docs/debug_logs/convocation-open-5–0 UR.json`; a working name) is the fifth contributed list, with its fifteen.
- Against the sixteen in the AI's hands: **46.8%** as midrange, 45.3% as control (paired difference −1.5 ± 1.6, so no real difference; registered as midrange).
- Best: the Tally 84, the Locks 69, the Undertow 67. Worst: the Levy 22, the Pall 27, the Loop 28.
- Chris expects to tune its sixty and fifteen; `combo-probe`'s in-place `--swap` and `open:rr --only` are the tools.

## After the handoff — tuning the Kiln against the Levy and the Pall (Chris, 2026-10-06; proposed, not applied)

`open:rr` gained `--swap key:from:n:to[;…]` (cards replaced in place: the same shuffle, so paired by game) and `--vs k1,k2`.

- **The AI does not sideboard the Kiln's fifteen** against either deck: its rules know targeted removal, counters and graveyard exile, not Pyroclasm or Boomerang. Sideboard plans were therefore tested as the sixty a person would present, swapped by hand.
- **Main deck** (1,600 games a variant against the sixteen, the Kiln's baseline seeds). Baseline: the Levy 22%, the Pall 27%, the field 46.8%.
  - −2 Experimental Overload +2 Control Magic: the field **+5.8 ± 1.5**.
  - 4 Control Magic (also −2 Blaze) and −3 Arcane Collector +3 Flametongue Kavu: the field **57.8% (+11.0 ± 2.2)**, the Levy 44%, the Pall 31%.
  - Cutting Young Pyromancer hurt against the field for every replacement but the Kavu (Chris found it weak in play; the AI gets value from it).
- **Sideboard, on that main** (300 games a plan, the opponent sideboarded too):
  - Against the Pall: 37% as is; −4 Tidewall +2 Crypt +2 Macabre **60%**; −4 Tidewall −3 Kavu +4 Crypt +3 Macabre **65%**. Here graveyard exile matters a great deal — unlike for the Mardu lists.
  - Against the Levy: 52% as is; none of seven plans improved it (Pyroclasm ±0; cutting Counterspells for anything cost 3–8 points).
- Chris to decide the seventy-five; nothing is changed in the list yet.

## Deviations from the brief
1. **`loopDrawCap` is an engine rule field, not a world knob** (`GameRules.loopDrawCap`, default 100). A match's rules are built in a dozen places that do not read the knob table.
2. **The loop draw does not apply CR 104.4b's exception for an optional action.** A player who repeats a position a hundred times in a turn by choice also draws. Recorded in R-103.
3. **The rule numbers are R-103 and R-104** (the registry stood at R-102).
4. **The Hearth is the third contributed list**, not the second; the Pall is the fourth.
5. **"Reachable within two draws by the deck's count"** is implemented as: the starts and dig cards left in the library give a one-in-four chance or better over two draws. For the Pall that is nearly always true.
6. **Book 100 goes one step past the brief:** casting a second copy of a looping legend is allowed and valued for any deck, not only a combo list. The Coin, the Loop and the Hearth hold four Ushers each.
7. **The Witch test used the combo probe's in-place swap**, not `card-test` (which builds Sealed hosts). The method is the same: one slot, the same seeds, paired by game.
8. **The rating's lower shrink target is not built.** The brief says "before the next rebuild"; no rebuild was run.
9. **The linkage's fence (a) is recorded, not built** (the linkage itself is not built).
10. **The Pall's fifteen is Chris's own**, as registered. It holds no graveyard exile, so a field seat on the Pall does not board against another Usher deck.

## Concerns
1. **Game one is where the Pall is too strong, and the brief's measure does not look there.** 68–72% in game one, 56% after sideboards. A best-of-three is one game of each kind and then a third boarded, so the match rate is nearer 60%. And the pilot is still slow: it kills on turn 6 where a person kills on turn 2 or 3. In a person's hands the game-one number will be higher. I would not read 56% as "the format has an answer" until a person has played against a field that boards.
2. **The answer is only as good as the draw.** A seat boards in four hate cards; they are used in under half its games. Used, they hold the Pall to 50%.
3. **The Witch cannot be measured yet.** ADR-160 names her as the first restriction, but the pilot does not use her well enough for a number. Teaching the dig rule to dig harder (Chris pays to six or eight life) comes before any measure of her.
4. **Two tier-2 cards now appear in campaign shops.** Tormod's Crypt and Faerie Macabre carry `shopTier: 2`, as briefed, so the journey's shops stock them (the shop-tier pin moved from 60 to 62 tier-2 cards). If they are meant for the Convocation only, they need a different marking.
5. **The plan vocabulary has one customer.** `piece` assumes a loop of one card returning itself. The Larder's plan (the Artisan reanimated once) would be the first test of whether the shape generalises; the reviews recommend it.
6. **The take-back's availability leaks a little**, and where its line sits is a dial (carried from S54).
7. **The repeat's buttons are still not walked in a browser** (carried from S54; the controller tests drive the same code on the real engine).
8. **The field's sideboards are built by rule, not authored** (carried from S54).
10. **The Usher mirror is decided by who lands an Usher first, and Buried Alive arms both players** (confirmed in the Coin study above). A list with four Ushers of its own is the natural predator of the Pall. That is a real metagame answer already in the field, and it is not sideboard hate.
11. **Sideboard hate is not the lever.** Half a sideboard of it buys five points. The Pall's edge is game one (64–88% against these six) and a fair plan that wins without the loop. If it needs holding back, the levers are a main-deck answer in the field's lists, a restriction, or a faster field.
9. **The rating's feedback loop** (S54 Concern 2) stands. The pilot is now book 106, so every rating run is stale again.

## Registry entries added/changed
- **R-103** — the mandatory-loop draw. **R-104** — `exileGraveyard`; `exile` on a graveyard card.
- **Pool registry:** `tormods_crypt`, `faerie_macabre` (Session 55 section; 244 → 246).

## Test status
`pnpm test`: 104 files passed, 1 skipped; **949 tests passed, 2 skipped** (the standing two). `pnpm typecheck` and `pnpm build:web` pass.

New this session:
- `sim/s55-fuzz.test.ts` (2), `sim/s55-loop-draw.test.ts` (4), `sim/s55-cards.test.ts` (5).
- Books 100–106 and the plan-matching test in `agents/book-of-shame.test.ts` (8).
- Three pins moved for the new cards: the pool count (260 → 262 defs), the shop-tier tally, and the list of cards that reach any graveyard.
- **Ladder mirror gate PASS** (pilot 106).
- About 45,000 sim games this session raised no engine error.

**Not verified:** the two new cards in a browser; the Pall played by a person against a boarding field; the repeat's buttons.

## Suggested next
- **Chris plays the Pall and plays against it**, on the local build, against a field that boards. That is the number ADR-160 needs.
- **Dig harder** (Concern 3), then measure the Witch.
- **The Larder's plan** (the reviews): the second combo list, and the test of the plan's vocabulary.
- **A counter rule for control lists** (the Locks' review): spend the held mana on the turn's best spell.
- **The campaign linkage**, with fence (a).
- **The rating's shrink target**, then a rebuild sized to the evidence it replaces.

## How to run
```
pnpm viewer                                                    # /convocation; /play for a single match
pnpm typecheck && pnpm test
pnpm open:gen                                                  # the lists and their plans from open-contributed.json
pnpm combo-probe --games 40 --shard i/5 [--boarded] [--no-plan] [--swap the_jet_witch:3:hypnotic_specter] --out analysis/runs/x_$i.json
pnpm combo-probe --report analysis/runs/x_*.json
pnpm open:rr --games 100 --seed 46 --shard i/10 --out analysis/runs/rr16_$i.json   # then --merge
pnpm convocation-sim --events 8 --seed 55 --shard i/8 --out analysis/runs/convocation55_shard$i.json   # then --report
pnpm ladder                                                    # the gate for any AI change (run alone)
FUZZ_FULL=1 npx vitest run packages/sim/src/s55-fuzz.test.ts
```
