# Handoff — after Session 66 (2026-10-17)

## State of the world
Five Constructed formats have fields of their own — the Open, Peasant and three triads: Naya, Esper and now **Mardu** (RWB, eleven lists, tables recorded). Esper has its second table (the sweeper round in, the Ossuary archived). Since S65 the pool has two custom cards (Foxglove Dose T2, Tidal Shackle T1), Karmic Mentor returns any permanent (R-114: an Aura enters attached), and Emerald Snakes is registered in the Open and Naya. Shape thresholds are frozen per format (ADR-186, enforced by `open:gen`). The pilot carries books to 139. Run with `pnpm viewer`; `pnpm test` for the suite (1,100: 1,098 passed, 2 skipped).

## Done this session
- **Part 0**: rulings and ADRs 185, 186 (built: `open:gen` refuses a field of eight or more without a frozen `shapeScale`; Esper 10/8, Peasant 20/4, Naya 18/3, Mardu 18/3), 168 for guides — `docs/decision-updates/s66.md`. Esper's names: the Roll, the Eddy, the Aerie, the Chancel, the Barrow, the Ossuary.
- **Part 1 — Mardu** (`formats/mardu/`, `MARDU_FORMAT`, the door's line "red, white and black. The Usher's loop lives here, and the race that beats it"). Eleven seeds: nine whole (the Pall with its plan, Mardu Control, the Muster, the Warband, the Levy; the Roll and the Chancel from Esper; the Watch from Naya), the Rabble with its blue mana swapped, **BR Removal** promoted from Peasant (Chris: Hypnotic Specter, Hymn, Dread Presence, Demonic Tutor, Drana, Char, the power in the mana) and **Mono-Red Burn** built. Event test `s66-mardu-event.test.ts`.
  - **Table of record** (seed 56, 100 games and 60 matches a pairing), in matches: **Mardu Control 67.7**, the Rabble 62.9, **the Pall 61.8**, the Watch 52.7, the Roll 51.3, the Chancel 49.1, BR Removal 43.9, the Muster 43.5, the Levy 40.7, the Warband 40.2, Burn 36.3.
  - **The read the triad is for: yes, the Open's shape holds** — the loop on top (Mardu Control; the Pall, which beats it 55–45 head to head among the top eight), the race next (the Rabble, the Watch, the Roll), the between below (the Chancel, the Levy). Mardu Control loses nothing for having no Clio to prey on (Open 70.2); it is a sideboard deck (52.3 in game one, +13.7 after). **The Pall rises** (Open 51.4, seventh → Mardu 61.8, third): the best game one (66.0), its loop assembled in 60% of its games (52% in the Open) and every one of those won; it loses 13 points after game one to the Crypts. Chris: the Usher is the format's best card, and beating her is most of the game (no Reaper's Forerunner in Mardu).
  - **The lord**: by the census's convention Mardu's lord is the Usher (its only three-colour legend; ministers Lumen, Isaura, Meliyan). Two Ushers in the Chancel (with two Plateaus and two Badlands to cast her) **+7.6 ± 2.4** over the same mana — adopted (Chris); Meliyan in BR Removal −2.5 ± 1.1, not.
- **Part 2 — Esper's second table**:
  - **The sweeper round**: a guide shape **`wide`** (Chris: `small` counts creature cards and misses decks that go wide through token makers; `wide` = eight or more token-making cards — in Esper the Roll and the Levy). Rows measured one at a time, 160 matches a pairing: **Wrath** for the Locks +3.1, the Chancel +5.0, the Aerie +3.4; the **Wave** for the Locks +7.5; Retribution −1.6 to +0.3 (out). Adopted together: the Locks +9.7 ± 5.1. Fifteens registered for the Chancel and the Aerie. The Writ (UB) sits out: no sweeper in the pool it can cast.
  - **The out-rule's `small` word**: adopted for no Esper list (eight unchanged, the Undertow level, the Roll −5.3).
  - **Faldor** (two for two Valkyries in the Aerie): −6.3 ± 2.1, cast 0.56 a game — not adopted.
  - **The Ossuary's probe → archived** (Chris): 24.7% against the field. Its reanimation aims right (489 of 506 casts raised a piece) but the pieces land late (9% by turn six, 40% never) and half its losses had a piece answered (Swords 27, Control Magic 22, Vindicate 12, Doom Blade 8, Wrath 6; Edicts 2). The brief's rule split evenly; a timing rule would only reach the second failure.
  - **The Barrow** at 31.9 (was 40.6): its retire count is one.
  - **Table re-run** (nine lists), in matches: the Roll 63.1, the Writ 59.6, the Aerie 53.1, the Undertow 51.3, the Eddy 50.6, the Levy 48.1, the Locks 47.5, the Chancel 44.8, the Barrow 31.9.
- **Part 3 — the read across three triads**: **Naya has an engine** (Emerald Snakes 67.5 — Manaba and the Cobra, the Keeper as the payoff) over a race (the Rabble, Stompy) and no lock (no counterspell). **Esper has a race over a lock** — the Roll's tokens on top, the Writ's counters second, its engine gone (the Ossuary archived). **Mardu has an engine and a race at once** — the Usher's loop in two shells over the Rabble. A fourth by contrast: **Sultai (BGU)** is the one triad with no sweeper in the pool (every sweeper is white or red) and the shallowest reuse but one (seven lists whole, two more with a mana swap) — it would test a format the creature decks own; **Jeskai** has both counters and sweepers and deep reuse (thirteen whole, two with a mana swap).
- **The estimate for the remaining seven** (lists already registered that are legal whole, of 48 distinct across the five fields; many are Peasant lists or Rabble variants, so the distinct families are fewer): Grixis 15 (+1 with a mana swap), Jund 13 (+3), Jeskai 13 (+2), Abzan 10, Temur 9 (+4), Sultai 7 (+2), Bant 6. A triad of ten seeds needs two to four built lists for Grixis, Jund and Jeskai; five or six for Sultai and Bant. Built as a batch: the seeding and the tables are mechanical (a triad's field takes about thirty minutes of machine time to record); the building and a census read per triad is the work — roughly a session for the three deep triads and one for the four shallow.
- **Post-S65 work** (before this brief, pushed): Foxglove Dose and Tidal Shackle; books 136–139; R-112–R-114; the guide shapes `sweepers` and `shrinks`; Emerald Snakes in the Open (63.6, third) and Naya (67.5, first); the stale-attacker fix; Naya's thresholds frozen.

### Post-S66 (2026-10-17/18): Chris's answer to the Usher's loop
- **The bottoming (R-115, `putOnBottom`)**, studied and set aside: Hallowed Rites, the Sexton of the Vale at five costs and bodies, Pyre Rites at four (book 140 for the pilot). In the Watch and Mardu Control every variant measured level or negative against the slot it took; the rider on a Shock was worth about nothing (−0.4 ± 0.7). The loop beats a defender holding nothing; a one-shot answer is rarely held at the right time. The cards stay in `data/cards-proposed`.
- **The replacement (R-116, `exileOpponentsDying`)**: "If a creature an opponent controls would die, exile it instead" — the loop's legend-rule step becomes an exile, and no drain fires. Hallowed Warder ({1}{W}) at 1/4 and 2/3, Vigil Keeper ({2}{W}, draw a card) at 2/2 and 1/3: the Keeper strongest, +6 to +13 against the Usher decks. **Vigil Keeper adopted at 1/3** (Chris), T2 interim, with its art (art nouveau, of four) and Chris's printed face; Peasant score 2.43 (rebuilt).
- **Its slot** (160 matches a pairing, paired, fresh baselines): in Mardu Control three Keepers for the three Restoration Angels +4.2 ± 1.0 (Jet Witch +3.1; Soul Warden −0.2; in the fifteen for the Macabres +1.2), **not adopted** (Chris). **In the Watch, two Emeria Angels and a Dawnwing Marshal out for three Keepers, +4.8 ± 1.0 — adopted**; Mardu's tables re-run (`analysis/runs/mardu_*_post66.*`): the Watch 52.7 → 57.1 in matches, nothing else moved more than 1.4.
- **Chris's next**: winning a Mardu Umbel with no Usher in the 75.
- Tests after: **1,110 passed**, 2 skipped (new: `sim/s66-hallow.test.ts`, `sim/s66-warder.test.ts`, the hallow fuzz). Ladder PASS for books 140 and its amendments; none for R-116 (no ladder card carries it) or the Watch's list change.
- **Concern (tooling)**: a guided list's fifteen cannot be varied by `--deck-side` alone — the guide is matched by the exact fifteen, so one changed card drops the whole guide silently and the rules sideboard instead (Mardu Control read −7 from it). Carry the guide's rows with `--deck-guide`; a control with the unchanged guide reproduces the baseline exactly. For the planner: a guide could be keyed by list rather than by fifteen, or `open:rr` could warn when a fifteen under test matches no guide that its list had.

## Deviations from the brief
1. **The Pall is not mono-black**: it is black with the Usher's white and red, Mox Ruby and Pearl and the RWB duals — all within RWB, so it seeds whole.
2. **BR Removal's line was unfinished** ("the Specter's cousins, Vindicate? — no, WB"): built from Peasant's list with Chris's direction (above).
3. **The lord**: the brief called the Usher Mardu's minister and asked the implementer to name a three-colour lord; by the census's convention she is the lord (the only three-colour legend in RWB). The trial became the Usher in the Chancel and Meliyan (the unseeded minister) in BR Removal.
4. **ADR-186 "frozen at their first eight"**: Mardu's eleven seeds have no order to take eight by — frozen at the whole first field's 18/3. Peasant frozen too (20/4) though the ADR names only Esper and Mardu: the rule is general — **for the planner to confirm**.
5. **The sweeper round keyed on `wide`, not `small`** (Chris): `small` does not fire on the Roll or the Levy in Esper.
6. **The Writ took no part** in the sweeper round (UB; no castable sweeper).

## Concerns
1. **`small` and `wide` measure different things, and the brief's guides had assumed `small` saw tokens.** Every shape counting creature cards misses token makers; any future guide aimed at a go-wide deck should name `wide`.
2. **The out-rule's `small` word does nothing in Esper** for eight lists — their sideboarding never reaches the defensive card it protects. Its value was the Open's lists (S61); it may not be worth trialling per triad.
3. **The Ossuary's split result**: a reanimator shape in a format with Swords, Control Magic and Vindicate faces two failures at once; the next reanimator seed (Grixis, Sultai) should be read against the removal its field holds before it is built.
4. **The lords are mixed**: the Fordkeeper wanted by some, the Dredger by none, Faldor by none, and the Usher strongly wanted (+7.6) — she is the only lord whose card is also a combo piece. The planner's "texture" reading holds for the others.
5. **Open:gen's shape list had fallen behind** the guide shapes (S63's list; `sweepers`, `shrinks`, `wide` added this session) — a guide naming a shape it did not know failed generation after the decks file had already been rewritten, and one Esper re-run played without its guides (re-run, recorded correctly). Generation should validate before it writes.
6. **The pilot under-plays the Manaba engine** (Chris's Emerald Snakes: 8–0 and 13–1 by hand, 48–66 in the pilot's) and races (6–0 against Mardu Control by hand, the pilot 43) — the tables rank archetypes as the pilot plays them.

## Registry entries added/changed
- No new R-entries this session (R-112–R-114 post-S65). Pool registry unchanged this session (Karmic Mentor's row amended post-S65).
- Guide shape `wide` (sideboard-ai; `open:gen` validates it with `sweepers` and `shrinks`).

## Test status
`pnpm test`: **1,098 passed**, 2 skipped (1,100). New: `world/s66-mardu-event.test.ts` (the colours and the land rule; an event to a champion); `wide` pinned in `sideboard-s56.test.ts`. Ladder last run for book 139 (PASS); no AI change this session.

## Suggested next
- **The four remaining deep and shallow triads as a batch** (the estimate above), Jeskai or Sultai first as the fourth by contrast.
- **Mardu by hand**: Chris's run — what beats the Usher without the Forerunner (the Crypts, the race, Faerie Macabre where it is legal).
- **The Barrow**: one retire count; a second table at the bottom retires it.
- **The Dose's trick** (its own probe, book 129's shape on a conditional harm), and a pilot term for spending Manaba mana on a wide board (Concern 6).
- Still owed: a journey played through a sitting.

## How to run
```
pnpm install && pnpm typecheck && pnpm test          # FUZZ_FULL=1 pnpm test for the full fuzz
pnpm viewer                                          # the app (dev); pnpm build:web before any push
pnpm ladder                                          # the AI gate — alone, ~13 min (two baselines)
scripts/open/rr.sh rec 100 [--format peasant]        # game one, every pairing, 8 shards → analysis/runs/scratch/rr/
scripts/open/rr.sh m 100 --matches 60 [--format peasant]
pnpm open:rr [--format peasant] --merge analysis/runs/scratch/rr/rec_?.json --record --out analysis/runs/rr.json   # --record writes formats/<id>/means.json; then open:gen
pnpm open:rr [--format peasant] --matches-report analysis/runs/scratch/rr/m_?.json --record --out analysis/runs/matches.md
pnpm open:gen && pnpm reference                      # after any change under data/convocation/formats/
pnpm sideboard:show --format peasant --list br --vs elder,rabble
pnpm rating:format --format peasant [--write]        # the format's own card score
pnpm format:census --max-tier 2 ; pnpm format:rr --field <file> --max-tier 2    # a pool and a field that are not yet a format
pnpm format:census --colors RWB [--max-tier 2] ; pnpm format:census --triads   # a triad's shelf (the land rule applied); the ten side by side
scripts/open/rr.sh nm 100 --format naya --matches 60   # Naya's tables, as Peasant's (--format naya everywhere --format peasant goes)
pnpm open:rr … --max-turns 140                       # the turn limit on trial
pnpm open:rr … --off removalmatchup                 # book 129 off (also optionalpay, equiphost, drawforlife, loopnet, laterpicks, and every earlier switch)
python3 scripts/open/seat.py <list> <tag>…           # a trial in one seat: matches, games, by opponent, casts
scripts/open/rr.sh t 160 --matches 160 --format open --with-archived --only larder --vs <field> --deck larder:<file>:midrange --deck-side <file>   # a new list in an archived seat, against the field
scripts/open/rr.sh t 160 --matches 160 --format esper --only locks --vs bwtokens,levy --deck locks:<main> --deck-side <side> --deck-guide <guide>   # a guide row measured
```
