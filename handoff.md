# Handoff — after Session 47 (2026-10-01)

## State of the world
v1 is live; S46 (the Open) and S47 are committed locally and **not pushed**. S47 was the Convocation's scoping session and nothing in it has a screen: the plan is `docs/convocation-plan.md`; the card rating v0 is `data/convocation/card-rating.json` (measured over 33,600 games, 112 authored lists); the sets and pack recipes are `data/convocation/{sets,recipes}.json` with `pnpm booster` and `pnpm sealed-pool`; the match series is built headless in `packages/world/src/series.ts`. The campaign is untouched. `pnpm typecheck`, `pnpm test` and `pnpm build:web` pass.

## Done this session
- **Part 0 — rulings filed**: `docs/decision-updates/s47.md` (ADR-144, ADR-145, Chris's four kickoff answers, the interim choices).
- **Part 1 — the plan**: `docs/convocation-plan.md`. The overview's six questions answered; five stages (Sealed single event → series and standings at sixteen seats → the drafter → Constructed by select-and-repair → the full ladder), each with files, types, screens, tests and what the Lab measures; the save key; six risks. **Estimate: 5–6½ sessions after this one (S48–S53).**
- **Part 2 — the card rating, v0**: `pnpm rating:run` (every authored list against sixty others at even entrances — 20 life, master both; cards seen in hand and cards cast, per game) and `pnpm rating:build` → `data/convocation/card-rating.json` + `card-rating-report.md`. `world/rating.ts` — `cardRating(def, table)`, falling back to the tier prior. 228 cards rated; two (Airship Crash, Darksteel Myr) are in no list and read their prior.
- **Part 3 — sets and recipes**: nine sets (the Plane, the First Bloom, the Flood, the five still pairs WU / UB / WR / BG / RG, Pauper) as filters; four recipes (Classic, Flat, Rich, Pauper); `world/packs.ts` (`resolveSet`, `validatePackData`, `fillErrors`, `rollPack`, `rollSealedPool`). Validated: no basics, tokens, laws or prize cards; weights sum to one; every set fills its recipe.
- **Part 4 — the series, built**: `MatchSeries` (the record, the chooser, per-game seeds from the series seed, resumable from the games played) and `runSeries` over `runMatch` with a `betweenGames` hook for the sideboard screen. Four tests: best-of-three to a majority with the loser taking the play; the chooser taking the draw; a forced draw (three games at a two-turn cap → a drawn series, one point each); a 1–0–2 series, the hook, a resumed series.
- **Part 5 — the save key**: `convocation-event-v1`, designed in the plan (shape, size, resuming, what the world's UI lends).
- **`world/authored-lists.ts`**: every authored list in one table (112) — the rating's field, the Constructed builder's library.

## The card rating — what it says

`rating = prior(tier) + 0.5 × ½(presence′/σP + lift′/σL)`; σP = 4.6 points, σL = 1.4 points. The full tables are in `data/convocation/card-rating-report.md`.

**Top ten**: Clio, Lady of the Depths 3.72 · The Usher 3.59 · Obsidian Observatory 3.41 · Drana 3.31 · The Fordkeeper 3.29 · Lumen 3.27 · Wrackroot 3.23 · Cairnbrand 3.19 · Tundra 3.19 · Time Walk 3.18.

**Bottom ten**: Forgotten Cave 0.19 · Gray Ogre 0.29 · Disenchant 0.31 · Brute Force 0.37 · Waterfront Bouncer 0.46 · Hill Giant 0.48 · Shock 0.58 · Lonely Sandbar 0.62 · Giant Growth 0.63 · Orcish Lumberjack 0.66.

**The rating against the tier — for the planner to read by hand:**

| card | tier | rating | vs tier | lists | presence | seen | lift | cast when drawn |
|---|---|---|---|---|---|---|---|---|
| Clio, Lady of the Depths | prize | 3.72 | +1.22 | 8 | +9.0 | 2602 | +5.4 | 74% |
| The Usher | prize | 3.59 | +1.09 | 4 | +14.5 | 1776 | +3.8 | 64% |
| Vampire Nighthawk | 2 | 2.56 | +1.06 | 23 | +8.7 | 8945 | +3.7 | 88% |
| Control Magic | 3 | 3.06 | +1.06 | 8 | +1.7 | 2320 | +6.4 | 72% |
| Nekrataal | 2 | 2.46 | +0.96 | 7 | +16.6 | 2535 | +1.7 | 78% |
| Forgotten Cave | 1 | 0.19 | −0.81 | 8 | −12.6 | 2441 | −1.7 | 91% |
| Arc Mage | 2 | 0.77 | −0.73 | 9 | −12.2 | 3359 | −1.2 | 88% |
| Gray Ogre | 1 | 0.29 | −0.71 | 3 | −18.1 | 1243 | −0.9 | 94% |
| Disenchant | 1 | 0.31 | −0.69 | 2 | −9.3 | 334 | −4.8 | 30% |
| Scepter of Dominance | 2 | 0.85 | −0.65 | 2 | −16.1 | 861 | −1.7 | 82% |

(presence and lift in win-rate points.) Clio at the top of the whole pool agrees with what the Undertow showed. Vampire Nighthawk is the strongest evidence in the table: 23 lists, 8,945 sightings, positive on both terms. Control Magic's number is nearly all lift (+6.4 within its lists). Forgotten Cave and Gray Ogre are the presence term's confound — the lists that play them lose.

## A sample pack and pool

`pnpm booster --set plane --recipe classic --seed 7`: Angelic Destiny (3) · Rampaging Baloths (3) · Goblin Chieftain (2) · Counterspell (2) · Savannah Lions · Centaur Courser · Little Bear (2) · Gravedigger · Master Decoy · Wood Elves · Tranquil Thicket · Brute Force · Evolving Wilds · Shock · Wall of Air.

`pnpm sealed-pool --seed 7`: 90 cards, 68 distinct — W 11 · U 16 · B 11 · R 23 · G 17 · lands 12; tier 1 56 · tier 2 23 · tier 3 11. Across eight seeds a pool holds 6–11 tier-3 cards, 0–2 tier-R, 4–13 nonbasic lands and 0–5 colourless cards.

| set | recipe | T1 | T2 | T3 | R | total |
|---|---|---|---|---|---|---|
| plane | classic | 73 | 57 | 19 | 35 | 184 |
| first_bloom | classic | 72 | 54 | 11 | 24 | 161 |
| flood | rich | 73 | 57 | 19 | 35 | 184 |
| pair_wu | classic | 32 | 18 | 8 | 5 | 63 |
| pair_ub | classic | 29 | 26 | 7 | 6 | 68 |
| pair_wr | classic | 28 | 20 | 8 | 5 | 61 |
| pair_bg | classic | 33 | 24 | 8 | 6 | 71 |
| pair_rg | classic | 36 | 20 | 7 | 5 | 68 |
| pauper | pauper | 73 | 0 | 0 | 0 | 73 |

## Deviations from the brief
1. **The rating is measured fresh, not from the runs on disk** (Chris, kickoff). The campaign sweeps are text at lopsided entrances; the Open's round-robin logs casts but not draws. *Rule on*: nothing — ratified at kickoff.
2. **The rating has a second term the brief did not ask for** — *lift*: the pilot's result in games where the card was seen in hand, less that list's own win rate. The brief's presence term alone hands every card its list's strength. Both are blended half and half after shrinkage. *Rule on*: the blend's weights, or presence alone.
3. **"Cast rate when drawn" is reported, not blended** — a low rate (Disenchant 30%) is information, but folding it in would punish reactive cards for being held.
4. **`pnpm booster`, not `pnpm pack`** — `pack` is pnpm's own command and shadows a script of that name. `pnpm sealed-pool` is as the brief wrote it.
5. **The Flood's cards equal the Plane's.** By Chris's ruling the Flood is the First Bloom plus everything since Session 40, which is every non-prize card. The two sets differ only in recipe (Rich against Classic). *Rule on*: whether the Flood should instead carry a curated list, or stay as the Plane-under-Rich.
6. **The First Bloom is an id list by exclusion** — the Plane less the 23 non-prize cards in the pool registry's Session 40–46 sections; card data has no session marker.
7. **Rich's rare slot is Classic's** ({3: 0.8, R: 0.2}) — the formats doc gives "2 rares" without weights.
8. **The series' length and game one's coin are interim** — the series stops after N games (more wins takes it; level is a draw); the coin names the starting player outright where CR 103.1 has its winner choose. *Rule on*: both.
9. **A prize card's rating prior is R's (2.5)** — the brief's prior covers tiers 1, 2, 3 and R only.

## Concerns
1. **The rating's field is uneven, and it shows.** Thirty-card beasts and sixty-card Open lists play each other; the best list in the run is the mono-black slice (80%), and the Undertow is 66% here against 38% in the Open because mill is strong against thirty-card decks. The presence term carries all of that into the cards. The lift term does not, which is why I added it — but it has its own lean (cards are seen more in long games). v0 is fit for "play your bombs, cut your Disenchants"; it is not fit for close calls between playables.
2. **The first real correction is the Sealed sim, not more authored-list games.** Decks built from random pools have no author, so a card's lift there is free of the list confound. I would build `pnpm sealed-sim` in S48 beside the builder and treat v0 as the prior it updates — the shape Chris described at kickoff. Each row already stores its sample for that.
3. **"Everything below prizeOnly" keeps the Power and the legends out of every pack.** The Lotus, the Moxen, Time Walk, the High Grounds and the lords' legends are all prizeOnly, so tier R in a pack is 35 cards: the ten original duals, the Library of Alexandria, Demonic Tutor and 23 others (mostly the gold cards). A Classic pool's tier-R card is a dual land about three times in ten. That is what the brief specified; I flag it because "R at 0.2 in the rare slot" may read to the planner as "Power sometimes", and it is not.
4. **The browser's game rate is not on record.** The S46 handoff said "~7.5 games/s on six workers (implementer-notes)"; the notes hold no such figure. I repeated it into the plan's first draft before checking, and have removed it. Node runs ~20 games/s per process. S48 should time the Lab worker before deciding between a worker pool and running the other seats' series on the main thread.
5. **The deck editor is tied to the world.** Its spares read `world.player.collection` and its save writes `world.decks`. Giving it a pool source is a refactor of a large component, and it is the part of S48 most likely to overrun — the reason my estimate for S48 is "one session, tight; one and a half honest".
6. **Nonbasic lands in the common slots.** A Classic pool carries about ten nonbasic lands (the tier-1 cycling lands and Evolving Wilds). Not wrong, but it is ten of ninety cards that are rarely playables, and it is visible in the first pools.
7. **Tier 3 is nineteen cards** (eleven in the First Bloom; seven or eight in a pair set). Nothing obvious is *missing* yet — that read wants pools played, not pools printed — but an eight-seat pod opens 48 rare slots from 19 + 35 cards, so repeats will be the norm.
8. **ADR-144's text is already stale on one row**: it names the Undertow a pilot floor; with Clio it is 38%. The Larder is the one list left under 35%.
9. **`fillErrors` is conservative**: the First Bloom fails the Flat recipe on paper (eleven tier-3 cards, fifteen slots that *may* roll tier 3) though a real pack would almost never need more than four. If Flat is wanted for the First Bloom, the roll needs a fallback tier rather than the validator loosening.

## Registry entries added/changed
- **R-101** — the match series: CR 103.1 (who chooses the first turn across games) and 104.4a (the drawn game), both verified against the Comprehensive Rules this session; the series' length and the standings' points marked as tournament policy, interim.
- Pool registry: no rows changed (no cards this session).

## Test status
`pnpm test`: 85 files passed, 1 skipped; **815 tests passed, 2 skipped** (the two skips are the standing ones). New: `series.test.ts` (4), `packs.test.ts` (7, including the rating table's check). No fixtures re-baselined. `pnpm typecheck` and `pnpm build:web` pass. No fuzz this session — no new cards entered a deck.

Not verified: the series over `MatchController` (headless only); the browser worker's speed; any screen.

## Suggested next
**S48 — Sealed, a single event**, as the brief scopes it, in this order so the risky piece is found early:
1. The editor's source object (the refactor) — first, because it is the overrun risk.
2. `buildLimitedDeck` from the rating, with `pnpm sealed-sim` (200 pools → 200 decks → a round-robin) as its check and as the rating's first update.
3. `event.ts` — eight seats, three Swiss rounds, standings — headless end to end, saved and resumed.
4. The four screens (pool and build, pairings and standings, the series banner over `PlayMatch`, the prize).

If the session must shed something, shed the prize screen's content, not the save.

## How to run
```
pnpm booster --validate                              # the sets by tier; the data's errors
pnpm booster --set plane --recipe classic --seed 7   # one pack
pnpm sealed-pool --seed 7                            # six Classic packs (--json for the ids)
pnpm rating:run --offsets 30 --games 10 --shard 0/6  # the measurement (six shards → analysis/runs, local)
pnpm rating:build                                    # → data/convocation/card-rating.json + the report
npx vitest run packages/world/src/series.test.ts packages/world/src/packs.test.ts
pnpm typecheck && pnpm test
```
