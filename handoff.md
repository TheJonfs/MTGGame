# Handoff — after Session 67 (2026-10-19)

## State of the world
Eight formats now have fields of their own: the Open (fifteen lists), Peasant, Naya, Esper, Mardu (twelve), and this session's deep batch — **Grixis, Jund and Jeskai**, eleven seeds each, with tables of record, frozen thresholds, reference pages, door lines, the play screen's groups and door tests. Guides now belong to their list in the measuring tools (ADR-188): `open:rr` keeps a list's guide when its fifteen is varied and warns about rows the fifteen can't feed. `open:gen` writes nothing until every check passes, and the guide shapes are one list. Vigil Keeper is in the Open's Muster. `pnpm pilot-probe` reads three of the pilot's gaps against Chris's recorded play. Tests: `pnpm test` (1,119 passed). Tables: `scripts/open/rr.sh <tag> 100 [--matches 60] --format <id>`, then `open:rr --merge/--matches-report … --record`, then `open:gen`.

## Done this session
- **Part 0**:
  - Rulings and ADR-187 and 188 are in `docs/decision-updates/s67.md`, with Chris's five kickoff rulings (the brief read against the data).
  - ADR-188 built: `LIST_GUIDES` (`<format>:<key>` → guide); `guideOfList`; `aiSideboard`'s explicit `guide`; `open:rr`'s guide by key, test guide and warning. `open:gen` queues every write until all checks pass (a planted bad shape wrote nothing). `GUIDE_SHAPES` is typed exhaustive. Equivalence: 1,638 Mardu Control games re-run identical.
  - Mardu's names: BR Removal (Mardu) is now **the Ashen**, Mono-Red Burn **the Kindling**.
- **Part 1 — Vigil Keeper in the Open**:
  - **The Muster**: three for the Fencing Aces, +2.9 ± 0.9 (the Pall +12.5). **Adopted.**
  - **Emerald Snakes**: two Keepers on a Savannah swap, +0.3. Not adopted.
  - **Countersnake's fifteen**: +0.0. Not adopted.
  - **Reaper Clio**: dropped (Chris's ruling).
  - The Open's tables re-run: the Muster 41.5 → 43.9, the Pall 51.4 → 49.7.
- **Part 2 — the batch.** Seeds whole where legal, with every land swap logged in the list's source:
  - **Grixis**: the Kiln, the Rabble, the Writ, the Eddy, the Undertow, the Barrow, the Tally (revived), the Ashen, the Kindling, Peasant's BR Removal; built: Grixis Clio.
  - **Jund**: the Sweep (land swap), the Ashen, the Rabble, the Stampede, Dungrove Auras, Emerald Snakes (land swap), the Wurmspeaker, the Kindling, the Reaper (revived, land swap), **Black Forest Ham** (Chris's); built: Jund Coin.
  - **Jeskai**: the Kiln (fifteen swap), the Tally, the Aerie (land and fifteen swaps, Esper's guide carried), the Watch, the Muster, the Warband, Naya's Rabble, UR Pyroclasm Control; built: Jeskai Sweepers, Jeskai Theft, Jeskai Locks.
  - **The lords**:
    - The Stoker: −1.6 and −4.2. Not adopted.
    - **The Bailiff in the Theft: +4.6 ± 1.0. Adopted** (Jeskai re-run: the Theft 43.3 → 49.7); in the Sweepers +0.5.
    - The Reaper: −3.4 into Emerald Snakes; +2.1 ± 1.3 for two out of the Sweep, under the bar.
- **Part 3 — the probes** (`pnpm pilot-probe --witch | --manaba | --racing`); the results are in Concerns 1 to 3.
- **Part 4 — the read** (decision updates):
  - **Tables in matches:**
    - **Grixis**: the Rabble 82.6, Clio 61.8, the Writ 57.3 … the Undertow 26.7.
    - **Jund**: Emerald Snakes 67.9, Dungrove Auras 64.8, the Rabble 61.6 … Jund Coin 28.7.
    - **Jeskai**: the Rabble 74.7, the Watch 67.0, the Locks 57.5 … the Sweepers 30.8, UR Pyroclasm Control 30.5.
  - **Six triads**: Naya and Jund an engine over a race; Esper and Jeskai a race over a lock; Mardu an engine and a race at once; Grixis a race over everything. The red race tops three of the six.

## Deviations from the brief
1. **No Grixis reanimator** (interim, logged). The brief's condition: the Ossuary died to Swords, Control Magic and Vindicate. Grixis keeps Control Magic (the Kiln's four, the Tally's two, two fifteens) and every list's graveyard hate. Planner: build it next session, or accept the read.
2. **Jund Coin built although the Sweep is already Jund Aristocrats** (Reaper, Meliyan, Blood Artist, Bitterblossom). The Coin is the brief's no-white Coin shape. It measured last (28.7). Planner: keep it, or retire it on its first count.
3. **ADR-188 in events and the play screen**: they still match a guide by fifteen. A seat there holds its list's authored fifteen or a built one, so the two readings agree and event behaviour is unchanged. Planner: confirm the reading.
4. **The Kiln's three Macabres became Pyroclasms in Jeskai.** The Kiln makes no white mana, so it has no castable graveyard answer but the Crypt, and it already holds four. The Aerie's Macabre became a third Crypt.
5. **The lord read for Jund** is the Reaper added to one list and taken out of another, since two seeds already carry it.

## Concerns
1. **The Witch probe contradicts the brief's premise.**
   - **The pilot doesn't overpay; it draws later and less.** It activates 4.8 times a game, the first on turn 10.2. Chris activates 7.0 times, the first on turn 6.6, and pays into an untapped racer more often (31% against 18%).
   - **The candidate rule would change little.** It forbids 61 of 329 pilot activations, and those games went no worse.
   - **For S68:** the useful term is "use the Witch early while it's safe", not "stop paying". Book 113's shape, extended to the board, is the wrong lever.
2. **The Manaba probe can't see the pilot's taps.** The pilot pays through the solver, so its Manaba taps aren't agent actions. The end-step board is the reliable reading, and it shows no mana wasted. The 13–1 versus 60 gap is likely elsewhere (sequencing, the Forerunner's timing: Chris holds it at 19.6% of end steps).
3. **Racing isn't the attack declaration.** The pilot would have held on only 5 of Chris's 64 attacking turns, and only one of those positions decides a game. A next probe should read blocks and the turn order of casts.
4. **The red race dominates Grixis (82.6) and Jeskai (74.7).**
   - In Grixis nothing white answers it; in Jeskai the counters-and-sweepers contrast didn't produce a deck that beats it in the pilot's hands.
   - The built Jeskai Sweepers is last but one (30.8). That may be the build, or the pilot's Wrath timing; it's worth one probe before a list is blamed.
5. **Frozen `large` thresholds of 1 in Grixis and Jund** (ADR-186). This is S65's fragile low-rank case again: `large` fires against nearly every list there. Planner: ratify, or set by hand.
6. **The Keeper answers the Pall, not Mardu Control**: +12.5, +8.1 and +4.4 against the Pall, but +0.6, +1.9 and −1.2 against Mardu Control. Mardu Control's loop is one engine among several. No fifth shape joins the Open's four.
7. **The fifteen-matched guide lookup** still lives in events, the UI and `combo-probe`/`sideboard:show`. Those were left as they were; only `open:rr` is key-based. `sideboard:show` would be a small follow-up.
8. **Post-S67 (Chris's Grixis run, Mono-Black Clio 8–0): the pilot's damage targeting.**
   - **Burn spells:** of 23 AI burn spells at Chris's creatures, 9 were not lethal on their own, and 6 left the creature alive (Shocks on Nighthawk, Dread Presence and Drana; a Bolt on Drana). No gate found for burn *spells* aimed at a creature.
   - **The Ruby Tyrant** (Chris's observation, confirmed in the Rabble's game two): two pings at a Witch with 2 toughness left, where one was lethal; ten turns beside Chris's Clio without once aiming two pings at her. The activated-ability gate (`heuristic-agent.ts`, the `damage` case near "repeatable") refuses any single ping that does not kill — so it can never stack two on a 4-toughness creature — and its `kills()` reads marked damage but not pings already on the stack, so it doubles up.
   - **For S68's pilot rules, beside the Witch term:** a burn spell aims at a creature only when it kills, alone or with what is already committed (combat, the stack); repeatable damage plans a kill across activations and counts its own pending pings. Ladder-gated.
9. **Post-S67 (Chris's Jeskai runs, Jeskai Control 3–3 then Sacred Minefield 8–0, 16–3 in games): the pilot attacks into the opponent's triggers.** With Chris's Powerstone Minefield out (2 damage to each attacking or blocking creature, on its trigger — before blocks), **210 of 260 attackers the pilot declared (81%) died to the trigger alone**, dealing nothing: the Rabble 127 of 127 (every attacking turn), the Muster and UR Pyroclasm Control 86%, the Aerie and the Watch 57%. The attack evaluator does not read the defender's permanents' ATTACKS/BLOCKS triggers. **For S68, with the damage targeting (Concern 8)**: a combat read that charges each attacker (and blocker) what the battlefield's triggers will do to it on declaration — the Minefield first; the same question for any opposing static or trigger an attack or block sets off. Until then, a Minefield list's tables overstate it: the pilot feeds it creatures.

## Registry entries added/changed
- No R-entries; no pool changes (Vigil Keeper is now in the Open's Muster, and the Watch has it in Mardu and Jeskai).
- New formats: `grixis`, `jund`, `jeskai`, each with `lists.json`, `means.json`, `matches.json` and `docs/reference/<id>-lists.md`. Open revision S67: the Muster (`open-lists.ts`).

## Test status
**1,119 passed**, 2 skipped (1,121). New: `world/s67-guides.test.ts` (ADR-188: every list mapped, a varied fifteen keeps its guide by key, one shape list) and `world/s67-triads-event.test.ts` (each triad's colours and land rule, an event to a champion). No ladder: no AI decision changed (the probe tool only reads); the sideboarding is identical for every registered list (the equivalence run).

## Suggested next
- **S68's pilot rules** from the probes: the Witch used early when safe (Concern 1), with a ladder gate; a block and sequencing probe for the racing gap (Concern 3); the Manaba read through the solver's payments (Concern 2).
- **The shallow batch**: Sultai first by contrast (no sweeper), then Abzan, Temur, Bant. This batch's cost holds: one session for three, about 2.5 hours of machine time.
- A Grixis reanimator (Deviation 1); the Jeskai Sweepers' Wrath timing probe (Concern 4).

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
pnpm pilot-probe --witch --format mardu --lists witch,pall,marducontrol --games 6 --recorded <file>   # S67: the Witch's activations, the pilot and the human
pnpm pilot-probe --manaba --format open --lists emeraldsnakes --games 6 --recorded <file>
pnpm pilot-probe --racing --format open --recorded <file> --playouts 6
python3 scripts/open/seat.py <list> <tag>…           # a trial in one seat: matches, games, by opponent, casts
scripts/open/rr.sh t 160 --matches 160 --format esper --only locks --deck locks:<main> --deck-side <side> [--deck-guide <guide>]   # a fifteen varied keeps the list's guide (ADR-188); --deck-guide replaces its rows
```
