# Handoff — after Session 49 (2026-10-03)

## State of the world
**The Convocation is a sixteen-seat event with a Top 8.** `/convocation`: six Classic packs, the build, five Swiss rounds of best-of-three (byes for an odd field), the Umbel — quarter-finals, semi-finals, a final — and a finish written to the ledger. The S48 event of eight (three rounds, no bracket) is still offered beside it, with a difficulty (easy / standard / hard) that sets the AI seats' extra life by round. The AI seats sideboard from game two. The colour question has an answer of the kind the brief asked for — **red's record is not the rating's doing** — and the drafter's pick rule and sim exist as data (no draft screen yet). S46–S49 are committed locally and **not pushed**. `pnpm typecheck`, `pnpm test` (842) and `pnpm build:web` pass.

## Done this session
- **Part 0 — rulings applied** (`docs/decision-updates/s49.md`): the tiebreaks verified against the Magic Tournament Rules' Appendix C and corrected to it (the floor is 0.33, not one third; game-win share is floored too; opponents' game-win share added as the third tiebreak); ADR-148's life-only entrance (Standard +0 / +2 / +4, Easy flat, Hard +2 / +4 / +6) and the bracket's (+4 / +6 / +8); the base floor's legality line stands down when a format asks more; the builder caps four-and-five-drops at nine.
- **Part 1 — the colour question**: `pnpm sealed-sim --forced` (55,200 games) and `--noise 0.4` (20,000 games), and a v2 candidate (`pnpm rating:build --noise`). Tables below. **v2 did not replace v1.**
- **Part 2 — sixteen seats, five rounds, a Top 8**: `newSealedEvent({ seats: 16, rounds: 5, top8: true })`; byes (a fifteen-seat test: one a round, never twice, three points and no games); the bracket in the event's state (`startBracket`, `recordBracketSeries`, `advanceBracket`, `finalPlaces`) seeded 1v8 / 4v5 / 2v7 / 3v6; the human plays theirs live and the rest resolves headless; a player outside the eight watches it resolve from one screen; the save carries the bracket and resumes inside it. **The AI's sideboarding** (`world/sideboard-ai.ts`), pinned: artifact/enchantment removal in against three or more auras and equipment; creature removal in against fifteen or more creatures; counters out against a creature deck. "The Umbel is yours" only for the win.
- **Part 3 — the drafter's data**: `world/drafter.ts` (the pick rule — `DRAFT_TERMS`; designed in the plan's stage 3), `pnpm draft-sim --pods 50`, and `pnpm draft-sim --pick-order` → `data/convocation/pick-order-plane.md` (the top sixty).
- **Part 4 — text and art**: the planner's sixteen names; the Umbel plate (`docs/art/subjects/convocation-umbel.md` — eight stalks from one point), installed beside the bracket **pending Chris's verdict**.
- **Walked in the browser** (dev build): a sixteen-seat event with the human winning all five rounds and the Top 8 (seeded first; +4 life on the quarter-final opponent; a reload mid-quarter-final resumed at one game played; "The Umbel is yours"; ledger "first of 16"); and a second with the human losing every round (outside the eight; "Watch the bracket resolve"; sixteenth of sixteen). No console errors.

## The colour question — what the two experiments say

**1. Forced pairs.** For each pair, forty pools in which that pair is at least third by the builder's own score. *Forced* is the best deck the builder makes in the pair; *chosen* is the deck it would pick from the same pool, on the same seeds. Each deck plays twenty of a fixed field of forty.

| pair | forced | chosen (same pools) | forced − chosen | forced, where the pair was the builder's 1st | where it was 2nd or 3rd |
|---|---|---|---|---|---|
| WU | **51%** | 49% | +2.5 | 48% | 52% |
| UG | **49%** | 49% | +0.5 | 53% | 47% |
| UB | **47%** | 47% | −0.6 | 51% | 45% |
| WG | **46%** | 45% | +1.0 | 45% | 47% |
| WB | **43%** | 46% | −2.2 | 45% | 41% |
| BG | **41%** | 44% | −3.4 | 44% | 39% |
| UR | **37%** | 45% | −8.2 | 36% | 38% |
| WR | **35%** | 42% | −7.7 | 33% | 35% |
| BR | **35%** | 43% | −7.9 | 38% | 34% |
| RG | **33%** | 40% | −7.6 | 35% | 32% |

By colour (the mean of its four pairs): W 44% · U 46% · B 41% · **R 35%** · G 42%. (The field's forty decks ran a few points above average, so read the columns against each other, not against 50%.)

**The reading the brief set up:** forced red decks do not win 45–50% from red-rich pools — they win 33–38% even in the pools where a red pair was the builder's own first choice. So **the rating was not under-rating red; the cause is the pool or the pilot.** v1 stands.

**2. Rating noise.** A third of 200 decks built with σ = 0.4 noise on every card's rating. Red's share of decks: 10% (v1's run) → 8%; red pairs' win rates 38–48% on fifteen decks. The update's movers (v1 → the v2 candidate) are mostly **red cards going down** — once the noise got them played, the evidence was against them:

| card | tier | v1 | v2 | sealed seen | sealed lift |
|---|---|---|---|---|---|
| Guttersnipe | 3 | 1.89 | 1.30 | 2232 | −5.9 |
| Dragon Mage | 3 | 1.71 | 1.26 | 2172 | −5.1 |
| Titania, Protector of Argoth | legend | 2.96 | 2.61 | 621 | −2.7 |
| Siege-Gang Commander | 3 | 2.38 | 2.04 | 1985 | −4.6 |
| Young Pyromancer | 2 | 1.36 | 1.03 | 2031 | −6.7 |
| Goblin Chieftain | 2 | 2.13 | 1.81 | 2692 | −1.9 |
| Goblin Matron | 2 | 1.67 | 1.38 | 2038 | −2.9 |
| Entomb | 2 | 0.67 | 0.39 | 2263 | −9.2 |
| The Warden | legend | 2.60 | 2.33 | 185 | −4.3 |
| Curiosity | 1 | 0.77 | 0.52 | 605 | −6.1 |

(The other ten of the twenty are in `data/convocation/card-rating-v2-candidate-report.md`; all twenty moved down.)

**What I could and could not separate, pool against pilot** (a 720-game probe: thirty red-pair decks and thirty others, twelve games each):
- *Not burn at faces.* Red decks hold 1.6 burn spells and cast one every other game; 23% of those go at the face — about one face-burn in ten games.
- *The bodies differ.* Red's commons and uncommons are the pool's highest in power and lowest in toughness (2.0 / 1.5 on average, against 1.5–1.8 / 1.7–2.1 elsewhere) — creatures that want to attack early and trade badly late. Red decks' games run as long as anyone's (19.5 turns).
- *I cannot say whether a better pilot would win with them.* That needs a human, or an attack-policy experiment; it is the note the brief asked for: **for the AI ledger — in Limited, a term for racing with a low-toughness board (when the opponent's blockers outclass ours and the clock is not ours, small attackers are being spent, not used); burn at faces is not the problem.**

## The draft sim — 50 pods of eight, three Classic packs, the pick rule, 2,800 games

- **Seats per colour** (even is 40%): W 43% · U 38% · **B 51%** · **R 27%** · G 42%. Drafting spreads the colours far more than Sealed did (red 8–10% there) — a seat takes what is passed.
- **They do fight over black**: four or more of eight seats are on black in 33 of 50 pods (five or more in 17). The most-drafted colour in a pod is shared by five or more seats in 31 pods.
- **A colour's seats win**: W 54% · U 54% · B 49% · **R 38%** · G 51% — red again, now with 106 seats behind it.
- **Pairs**: BG 14% · UB 14% · WG 13% · WB 13% · WU 11% · BR 10% · UG 9% · WR 6% · UR 6% · RG 5%.
- **Commitment**: a seat's two colours last change at pick 4.9 on average; 88% are settled by the cut at pick 8; 8% change after the first pack. 25 of 400 decks splash.
- **The pod's spread**: the best seat's win rate less the worst's averages 53 points; a seat's standard deviation within its pod is 16.7 points.
- **The pick order's top ten** (`pick-order-plane.md`): Clio, Drana, the Usher, Lumen, the Fordkeeper, then **Tundra, Tropical Island, Scrubland**, Vindicate, **Plateau** — four dual lands (see Concern 3).

## After the handoff (Chris's question: does red need help at tiers 1 and 2, or is it short of bombs?)

Read from the v2 candidate's Sealed sample (the v1 run plus the noise run), mono-coloured cards, lift in win-rate points weighted by sightings:

| colour | tier 1 (cards; lift; sightings) | tier 2 | tier 3 |
|---|---|---|---|
| W | 11; +2.2; 70,237 | 6; +0.8; 44,692 | 5; +2.9; 43,284 |
| U | 15; +1.0; 39,090 | 8; +3.0; 60,329 | 3; +4.1; 29,107 |
| B | 8; 0.0; 79,396 | 14; +0.1; 127,656 | 4; +1.2; 49,809 |
| **R** | **11; −3.0; 2,187** | **10; −3.0; 14,349** | **3; −5.2; 6,389** |
| G | 19; −0.7; 51,688 | 6; +0.1; 45,670 | 4; +2.0; 32,326 |

- **It is not a count problem and not only a bomb problem.** Red has as many tier-1 and tier-2 cards as white. What it lacks is cards that are good on their own: no mono-red card with 600+ sightings has a positive lift (the best is Boggart Brute, −0.7), where every other colour has several commons and uncommons at +2 to +5 (Inspiring Overseer, Soul Warden, Pacifism; Cloudkin Seer, Mist Raven, Aether Channeler; Vampire Nighthawk, Nekrataal, Terror; Wood Elves, Centaur Courser).
- **Red's tiers 1–2 are a Constructed package.** Seven cards are the Goblin deck's (Piker, Prospector, Matron, Chieftain, Grenade, Outburst, and Siege-Gang above them), three are spell payoffs (Young Pyromancer, Guttersnipe, Arc Mage), and the plain bodies are the pool's weakest (Raging Goblin, Gray Ogre, Hill Giant, Orcish Lumberjack). A sealed pool rarely assembles the tribe or the spell count those cards want.
- **Tier 3 is thin for Limited**: Siege-Gang (−4.6), Dragon Mage (−5.1), Guttersnipe (−5.9) — two of the three are build-arounds. The legends are barely sampled (Drakuseth +11.3 on 79 sightings; the Ruby Tyrant −2.5 on 195): nothing can be said of them.
- **But the burn's numbers point at the pilot too**: Lightning Bolt −3.7 (849 sightings), Char −2.2, Goblin Grenade −3.1, Pyroclasm −3.1, where black's Terror is +1.7 and white's Pacifism +2.6. Lift is measured against the deck's own average, so "red decks are weak" does not explain it — a red deck does *worse* than its own norm when it holds a Bolt. That is not a believable verdict on Lightning Bolt in Limited; it says the heuristic is not getting removal's worth out of burn. Not investigated.
- **Caveat**: tier 1's sample is small (2,187 sightings; four of the eleven cards never seen) because the builder so rarely plays red commons.

**The implementer's read**: both. The pool question has enough evidence to act on — red wants a handful of self-sufficient tier-1/tier-2 cards (bodies with evasion or an enters-the-battlefield effect; a solid three- and four-drop) more than it wants another bomb. The burn finding wants an AI look before any card is judged by these numbers.

### The burn, looked at (Chris: why is red presumably misusing its burn?) — two causes found and fixed; red still loses

A probe over 640 Sealed games of forty red decks, each burn spell followed from the hand to its use:

| card | drawn | at a creature (killing it) | at the face | of those: an EMPTY enemy board, not lethal | left in hand at the game's end |
|---|---|---|---|---|---|
| Lightning Bolt | 202 | 108 | **87** | **69** | 7 |
| Char | 139 | 118 | 9 (7 lethal) | 0 | 12 |
| Goblin Grenade | 301 | 111 | 27 (23 lethal) | 2 | **163 (54%)** |

1. **Lightning Bolt went at the face on the first turns** — 69 of 195 casts hit an opponent with no creatures and thirteen or more life, held two turns on average. With nothing to kill and the mana idle, the face was the best-scoring use. **Fixed (book 88)**: a numeric-damage spell that can hit a creature is removal first; aimed at the opponent's face it waits unless it is lethal, the opponent is at eight life or less, or the deck is the aggro archetype (whose burn is its reach — unchanged). After: Bolt at the face 87 → 12, kills 108 → 188 (same forty pools).
2. **Goblin Grenade was put in decks with no Goblins** — its additional cost sacrifices one, and the builder read only its rating. It sat in hand in 54% of the games it was drawn. **Fixed in the builder**: a card whose additional cost sacrifices a creature of a subtype is played only beside five creature cards of that subtype. Grenade's appearances fell from 301 to 90 over the same pools.
3. **Char was used well** (118 kills of 127 casts). Instants are mostly cast in the AI's own upkeep or draw step (104 of 127 for Char; the same for Terror and Doom Blade) — the first window after the opponent's creature lands. Odd to watch, not costly.
4. **Not fixed, noted**: a VARIABLE amount (Blaze, Sacred Helix) is outside the new rule — only numeric damage is read.

**What it bought**: eighty forced red decks, 1,600 games against a fixed field, before → after: **39.4% → 40.6%**. Inside the noise (about ±1.2), and a point at most. The burn misuse was real and is gone, but it was never the reason red loses — which puts the weight back on the pool: red's tier 1 and tier 2 have no card that is good on its own. Ladder mirror gate PASS; the campaign's non-aggro red mages now hold their burn for creatures too (not measured in the campaign's sims).

## Deviations from the brief
1. **v2 is written as a candidate file and v1 stands** — the brief's own rule, applied; the planner can overrule by copying the candidate over.
2. **A drawn bracket series goes to the higher seed.** The brief does not say; single elimination needs a winner and a best-of-three can end 1–1–1.
3. **The AI sideboards on the opponent's registered list, not on cards "seen".** The heuristic is already handed that list every game; reading the last game's log for what was seen is more code for a rule that would mostly reach the same answer. *Rule on*: whether open lists are acceptable here.
4. **"Auras seen"** is three or more noncreature artifacts and enchantments in the list — auras and equipment both, since the same removal answers either.
5. **The door offers two events and a difficulty.** The brief asks for sixteen seats; I kept the eight-seat event as the short option, and added the difficulty select because ADR-148's table is per difficulty and nothing else chooses it.
6. **Hard's bracket entrance** is +6 / +8 / +10 and Easy's is flat — the brief names Standard only.
7. **The forced-pair field is forty decks** with each deck meeting twenty of them (the brief says "the field's twenty"), and every forced deck is paired with the chosen deck from the same pool on the same seeds — that pairing is what makes the "forced − chosen" column possible.
8. **The Top 8's "one screen"** for a player outside the eight is the bracket itself with one button; the same screen serves a player still in it.

## Concerns
1. **Red is a real problem for the mode, and the rating cannot fix it.** A draft puts a quarter of the seats on red and they win 38%. In Sealed the builder avoids red, which hides it; in a draft the cards have to go somewhere. Updating the rating on this evidence lowers red further (the v2 candidate), which is honest about results and makes the avoidance stronger — a loop that ends with red undraftable for the AI and a free lane for a human who can pilot it. Whether a human *can* is the open question; Chris drafting or building red deliberately in his next event would tell more than another sim.
2. **The builder leans on black more than black earns.** Black is in 64% of Sealed decks and 51% of draft seats, but forced black pairs win 41% — below white (44%) and blue (46%). WU is the best forced pair (51%) and is chosen 8–11% of the time. The rating's black cards came from authored lists where black was strong at sixty cards; the Sealed updates have not corrected the colour as a whole.
3. **Dual lands are first picks.** Their ratings come from Constructed lists (a Tundra is in the best decks), and the pick rule takes rating alone for picks one to three. An AI seat opening a dual will take it over a removal spell. The builder then plays the dual only if it fits. A land's draft value wants its own treatment — a flat low value before the colours settle is the obvious one.
4. **Seats commit at pick four.** The bonus starts at +0.1 and compounds, so whatever two colours lead after three picks are almost always the seat's colours for the draft (88% never change after pick 8). That is a rigid drafter: it will not move into an open colour. Fine for a first field; worth a look before the human's draft, because a rigid field is easy to read.
5. **The pod's spread is wide** — 53 points between the best and worst seat. Some of that is seven-opponent noise at two games a pairing; some is real (a seat that fought over black against a seat that had blue to itself). It is the number to watch when the pick rule changes.
6. **The field's round time under load**: seven series took 0.7–1.2 s on the main thread while six sim processes were running on the same machine — inside the brief's 3 s line, but not a clean measurement. The S48 figure for three series (0.2–0.3 s warm) suggests about 0.6 s clean.
7. **The entrance at rounds four and five is round three's** (+4): the table has three rows and a later round reads the last. A five-round event at Standard is +0 / +2 / +4 / +4 / +4, then +4 / +6 / +8 in the bracket — so the quarter-final is no harder than round five. If the ramp should continue, the table wants five rows.
8. **A finished event's Swiss standings place and bracket place differ**, and the prize screen's table is ordered by the final place while its record columns are the Swiss rounds' — a quarter-final loss does not show in "Record". Correct, but it may read oddly.

## Registry entries added/changed
- **R-101** amended — the tiebreaks are the Magic Tournament Rules' Appendix C, verified against the text (0.33 floors; three tiebreaks).
- **Knobs**: `convocationEntrance` filled (ADR-148), `convocationBracketEntrance` added; `docs/knobs.md` regenerated.
- Pool registry: no rows changed (no cards this session).

## Test status
`pnpm test`: 87 files passed, 1 skipped; **842 tests passed, 2 skipped** (the standing two). New in `event.test.ts`: the sixteen names; a full sixteen-seat event with the bracket, saved and resumed inside it; the bracket's entrance and the drawn-series rule; byes at fifteen seats; five sideboarding tests; the pick rule. New in `convocation-controller.test.ts`: the sixteen-seat event through the controller with the human winning the Top 8 (the entrance by round and bracket round, a reload in the bracket, the ledger); the human outside the eight, and a quarter-final loser's finish; the AI's game-two deck. Amended: the ladder test (ADR-148's values).

No AI heuristic changed this session (the sideboarding is deck choice, in the world package), so no ladder run. No fuzz — no new card entered a deck; 78,000 sim games over built decks raised no engine error.

Not verified: the Lab worker's rate (still); the production build in a browser; an event played by hand without the dev concession at sixteen seats; whether ADR-148's life values are right (Chris's next event reads them).

## Suggested next
**S50 — the drafter as a screen.** Estimate: **one session** for pick-and-pass with the pod's seven AI seats on the pick rule, the human's picks into the event's pool, then the existing build → rounds → Umbel flow (a draft event is a Sealed event with a different way of getting the pool). Before it, two small things I would settle because a human will exploit them at once:
- lands' pick value (Concern 3) — a line in the pick rule;
- whether the field should be less rigid (Concern 4) — a slower bonus before the cut.

And one thing for Chris rather than for code: **play red on purpose** in the next event and report whether it is the cards or the pilot.

## How to run
```
pnpm viewer                                  # /convocation — sixteen seats and the Umbel by default
pnpm sealed-sim --forced --games 4 --shard 0/6     # six shards, then:
pnpm sealed-sim --forced-report --games 4          # the forced-pair table → analysis/runs/forced_pairs.md
pnpm sealed-sim --pools 200 --games 10 --seed 4901 --noise 0.4 --shard 0/6 --out analysis/runs/sealednoise_shard0.json
pnpm rating:build --noise                    # → data/convocation/card-rating-v2-candidate.json (v1 untouched)
pnpm draft-sim --pods 50                     # the draft's colour table
pnpm draft-sim --pick-order                  # → data/convocation/pick-order-plane.md
npx vitest run packages/world/src/event.test.ts packages/ui/src/convocation
pnpm typecheck && pnpm test
```
