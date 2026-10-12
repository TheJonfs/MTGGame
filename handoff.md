# Handoff — after Session 61 (2026-10-12)

## State of the world
The Open is fourteen lists with three pillars — Reaper Clio (72.2 in matches), Mardu Control (69.7), the Rabble (64.4) — then the Pall (55.5), the Writ (54.9) and Countersnake (54.0); the other eight stand between 33 and 47. Session 61 paid two debts: the pilot no longer runs a loop that hurts nobody into the engine's draw (book 124), and the sideboarding rules have an out-rule, adopted by the three lists it helps. The measuring tools live in the repo (`scripts/open/`). `pnpm typecheck`, `pnpm test` (1018) and `pnpm build:web` pass. **Nothing since `05ab495` is pushed: Chris is holding pushes for one larger push. Do not push until he asks.**

## Done this session
- **Part 0 — rulings and tools.** `docs/decision-updates/s61.md` records the block ratified by the brief and ADR-175 (the three pillars). **The scratch tools are in the repo**: `scripts/open/` — `rr.sh` (the shard launcher), `trials.py`, `mrep.py`, `g1.py`, `pair.py`, a README. `rr.sh` now refuses a tag that already has shard files, and puts the caller's arguments first (see Concern 1).
- **Part 1 — the loop that helps the opponent.** *Probe* (`open:rr` records every loop a seat runs: `logA.loops`): 23,908 games — the Usher pairings, the mirrors, and the eleven rules lists' match tables — held 3,062 turns with a loop, about 2,900 of two passes or more. Nearly all were killing loops, and every one of those was won. The failures were one small class: **eight games drawn**, each a loop that gained the looper life every pass and cost the opponent none (their Soul Wardens or Blood Artists gave back what the drain took) — 145 to 168 passes, to the engine's stall draw, with the looper far ahead on life. In every case the first aim was a choice (two or more legal targets). *Rule* — **book 124**: a loop is priced by what one pass does to BOTH life totals, lifegain read (`evaluator.legendLoopNet`: every "whenever a creature dies" and "whenever another creature enters" on both sides). It is worth the game when it takes life from them and we outlast it; worth a few passes when it only gains us more than them — and **stopped after ten passes** (the return is aimed at another card); a loss otherwise. A cast whose return would have nothing but its own copy to aim at is held when that loop is a bad one. Off: `loopnet`. *Measure*, 600 games a pairing on nine Usher pairings (5,400 games), paired: **drawn games 15 → 1**, loops of thirty passes or more 28 → 14, no win rate moved by more than 0.3 ± 0.4. **Ladder mirror gate PASS.** In the new tables of record: no loop draw in 22,637 games.
- **Part 2 — the sideboarding out-rule.** *Probe* (each rules list with no sideboarding, paired with the rules, 780 matches a list): the rules gain for the Writ (+6.9 ± 3.5) and the Depths (+7.6 ± 3.4) and are within ±3 of nothing for the other nine. Where they lose points, what left was what the brief expected — Walls of Blossoms (Reaper Clio, Countersnake), Typhoid Rats (the Pall), Shocking Sharpshooters (the Sweep) — against the small-creature decks. *Rule*, three words, each a switch (`AiSideboardTerms.out61`): `small` (against fifteen or more creatures of toughness two or less, a defensive card — more toughness than power, or a token-maker — never leaves), `spells` (and a spell leaves before a creature), `graveyard` (against a graveyard deck the hate comes in for spot removal first, and the creature rule does not bring that removal back). *Measure*, 150 matches a pairing, paired, on the pairings each word touches:

| list | `small` | `small` + `spells` | `graveyard` (the Pall pairing) | adopted |
|---|---|---|---|---|
| Reaper Clio | +2.6 ± 2.6 | **+3.0 ± 2.4** | 0 | small, spells |
| the Sweep | **+5.1 ± 2.7** | +5.1 ± 2.7 | **+7.3 ± 6.2** | small, spells, graveyard |
| the Warband | +0.2 ± 0.6 | +0.2 ± 0.6 | **+14.0 ± 8.1** | graveyard |
| Countersnake | −2.3 ± 2.8 | +0.3 ± 2.6 | −8.0 ± 8.0 | — |
| the Kiln | 0 | 0 | −14.0 ± 7.7 | — |
| the Depths | −1.0 ± 2.4 | −1.0 ± 2.4 | −1.3 ± 6.9 | — |
| the Muster | 0 | −1.9 ± 3.1 | +4.7 ± 7.5 | — |
| the Rabble, the Pall, the Writ, the Wurmspeaker | 0 | 0 | 0 or n/a | — (no swap of theirs changes) |

  Adoption is data (`outRules` in `open-contributed.json`, generated to `SIDEBOARD_OUT_RULES`, matched by the list's sixty). Game one is untouched by construction; the later-games column moved with the match column in every row.
- **Part 3 — the journey's Purge** (book 123; paired, the rule on against `--off laterpicks`). `flood-sim --refs postlairs` (60 games a seat): one deck holds it, the Cairnbrand Pyre's — **91 → 94, 87 → 91 and 58 → 66** against the three references, a Purge cast in 0.23–0.29 of its games; the thirty cells average 60.3 → 60.8 (S51: 60.6). `heart-sim --tide 1 --refs postlairs` (300 games a cell, twelve cells): the Manafleur's kill rate **89.8 → 90.8**, up in nine cells and down in none, a Purge in 0.10–0.15 of its games. Both CLIs gained `--off` and a Purge count.
- **Part 4 — smalls.** The single match's series, sideboarding and recording are a module (`ui/play/match-run.ts`) with a unit test (six tests: the loser chooses and the AI plays; one record a game; the AI's sideboarded sixty; the sideboard round trip and its refusals; the builder's fifteen for a deck without one; the recording's shape and its cap). `docs/deployment-size.md` scopes the deployment's size (recompressing the art in place takes 399 MB to about 170; hosting outside is the second option). The matchup grid shows the new tables.
- **The tables of record** (`analysis/runs/rr14_s61b.json`, `matches14_s61b.md/.json`; 100 games and 60 matches a pairing; pilot book 124): matches / game one — Reaper Clio 72.2 / 69, Mardu Control 69.7 / 61, the Rabble 64.4 / 59, the Pall 55.5 / 65, the Writ 54.9 / 49, Countersnake 54.0 / 51, **the Sweep 47.0 / 43** (44.2 before its out-rule), the Depths 44.5 / 45, the Levy 42.9 / 42, the Muster 42.0 / 44, the Kiln 40.6 / 43, the Tollgate 40.1 / 44, the Warband 39.0 / 41, the Wurmspeaker 33.2 / 40.

## The three pillars as registered

**Reaper Clio** — Four-Colour Snake Control (G B u r); `reaperclio`. 72.2 in matches. Sideboarded by the general rules with the S61 out-rule (`small`, `spells`).
- Spells (41): 4 Birds of Paradise, 4 Clio, Lady of the Depths, 4 Flametongue Kavu, 4 Manaba, 4 Rage Cobra, 4 Reaper's Forerunner, 4 Wall of Blossoms, 3 Mystic Snake, 3 The Reaper, 1 Black Lotus, 1 Mox Emerald, 1 Mox Jet, 1 Mox Ruby, 1 Mox Sapphire, 1 The Reeve, 1 Time Walk
- Lands (19): 4 Bayou, 4 Taiga, 4 Tropical Island, 2 Volcanic Island, 1 Badlands, 1 Cairnbrand, 1 Tallyflame Court, 1 Underground Sea, 1 Wrackroot
- Sideboard (15): 3 Tormod's Crypt, 3 Essence Scatter, 3 Savage Twister, 3 Putrefy, 1 Drana, Kalastria Bloodchief, 1 Faerie Formation, 1 Seraphina, the Initiative

**Mardu Control** — Usher Control (W B R); `marducontrol`. 69.7 in matches. Sideboarded by its guide alone (Chris's plan).
- Spells (40): 4 Blood Artist, 4 Soul Warden, 4 Vampire Nighthawk, 4 Vindicate, 3 Lumen, the Hearth Fire, 3 Restoration Angel, 3 The Jet Witch, 3 The Usher, 2 Phyrexian Purge, 2 Swords to Plowshares, 2 Wrath of God, 1 Black Lotus, 1 Demonic Tutor, 1 Mox Jet, 1 Mox Pearl, 1 Mox Ruby, 1 Sacred Helix
- Lands (20): 4 Badlands, 4 Godless Shrine, 4 Plateau, 4 Scrubland, 1 Blood Crypt, 1 Cairnbrand, 1 Obsidian Observatory, 1 Sacred Foundry
- Sideboard (15): 3 Tormod's Crypt, 3 Faerie Macabre, 3 Pyroclasm, 2 Flametongue Kavu, 1 Phyrexian Purge, 1 Sacred Helix, 2 Wrath of God
- Guide: against many small creatures and few large (the Rabble, the Muster, the Warband) — 3 Pyroclasm, 2 Kavu, 2 Wrath, 1 Helix for 2 Swords, 4 Vindicate, 2 Purge. Against small and large together (Reaper Clio, the Wurmspeaker) — the same eight for the 4 Soul Wardens and 4 Blood Artists. Against large creatures only — 2 Wrath and the Helix for 2 Swords and a Vindicate. Against a graveyard plan (the Pall) — 3 Crypt, 3 Macabre for 2 Swords, 2 Ushers, 2 Vindicate (and the Wraths and the Helix come in too: the Pall reads as large).

**the Rabble** — Mono-Red Goblins (R); `rabble`. 64.4 in matches. Sideboarded by the general rules.
- Spells (42): 4 Char, 4 Dragon Fodder, 4 Flametongue Kavu, 4 Goblin Chieftain, 4 Goblin Grenade, 4 Hordeling Outburst, 4 Lightning Bolt, 4 Raging Goblin, 4 Seasoned Pyromancer, 2 Siege-Gang Commander, 1 Black Lotus, 1 Mox Jet, 1 Mox Ruby, 1 Mox Sapphire
- Lands (18): 8 Mountain, 4 Badlands, 4 Volcanic Island, 1 Cairnbrand, 1 Tallyflame Court
- Sideboard (15): 4 The Ruby Tyrant, 3 Abrade, 4 Tormod's Crypt, 4 Faerie Macabre

## The top eight against each other (matches, 60 a pairing; the row's rate against the other seven)

| | vs the seven | Reaper Clio | Mardu Control | Rabble | Pall | Writ | Countersnake | Sweep | Depths |
|---|---|---|---|---|---|---|---|---|---|
| **Reaper Clio** | 66.1 | — | 48 | 85 | 62 | 63 | 71 | 65 | 68 |
| **Mardu Control** | 63.3 | 52 | — | 60 | 48 | 58 | 75 | 68 | 82 |
| **Rabble** | 58.9 | 15 | 40 | — | 57 | 77 | 58 | 81 | 85 |
| **Pall** | 50.5 | 38 | 52 | 43 | — | 50 | 43 | 65 | 62 |
| **Countersnake** | 44.6 | 29 | 25 | 42 | 57 | 45 | — | 53 | 62 |
| **Writ** | 43.3 | 37 | 42 | 23 | 50 | — | 55 | 53 | 43 |
| **Sweep** | 39.9 | 35 | 32 | 19 | 35 | 47 | 47 | — | 65 |
| **Depths** | 33.3 | 32 | 18 | 15 | 38 | 57 | 38 | 35 | — |

Reaper Clio over the Rabble reads 85 here (75 on the last table; 60 matches, so ±10 — her out-rule leaves her Walls in against it, and the paired measure of that at 150 matches was 0 to +9). At 900 matches Mardu Control is 56 over Reaper Clio and 57 over the Rabble.

## After the session — the tier-two format (working name "Penny"), explored with Chris (2026-10-12) — NOT PUSHED

Chris proposed tiers 1 AND 2 in place of Pauper's tier 1; the name may change (it is in two file names and no code). **The full write-up, with every list, is `docs/penny-experiments.md`** — bring that file to the planner with this one.

- **Tools:** `pnpm format:census --max-tier N` (what a tier ceiling leaves of the pool; how each Open list survives it) and `pnpm format:rr --field <file> --max-tier N` (a game-one round-robin of ANY set of lists: legality checked, a per-card cast count so a card the pilot never casts shows at once). The Open's own tools still need the format switch for sideboarded matches.
- **The pool:** 140 cards (Pauper: 75). All ten shock lands; no gold card, no legend, no power, no original dual. One sweeper (Pyroclasm), two counters, eleven removal spells, and the removal on bodies — Flametongue Kavu, Nekrataal, the Forerunner. Nothing costs more than five.
- **Three round-robins of first drafts** (the AI, game one, 200–300 games a pairing; Chris's four ideas, three ports, and nine more lists): **black-red removal on bodies is the best deck** (67 against a spread of eleven; 61 over the Rabble's port), as a family of builds; **UW Skies is its one even matchup** (50–54) and loses to every aggro deck (35–44), and could not be tuned out of that; **the Rabble's port, RG Stompy, the Muster's port and RW tokens are the aggro tier** (52–57); the two control decks (43–47), Naya Flash Snakes (48), hexproof auras (35) and block-and-mill (26) did not work. No card went uncast.
- **Draft lists a seed set could start from** (all in the write-up): BR Removal (two builds), Mono-Black Removal, the Rabble's port, RG Stompy, the Muster's port, RW Tokens, UW Skies (two builds), BW Aristocrats, Naya Flash Snakes, UB Control, UR Pyroclasm Control.
- **What the pool is missing** (eight items in the write-up, for the cards the next session may bring): a finisher or two at tier 2 (ramp and reanimation both have everything but a target — Rampaging Baloths, Pelakka Wurm, Baru, Serra Angel, Faerie Formation sit one tier up); a sweeper that kills toughness three or four and a real card-advantage spell (control has neither); sturdy threats against removal on bodies (one hexproof creature in the pool) — or the Kavu and the Nekrataal as the lever; a blocker of toughness five or more; depth in white (17 cards); a second mill engine; and the open question of whether the format is meant to have a combination deck at all.
- **Two cautions:** black mirrors drew 18% of their games at the turn limit (deathtouch blockers and lifelink that will not attack each other — the Tollgate's problem again); and these are first drafts in the AI's hands, the same pilot that gets 39% from a deck Chris went 8–0 with.

## Deviations from the brief
1. **Part 1's rule has a third clause the brief did not ask for.** "Started only when positive for us and not more positive for them, tested each iteration" lets the commonest failure through: a loop that gains us two a pass and costs them nothing passes that test every time and runs to the draw. The rule stops such a loop after ten passes. And a loop in which both sides bleed is run only when they die first.
2. **Part 2's rule is three switches, adopted per list — and one of them points both ways.** `graveyard` gains fourteen for the Warband and loses fourteen for the Kiln on the same pairing. It is adopted where it measured a gain, as the brief says; it is not a rule about graveyard decks. The brief's "a creature with power ≥ toughness" is the complement of `small`'s defensive test, not a separate step.
3. **Part 3 is read paired** (the rule on against off, same seeds), not against S51's baselines: the S51 figures were other cells (the heart at 50 life against the stock references) and are quoted where they compare.
4. **"No sideboarding" was run with `--sideboarded-only`** (every other list sideboards; the list under test does not), not an empty guide — the same thing without a file a list.
5. **The Pauper read is in Suggested next**, from a census script that was not kept.

## Concerns
1. **Every table launched through the scratch `rr.sh` ran at seed 56, whatever `--seed` said** — `open:rr` reads the FIRST occurrence of a flag and the script put its default first. The tables of record since S59 are all seed 56 (consistent with each other, so every paired trial run through the script held); the handoff's "seed 91" for them was wrong. Runs started directly (the 900-match confirmations, this session's probes) used the seed given. The repo's `rr.sh` puts the caller's arguments first.
2. **The Tollgate's games do not end.** 128 of the tables' 22,637 games were drawn at the hundred-turn limit, every one a Tollgate pairing (the Warband 39, Countersnake 37, the Muster 29, the Depths 13) — its Minefield against decks that cannot attack through it and cannot remove it, and no way for it to win either. A drawn game is half a win to each side, so its 40.1 is partly this. ADR-174's count for it has begun; this is what the count will find.
3. **Single cells at sixty matches are noise, and the probe showed it.** "Reaper Clio is fifteen points better against the Rabble with no sideboarding" (60 matches) was 0 at 150. Nothing was adopted on a cell; the adopted rows are sums over the pairings a word touches, and the Warband's is one pairing at 150.
4. **An adopted out-rule is matched by the list's sixty** — a field seat's tinkered copy sideboards by the plain rules (as a guide is matched by its fifteen). If tinkered copies should carry it, the match wants to be by key through the event.
5. **The forced-cast clause of book 124 never fired** in 5,400 games (the two measures with and without it are identical). It is the Hearth game's exact shape and is kept for that; it has no measured effect.
6. **Nine games in the tables ended with both players at zero or below** (reason `DRAW`) — simultaneous deaths, mostly the Rabble's burn against a lifelink swing. Correct by the rules (CR 104.4a); noted because the count looked like loop draws until read.
7. **A single game played on the draw is still not recorded** (the recorded-games tools read seat 0 as the human); matches always are.

## Registry entries added/changed
- Rules registry: none (R-103's second count is post-S60, ratified by this brief).
- Pool registry: none.
- Books: **124** (`book-of-shame.test.ts`); book 99's read survives as the switch `loopnet`.
- Data: `open-contributed.json` gains `outRules` (and its note).

## Test status
`pnpm test`: 117 files, **1018 passed**, 2 skipped (the runner reports worker time-outs under load — "Errors 4" — with no test failing; they appear when the suite runs on a busy machine). New: book 124; `ui/play/match-run.test.ts` (6). No fixture re-baselined. Ladder: mirror gate PASS (233 s).

## Suggested next
- **Pauper (S62) — the implementer's read of what `maxTier: 1` leaves.** 75 cards of the Open's 239 (basics apart): green 19 (14 creatures), blue 15, red 13, white 11, **black 8**, colourless 3, six lands. *By role:* 44 creatures, of which **two have power three or more** and none costs more than four; five removal spells (Terror, Shock, Blaze, Abrade, Airship Crash) and Pacifism; **one counterspell** (Essence Scatter); three card-draw spells (Ponder, Divination, Thought Scour). *Mana:* the six lands are the five cycling lands and Evolving Wilds — **no dual land**, so a two-colour deck is basics and four Wilds. *What carries over unchanged:* the engine and the pilot; `narrate`, `play-diff`, the single match (it offers Open lists only — a Pauper category is a line in `play-decks.ts`); the match series; the loop and Purge books are moot (no Usher, no Purge). *What needs a format switch first:* `open:rr`, `open:gen`, `sideboard:show` and the tables of record are hard-wired to the Open's lists and to `OPEN_FORMAT` for a built fifteen — the first S62 task is "a format's lists" as a parameter. *What will misfire:* the guide shapes are scaled to the Open — `small` (fifteen creatures of toughness ≤ 2) will be true of nearly every Pauper deck and `large` of none; the sweeper and steal shapes have no cards to bring in; graveyard hate has no target. *The rating problem, yes:* the tier-1 shelf's ratings run 0.8 / 1.1 / 1.2 at the quartiles against the Open's 1.2 / 1.6 / 2.5 — the whole shelf sits inside half a point, so "the lowest-rated card leaves" and the builder's "better only" are close to arbitrary there. The rating is a Limited score: it says a common is playable, not which common. A Pauper rating from Pauper games (the S51 method on seed lists) should come before any rule that ranks tier-1 cards. *The Open's lists are no head start:* the Muster shares 20 of 48 nonbasic cards with the shelf, the Wurmspeaker 18 of 40, the Rabble 12, the rest five or fewer. Expect white and green weenie, blue fliers with the one counter, and red burn that is three spells deep; black is a splash.
- **The Tollgate** (Concern 2): a turn-limit draw is a result worth a rule or a ruling before its ADR-174 count ends.
- **Recompress the art** (`docs/deployment-size.md`, option A) before the larger push, if the storage cap still matters.
- Still owed: a journey played through a sitting (S59); the sideboarding "creatures" rule for the nine lists the rules do nothing for (the probe says they could run none at no cost).

## How to run
```
pnpm install && pnpm typecheck && pnpm test          # FUZZ_FULL=1 pnpm test for the full fuzz
pnpm viewer                                          # the app (dev); pnpm build:web before any push
pnpm ladder                                          # the AI gate — alone, ~4 min
scripts/open/rr.sh rec 100                           # game one, every pairing, 8 shards → analysis/runs/scratch/rr/
scripts/open/rr.sh m 100 --matches 60                # matches
pnpm open:rr --merge analysis/runs/scratch/rr/rec_?.json --out analysis/runs/rr.json          # then copy the means into OPEN_MEANS
pnpm open:rr --matches-report analysis/runs/scratch/rr/m_?.json --record --out analysis/runs/matches.md
pnpm open:gen && pnpm reference                      # after any change to data/convocation/open-*.json
pnpm open:rr --only <list> --vs a,b --matches 150 --out61 small,spells,graveyard --out61-for <list>   # an out-rule on trial
pnpm open:rr … --off loopnet                         # book 124 off (also laterpicks, and every earlier switch)
pnpm open:rr … --progress | --match-only N | --trace-after N                                  # a game that never ends
pnpm sideboard:show --list <list> --vs a,b [--out61 small,graveyard]
pnpm narrate <recorded.json> ; pnpm play-diff <recorded.json>
pnpm flood-sim --refs postlairs [--off laterpicks] ; pnpm heart-sim --tide 1 --refs postlairs [--off laterpicks]
```
