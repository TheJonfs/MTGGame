# Handoff — after Session 52 and the post-S52 work (2026-10-05)

## State of the world
**The Convocation runs all three event kinds at up to thirty-two seats, and Limited and Constructed are now rated apart.** `/convocation` offers the Draft (four pods of eight; the player's pod live), the two Sealed events and the Open (Constructed: select-and-repair decks from all twelve Open lists, with stock, light and heavy tinkerers), five Swiss rounds and the Umbel. The card rating is **v1.3**: each card keeps v1.1's number as its Constructed score and carries a new **Limited score** (empirical Bayes on 73,600 Limited games), which every Limited path reads. Decks built on the Limited score beat v1.1's 52% in draft and 54% in Sealed, and black's draft seats went from 46% to 52%. Chris played a Draft ("it was great"; his first match losses, one in the Swiss and one in the quarter-final); his playtest fixes are in (books 93–94; the life buffs suppressed). Five experiments are built, measured and **shipped switched off** (the S52 pack-reading term, the colour term, the crowding penalty, an authored-only Constructed rating, the Constructed noise's plan rules) — each with its code, a test and the switch. Shocking Sharpshooter has its art. **S46–S52 and everything after are committed locally and not pushed.** `pnpm typecheck`, `pnpm test` (888) and `pnpm build:web` pass; the ladder gate passed after books 93–94.

## Done this session

### Session 52 (the brief)
- **Part 0**: rulings filed (`docs/decision-updates/s52.md`). **ADR-151** — the rating's arithmetic is a pure function (`world/rating-compute.ts`) with the fixture the S49–S51 pooling bug would have failed. The lord, guardian and petal baselines re-run on pilot 92 (within ±2, except Drakuseth +4 at the two lower tiers).
- **Part 1 — the Constructed builder** (`world/constructed-builder.ts`): select (legal share, ties by measured strength), repair (cut what the rule forbids; fill role for role inside the list's colours; the floors), noise, check. Seven formats (`CONSTRUCTED_FORMATS`: the Open, Pauper, the five gates), every seeded build a legal sixty; a new rule field `maxTier` for Pauper. `pnpm constructed:report`.
- **Part 2 — the Constructed event**: `newConstructedEvent`, `suggestedConstructedDeck`; the editor over the format's whole legal pool; saved journey decks read (never written) and checked by the format. Walked in the browser.
- **Part 3 — the drafter reads what is passed** (`colourSignals`, perfect memory, flow and cut): seven variants, never above the rule without it (42–45% against six-pack Sealed, where the rule makes 46%). **Shipped off.** Why: a signal built on the rating follows the rating — black rates highest, so black always reads as flowing.
- **Part 4 — measured**: drafted decks win 46% against six-pack Sealed but **66% against three-pack Sealed**; the gap is card supply, not the drafter or the builder.

### After the S52 handoff — Chris's four tweaks
1. **Thirty-two seats** in the five-round events; a Draft is four pods of eight (the others drafted headless at the start); a name builder (`world/convocation-names.ts`, the planner's sixteen then 926 more).
2. **The Open's field from all twelve lists**, and the noise has a noise: stock (a quarter), light (half: one or two swaps and a land), heavy (a quarter: four to six swaps and a land).
3. **`pnpm tinker`** — single-swap variants of a list on paired seeds. A single swap is below the noise at 220 games (SE ≈ 2.5 points); resolving two points needs about 1,400. **It found an engine crash** — a multi-target spec's fizzle check read the spec by the wrong index when the first target had left (CR 608.2b); fixed, two fixtures.
4. **The pod analysis** in `draft-sim` (the seat in its own pod): black seats lose wherever they sit.

### Chris's Draft playtest
- **Book 94 — a basic counter war.** The AI cast three Essence Scatters at one creature spell. A counter now aims only at a stack item still going to resolve, read down the stack: when the opponent counters our counter, the spell is live again.
- **Book 93 — no equipment shuffling.** A Bonesplitter passed back and forth: book 86's "unchanged" score was a quarter-point under passing, still picked about one window in ten under the softmax. Now refused outright; a 200-game probe: equipment moves 154 → 16, all off a creature that can't attack onto one that can.
- **The life buffs suppressed** (Chris: wait for a full tournament). `convocationEntrance` and `convocationBracketEntrance` are flat at every difficulty; the wiring and tests stay; ADR-148's tables kept as `CONVOCATION_ENTRANCE_ADR148`.
- Ladder mirror gate PASS after books 93–94.

### Black's rating — from "crowding" to the Limited score (Chris: dive in before the next session)
The question: black's draft seats won 46% while black's Sealed decks were level. Four steps, each measured:

| step | what it showed | outcome |
|---|---|---|
| **Colour term** (`rating:build --colour`) | Sealed colour rates W +3.3 · U +2.8 · **B +0.1** · G +0.6 · R −3.3 — black is level in Sealed; the term drove red out of Sealed decks (27% → 2%) through the builder's pair threshold | not adopted; code off |
| **Crowding penalty** (`colourCrowding`, two levers, six variants) | crowding is readable only at the wheel (r = 0.41; a first-pass count is r = 0.02); no variant moved black's share (47%) or win rate (46%). **Black seats lose at every crowding level, two black seats included** — the earlier "crowding" read was the arithmetic of a big losing group | shipped off |
| **Three-pack Sealed** (`sealed-sim --packs 3`) | black's share 56% → 39%, its win rate 50% → 48%: depth matters a little; drafted black (46%) is below even that | diagnostic |
| **Per-card draft study** (`pnpm draft-cards`, 300 pods, 33,600 games) | no black card is oversold as a pick; **black decks carry dead filler** — 2.3 slots a deck with lift below −1 point (W 0.4 · U 0.5 · R 0.8 · G 1.1): Entomb (cast when drawn 21%), Waste Not, Buried Alive (8%), Duress, Reassembling Skeleton, Dark Ritual — held up by the tier-2 prior (Entomb rated 1.28, above Typhoid Rats) | led to the split |

Entomb's v1.1 number came from 81 sightings (± 5 points) — under v1.0 no Sealed deck played it; v1.1 lifted it into decks, and 6,700 sightings now read −3.4. Thin evidence fed the next rating.

### Limited and Constructed rated apart (Chris: "both 1 and 2") — the Limited half adopted
- **One table, two scores.** Each row keeps `rating` (the Constructed score) and carries `limited`; `limitedView(table)` hands the Limited score to the Limited builder, the drafter, Sealed and draft events, the AI's sideboarding in a Limited event, the player's Limited "suggest a deck" and the Limited sims. The Constructed builder, the Open and the tinker read `rating`.
- **The Limited score** (`computeLimitedRating`, tested): Limited games only (sealed53, noise53, draftcards — pilot 94). Each tier's prior is its cards' *measured* mean lift (1: +0.7 · 2: +0.9 · 3: +1.9 · R: +1.5 points); a card moves from it by τ²/(τ² + se²) of its own lift (τ = 1.6 points); scaled to v1.1's mean and spread (1.8, 0.8) over the pack cards so the builders' terms keep their meaning.
- **Why the tier is only the shrink target** — measured out of sample on 2,400 drafted decks: a deck's mean tier prior predicts its win rate at **r = −0.06**; v1.1 0.34; the posterior lift 0.59.
- **The A/B on fresh seeds** (draft seed 54, 200 pods; Sealed seed 49, 200 pools):

| | v1.1 | Limited score |
|---|---|---|
| draft: seats on black / black seats win | 47% / 46% | 34% / **52%** |
| draft: colours' seat win rates | 46–54% | 47–52% |
| draft: dead-filler slots a deck | 2.6 (black 1.9) | 1.0 (black 0.15) |
| Sealed: colours' share of decks | W 46 · U 28 · B 63 · R 26 · G 38 | W 34 · **U 67** · B 29 · R 30 · G 41 |
| Sealed: colours' decks win | 47–54% | 49–51% |
| Sealed: deck rating against win rate, r | 0.44 | 0.61 |
| **head to head (`rating-ab`)** | | **draft 52.1% ± 0.5 · Sealed 53.8% ± 0.8** |

- **Adopted (Chris)** — `card-rating.json` v1.3: v1.1's `rating` untouched, v2's `limited` fields added, `run.limited` records the runs.
- **The Constructed check — v1.1 stays.** A full-size authored run on pilot 94 (33,600 games) built an authored-only Constructed candidate; on the Open, head to head with the same seeds (`rating-ab --constructed`), its decks win **48.7% ± 0.8**. v1.1's number carries Sealed lift on top of the authored evidence, and dropping it didn't help: without Sealed evidence the reanimator pieces (Entomb 1.55, Buried Alive 1.33, Unearth 1.30) rate as ordinary spells and the noise swaps them into decks with nothing to reanimate.

### "Why do the Larder and the Undertow repair badly?" (Chris) — they don't
- In the Open nothing is repaired (the lists are legal); a rating reaches a deck only through the noise. My first by-list table read list strength: the Larder (31% in S46's round-robin) and the Undertow (38%) are the two weakest Open lists under any rating. Set against the same list's own decks, only the Undertow's −9.7 ± 4.1 was clear — one 2.4-SE result in twelve lists.
- The noise does have three blind spots for a synergy list: a swap can take out an engine piece or bring in an enabler without its payoff; the land-down move adds the single best-rated creature in the colours (Drana in 9 of 16 Undertow decks); the land-up move cuts the lowest-rated spell (always an engine piece in the Larder).
- **The plan rules, built and measured** (`VARIATION_TERMS.plan`, tested): a swap's card shares an authored list with the one it replaces; a nonland four-of never leaves; the land-down move adds a copy of a card the deck plays. Head to head on the Open (`rating-ab --variation`, 8,000 games): **49.4% ± 0.6**, the Undertow −3.3 and the Larder −0.8 (each ± 4), variety down (distinct decks 299 → 270 of 400). **Shipped off.** The noise's harm was small to begin with.

### Art
- **Shocking Sharpshooter** (a real card with no Scryfall high-resolution scan): Chris's storm archer as `art.asset` (5:4 crop, 1024×819) and his printed face as `printedAsset` (745px). The face verified word for word against Scryfall and the def ({1}{R}, Summon Human Archer, Reach, the enters trigger at target opponent, 1/3); it names the card where today's Oracle says "this creature". Seen in the gallery both ways.

## Deviations from the brief
1. **The pack-reading term ships switched off** (S52 Part 3) — it lowered the field's quality in every variant, and the process rule says such a change reverts. *Rule on*: whether to keep the code.
2. **The 50% draft target is measured against six-pack Sealed**, which a three-pack draft deck should not be expected to beat; against three-pack Sealed the drafter wins 65–66%. Neither the target nor the entrance was changed.
3. **The draft event does not store the AI seats' pack memory** — with the reading terms off there is nothing to read it. If one returns, `event.draft` grows a `seen` list per seat (about 40 KB a draft).
4. **Bodies asks 24 creatures**; the gate formats are "the Open plus the gate". The formats doc leaves both open.
5. **No sideboarding in a Constructed event**, for the player or the field.
6. **Noise never moves a free card** (the Lotus, a Mox) — added after the first round-robin swapped them on rating alone.
7. **"Suggest a deck" in the Open is the field's select-and-repair** on the human seat's seed.
8. **A saved deck is offered whatever its legality**, marked "(not legal here)"; registration still refuses it.
9. **Post-S52 work outside any brief**, all at Chris's direction: the four tweaks, the playtest fixes, the black investigation, the rating split and its adoption, the Constructed checks, the variation rules. The rating's adoption (v1.3) is Chris's ruling; the planner may want an ADR for "Limited and Constructed are rated apart" (it supersedes part of ADR-145's single number).

## Concerns
1. **Blue takes over Sealed under the Limited score.** Blue is in 67% of Sealed decks (28% before) and games end by decking 17% of the time (7% before). The score is right about blue's cards (Control Magic, Traumatizer, Cloudkin Seer, Faerie Formation at the top), so this is a variety question for the pool or the builder, not the rating. In draft, seats compete and blue sits at 49% of seats winning 49%.
2. **Red is still the weakest colour** in both formats (47–50% in draft, 48.5–50% head to head) after S50's six cards.
3. **The tier ladder says nothing about Limited** (r = −0.06). Tiers still set shop prices, pack slots and the shrink target. Worth a planner look: Inspiring Overseer and Shocking Sharpshooter (tier 1) are top-15 Limited cards; Entomb and Waste Not (tier 2) are the bottom.
4. **Context-dependent cards break any context-free number.** Reanimator pieces are dead in Limited and fine in their own Constructed list; a single score per format still can't say "good with partners". The Constructed builder's noise is where it bites (Concern 6).
5. **The Limited score will drift as decks change.** It was measured on decks built by v1.1; v1.3's builder plays different cards, so some numbers rest on fewer sightings (the 20 unseen cards read their tier's mean). A re-measure after a noise run on v1.3 would close the loop (ADR-150's watch).
6. **The Constructed noise swaps by rating within role**, blind to a list's plan; the plan rules didn't pay, so a finer role or a synergy record would be needed to do better. The Larder and the Undertow are weak as lists — a design question, not a builder bug.
7. **The Open's first turn is Vintage's**; the entrance is flat for now (Chris), so this waits on play.
8. **The player's editor shows 234 cards** in the Open; a "start from a list" picker would serve better than an empty deck.
9. **A saved journey deck is almost never legal in the Open** (thirty or forty cards against sixty) until the campaign linkage exists.

## Registry entries added/changed
- No R-numbers. The engine fix (multi-target fizzle, CR 608.2b) is a bug fix with two fixtures, not a new mechanic.
- **Pool registry**: Shocking Sharpshooter's row (art and printed face).
- **Knobs**: `convocationEntrance` and `convocationBracketEntrance` flat (`{1: {life: 0, basics: 0}}`); the hard/easy overrides removed; `docs/knobs.md` regenerated.
- **Data**: `card-rating.json` v1.3 (the `limited` fields). `DeckRule.maxTier` (S52).
- **Books of shame**: 93 (equip refused when unchanged), 94 (counter war).
- **New switches, all off**: `DRAFT_TERMS.signal*` (S52), `crowdWeight` / `crowdRanks`, `rating:build --colour`, `VARIATION_TERMS.plan`.

## Test status
`pnpm test`: 92 files passed, 1 skipped; **888 tests passed, 2 skipped** (the standing two). New since S52's 877: the multi-target fizzle fixtures (2), books 93–94, the crowding signal and its off switch (2), the colour term, the Limited score and `limitedView` (2), the plan rules. Ladder gate PASS after books 93–94. No fuzz — no new card. About 450,000 sim games this stretch; one engine error (the fizzle crash, fixed).

Not verified: a full Open or a thirty-two-seat Draft played to the Umbel in the browser after the rating change (the event tests pass, and the gallery was checked for the art); the production build in a browser.

## Suggested next
**S53 — the full ladder** (staged events), as planned: a stage list (format, rounds), the player's pool and deck per stage, standings carried across stages, a second draft mid-event, the bracket in a chosen format, prizes by finish; a versioned save (`convocation-event-v2`). One to two sessions.

Before it, cheaply, for the planner to weigh:
- **Blue in Sealed** (Concern 1) — a pool or builder ruling.
- **Red** (Concern 2) — still last after S50.
- **A noise run on v1.3** to re-measure the Limited score on the decks it now builds (Concern 5).
- **An ADR** for the two-score rating.

## How to run
```
pnpm viewer                                                   # /convocation — the Draft, the Sealed events, the Open
pnpm typecheck && pnpm test
pnpm ladder                                                   # the AI gate (after any heuristic change)
pnpm draft-sim --pods 100 --games 4 --vs-sealed --sealed-packs 3     # pods, the pod analysis, drafted vs three-pack Sealed
pnpm sealed-sim --pools 200 --games 10 --seed 49 [--packs 3]          # Sealed (shard with --shard i/n, then --report)
pnpm draft-cards --pods 300 --games 4 --seed 53 --shard i/9           # the per-card draft study; then --report <shards>
pnpm rating:run --games 15 --shard i/9 --out analysis/runs/<name>_shardI.json   # the authored-list run
pnpm rating:build <authored shards> --limited sealed53,noise53,draftcards --candidate <name>   # a candidate with both scores
pnpm rating-ab --draft <A prefix> <B prefix> | --sealed a.json b.json | --constructed a.json b.json | --variation   # head to head; then --report
pnpm tinker --list open:warband                               # single-swap variants of a list
pnpm constructed:rr --format open --seed 52                   # the Open's field in a round-robin
```
