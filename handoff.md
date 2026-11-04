# Handoff — Session 71 in progress (after Session 70 and its post-session work; 2026-11-03)

## State of the world
Session 70's High Grounds and Chris's cards are in, and post-session work has gone on top: Convocation days can be Sealed as well as Draft; five tier-2 creatures; the rail's "tap for mana" toggle (any priority, so the Sapwell Dryad accelerates); **Highland Ritual** and **Molten Rain** in the pool (304 cards); **the Pinnacle** and **the Minefield**, Chris's two Valakut lists, in the Open (60.6 and 56.9 in matches, fifth and sixth of seventeen; they beat different fields), the Minefield also in Naya. Books 161 (Lumen's steal) and 162 (land destruction's aim) are in. **Session 71 is under way**: Part 0's rulings, the prize flow (ADR-194), and Part 1's two probes are done — they found no single shape of decision the pilot misprices and no edge on the opponents' side; Part 2 waits on the planner. Chris's **Confession** ({1}{B}, tier 2) is in the pool (305 cards). `docs/decision-updates/s70.md` is the full record, section by section. Run with `pnpm viewer`; tests with `pnpm test`.

## Done this session
**Session 70** (the commits to baeb0eb; details in the decision update): names, art and printed faces of the five High Grounds; R-118 to R-121; book 152 `groundtiming`; Chris's tuning rulings; Thought Replacement (book 153), Valakut, Balance and Wheel (book 154), Earthrise.

**Post-session, this round** (Chris's direction throughout):
- **Tap-for-mana toggle** on the bottom rail: lands tap at any priority when on; `packages/ui/src/play/tap-for-mana.test.ts`.
- **Highland Ritual** ({1}{R} sorcery, add {R} for each Mountain, Mountaincycling {2}, tier 1): three study rounds priced it, R-122 `addMana.times`, book 157 `burstx`, book 158 `burstcycle`, stained-glass art and Chris's printed face, read word for word. The plain card's +6.0 at {R} against +1.2 at {1}{R} is the study's headline.
- **Angel of the Ruins' plainscycling** had been unreachable since S36 (general rule answered first). `typedcycle` fixes it: ladder PASS, win rate unchanged within noise (+0.1 ± 1.9, +0.3 ± 1.4; seated without their plans).
- **Chris's Valakut run read** (8–0, 16–3 on Normal) by `pnpm narrate`. Book 159 `pendingdraw` (the Witch's stacked draws count toward a full hand); book 160 `burnhold` (no burn at a spent 1/1 body). Ladder PASS; 21,000 paired games level, every list −0.3 to +0.6.
- **The Pinnacle registered**: his 60 less Arc Mage, Whelp and a Blaze, plus two Doses and the fourth Kavu; fifteen less two Doses plus two Rage Cobras. 63.0 against 55.6 as played (AI's hands, 2,100 matches). Open tables of record re-run with sixteen lists.
- **WB Basilisk registered in Peasant** (2026-11-01, `wbbasilisk`): Chris's run went 5-0 in the Swiss and out in the quarterfinals, 11-3 in games. His list with 3 Plains and 1 Swamp for the 4 Thought Replacement; his fifteen; no guide. Peasant's tables re-run with fifteen lists: Dungrove Auras 68.3, BR Removal 61.4, White Skies 61.0, BR Djinn 60.8.
- **Chris's Naya Valakut run read** (15–1, Champion of the Umbel, Sealed/Open/Sealed/Open on Normal): the Umbel's two-Usher loop and its break (Lotus, Helix, Crypt on the stack); his Burnfallow count (sacrificing a Mountain nets one — no line made six that turn; the game was lost either way).
- **Book 161 (`threatswing`)**: Lumen took a Wall of Blossoms fifteen times and attacked with none. A steal now needs a swing (no defender, no zero power, no body softer than a ready Lumen, unless it is the blocker between our attackers and lethal). +1.06 ± 0.36 over 13,600 paired matches in every active Lumen list of four formats; ladder PASS. Book 26's fixture moved from a Bear to a Hill Giant.
- **The Minefield** (`minefield`, working name) registered in the Open (his 75) and in Naya (no Crypts or Macabres; 2 Drakuseth, 2 Bolt, 2 Char — the AI's rules bring Swords in for Walls at −2.6 ± 1.4, and these never come in). The Open's tables re-run with seventeen lists: Mardu Control 73.5, Reaper Clio 69.6, Emerald Snakes 65.1, the Rabble 62.1, the Pinnacle 60.6, the Minefield 56.9. Naya's were not re-run.
- **The land destruction study** and **book 162 (`landhit`)**: the evaluator prices every land at 0.5; a land that does more than make mana now earns +1.5 destroyed, any land +0.4 while they hold three or fewer. Vindicate lists level; ladder PASS. Implode, Lay Waste and two Molten Rain bounds (`data/cards-proposed/ld/`) as two main-deck copies in the Rabble and the Warband: all at or below zero (the casts aim right — 30 of 76 at Valakut — but come late, median turn 11.5); the rider is worth about three points.
- **Molten Rain** (TSR #348, the old frame; tier 2; no list yet): R-123 — `damage.to: "controllerOfTarget"` and the `if`'s `nonbasic`, read from the snapshot (CR 608.2h). Fuzz 320 games, four fixtures; the Peasant score rebuilt (1.18).

**Session 71, so far** (`docs/decision-updates/s71.md`):
- **Part 0**: the rulings recorded; ADR-193 already held (Balance and Wheel entered restricted).
- **ADR-194, the prize flow**: a journey Convocation's champion chooses a High Ground — of the ten after the full, of the five still-pair grounds after the short, a second on Hard — as a `ground` outbox entry that passes the fence; the journey pays each ground once. `ui/convocation/ground-prize.test.ts`. Not walked in the browser.
- **Part 1, the consequence probe** (`pnpm play-diff --consequences`; `analysis/s71/consequences-report.md`): five runs, 2,119 differences, four playouts a side — Chris's line is +0 to +3 points over the pilot's in every shape of every run, within noise; no shape ranks.
- **Part 1, option 3 — the opponents' side** (Chris; `pnpm pilot-probe --opponents`; `analysis/s71/opponents-report.md`): the pilot in Chris's seat against his recorded opponents' decks wins 48% (the registered lists 44%); Chris won 86%. The field is the master AI with no edge; its decks are 3.7 cards from the registered lists and about as strong (Peasant's weaker, +20). The gap is in the seat.
- **Confession** (Chris): priced by trial against Sign in Blood in three Peasant hosts (every cost level; Chris took {1}{B}); R-124 (the greatest-power target filter, `targetToughness`, a draw count as an Amount); book 163 `readtarget` (a target only read is no misaim — it had never been cast); his printed face and the cropped art installed; fuzz 320 games; the Peasant score rebuilt (2.06).

## Deviations from the brief
Post-session work had no brief; Chris directed it. Session 70's stand:
1. **The copy word is R-118, not R-117** — R-117 is the Meathook Massacre's `xPaid × −1` (post-S68).
2. **Names and art were done before the studies** (Chris), and the style ceremony was four styles across the five, not four candidates per card.
3. **The triad stage was not run** (Chris). Volmaw and Ranksmere still have no real Open seat; their triad reads are owed.
4. **Nightbower's nominal is {X}{B}{G}** and **Burnfallow's is card (b)** (Chris). Card (a) stays a study def (`data/cards-study/burnfallow_ping.json`).
5. **Cloudshift and the brief's archetype slots were not done**; Chris's cards took the session's second half.
6. Valakut's fixtures were written before its fuzz (the order reversed; noted).

Session 71's: **the probe was built in `play-diff`** (the brief named `pilot-probe`); **Part 2 was not started** — the probe ranked no shape, so what Part 2 builds is the planner's (the report's three candidates; Chris chose the opponents' side as the first, now done); **Part 3 (the triad reads) not started**. The brief predates 2026-11-03's books 161–162, the Minefield, Molten Rain and R-123.

Post-session decisions that were the implementer's, for ruling: **the fourth Kavu** for the Blaze slot (by trial); **the Pinnacle's and the Minefield's names, keys and titles**; **book 162's weights** (1.5 and 0.4, unmeasured alone); **the Naya fifteen** read from the AI's rules, not from Chris's play.

## Concerns
1. **The AI does not pilot Chris's sideboard plan.** The Pinnacle's guide read from his swaps measured 57.8 against the rules' 63.0, so it has no guide. +8 against the Rabble says the `small` rows are worth more study alone. Measured through `--deck-guide`, which is suspect against `control` lists (S69 Concern 3, unchased).
2. **Books 159 and 160 are pins, not gains**: level on 21,000 paired games. Book 160's reach is narrow by design; a wider burn hold is unmeasured.
3. **The Pinnacle's trials sat in the Wurmspeaker's chair**, so those numbers lack that pairing; the tables of record have it. Its game-one record reads 53 in the round-robin and 56.3 in the match table, seeds apart.
4. **The ritual audit's win rates (54%) do not match the grid's (36%)**: undiagnosed; only its window counts were used.
5. **Highland Ritual's Peasant score (0.35) was built with cycling {1}{R}**, before Chris's correction to {2}. Minor; it refreshes on the next rebuild.
6. **The Ossuary's and Larder's read of the Angel fix** was without their plans, as they are not in the field: a weak test of the fix.
7. **One restricted copy moves this pilot about a point** (Time Walk +0.6/+0.8 in Temur), so restricted studies read near the noise at 100–200 games a pairing.
8. **Hearthspire is the strongest High Ground** (+6.1, +2.8, +9.6 in the Open at the nominal). Chris kept 2 damage. It did work in the Pinnacle's lost game one.
9. **The intervening if is read at trigger placement, not at the event** (R-120's named simplification); Balance's players choose in seat order, not active player first (R-121's).
10. **The predictor prices a land search flat (0.5)** whatever it fetches, so a ramp list's two lands are under-read. The Pinnacle plays through this.
11. **The consequence model (ADR-191)** is unchanged.
12. **The AI cannot pilot WB Basilisk**: 29.5 in matches, last of fifteen, against Chris's 11-3 (5-11 against the two UW Skies lists, 0-1 against White Skies, where he beat UW Skies, walls 2-0). Registered knowingly, to be found and tweaked (Chris). It is an active list, so AI seats can draw it. The moving of a Collar to an untapped first striker is the line to read first. Three builds at 1,300 matches: as played 21.8, 2/2 29.9, 3/1 31.6 (±2.5).
13. **Land destruction in the pilot's hands is late.** It aims well (book 162) but casts at a median turn 11.5; nothing makes it a turn-three play against a ramp deck. Molten Rain's real test is a sideboard row against Valakut lists, and no guide shape names a land (only `plan` could carry it).
14. **Both Valakut lists read below Chris**: the Minefield 22 against Mardu Control in matches, against his four match wins over it in the run; the Pinnacle 30. The Minefield's Walls, Minefields and Wrath timing are ADR-191 probe material.
15. **The Naya fifteen is the bare nine for the AI**: its rules use none of Drakuseth, Bolt or Char, and Swords would cost points. A guide would be the way to use them, if any is wanted.
16. **Chris's records are the seat, not the field**: no single decision shape and no opponents' edge explains 86% against 48%. What neither probe separates — mulligans, sequencing over turns, the next turn's plan — is where Part 2 would look next; a probe of whole turns is the candidate.
17. **Confession at {1}{B} measured level with Sign in Blood** in the AI's hands at every cost; the pips did not separate in two-colour hosts. Chris's play is the test of {1}{B}.
18. **The probes' trials met a zsh trap**: `$h:child_of_night` reads `:c` as a modifier — braced variables (`${h}`) in loops. Two runs were lost to it before it was seen.

## Registry entries added/changed
- **Rules**: R-118 to R-121 (S70); R-122 `addMana.times`; R-123 (Molten Rain's two words); R-124 (Confession's three). `otherLand`, `nonland`, `landCard`; target predicate `land`.
- **Pool**: the S70 cards as before; five tier-2 creatures (shevelport_quartermaster, burnfallow_exuberant, notion_flayer, den_of_vipers, sapwell_dryad); highland_ritual (T1); molten_rain (T2, TSR #348); confession (T2, custom). `red_ritual` stays a study def for the harnesses; the land destruction bounds in `data/cards-proposed/ld/`.
- **The Open**: `pinnacle` and `minefield` in `contributed.json`. **Naya**: `minefield` in `formats/naya/lists.json`.
- **Peasant**: `wbbasilisk` in `formats/peasant/lists.json`.

## Test status
**1,215 passed**, 2 skipped; typecheck clean (`ui/convocation/ground-prize`, `sim/greatest-power-draw`, `sim/confession-fuzz`, book 163 since the last count; the pool 305, the tally's tier 2 88). New since S70: `sim/s70-highland-ritual(-fuzz)`, `ui/play/tap-for-mana`, `s70-tier2-five(-fuzz)`, `sim/molten-rain(-fuzz)`; books 155–162. Re-pinned: the pool count (304), the shop tally, book 26's target. `pnpm test` still exits non-zero on five vitest "onTaskUpdate" errors, the known load errors (no assertion fails); `s62-fuzz` is the slowest file at 230 s.

## Suggested next
- **The triad reads owed**: Volmaw in the Undertow and Sultai Mill; Ranksmere in the Aerie and the Roll. Burnfallow's now has the Pinnacle as a seat.
- **Session 71's Part 2**: the planner's call after the two probes; a probe of whole turns (Chris's turn against the pilot's, played out) is the next grain. Part 3's triad reads and Part 4's re-run tables remain.
- **Confession into a list**: Chris's play first; the trial's hosts (Mono-Black, BR Removal, BW Aristocrats) are where it read level with Sign in Blood.
- **The Pinnacle against Mardu Control and the Rabble** (30 and 20 in the tables): Chris's own lost games were to the Usher. The Rage Cobra slots are unproven; Chris should play the list as registered.
- **Molten Rain into a list**: a sideboard row against the Valakut lists (or a `plan`-shaped guide) is the test the main-deck trial was not.
- **Naya's tables** with the Minefield in the field.
- **WB Basilisk as registered**: Chris has not played the 24 lands. Whether to archive it from the field is his call if it reads badly as an opponent.
- **Chris on Hard**: the 16–3 was on Normal.

## How to run
```
pnpm install && pnpm typecheck && pnpm test          # FUZZ_FULL=1 pnpm test for the full fuzz
pnpm viewer                                          # the app (dev); pnpm build:web before any push
pnpm ladder                                          # the AI gate — alone, ~5 min
python3 scripts/open/trials.py analysis/s70/trials-open-2.txt   # paired game-one trials (tag|list|swap|flags|baseline)
pnpm open:rr --only <list> --swap "<list>:<from>:1:<card>~acost=…~n=…" --extra-cards data/cards-study   # a card's corner in a list
pnpm art:fetch                                       # after adding a real card (oracle text + scan; OVERRIDES pin a printing)
python3 .claude/skills/gemini-image/render.py --entity-file docs/art/subjects/<file>.md --no-style   # a card-art candidate
pnpm open:rr --off groundtiming,teamcounters,shrinkplan,payoffcost,sweepwait,burnhold,pendingdraw,threatswing,landhit   # rules off for a paired read
pnpm narrate <recorded-games.json> --event <seed>    # a recorded run, move by move
pnpm play-diff <recorded> --event <seed> --consequences --playouts 4 --out r.md --json r.json   # S71's consequence probe
pnpm pilot-probe --opponents --recorded <recorded> --event <seed> --archetype midrange --games 8   # S71's opponents' side
```
