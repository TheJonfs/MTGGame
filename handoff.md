# Handoff — after Session 70 and its post-session work (2026-10-31)

## State of the world
Session 70's High Grounds and Chris's cards are in, and post-session work has gone on top: Convocation days can be Sealed as well as Draft; five tier-2 creatures; the rail's "tap for mana" toggle (any priority, so the Sapwell Dryad accelerates); **Highland Ritual** in the pool (303 cards); and **the Pinnacle**, Chris's Valakut list, sixteenth list in the Open at 61.3 in matches, fifth. Valakut, Burnfallow and Earthrise finally have a real seat. `docs/decision-updates/s70.md` is the full record, section by section. Run with `pnpm viewer`; tests with `pnpm test`.

## Done this session
**Session 70** (the commits to baeb0eb; details in the decision update): names, art and printed faces of the five High Grounds; R-118 to R-121; book 152 `groundtiming`; Chris's tuning rulings; Thought Replacement (book 153), Valakut, Balance and Wheel (book 154), Earthrise.

**Post-session, this round** (Chris's direction throughout):
- **Tap-for-mana toggle** on the bottom rail: lands tap at any priority when on; `packages/ui/src/play/tap-for-mana.test.ts`.
- **Highland Ritual** ({1}{R} sorcery, add {R} for each Mountain, Mountaincycling {2}, tier 1): three study rounds priced it, R-122 `addMana.times`, book 157 `burstx`, book 158 `burstcycle`, stained-glass art and Chris's printed face, read word for word. The plain card's +6.0 at {R} against +1.2 at {1}{R} is the study's headline.
- **Angel of the Ruins' plainscycling** had been unreachable since S36 (general rule answered first). `typedcycle` fixes it: ladder PASS, win rate unchanged within noise (+0.1 ± 1.9, +0.3 ± 1.4; seated without their plans).
- **Chris's Valakut run read** (8–0, 16–3 on Normal) by `pnpm narrate`. Book 159 `pendingdraw` (the Witch's stacked draws count toward a full hand); book 160 `burnhold` (no burn at a spent 1/1 body). Ladder PASS; 21,000 paired games level, every list −0.3 to +0.6.
- **The Pinnacle registered**: his 60 less Arc Mage, Whelp and a Blaze, plus two Doses and the fourth Kavu; fifteen less two Doses plus two Rage Cobras. 63.0 against 55.6 as played (AI's hands, 2,100 matches). Open tables of record re-run with sixteen lists.

## Deviations from the brief
Post-session work had no brief; Chris directed it. Session 70's stand:
1. **The copy word is R-118, not R-117** — R-117 is the Meathook Massacre's `xPaid × −1` (post-S68).
2. **Names and art were done before the studies** (Chris), and the style ceremony was four styles across the five, not four candidates per card.
3. **The triad stage was not run** (Chris). Volmaw and Ranksmere still have no real Open seat; their triad reads are owed.
4. **Nightbower's nominal is {X}{B}{G}** and **Burnfallow's is card (b)** (Chris). Card (a) stays a study def (`data/cards-study/burnfallow_ping.json`).
5. **Cloudshift and the brief's archetype slots were not done**; Chris's cards took the session's second half.
6. Valakut's fixtures were written before its fuzz (the order reversed; noted).

Post-session decisions that were the implementer's, for ruling: **the fourth Kavu** for the Blaze slot (by trial), and **the Pinnacle's name, key and title**.

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

## Registry entries added/changed
- **Rules**: R-118 to R-121 (S70); R-122 `addMana.times`. `otherLand`, `nonland`, `landCard`; target predicate `land`.
- **Pool**: the S70 cards as before; five tier-2 creatures (shevelport_quartermaster, burnfallow_exuberant, notion_flayer, den_of_vipers, sapwell_dryad); highland_ritual (T1). `red_ritual` stays a study def for the harnesses.
- **The Open**: `pinnacle` in `contributed.json`.

## Test status
**1,198 passed**, 2 skipped; typecheck clean. New since S70: `sim/s70-highland-ritual(-fuzz)`, `ui/play/tap-for-mana`, `s70-tier2-five(-fuzz)`; books 155–160. Re-pinned: the pool count (303), the shop tally. `pnpm test` still exits non-zero on five vitest "onTaskUpdate" errors, the known load errors (no assertion fails); `s62-fuzz` is the slowest file at 230 s.

## Suggested next
- **The prize flow**: a High Ground or Balance as a champion's prize is one row in the prize table and one line in the fence. Which Convocation pays which ground is the planner's.
- **The triad reads owed**: Volmaw in the Undertow and Sultai Mill; Ranksmere in the Aerie and the Roll. Burnfallow's now has the Pinnacle as a seat.
- **The Pinnacle against Mardu Control and the Rabble** (37 and 35 in trial): Chris's own lost games were to the Usher. The Rage Cobra slots are unproven; Chris should play the list as registered.
- **Chris on Hard**: the 16–3 was on Normal.
- The consequence model (ADR-191) remains the next pilot work.

## How to run
```
pnpm install && pnpm typecheck && pnpm test          # FUZZ_FULL=1 pnpm test for the full fuzz
pnpm viewer                                          # the app (dev); pnpm build:web before any push
pnpm ladder                                          # the AI gate — alone, ~5 min
python3 scripts/open/trials.py analysis/s70/trials-open-2.txt   # paired game-one trials (tag|list|swap|flags|baseline)
pnpm open:rr --only <list> --swap "<list>:<from>:1:<card>~acost=…~n=…" --extra-cards data/cards-study   # a card's corner in a list
pnpm art:fetch                                       # after adding a real card (oracle text + scan; OVERRIDES pin a printing)
python3 .claude/skills/gemini-image/render.py --entity-file docs/art/subjects/<file>.md --no-style   # a card-art candidate
pnpm open:rr --off groundtiming,teamcounters,shrinkplan,payoffcost,sweepwait,burnhold,pendingdraw   # rules off for a paired read
pnpm narrate <recorded-games.json> --event <seed>    # a recorded run, move by move
```
