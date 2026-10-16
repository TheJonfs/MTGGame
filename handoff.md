# Handoff — after Session 65 (2026-10-16)

## State of the world
**Four** Constructed formats with fields of their own: **the Open** (unchanged — Reaper Clio 72.2, Mardu Control 69.7, the Rabble 64.4), **Peasant** (tier two and below; re-run with books 130–132), and two triads — **Naya** (RGW, S64) and **Esper** (WUB, this session). Each triad is a rule (`colorsWithin` and the land rule `manaWithin`, ADR-181), a `formats/<id>/lists.json` of ten seeds, recorded tables, a reference page (`docs/reference/<id>-lists.md`) and a door; **its field is its own registered lists** (ADR-184). Book 57 reads the optional trigger from the request (as book 132 does); books 133–135 (from Chris's Convocation) are in. Peasant's table: Dungrove Auras 71.9, RW Tokens 59.3, BR Removal 59.0, White Skies 58.1, **UW Skies 57.9** (books 130–131), BR Djinn 57.9. Esper's: **BW Tokens 65.6**, the Writ 63.5, Dimir Tempo 57.8, UW Skies 57.0 … the Reanimator 17.6. Naya's (re-run): the Rabble 58.9, the Watch 58.0, **the Brood 56.9 — now Chris's list**. Everything is pushed.

## Done this session
- **Part 0.** S64's deviations ratified; **ADR-182** (a custom card's study), **ADR-183** (habits become rules), **ADR-184** (a triad's field is its own lists) recorded.
  - **ADR-184 built**: `selectCandidates` seats a field format's own registered lists only (no campaign deck — the Fordkeeper's stronghold list had sat in Naya); a format with fewer than eight borrows the Open's lists wholly legal in it, by strength. The Naya event test now insists on it; Peasant's is unchanged (its lists were already its own).
  - **Naya's names** (the plane's register): the Snakes → **the Brood**, GW Auras → **the Thicket**, RW Tokens → **the Watch**, Stompy → **the Stampede**, Lifegain → **the Chantry** (keys unchanged).
  - **Book 57 fixed as book 132 was**: the engine's optional-trigger request now carries the trigger's targets (`RequestSource.targets`), and the "a harmful may aimed only at ours is declined" read takes them from the request — the resolving trigger had left the stack the view shows. Off: `optionalsource`. **Ladder PASS.**
  - **Peasant's table re-run** with books 130–132 (recorded): Dungrove Auras 71.9, RW Tokens 59.3, BR Removal 59.0, White Skies 58.1, UW Skies 57.9, BR Djinn 57.9, BW 49.4, the Rabble 47.8, Mono-Black 47.4, Stompy 45.1, UW Skies (walls) 41.5, the Muster 40.3, Naya 38.1, UR Control 26.2. **The triangle holds**: Auras 78–80 over the black lists; White Skies 57 over Auras; BR Removal 52–48 over White Skies. UW Skies' rise is the books' (+4.6 in its seat; 46.9 at S64's table).
- **Part 1 — Esper** (`ESPER_FORMAT`, `formats/esper/`): white, blue and black; the land rule; the Open's restricted list where it applies; the door's line *"Esper — white, blue and black. Counters, sweepers and the long game; the finishers are few."*
  - **The census's first line** (`format:census --triads`): each triad's legends — **each has exactly one three-colour lord and three two-colour ministers** (Esper: the Dredger; Clio, Faldor, Isaura). Faldor (WU) is in no Esper seed.
  - **Ten seeds**, built to sixty (Chris: the newer cards in; the Jet Witch is the brief's "Witch"; Mono-Blue Tempo splashes black for Clio): Mono-Black Control (the Pall's shell without the Usher — Mardu's), **the Writ** (its eleven red and green lands swapped), **the Levy** (whole), **the Locks** (revived with its revisions; two Protocols, two Karmic Mentors, a Wave), **the Undertow** (revived; its green mana swapped; four Tome Scours), **WB Control** (Mardu Control's shape without Ushers or red — Karmic Mentor ×4, Restoration Angel, Vindicate, the Jet Witch, Wrath, Isaura, Emeria Angel, Blood Artist, Soul Warden), **UW Skies** (Peasant's, promoted: Serra and Emeria Angels, Faerie Formation, Control Magic, Tundras, the Observatory), **BW Tokens**, **Dimir Tempo**, **Esper Reanimator** (a plan, goal once: Artisan of Kozilek and Angel of the Ruins buried by Entomb and Buried Alive, returned by Zombify and Graceful Restoration).
  - **The tables** (game one 100 a pairing; matches 60 a pairing; recorded):

| list | matches | game one | after sideboarding |
|---|---|---|---|
| BW Tokens | 65.6 | 60 | +1.8 |
| the Writ | 63.5 | 56 | +4.7 |
| Dimir Tempo | 57.8 | 52 | +4.3 |
| UW Skies (Esper) | 57 | 53 | +3.7 |
| the Levy | 53.3 | 57 | -7.0 |
| WB Control | 50.4 | 55 | -7.9 |
| the Locks | 48.5 | 50 | -1.7 |
| the Undertow | 45.7 | 48 | -2.7 |
| Mono-Black Control | 40.6 | 41 | +4.1 |
| Esper Reanimator | 17.6 | 26 | -1.1 |

  - **The Dredger** (Esper's lord; 160 matches a pairing): the Locks 49.0 with four, 50.0 with four other fliers (two Serras, two Faerie Formations) — level; the Reanimator 17.4 with two, 17.5 with four. **Neither must-play nor wanted** in these lists (cast 1.15 a game in the Locks; his graveyard-recursion activation is a control card's, and the Locks win without him).
- **Part 2 — the read across the triads.** **Naya is even** (42.8–59.2; none over 65 in game one or matches). **Esper is wider** (40.6–65.6, and the Reanimator at 17.6), and its top is **BW Tokens** (over ADR-171's 65 in matches, 60 in game one) beside **the Writ** (Clio's counter-control, 63.5) — an aggro deck and a control deck, with tempo and fliers (Dimir Tempo, UW Skies) at 57–58. Esper's three things to do, from the top of its table: go wide (BW Tokens, the Levy), counter and draw (the Writ, Tempo), fly (UW Skies). **The Clio lists** after book 122: the Writ 63.5, Tempo 57.8, the Undertow 45.7. Neither triad has a working combo deck: the Reanimator is the Larder again (the Open archived it at 31), Esper's Usher-less Mono-Black is 40.6. **Neither triad reproduces the Open's shape in a smaller box** — the Open's pillars are an engine (Clio's snakes), a loop (the Usher) and a race (the Rabble); Naya has the race, Esper the counters, and the engines live in the colours each lacks.
- **Part 3 — for Chris**: his four-colour Karmic Mentor brew (3–2, outside the eight) recorded, not registered. **He then won a Naya-and-Esper Convocation** (`docs/debug_logs/recorded_games/convocation-games-day1-esper.json`, `…-30-naya-snakes.json`, `docs/debug_logs/convocation-17-2-naya-snakes.json`): Esper 4–1 with an Esper Clio list (Clio, Protocol, Vindicate, Restoration Angel, the Jet Witch, Counterspell, Wall of Reverence, Dawnwing Marshal, Gravitational Shift; Specters, Nighthawks and Graceful Restoration in), and Naya 7–1 with his Naya Snakes and Angels (4–1 in the Swiss, then the eight: the Rabble 2–1, the Warband 2–0, the Thicket 2–0).
  - **His Esper Clio list under the pilot** (160 matches a pairing, Mono-Black's seat): **55.6 with the builder's fifteen** (Swords, Control Magic, Wrath against the creature decks), **44.0 with his plan** as a guide (Specters and Nighthawks in against every list) — the plan does not travel to the pilot. Not registered.
  - **His Naya list**: 47.5 with the builder's fifteen, **53.3 with his** (+5.8 — the plan travels here: Kavus, Wraths and burn against the go-wide decks, sweepers against the Thicket). With **two Airship Crashes for the Seasoned Pyromancers** (Chris: for the Thicket's Auras and Pacifisms and the Tollgate's Minefields) and in the Brood's own seat it **beat the planner's seed 54.0 to 49.2** (the Tollgate 28 → 69, the Thicket 51 → 62, the Rabble 35 → 43; the Muster 59 → 50, Wurms 59 → 52). **Registered as the Brood** (Chris), with its fifteen and his plan as its guide; the Crash row fires against the hexproof shape and against artifacts-and-enchantments decks that are not small — the Thicket, the Tollgate, and (by their shapes) the Stampede (its Elders) and the Watch (its Anthems). **Naya's table re-run**: the Rabble 58.9, the Watch 58.0, the Brood 56.9, Wurms 52.1, the Stampede 52.0, the Muster 45.6, the Warband 44.4, the Tollgate 44.3, the Chantry 44.1, the Thicket 43.7.
  - **Books 133–135, from his games** (each seen in the replays): **133** — no second answer at a creature our own pending spell already kills (two Doom Blades at one Marshal, two Shocks at one Overseer, a Bolt after our own Swords; off `oneanswer`); **134** — a trigger's target already chosen by our own pending item is taken last (two Tidewalls returned one Doom Blade; off `distinctreturn`); **135** — a modal activation is read by its chosen mode (Arc Mage's split onto itself was invisible to the misaim rule — `actionEffects` read the ability's own empty effects), and a tap-and-discard pinger waits for the main phase, at a player for the opponent's end step (off `pingtiming`; S29's Arc Mage pin amended). Ladder PASS; paired in Esper: the Writ 62.6 → 62.2, Tempo 57.8 → 56.9 (level — corrections, kept).
- **After the handoff (post-S65)** — Chris's second Naya run and the board's legibility:
  - **The in-play note and the keyword glyphs** (Chris: Baru's Wurm token read as a vanilla 6/6). The engine's `characteristicsTrace` names each contribution to a permanent's live P/T, keywords and restrictions with its source card; the inspector lists every change from the printed card under the frame; a battlefield tile shows only the keywords gained (green ring) or lost (red ring, struck) against the printed card, each glyph's tooltip naming its source. Fourteen glyphs from the image skill, Chris's picks (`assets/generated/MANIFEST.md`).
  - **His experimental Naya list** (Snakes with Ruby Tyrants; `convocation-games-30-anothernaya.json`, read only, not studied): 5–0 in the Swiss, 0–2 in the quarterfinal to the Brood. Game one turned on his Sacred Helix's six life becoming six counters on their Karmic Mentor through their Rage Cobra; game two on one red source in five lands. Chris's read: Rage Cobra with a Manaba is one of Naya's pillars — fine, a 2/2 that folds to much removal.
  - **Book 136** (the probe: the Brood against every Naya list, 200 games — the life an opponent's Cobra was fed, by the action before it; the gainer's Helix was cast into a Cobra 8 times, mostly at low life, and even aimed at the Cobra it feeds, the Cobra seeing the gain before it dies, CR 603.2): `lifegainPayoffBonus` read any LIFE_GAINED trigger of ours as a payoff for OUR gain — our own Cobra, which watches the opponent's, paid our Lumen. Now the payoff is read by whose gain it watches, and the mirror: while the opponent controls one that watches ours, our life-gain plays cost what they would have paid (0.4 a life, 0.6 a lifelink or life-trigger creature; Helix's gain is the mana spent). Off `cobrafeed`. Ladder PASS; paired in Naya (the Brood's nine pairings, 160 a pairing): 53.1 → 53.3, 9 of 1,440 games changed (level — a correction, kept). The mirror pairing (the Brood against itself) is not in an `--only` run.
  - **Foxglove Dose — Chris's card, under study** (`data/cards-proposed/`, outside the pool until adopted): {1}{R} Instant, "Target creature gets +2/+0 until end of turn. Then if its power is 5 or greater, destroy it." Vocabulary: **R-112**, the `if` clause's `powerAtLeast`, read live after the pump (CR 608.2c, 613.4c — verified). Fuzz first (432 games, random and heuristic, replays identical), then fixtures. A single-factor grid in the Rabble's Char slot, both formats, 160 a pairing, paired on Char (Peasant 45.5, the Open 58.7), on the kill line (the printed power that dies: threshold less pump):

    | variant | Peasant Δ | Open Δ |
    |---|---|---|
    | 1R, +2, kill line 3 (the centroid) | +1.8 | −0.2 |
    | R | +3.3 | +1.1 |
    | 2R | +0.2 | −0.6 |
    | +3, kill line 3 | +1.8 | −0.2 (the same games: with the trick off the pump only sets the line) |
    | kill line 2 (dies at 4) | **+5.3** | +1.7 |
    | kill line 4 (dies at 6) | 0.0 | −2.3 |

    (each ±1.5.) The read: **the kill line is the card**; cost is a point or two a step; the trick is not measured (below). By opponent it is Char's opposite — toughness-blind removal gains against the big bodies Char's four cannot kill (the Elder's Wurms +11, Stompy +9, the Tollgate +9, the Wurmspeaker +8) and loses where Char goes face (the Writ −15, the Depths −4, Mono-Black −6). Per cast at the centroid (520 games a format): Peasant 349 cast, 337 kills; the Open 332 cast, 317 kills; in hand at the end 0.3 a game against Char's 0.1.
  - **Book 137** (the study's first probe: 112 of 414 Doses pumped a creature of theirs that lived — a Forerunner 1/1 made a 3/1 in an upkeep; the cast sat 0.6 under passing, but a held instant meets many windows): an instant or sorcery that only pumps its target and harms it under a condition is **refused** when the predictor says the target is still there no worse (theirs), or — on ours — outside combat or where ours would die. Off `misfire`. Its other half — the misaim rule standing aside for a conditioned harm, which lets the Dose be the trick on our own attacker — is **on trial only** (`conditionaim`): measured paired, the trick cost about two points in both formats (the pump spent on a goblin is the kill not kept), and the pilot has no term for that trade. So the grid above is the Dose as removal. Ladder PASS.
  - **For Chris**: the tier and the numbers (expected T2); whether the trick should be a design intent the pilot must learn, or the card is removal that happens to pump.

## The formats' lists
- **The Open**: `docs/reference/open-lists.md`; its pillars below.
- **Naya** (`docs/reference/naya-lists.md`; the table of 2026-10-16, with Chris's Brood):

| list | matches | game one | after sideboarding |
|---|---|---|---|
| the Rabble (Naya) | 58.9 | 56 | -0.2 |
| the Watch | 58 | 54 | +1.8 |
| the Brood | 56.9 | 56 | -1.8 |
| Mono-Green Wurms | 52.1 | 46 | +9.3 |
| the Stampede | 52 | 55 | -5.6 |
| the Muster | 45.6 | 47 | -0.7 |
| the Warband | 44.4 | 48 | -3.1 |
| the Tollgate | 44.3 | 49 | -4.5 |
| the Chantry | 44.1 | 45 | +1.1 |
| the Thicket | 43.7 | 44 | +3.5 |

- **Esper**: `docs/reference/esper-lists.md` (table above).
- **Peasant** (`formats/peasant/lists.json`; the table of 2026-10-16):
- **Dungrove Auras** (`elder`; midrange) — 71.9 in matches, 65 in game one. 4 Blanchwood Armor, 4 Dungrove Elder, 4 Gaean Wurm, 4 Gladecover Scout, 4 Llanowar Elves, 4 Rancor, 4 Wall of Blossoms, 3 Harmonize, 3 Reaper's Forerunner, 2 Centaur Courser, 2 Penumbra Wurm. Lands: 22 Forest.
- **RW Tokens** (`tokens`; aggro) — 59.3 in matches, 53 in game one. 4 Dawnwing Marshal, 4 Dragon Fodder, 4 Glorious Anthem, 4 Hordeling Outburst, 4 Lightning Bolt, 4 Raise the Alarm, 4 Soul Warden, 4 Young Pyromancer, 3 Flametongue Kavu, 2 Captain of the Watch. Lands: 10 Plains, 9 Mountain, 4 Sacred Foundry.
- **BR Removal** (`br`; midrange) — 59 in matches, 56 in game one. 4 Blood Artist, 4 Child of Night, 4 Doom Blade, 4 Flametongue Kavu, 4 Lightning Bolt, 4 Nekrataal, 4 Typhoid Rats, 4 Vampire Nighthawk, 2 Gravedigger, 2 Reassembling Skeleton, 1 Terror. Lands: 12 Swamp, 7 Mountain, 4 Blood Crypt.
- **White Skies** (`wskies`; midrange) — 58.1 in matches, 58 in game one. 4 Dazzling Angel, 4 Inspiring Overseer, 4 Restoration Angel, 4 Soul Warden, 4 Swords to Plowshares, 4 Vitalist, 4 Wall of Reverence, 4 Youthful Valkyrie, 3 Wave of Reckoning, 2 Karmic Mentor. Lands: 23 Plains. Sideboard (registered): 3 Retribution of the Meek, 2 Captain of the Watch, 2 Disenchant, 2 Glorious Anthem, 2 Pacifism, 1 Longbow Archer, 1 Savannah Lions, 1 Tormod's Crypt, 1 Wave of Reckoning; guide: 3 Retribution in against the hexproof shape.
- **BR Djinn** (`brdjinn`; midrange) — 57.9 in matches, 55 in game one. 4 Blood Artist, 4 Child of Night, 4 Doom Blade, 4 Flametongue Kavu, 4 Lightning Bolt, 4 Nekrataal, 4 Typhoid Rats, 4 Vampire Nighthawk, 3 Gallows Djinn, 2 Char. Lands: 12 Swamp, 7 Mountain, 4 Blood Crypt.
- **UW Skies** (`skies`; midrange) — 57.9 in matches, 51 in game one. 4 Counterspell, 4 Dawnwing Marshal, 4 Inspiring Overseer, 4 Plumecreed Escort, 4 Restoration Angel, 4 Swords to Plowshares, 4 Traumatizer, 4 Youthful Valkyrie, 2 Karmic Mentor, 2 Wave of Reckoning. Lands: 10 Island, 10 Plains, 4 Hallowed Fountain. Sideboard (registered): 3 Retribution of the Meek, 2 Disenchant, 2 Essence Scatter, 2 Protocol, 2 Wave of Reckoning, 1 Arcane Collector, 1 Tormod's Crypt, 1 Wall of Air, 1 Wall of Reverence; guide: 3 Retribution in against the hexproof shape.
- **BW Aristocrats** (`bw`; midrange) — 49.4 in matches, 50 in game one. 4 Blood Artist, 4 Child of Night, 4 Doom Blade, 4 Nekrataal, 4 Restoration Angel, 4 Soul Warden, 4 Swords to Plowshares, 4 Vampire Nighthawk, 3 Vitalist, 2 Captain of the Watch. Lands: 10 Swamp, 9 Plains, 4 Godless Shrine. Sideboard (registered): 3 Retribution of the Meek, 3 Tendrils of Corruption, 2 Disenchant, 2 Inspiring Overseer, 2 Wave of Reckoning, 1 Tormod's Crypt, 1 Wall of Reverence, 1 Youthful Valkyrie; guide: 3 Retribution in against the hexproof shape.
- **the Rabble (Peasant)** (`rabble`; aggro) — 47.8 in matches, 49 in game one. 4 Char, 4 Dragon Fodder, 4 Flametongue Kavu, 4 Goblin Chieftain, 4 Goblin Grenade, 4 Goblin Matron, 4 Hordeling Outburst, 4 Lightning Bolt, 4 Raging Goblin, 2 Boggart Brute, 2 Goblin Piker. Lands: 20 Mountain.
- **Mono-Black Removal** (`mbc`; midrange) — 47.4 in matches, 45 in game one. 4 Child of Night, 4 Doom Blade, 4 Nekrataal, 4 Sign in Blood, 4 Typhoid Rats, 4 Vampire Nighthawk, 3 Gallows Djinn, 3 Gravedigger, 3 Terror, 2 Blood Artist, 2 Tendrils of Corruption. Lands: 23 Swamp.
- **RG Stompy** (`stompy`; aggro) — 45.1 in matches, 50 in game one. 4 Centaur Courser, 4 Flametongue Kavu, 4 Grizzly Bears, 4 Lightning Bolt, 4 Llanowar Elves, 4 Rancor, 4 Rumbling Baloth, 3 Gaean Wurm, 3 Mother Bear, 3 Reaper's Forerunner, 2 Birds of Paradise. Lands: 13 Forest, 4 Mountain, 4 Stomping Ground.
- **UW Skies, walls** (`skieswall`; midrange) — 41.5 in matches, 45 in game one. 4 Dawnwing Marshal, 4 Inspiring Overseer, 4 Plumecreed Escort, 4 Restoration Angel, 4 Swords to Plowshares, 4 Traumatizer, 4 Wall of Air, 4 Youthful Valkyrie, 2 Pacifism, 2 Wave of Reckoning. Lands: 10 Island, 10 Plains, 4 Hallowed Fountain. Sideboard (registered): 3 Retribution of the Meek, 2 Disenchant, 2 Essence Scatter, 2 Protocol, 2 Wave of Reckoning, 1 Counterspell, 1 Longbow Archer, 1 Tormod's Crypt, 1 Wall of Reverence; guide: 3 Retribution in against the hexproof shape.
- **the Muster (Peasant)** (`muster`; aggro) — 40.3 in matches, 44 in game one. 4 Fencing Ace, 4 Flametongue Kavu, 4 Glorious Anthem, 4 Lightning Bolt, 4 Longbow Archer, 4 Raise the Alarm, 4 Savannah Lions, 4 Soul Warden, 3 Restoration Angel, 2 Swords to Plowshares. Lands: 11 Plains, 6 Mountain, 4 Sacred Foundry, 2 Secluded Steppe. Sideboard (registered): 3 Retribution of the Meek, 2 Disenchant, 2 Inspiring Overseer, 2 Swords to Plowshares, 2 Wave of Reckoning, 1 Blaze, 1 Tormod's Crypt, 1 Wall of Reverence, 1 Youthful Valkyrie; guide: 3 Retribution in against the hexproof shape.
- **Naya Flash Snakes** (`naya`; midrange) — 38.1 in matches, 46 in game one. 4 Birds of Paradise, 4 Flametongue Kavu, 4 Lightning Bolt, 4 Manaba, 4 Rage Cobra, 4 Reaper's Forerunner, 4 Restoration Angel, 4 Wall of Blossoms, 3 Little Bear, 3 Swords to Plowshares, 2 Llanowar Elves. Lands: 6 Forest, 4 Sacred Foundry, 4 Stomping Ground, 4 Temple Garden, 1 Mountain, 1 Plains.
- **UR Pyroclasm Control** (`urcontrol`; control) — 26.2 in matches, 32 in game one. 4 Brainstorm, 4 Counterspell, 4 Flametongue Kavu, 4 Lightning Bolt, 4 Pyroclasm, 4 Traumatizer, 4 Wall of Air, 3 Air Elemental, 3 Char, 2 Essence Scatter. Lands: 11 Island, 9 Mountain, 4 Steam Vents.

## The Open's three pillars as registered (unchanged)

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
1. **"The Witch" is the Jet Witch** (Chris); **"Mono-Blue Tempo" splashes black for Clio** (Chris) — Dimir Tempo.
2. **The Writ and the Undertow are not Esper-legal whole**: their red and green lands (and the Undertow's Mox Emerald) were swapped for Esper's, as the Rabble's were for Naya.
3. **The Reanimator's "without the Dredger" trial over-filled the Angels** (five, one over the cap — my swap) — read as no more than a direction (14.9); the two- and four-Dredger runs stand.
4. **"The format's three things to do from the top-eight sub-table"** read from the top of the match table (no separate sub-table exists).

## Concerns
1. **BW Tokens is over 65 in matches** (65.6; 60 in game one) on a first draft of a format a day old — ADR-171's line, as Dungrove Auras was in Peasant. Esper has a sweeper family (Wrath, the Wave, Retribution in no list) the seeds use lightly.
2. **The Reanimator plan does not work** (17.6): Zombify is cast 0.89 a game, Entomb 0.87 and Buried Alive 0.57, yet it wins about one match in six — the Larder's read in the Open (archived at 31). **Not probed**: whether the plan's pieces are in the graveyard when Zombify is cast, or whether the shape is simply too slow in Esper, is the probe's to say (ADR-167) before any rule.
3. **Mono-Black Control without the Usher is weak** (40.6): the Pall's shell was the loop's.
4. **Each triad's lord is optional so far**: the Fordkeeper is wanted by some Naya lists, the Dredger by none in Esper. Faldor (WU) is unseeded.
5. **The triad tables are single-seed** and the seeds untuned.
6. **A person's sideboard plan travels to the pilot only sometimes**: Chris's Naya plan +5.8, his Esper plan −11.6 against the builder's. Registered guides should be measured, as ADR-168 says, not copied from a winning run.
7. **The Thicket and the Tollgate fall with the new Brood** (−4.4, −5.5): enchantment answers (Disenchant, Airship Crash) are now in the format's best lists.
8. Carried: the triangle in Peasant holds by small margins; the red-white aggro decks have no answer to Auras; guides and out-rules are matched by cards across formats.

## Registry entries added/changed
- Formats: **Esper** (`ESPER_FORMAT`, `formats/esper/` — lists, means, matches; `docs/reference/esper-lists.md`); Naya's five names.
- Engine: `RequestSource.targets` (an optional trigger's targets on its request).
- Books: **57** amended (`optionalsource`); **133** (`oneanswer`), **134** (`distinctreturn`), **135** (`pingtiming`).
- Naya: the Brood replaced by Chris's list (its fifteen and guide); the table re-recorded.
- World: `selectCandidates` (ADR-184); the census's legends line.
- Plans: `esper:reanimator` (generated).

## Test status
`pnpm test`: 129 files, **1,078 passed**, 2 skipped (post-S65: the trace, the in-play lines, books 136–137, Foxglove Dose's fixtures and fuzz). New: `world/s65-esper-event.test.ts` (2: the colours and the land rule; an Esper event to a champion), books 57 and 133–135 pinned (S29's Arc Mage case amended); the Naya event test now requires its own lists only. Ladder (book 57; books 133–135): mirror gate PASS.

## Suggested next
- **The third triad, by what the two say the family lacks**: both triads lack the Open's engines — **RWB (Mardu)** holds the Usher (the loop) and Mardu Control's shell, and would test whether a triad *with* an engine produces the Open's shape; **URW (Jeskai)**, the census's most balanced, is the steadier choice. The implementer's read: **Mardu**, for the question the brief asks.
- **BW Tokens over 65** in Esper (Concerns 1) and **the Reanimator's plan** (Concerns 2) — a probe before any rule.
- **Faldor** in an Esper list (the unseeded minister).
- Still owed: a Naya or Esper Convocation played; a journey through a sitting.

## How to run
```
pnpm install && pnpm typecheck && pnpm test          # FUZZ_FULL=1 pnpm test for the full fuzz
pnpm viewer                                          # the app (dev); pnpm build:web before any push
pnpm ladder                                          # the AI gate — alone, ~4 min
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
```
