# Handoff — after Session 69 (2026-10-21)

## State of the world
Twelve Constructed fields now: the Open, Peasant, and the ten triads — this session's shallow batch (**Sultai, Abzan, Temur, Bant**, ten seeds each, tables, frozen thresholds, reference pages, doors, the play screen, door tests). The defence rules are in: `sweepwait` (book 147) and `payoffcost` (book 148) adopted; `blockloss` (book 146) on trial only. Grixis's and Jeskai's tables re-run after them. The ladder passes. Tests: `pnpm test` (1,136 passed).

## Done this session
- **Part 0**: S68's deviations ratified; ADR-190 (the red race a defence problem — re-stated in Part 3); Chris's four kickoff rulings (Sultai: Reaper Clio and Emerald Snakes out, the Depths in; Temur: Grixis Clio and Reaper Clio out, Reaper Control revived with Emerald Keepers; Bant: Countersnake's Clios for Serra Angels; Abzan as written).
- **Part 1 — the batch**: four formats, forty lists (thirty-two seeds whole or with logged swaps, eight builds), tables in three columns. Leaders: **Sultai Reeve 73.9**, **the Chancel 66.3** (Abzan), **Temur Ramp 67.2**, **Bant Sower 71.7**. The lords: only the Sower in Bant Sower earned its place (+2.6 ± 1.2, adopted); the Unwinder in Emerald Snakes −11.5.
- **Part 2 — the defence**: `sweepwait` at half the card's mana value (the Jeskai Sweepers +1.0, Mardu Control +2.6; sweeps into one or none 64% → 54%); `payoffcost` (Chris's game 17 the fixture; rare in the tables); `blockloss` measured −0.6 to −3.1 against the Rabble — trial only. Ladder PASS.
- **Part 3 — the read**: the red race unmoved (Grixis 75.8, Jeskai 77.8); the ten-triad read (decision updates): the race tops two of ten; Sultai, Abzan and Bant have none; Temur's big bodies sit over it.

## Deviations from the brief
1. **`blockloss` not adopted** — the brief's rule measured negative against the Rabble; kept as `trial: ["blockloss"]`. The racing probe's extra blocks were the Snakes matchups', not the swarm's.
2. **`sweepwait`'s bar is half the card's mana value**, and "the race forces it" reads three turns — at the brief's full bar the Sweepers lost 4.1 against the red lists (four Goblin tokens are 2.0 of value).
3. **"Losing the race" reads only the opponent's clock** (their board kills us within N turns) — the brief's comparison of clocks marked every low-power control deck as losing every race, and nothing fired.
4. **Bant Sower without Clio** (black); **Bant Auras with Pacifism for Protocol** (its mana has too little blue).
5. Temur's derived `large` threshold was 0 — set to 2 by the amended ADR-186.

## Concerns
1. **The red race is a field question.** Three defence rules and five pilot rules have not moved the Rabble in Grixis or Jeskai. In both, one or two lists answer it — Mono-Black Clio and Massacrats; the Watch and Sacred Minefield — and every other seed was built for a different field. More answers in the seeds (or a card), not more pilot.
2. **Built lists top three of the four new triads** (Sultai Reeve 73.9, Temur Ramp 67.2, Bant Sower 71.7). The seeds there are mostly other formats' lists ported, not native designs; the builds were made for the colours. Read the tables as "the seeds are weak here" as much as "the builds are strong" — Chris's breaks will tell.
3. **The Unwinder is a trap in Emerald Snakes** (−11.5): a five-mana lord in a deck whose curve is mana creatures and the Keeper.
4. **`payoffcost` moved nothing measurable** — the position (one life, their payoff out) is rare; it stays as a correctness rule.
5. The guides of Massacrats and Mono-Black Clio still miss the Tally (no shape reads a burn-spells deck with twelve creatures).

## Registry entries added/changed
- No R-entries; books 146–148 (agents). New formats: `sultai`, `abzan`, `temur`, `bant` (`lists.json`, `means.json`, `matches.json`, reference pages). Bant Sower takes four Sowers.

## Test status
**1,136 passed**, 2 skipped (1,138). New: books 146–148; `world/s69-triads-event.test.ts`. Book 147's pin moved from a lone Bears to a lone Raging Goblin (the half bar). Ladder gate/mirror PASS.

## Suggested next
- **The family's state**: ten triads, two tier formats (Peasant; Pauper as data), one Open — twelve Constructed fields with tables. The next design conversation, per the brief: **the Convocation's prizes now that nine-plus formats exist**, **the still-pair High Grounds on the shelf**, and **phase three**.
- **Chris's breaks**: a Sultai Snake deck with Mystic Snake, a Temur control list, Bant and Abzan open — each registered and measured as the Witch, Massacrats and Sacred Minefield were.
- **The red race's answers**: a seed or a card per red triad that answers it (Concern 1); the "friction, not a gate" audit when a session has a half-day.

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
pnpm sideboard:show --format mardu --list witch --vs pall,rabble
pnpm rating:format --format peasant [--write]        # the format's own card score
pnpm format:census --colors UBR [--max-tier 2] ; pnpm format:census --triads   # a triad's shelf (the land rule applied); the ten side by side
python3 scripts/open/seat.py <list> <tag>…           # a trial in one seat: matches, games, by opponent, casts
scripts/open/rr.sh t 160 --matches 160 --format esper --only locks --deck locks:<main> --deck-side <side> [--deck-guide <guide>]   # a fifteen varied keeps the list's guide (ADR-188); --deck-guide replaces its rows
pnpm pilot-probe --witch|--manaba|--racing …            # S67 probes (see decision-updates/s67.md)
pnpm pilot-probe --mines --format jeskai --lists rabble,watch --vs minefield --games 20 [--off triggercharge]   # S68: attackers lost to a Minefield's trigger
pnpm pilot-probe --diffs --format open --recorded <file> --playouts 4     # S68: the human's blocks and casts against the pilot's, with playouts
pnpm pilot-probe --manaba2 --format open --lists emeraldsnakes --games 4 --recorded <file>   # S68: Manaba mana from the board
pnpm pilot-probe --sweeps --format jeskai --lists sweepers --games 4 --recorded <file>[,<file>]   # S68: each sweeper and the board it met
pnpm open:rr … --off triggercharge,deathcharge,burnkills,pingplan,witchearly   # S68's rules off (books 141–145)
```
