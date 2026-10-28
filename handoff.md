# Handoff — after Session 69, with the post-S69 work (2026-10-28)

## State of the world
Twelve Constructed fields with tables: the Open, Peasant, and the ten triads — and Chris has now played (and contributed a list to) **all ten triads**. Since S69: five lists of his registered with measured guides (Massocrafts in Sultai, BW Massacrats in Abzan, Temur Control in Temur, Sour Worms in Bant; Mono-Black Clio, Massacrats and Sacred Minefield before), three pilot books (149–151), and a play-screen shortcut (drains auto-aim at the opponent). The pilot now predicts a −X/−X sweep and the life its deaths move (book 151). Tests: `pnpm test` (1,142 passed). Ladder PASS after books 149–150 and after book 151.

## Done this session
S69 itself (pushed 2026-10-21) — the brief's four parts:
- **Part 0**: S68's deviations ratified; ADR-190; Chris's four kickoff rulings.
- **Part 1 — the batch**: Sultai, Abzan, Temur, Bant — forty lists, tables, frozen thresholds, doors. Only the Sower in Bant Sower adopted among the lords.
- **Part 2 — the defence**: `sweepwait` (book 147) and `payoffcost` (book 148) adopted; `blockloss` (book 146) trial only.
- **Part 3 — the read**: the red race unmoved; the ten-triad read.

Post-S69 (Chris's runs; `docs/decision-updates/s69.md` has every number):
- **Temur Snakes** (the `reaper` key renamed); top-four matrices per new format.
- **Massocrafts** (Sultai, 8–0): guide measured four ways; Protocols for Birds/Manaba and the Massacres for the Witch and a Keeper against the Clio lists (+4.6).
- **Play screen — drains aim at the opponent**: a trigger whose targets are all players and whose every effect on the target is life loss or damage goes on the stack at the opponent (Blood Artist); anything else asks (Hedron Crab's mill); menu toggle, default on (`play/auto-aim.ts`).
- **Books 149–150**: `teamcounters` (a team +1/+1 counter bought at their end step, any team — the lone Isaura; S40's book 61 pin reversed, old reading under `off`); `shrinkplan` (a shrink counts our shrinks on the stack).
- **BW Massacrats** (Abzan, 8–0): guide +5.2 over the rules. Pilot measure 41.2 before book 151, 49.0 after; BW Aristocrats 47.2. **Chris's ruling: both stay** (Massacrats better against the field 50.7–45.0, Aristocrats better head to head 67–33); hybrids later.
- **Book 151 — the −X/−X sweep predicted**: `sweepPT` and `deathPayoffs` in `view-sim.ts` (every DIES payoff, both sides, the dying included; Wrath's prediction reads it too); X=0 allowed for a noncreature permanent with an ability that does not read X. Paired: BW Massacrats +7.9, Massacrats +4.1, Massocrafts +6.1. Abzan, Grixis, Sultai tables re-run.
- **Temur Control** (Temur, 8–0): guide +3.6 over the rules; Chris's main stands (two Pyroclasms for the Doses −1.9; a third Kavu for the Char +2.2 ± 1.5, under the bar). Temur table: 53.9, sixth.
- **Sour Worms** (Bant, 8–0): guide trimmed to its Control Magic rows (+2.2 over the read guide; the deathtouchers against the Aura decks cost ~10 there); Swords for Protocols a wash. Bant table: 58.0, third.

## Deviations from the brief
1. **`blockloss` not adopted** (S69 Part 2): measured negative against the Rabble; `trial: ["blockloss"]`.
2. **`sweepwait`'s bar is half the card's mana value**, and "the race forces it" reads three turns.
3. **"Losing the race" reads only the opponent's clock.**
4. **Bant Sower without Clio; Bant Auras with Pacifism for Protocol.**
5. Temur's derived `large` threshold set to 2 (ADR-186 amended).
6. Post-S69, unbriefed and Chris-directed: books 149–151 and the auto-aim — each with its paired read and the ladder.

## Concerns
1. **The pilot's consequence model is shallow** (Chris, on book 151: "a broader theme"). Book 151 covers one shape — a scoped shrink and its drain/gain payoffs. Still flat or absent in `view-sim`: damage payoffs beyond drain/gain (a DIES trigger that deals damage, makes a token, draws), the life a sacrifice outlet's payoff moves, triggers off a spell's own resolution chain. Each Massacre-type gap sat unseen until a human list measured far below its human record — **a list whose pilot number is far below Chris's record is the probe to run first.**
2. **Sacrifice-cost pings skip the ping plan**: the Rabble's Siege-Gang shot a 4/1 Wall twice (two Goblins) in Chris's Temur semi-final — `pingPlanGated` covers repeatable abilities without a sacrifice only.
3. **`--deck-guide` drift against `control` lists**: Sour Worms' same-path check lost 9.7 against the two counter decks (its test guide's Control Magic rows did not fire); not chased. Adopted guides were confirmed on the registered path.
4. **The red race is a field question** (S69 Concern 1, unchanged): more answers in the seeds, not more pilot.
5. **Chris's lists rank well below his records in the pilot's hands** (Temur Control 53.9 to his 16–2; Sour Worms 58.0; BW Massacrats 49.0): the pilot underplays control and engines. The tables measure the pilot as much as the lists.
6. The Massacrats and Mono-Black Clio guides still miss the Tally (S69 Concern 5).

## Registry entries added/changed
- No R-entries. Books 149–151 (agents). Lists registered: `sultai:massocrafts`, `abzan:bwmassacrats`, `temur:temurcontrol`, `bant:sourworms` (each with its guide in `guidesOnly`); `temur:reaper` renamed Temur Snakes. Tables of record re-run: Sultai, Abzan, Grixis, Temur, Bant.

## Test status
**1,142 passed**, 2 skipped (1,144). New: books 149–151 (`book-of-shame.test.ts`), `play/auto-aim.test.ts`; S40's book 61 pin reversed for `teamcounters` (the old reading kept under `off`). Ladder gate/mirror PASS after 149–150 and after 151.

## Suggested next
- **With every triad played**: the design conversation the S69 handoff named — the Convocation's prizes across nine-plus formats, the still-pair High Grounds on the shelf, phase three.
- **The consequence model** (Concern 1): a session on downstream triggers in the predictor — death payoffs of every kind, sacrifice outlets, tokens — measured on the engine lists (the Massacre decks, the Usher, Mardu Control, the Reaper).
- **Small pilot fixes**: sacrifice-cost pings into the ping plan (Concern 2); chase the `--deck-guide` drift (Concern 3).
- **Chris's open threads**: hybrid BW Massacrats/Aristocrats builds; Massocrafts' six open sideboard slots; a third Kavu in Temur Control (+2.2, under the bar).

## How to run
```
pnpm install && pnpm typecheck && pnpm test          # FUZZ_FULL=1 pnpm test for the full fuzz
pnpm viewer                                          # the app (dev); pnpm build:web before any push
pnpm ladder                                          # the AI gate — alone, ~13 min (two baselines)
scripts/open/rr.sh rec 100 [--format grixis]         # game one, every pairing, 8 shards → analysis/runs/scratch/rr/
scripts/open/rr.sh m 100 --matches 60 [--format grixis]
pnpm open:rr [--format grixis] --merge analysis/runs/scratch/rr/rec_?.json --record --out analysis/runs/rr.json   # --record writes formats/<id>/means.json; then open:gen
pnpm open:rr [--format grixis] --matches-report analysis/runs/scratch/rr/m_?.json --record --out analysis/runs/matches.md
pnpm open:gen && pnpm reference                      # after any change under data/convocation/formats/ (writes nothing if any check fails)
scripts/open/rr.sh t 160 --matches 160 --format temur --only temurcontrol [--no-guide]   # a list against its field, 160 matches a pairing (flags written out, not through a variable)
scripts/open/rr.sh t 160 --matches 160 --format bant --only sourworms --deck sourworms:<main> --deck-side <side> [--deck-guide <guide>]   # a build under test — calibrate with a same-path run of the 75 first
pnpm sideboard:show --format bant --list sourworms --vs auras,locks
pnpm narrate <recorded-games.json> --event <seed> [--match bracket5.1]   # a recorded game move by move
python3 scripts/open/seat.py <list> <tag>…           # a trial in one seat: matches, games, by opponent, casts
pnpm format:census --colors GWU                      # a triad's shelf
pnpm pilot-probe --witch|--manaba|--racing|--mines|--diffs|--manaba2|--sweeps …   # S67–S68 probes (see decision-updates)
pnpm open:rr … --off teamcounters,shrinkplan,payoffcost,sweepwait    # rules off for a paired read (book 151's view-sim change has no switch — use a worktree at 69293e2, the commit before it, for its baseline)
```
