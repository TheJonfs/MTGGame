# Handoff — Session 63, Parts 0 and 1 (2026-10-14)

## State of the world
Two Constructed formats, each with its own field. **The Open** is unchanged (fourteen lists; Reaper Clio 72.2, Mardu Control 69.7, the Rabble 64.4). **Peasant** (tier two and below) now has its first registered fifteens and guides and a new table of record (5,460 matches, seed 56, the 120-turn limit; `analysis/runs/peasant_matches_s63.md`): **Dungrove Auras 72.1** (from 76.0), BR Removal 64.0, BR Djinn 59.1, **White Skies 56.9** (60–40 against Auras: the one list ahead of it), RW Tokens 52.1, BW Aristocrats 51.3, Mono-Black 50.1, the Rabble 49.7, Stompy 49.6, UW Skies 47.4, the Muster 40.9, UW Skies (walls) 38.1, Naya 36.0, UR Control 32.8. Three cards joined the pool (Chris's, all tier 2): **Basilisk Collar, Wall of Razors, Retribution of the Meek**; one new word (R-109) and one new book (128). Session 63's Part 1 is done; **Parts 2–4 (the formats' plumbing, the triads' census, the art) are not started**. Everything is pushed.

## Done this session
- **Part 0** — rulings read and applied as written (ADR-178's order of levers; the Elder stays). The ADR-167 audit of the "target player" family is **not done** (Concerns 1).
- **Diagnostics before building.** White Skies against Auras (411 games): with an Elder cast and no Wall of Reverence or Wave, White Skies wins 29%; with a Wall 59%, a Wave 69%. Swords to Plowshares does nothing in the pairing (52% cast, 57% not). Rancor is what beats it (72% when none is cast, 47% when one is).
- **Experiments toward an Elder answer** (each 160 matches a pairing in a spare seat, against the field):
  - BW Wave (White Skies' core with Blood Artist, Moaning Wall, Sign in Blood): 26.4; with Nighthawks 39.9. A deck built around the Wave wins only when it finds one.
  - RW Wave (Bolts and Kavus for Swords and Vitalists): 54.0–57.2 overall but 41–49 against Auras; better against the black lists, worse against the Elder.
  - Basilisk Collar on first strikers (WB and mono-white): 35–40 overall, 24 and 41 against Auras — crushes creature decks, collapses against black removal (8–10).
  - Wall of Razors with the Collar (RW): 25.0 and 34.4 overall; 76% of the Auras games in which both were cast. A sideboard plan against one deck.
  - Collars and Longbow Archers in White Skies' sideboard against hexproof: +8 (seed 56) and +4.6 (seed 91, 400 matches) against Auras.
  - Chris's 8–0 White Skies run (`docs/debug_logs/recorded_games/PeasantWhiteSkies.json`): 8–1 in games against Auras where the pilot is 54. The play diff: he held Swords on 41 turns the pilot would have cast it (30 never cast), aimed counters at one flier, and sided all four Swords out. His plan in the pilot's hands (no Swords main; his fifteen and guide) changes nothing (52–58 against Auras, ±7.7): **the gap is play, not the list.**
- **Three cards (Chris; tier 2, his ruling of 2026-10-14)**, each verified on Scryfall, fuzzed (3,840 games in `sim/s62-fuzz.test.ts` with eight lists), with fixtures (`sim/s63-collar.test.ts`, 7) and art:
  - **Basilisk Collar** (WWK; {1} Equipment, deathtouch and lifelink, equip {2}). No new word.
  - **Wall of Razors** (STH; {1}{R} Wall 4/1, defender, first strike). No new word.
  - **Retribution of the Meek** (VIS; {2}{W} sorcery, destroy all creatures with power 4 or greater). **R-109**: `destroyAll` with `powerAtLeast`, power read as it resolves. The sideboarding rules do not count it a sweeper (it does not answer the wide).
- **Book 128** — an equip is priced with the equipment's keywords and size on its host; deterrence reads first strike. In 40 probe games the pilot had put four Collars on a Wall of Reverence and attached about half of them; after, 24 of 35 equips went to first strikers. Ladder: PASS. Off: `equiphost`.
- **Part 1** — the `hexproof` guide shape (four or more hexproof or shroud creatures with power two or more or a self-set size; the brief's "power two or more" alone misses the Elder, whose printed power is `*`). **Retribution through the white lists**: main deck, +3 to +9 against Auras and a net loss overall everywhere (the field rarely shows four power); from the sideboard against hexproof only (400 matches, seed 91, paired): UW Skies (walls) +12.8, BW +11.0, UW Skies +10.3, White Skies +8.5, the Muster +6.2, RW Tokens +1.3. **Registered** (Chris): the five fifteens and guides, RW Tokens not. The Wave stays White Skies' main-deck sweeper (Retribution for the Waves: −4 overall, no better against Auras).
- **The table of record** recorded (above). The brief's read: **the shape nearest the Elder is fliers and lifegain with a sweeper** (White Skies 60, BW and UW Skies 48); the Edict on a small board and the race (18–33) are not.
- **Chris's UW Skies** (`docs/debug_logs/convocation-open-5–0-UWSkies.json`; 5–0, then out to Naya): under the pilot 44.6 with the builder's fifteen and 45.1 with his (registered UW Skies 47.5), 40 against Auras, 31 against Naya. Tested, **not adopted**. The play diff again: Swords held, Plumecreed Escort held as protection, Dawnwing Marshal's pump not spent.

## Peasant's fourteen lists (working names; `data/convocation/formats/peasant/lists.json`; the table of 2026-10-14)
- **Dungrove Auras** (`elder`, Mono-Green Auras (G); midrange) — 72.1 in matches, 66 in game one. 4 Blanchwood Armor, 4 Dungrove Elder, 4 Gaean Wurm, 4 Gladecover Scout, 4 Llanowar Elves, 4 Rancor, 4 Wall of Blossoms, 3 Harmonize, 3 Reaper's Forerunner, 2 Centaur Courser, 2 Penumbra Wurm. Lands: 22 Forest.
- **BR Removal** (`br`, Rakdos Removal (B R); midrange) — 64 in matches, 58 in game one. 4 Blood Artist, 4 Child of Night, 4 Doom Blade, 4 Flametongue Kavu, 4 Lightning Bolt, 4 Nekrataal, 4 Typhoid Rats, 4 Vampire Nighthawk, 2 Gravedigger, 2 Reassembling Skeleton, 1 Terror. Lands: 12 Swamp, 7 Mountain, 4 Blood Crypt.
- **BR Djinn** (`brdjinn`, Rakdos Removal, Djinn and Char (B R); midrange) — 59.1 in matches, 57 in game one. 4 Blood Artist, 4 Child of Night, 4 Doom Blade, 4 Flametongue Kavu, 4 Lightning Bolt, 4 Nekrataal, 4 Typhoid Rats, 4 Vampire Nighthawk, 3 Gallows Djinn, 2 Char. Lands: 12 Swamp, 7 Mountain, 4 Blood Crypt.
- **White Skies** (`wskies`, Mono-White Lifegain Skies (W); midrange) — 56.9 in matches, 58 in game one. 4 Dazzling Angel, 4 Inspiring Overseer, 4 Restoration Angel, 4 Soul Warden, 4 Swords to Plowshares, 4 Vitalist, 4 Wall of Reverence, 4 Youthful Valkyrie, 3 Wave of Reckoning, 2 Dawnwing Marshal. Lands: 23 Plains. Sideboard (registered): 3 Retribution of the Meek, 2 Captain of the Watch, 2 Disenchant, 2 Glorious Anthem, 2 Pacifism, 1 Longbow Archer, 1 Savannah Lions, 1 Tormod's Crypt, 1 Wave of Reckoning; guide: 3 Retribution in against the hexproof shape.
- **RW Tokens** (`tokens`, Boros Tokens (W R); aggro) — 52.1 in matches, 52 in game one. 4 Dawnwing Marshal, 4 Dragon Fodder, 4 Glorious Anthem, 4 Hordeling Outburst, 4 Lightning Bolt, 4 Raise the Alarm, 4 Soul Warden, 4 Young Pyromancer, 3 Flametongue Kavu, 2 Captain of the Watch. Lands: 10 Plains, 9 Mountain, 4 Sacred Foundry.
- **BW Aristocrats** (`bw`, Orzhov Aristocrats (W B); midrange) — 51.3 in matches, 52 in game one. 4 Blood Artist, 4 Child of Night, 4 Doom Blade, 4 Nekrataal, 4 Restoration Angel, 4 Soul Warden, 4 Swords to Plowshares, 4 Vampire Nighthawk, 3 Vitalist, 2 Captain of the Watch. Lands: 10 Swamp, 9 Plains, 4 Godless Shrine. Sideboard (registered): 3 Retribution of the Meek, 3 Tendrils of Corruption, 2 Disenchant, 2 Inspiring Overseer, 2 Wave of Reckoning, 1 Tormod's Crypt, 1 Wall of Reverence, 1 Youthful Valkyrie; guide: 3 Retribution in against the hexproof shape.
- **Mono-Black Removal** (`mbc`, Mono-Black Removal (B); midrange) — 50.1 in matches, 47 in game one. 4 Child of Night, 4 Doom Blade, 4 Nekrataal, 4 Sign in Blood, 4 Typhoid Rats, 4 Vampire Nighthawk, 3 Gallows Djinn, 3 Gravedigger, 3 Terror, 2 Blood Artist, 2 Tendrils of Corruption. Lands: 23 Swamp.
- **the Rabble (Peasant)** (`rabble`, Mono-Red Goblins (R); aggro) — 49.7 in matches, 49 in game one. 4 Char, 4 Dragon Fodder, 4 Flametongue Kavu, 4 Goblin Chieftain, 4 Goblin Grenade, 4 Goblin Matron, 4 Hordeling Outburst, 4 Lightning Bolt, 4 Raging Goblin, 2 Boggart Brute, 2 Goblin Piker. Lands: 20 Mountain.
- **RG Stompy** (`stompy`, Gruul Stompy (R G); aggro) — 49.6 in matches, 50 in game one. 4 Centaur Courser, 4 Flametongue Kavu, 4 Grizzly Bears, 4 Lightning Bolt, 4 Llanowar Elves, 4 Rancor, 4 Rumbling Baloth, 3 Gaean Wurm, 3 Mother Bear, 3 Reaper's Forerunner, 2 Birds of Paradise. Lands: 13 Forest, 4 Mountain, 4 Stomping Ground.
- **UW Skies** (`skies`, Azorius Skies (W U); midrange) — 47.4 in matches, 45 in game one. 4 Counterspell, 4 Dawnwing Marshal, 4 Inspiring Overseer, 4 Plumecreed Escort, 4 Restoration Angel, 4 Swords to Plowshares, 4 Traumatizer, 4 Youthful Valkyrie, 2 Pacifism, 2 Wave of Reckoning. Lands: 10 Island, 10 Plains, 4 Hallowed Fountain. Sideboard (registered): 3 Retribution of the Meek, 2 Disenchant, 2 Essence Scatter, 2 Protocol, 2 Wave of Reckoning, 1 Arcane Collector, 1 Tormod's Crypt, 1 Wall of Air, 1 Wall of Reverence; guide: 3 Retribution in against the hexproof shape.
- **the Muster (Peasant)** (`muster`, Boros Weenie (W R); aggro) — 40.9 in matches, 44 in game one. 4 Fencing Ace, 4 Flametongue Kavu, 4 Glorious Anthem, 4 Lightning Bolt, 4 Longbow Archer, 4 Raise the Alarm, 4 Savannah Lions, 4 Soul Warden, 3 Restoration Angel, 2 Swords to Plowshares. Lands: 11 Plains, 6 Mountain, 4 Sacred Foundry, 2 Secluded Steppe. Sideboard (registered): 3 Retribution of the Meek, 2 Disenchant, 2 Inspiring Overseer, 2 Swords to Plowshares, 2 Wave of Reckoning, 1 Blaze, 1 Tormod's Crypt, 1 Wall of Reverence, 1 Youthful Valkyrie; guide: 3 Retribution in against the hexproof shape.
- **UW Skies, walls** (`skieswall`, Azorius Skies with walls (W U); midrange) — 38.1 in matches, 40 in game one. 4 Dawnwing Marshal, 4 Inspiring Overseer, 4 Plumecreed Escort, 4 Restoration Angel, 4 Swords to Plowshares, 4 Traumatizer, 4 Wall of Air, 4 Youthful Valkyrie, 2 Pacifism, 2 Wave of Reckoning. Lands: 10 Island, 10 Plains, 4 Hallowed Fountain. Sideboard (registered): 3 Retribution of the Meek, 2 Disenchant, 2 Essence Scatter, 2 Protocol, 2 Wave of Reckoning, 1 Counterspell, 1 Longbow Archer, 1 Tormod's Crypt, 1 Wall of Reverence; guide: 3 Retribution in against the hexproof shape.
- **Naya Flash Snakes** (`naya`, Naya Flash (R G W); midrange) — 36 in matches, 45 in game one. 4 Birds of Paradise, 4 Flametongue Kavu, 4 Lightning Bolt, 4 Manaba, 4 Rage Cobra, 4 Reaper's Forerunner, 4 Restoration Angel, 4 Wall of Blossoms, 3 Little Bear, 3 Swords to Plowshares, 2 Llanowar Elves. Lands: 6 Forest, 4 Sacred Foundry, 4 Stomping Ground, 4 Temple Garden, 1 Mountain, 1 Plains.
- **UR Pyroclasm Control** (`urcontrol`, Izzet Control (U R); control) — 32.8 in matches, 36 in game one. 4 Brainstorm, 4 Counterspell, 4 Flametongue Kavu, 4 Lightning Bolt, 4 Pyroclasm, 4 Traumatizer, 4 Wall of Air, 3 Air Elemental, 3 Char, 2 Essence Scatter. Lands: 11 Island, 9 Mountain, 4 Steam Vents.

Archived: UB Mill and WB Wave Control. Not registered: Black Forest Ham (Chris's BG Elder list, 52 under the AI); Chris's UW Skies (above).

## The Open's three pillars as registered (unchanged this session)

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

## Deviations from the brief
1. **The `hexproof` shape counts a self-set size as large.** The brief's "power two or more" reads the printed power; Dungrove Elder's is `*` (0 in the def), so the shape as written would not see the deck it was made for.
2. **Part 1's guides are Retribution, not the brief's rows.** The brief's rows were measured or had been: the fourth Wave in White Skies (+2, post-S62), Diabolic Edict in BW (−3.4 main, Auras 45 → 37), the race rows for the black lists (nothing to bring). Retribution of the Meek arrived in the session (Chris) and beat every one; the brief's other rows were not run.
3. **The out-rule's `hexproof` word is not built.** The guides name what leaves (Swords, Pacifism, Doom Blade), which is the same thing for the five lists that have guides.
4. **Three cards and a word outside the brief** (Chris's, in the session): the pool's second round started before the planner's candidates.

## Concerns
1. **The ADR-167 audit of the "target player" family (Part 0) is owed.** Not started.
2. **The pilot is the white decks' ceiling.** Two of Chris's runs (White Skies 8–0, UW Skies 5–0) beat their lists' AI numbers by far, and the play diffs name the same habits: Swords spent on a Centaur Courser or a Llanowar Elves (the pilot casts it 1.4 a game, Chris three times in eighteen), a flash creature cast at once rather than held as protection, a pump spent when nothing needs it. Book 117 (removal waits for a creature worth it) exists and is not enough here. An AI study on these would likely move the white lists more than another card.
3. **Retribution of the Meek is a rare at tier 2** (Chris's ruling); Basilisk Collar too. Peasant's tiers have never been rarity; noted for the planner.
4. **The red-white aggro decks have no answer to Auras** (Tokens 23, the Muster 25 with Retribution, Stompy 23): they lose the race before a sorcery matters. Whether Peasant wants one is a pool question.
5. **The Collar decks lose to black removal by the same margin they beat creature decks**; the Collar is in no list.
6. **Seed variance is large in single pairings**: White Skies against Auras is 54 on seed 56 and 64 on seed 91 (160 and 400 matches). Paired runs (same seed, game one identical) are what the guide reads rest on.
7. Carried from S62: the Peasant score rates the cards of the decks that exist — it has no number for the three new cards (the test expects them unscored) and should be rebuilt when the seeds change; guides and out-rules are matched by cards across all formats.

## Registry entries added/changed
- Rules registry: **R-109** (destroy all creatures with power N or greater).
- Pool registry: Basilisk Collar, Wall of Razors, Retribution of the Meek (tier 2, Chris).
- Books: **128** (an equip priced on its host). Switch: `equiphost`.
- Data: Peasant's first `sideboard` and `guides` (five lists); `formats/peasant/matches.json` (the new table).
- Tools: `scripts/open/seat.py <list> tags…` — a trial's summary over every shard of a tag, with cast counts.

## Test status
`pnpm test`: 121 files, **1045 passed**, 2 skipped (the runner's worker time-outs under load show as "Errors" with no test failing). New: `sim/s63-collar.test.ts` (7), book 128; the S62 fuzz has eight lists (3,840 games with `FUZZ_FULL`). Re-pinned: the loader count (281), the tier tally (80 / 75 / 20 / 35), the Peasant score's unscored list. Ladder (book 128): mirror gate PASS.

## Suggested next
- **The rest of Session 63**: Part 2 (`OPEN_MEANS` generated, a reference page and a grid per format, plans as a parameter, `format:census --colors`), Part 3 (the triads' census), the Part 0 audit.
- **An AI study on the white decks' play** (Concerns 2), from Chris's two logs: when to spend Swords, holding a flash creature, the Marshal's pump.
- **The planner's second Peasant round**, drafted toward fliers and lifegain with a sweeper: what that shape lacks is card draw in white (White Skies is 45–49 against the black lists) and a way for black to approach Auras other than racing (BR 18–20).
- Still owed: recompress the art before a large push (if the storage cap bites); a journey played through a sitting.

## How to run
```
pnpm install && pnpm typecheck && pnpm test          # FUZZ_FULL=1 pnpm test for the full fuzz
pnpm viewer                                          # the app (dev); pnpm build:web before any push
pnpm ladder                                          # the AI gate — alone, ~4 min
scripts/open/rr.sh rec 100 [--format peasant]        # game one, every pairing, 8 shards → analysis/runs/scratch/rr/
scripts/open/rr.sh m 100 --matches 60 [--format peasant]
pnpm open:rr [--format peasant] --merge analysis/runs/scratch/rr/rec_?.json --out analysis/runs/rr.json     # then the means into OPEN_MEANS ("<format>:<list>")
pnpm open:rr [--format peasant] --matches-report analysis/runs/scratch/rr/m_?.json --record --out analysis/runs/matches.md
pnpm open:gen && pnpm reference                      # after any change under data/convocation/formats/
pnpm sideboard:show --format peasant --list br --vs elder,rabble
pnpm rating:format --format peasant [--write]        # the format's own card score
pnpm format:census --max-tier 2 ; pnpm format:rr --field <file> --max-tier 2    # a pool and a field that are not yet a format
pnpm open:rr … --max-turns 140                       # the turn limit on trial
pnpm open:rr … --off equiphost                      # book 128 off (also drawforlife, loopnet, laterpicks, and every earlier switch)
python3 scripts/open/seat.py <list> <tag>…           # a trial in one seat: matches, games, by opponent, casts
```
