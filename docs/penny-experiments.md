# The tier-two format (working name "Penny") — first experiments (2026-10-12, after Session 61)

**The format is Peasant (ADR-176, Session 62); "Penny" is retired.** This file keeps its name because the Session 62 brief cites it. The lists here were the drafts; the seeds, the ten cards added since and the tables of record are in `handoff.md` and `data/convocation/formats/peasant/`.

*The name is Chris's working one and may change. It appears in this file's name and in `data/convocation/experiments/penny-field*.json` only — no code, test or generated file carries it. The tools take a tier ceiling (`--max-tier 2`), not a name.*

For the planner. Chris proposed Penny — tier 1 and tier 2 cards — in place of Pauper's tier 1 alone; these are a census
and two game-one round-robins of first-draft lists, to say what the format looks like before seeds are drafted.
**Everything here is the AI piloting first drafts in game one; nothing is sideboarded and nothing is tuned.**

Reproduce: `pnpm format:census --max-tier 2`; `pnpm format:rr --field data/convocation/experiments/penny-field2.json --max-tier 2 --games 200 --seed 63`. Round 3: `penny-field3.json`, `--seed 64`.

## The pool

140 of the Open's 239 cards (basics apart); 65 are new at tier 2. Green 27 (21 creatures), red 26, blue 24, black 23,
white 17, colourless 6, lands 17. **All ten shock lands are legal** (no original duals, no High Grounds, no power).
**No gold card and no legendary creature**: no Clio, no Usher, no Reaper, no Lumen, no Jet Witch, no Vindicate, Putrefy
or Sacred Helix, no Mystic Snake. One sweeper (Pyroclasm; Wrath of God and Savage Twister are out); two counterspells
(Counterspell, Essence Scatter); one steal (Protocol); eleven removal or burn spells (Swords, Doom Blade, Terror,
Tendrils, Bolt, Char, Shock, Blaze, Abrade, Goblin Grenade, Airship Crash) and the removal on bodies — **Flametongue
Kavu, Nekrataal, Reaper's Forerunner**. Five creatures of power four or more (the Kavu, Air Elemental, Gallows Djinn,
Rumbling Baloth, Thundersnake); nothing costs more than five. The reanimation spells are legal (Buried Alive, Entomb,
Zombify, Unearth, Dark Ritual) with nothing worth returning. **Baru and Pelakka Wurm are not legal** (tier 3 and above),
so the Wurm deck Chris sketched is Gaean Wurm and Rumbling Baloth only.

## Round-robin 2 — eleven lists, 200 games a pairing (± 7 a cell), the row's win rate

| | BR Removal | Rabble (port) | RG Stompy | Muster (port) | UW Skies | BW Aristocrats | Naya Flash Snakes | UB Control | Warband (port) | UR Pyroclasm Control | UG Block and Mill | **mean** | turns |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **BR Removal** | — | 61 | 65 | 56 | 46 | 72 | 71 | 73 | 72 | 73 | 83 | **67.0** | 23.6 |
| **Rabble (port)** | 39 | — | 43 | 43 | 58 | 56 | 51 | 71 | 66 | 72 | 75 | **57.1** | 18.2 |
| **RG Stompy** | 36 | 57 | — | 56 | 56 | 38 | 57 | 61 | 65 | 60 | 83 | **56.8** | 17.7 |
| **Muster (port)** | 45 | 58 | 44 | — | 56 | 46 | 53 | 57 | 62 | 52 | 76 | **54.7** | 18.8 |
| **UW Skies** | 54 | 42 | 44 | 44 | — | 58 | 55 | 55 | 52 | 63 | 80 | **54.6** | 19.9 |
| **BW Aristocrats** | 28 | 44 | 62 | 55 | 42 | — | 53 | 47 | 58 | 49 | 70 | **50.6** | 25.4 |
| **Naya Flash Snakes** | 30 | 50 | 44 | 47 | 45 | 47 | — | 52 | 54 | 49 | 60 | **47.5** | 21.8 |
| **UB Control** | 27 | 30 | 39 | 44 | 45 | 54 | 49 | — | 42 | 61 | 80 | **46.8** | 25.2 |
| **Warband (port)** | 29 | 35 | 35 | 38 | 48 | 43 | 47 | 59 | — | 50 | 77 | **45.8** | 19.1 |
| **UR Pyroclasm Control** | 28 | 28 | 40 | 48 | 37 | 52 | 52 | 40 | 50 | — | 60 | **43.3** | 27.0 |
| **UG Block and Mill** | 17 | 26 | 17 | 24 | 21 | 31 | 41 | 20 | 24 | 40 | — | **25.8** | 19.0 |

27 games drawn (brmid v bwlife 11, naya v rabble 2, rabble v warband 2, naya v urctl 2); ends: {'LIFE': 10071, 'DECKED': 902, 'DRAW': 12, 'MAX_TURNS': 15}.

## Round-robin 1 — the first six, 300 games a pairing (± 6)

| | BR Removal | Rabble (port) | UW Skies | Muster (port) | Naya Flash Snakes | UG Block and Mill | **mean** | turns |
|---|---|---|---|---|---|---|---|---|
| **BR Removal** | — | 58 | 47 | 59 | 71 | 84 | **63.8** | 21.4 |
| **Rabble (port)** | 42 | — | 50 | 54 | 53 | 75 | **54.7** | 17.7 |
| **UW Skies** | 53 | 50 | — | 44 | 50 | 77 | **54.6** | 17.9 |
| **Muster (port)** | 41 | 46 | 56 | — | 44 | 74 | **52.2** | 18.1 |
| **Naya Flash Snakes** | 29 | 48 | 50 | 56 | — | 63 | **49.3** | 20.7 |
| **UG Block and Mill** | 16 | 25 | 23 | 26 | 37 | — | **25.4** | 18.1 |

## Round-robin 3 — the top five, and what was tried against them (200 games a pairing, ± 7)

Three questions: does a tuned Skies beat the aggro decks; is BR Removal one list or a family; what else lines up against it.

| | BR Removal | BR Removal, Djinn and Char | Mono-Black Removal | RG Stompy | Rabble (port) | RW Tokens | Muster (port) | UW Skies | UW Skies, walls for counters | UW Anthem Skies | GW Hexproof Auras | **mean** | turns |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **BR Removal** | — | 46 | 56 | 68 | 58 | 55 | 56 | 50 | 52 | 52 | 81 | **57.1** | 24.1 |
| **BR Removal, Djinn and Char** | 54 | — | 62 | 65 | 51 | 54 | 58 | 48 | 54 | 55 | 70 | **57.0** | 23.3 |
| **Mono-Black Removal** | 44 | 38 | — | 72 | 63 | 56 | 55 | 40 | 41 | 47 | 87 | **54.1** | 25.4 |
| **RG Stompy** | 33 | 35 | 29 | — | 53 | 59 | 61 | 65 | 55 | 61 | 71 | **52.0** | 17.1 |
| **Rabble (port)** | 42 | 49 | 37 | 47 | — | 48 | 52 | 60 | 63 | 61 | 62 | **51.9** | 17.4 |
| **RW Tokens** | 46 | 46 | 45 | 41 | 53 | — | 53 | 60 | 58 | 62 | 57 | **51.8** | 17.0 |
| **Muster (port)** | 44 | 42 | 46 | 39 | 49 | 48 | — | 57 | 53 | 63 | 57 | **49.5** | 17.6 |
| **UW Skies** | 51 | 52 | 61 | 35 | 40 | 40 | 43 | — | 65 | 54 | 48 | **48.8** | 18.8 |
| **UW Skies, walls for counters** | 48 | 47 | 59 | 45 | 37 | 42 | 48 | 36 | — | 57 | 67 | **48.5** | 20.4 |
| **UW Anthem Skies** | 49 | 46 | 53 | 40 | 40 | 39 | 38 | 46 | 43 | — | 51 | **44.1** | 17.5 |
| **GW Hexproof Auras** | 20 | 30 | 13 | 29 | 38 | 43 | 44 | 52 | 33 | 50 | — | **35.0** | 16.9 |

84 games drawn, 71 of them at the hundred-turn limit between a black-red list and the mono-black one (18% of those two pairings): two decks of deathtouch blockers and lifelink that will not attack into each other. A sideboarded table will carry these as half-wins.

- **BR Removal is a family, not a list.** The Djinn-and-Char build is level with the first (57 each in this field; 54–46 head to head). Mono-black without the red (no Kavu, no Bolt) still beats the aggro decks — Stompy 72, the Rabble 63 — but loses to both black-red builds and to Skies (40): **the red is what makes it the best deck, and black alone is what beats aggro.**
- **Skies stays even with BR Removal (50–52) and could not be tuned to beat aggro.** Walls of Air and Pacifisms for the Counterspells and Air Elementals moved Stompy from 35 to 45 and the Muster from 43 to 48, the Rabble not at all (40, 37), and lost the mirror. An Anthem build was worse everywhere. Skies is a 49 in this field: the format's check on BR Removal, and prey for everything fast.
- **Go-wide tokens (RW, Young Pyromancer and the Anthem) is a 52 and the closest aggro deck to BR Removal (46)** — spot removal trades one for one with half a card.
- **Hexproof auras did not work (35)**: one hexproof creature in the pool (Gladecover Scout) is not a deck.
- In a field this top-heavy (three black lists, three Skies) every mean is pulled to 50; the first table's 67 for BR Removal is the fairer figure against a spread of decks.

## What the pool is missing (for the next session's cards; the implementer's read)

Each is a gap the tables showed, with what kind of card would fill it. The engine has no protection and no regeneration (manifest: hexproof, shroud and indestructible stand in), so the suggestions stay inside that.

1. **Nothing goes over the top.** No creature costs more than five; the largest are a 5/5 with a drawback (Gallows Djinn) and two 4/4s. Green has eleven ways to make mana (Llanowar, Birds, Manaba, Wood Elves, Rampant Growth, Werebear) and nothing to spend it on, and the reanimation package (Buried Alive, Entomb, Zombify, Unearth, Dark Ritual) has nothing to return. **One or two real finishers at tier 2** would create the ramp deck and the reanimator deck at once. The pool already holds candidates one tier up: Rampaging Baloths, Pelakka Wurm, Baru (Chris's Wurm list), Faerie Formation, Serra Angel.
2. **Control has no sweeper that matters and no way to pull ahead.** Pyroclasm is the only sweeper and did not turn the Rabble matchup (28) — the format's best creatures have toughness two with a Chieftain behind them or are a Kavu. Card advantage is Divination and Brainstorm. **A sweeper that kills toughness three or four** (or Wrath of God at tier 2) **and one real card-advantage spell** are the two cards a control deck is waiting for; without them the format has two speeds, aggro and midrange.
3. **Nothing punishes removal on bodies.** Flametongue Kavu, Nekrataal, Reaper's Forerunner and Typhoid Rats are why BR Removal is the best deck, and the answers to them are thin: one hexproof creature, one shroud creature (Blurred Mongoose), one indestructible (Darksteel Myr, 0/1), two recursive ones (Reassembling Skeleton, Gravedigger). **Sturdy threats** — hexproof or shroud on a body worth protecting, a creature that leaves something behind when it dies, a creature that returns — would give aggro and midrange a way to fight it that is not "be Skies". If the Kavu or the Nekrataal is to be the format's lever instead, both are tier 2 and one step up removes them.
4. **Blockers stop at toughness four.** "Big enough butts" is Wall of Air (1/5), Wall of Blossoms, Traumatizer, Treetop Snarespinner (x/4) and Youthful Valkyrie (1/3). A Kavu kills every one of them but the Wall of Air. A defensive deck wants **a blocker with toughness five or more that does something** at three or four mana.
5. **White is the thin colour** (17 cards; one removal spell and Pacifism; no card advantage; nothing above four mana). Its decks are the Muster and half of Skies. A white four- or five-drop worth playing (Serra Angel is tier 3) and a second white answer would make it a colour and not a splash.
6. **Mill is two cards short.** Hedron Crab, Altar of Dementia and the Traumatizer are all legal and the deck was last by thirty points: the Crab is slow without fetches (Evolving Wilds only), the Altar has nothing large to eat, and the Traumatizer needs evasion. It wants a second engine (a repeatable mill permanent) — or it is simply not a tier-two deck.
7. **No combination deck at all.** That may be the format's character, deliberately: the Open is where the Usher lives. Flagged so that it is a choice.
8. **A stall risk to design against:** black mirrors drew one game in five at the turn limit. Any card that breaks a ground stall (evasion in black, a repeatable drain, a pinger) helps the format finish its games; the Tollgate has the same problem in the Open.

**Cards that would matter to the Open too**, if they came in at tier 1 or 2: a sturdy threat (item 3) is what the Open's non-pillar aggro decks lack against Reaper Clio and Mardu Control; a five-toughness blocker (item 4) is what the Tollgate and the Sweep would play at once; a mid-range sweeper (item 2) changes Mardu Control's and the Writ's sideboards.

## What the numbers say (rounds 1 and 2)

- **The deck to beat is not the Rabble; it is black-red removal on bodies** — Typhoid Rats, Child of Night, Nighthawk,
  Nekrataal, Flametongue Kavu, Blood Artist, with Doom Blade and Bolt. 67 against the field of eleven, 61 over the
  Rabble, 56–73 over everything but one list. Every creature in it trades up or kills something on entering, and with
  Clio and the Usher gone nothing goes over the top of that.
- **UW Skies is its one bad matchup (46–54)** and the only list above 50 against it: fliers the ground removal trades
  with badly, Swords, and Restoration Angel. Skies is otherwise middling (it loses to the three aggro decks).
- **The Rabble's port is a good deck, not a pillar** (57): it beats the control decks (71, 72) and the mill deck, and
  loses to BR Removal, the Muster and RG Stompy. Without Seasoned Pyromancer, Siege-Gang and the power it has less reach.
- **RG Stompy (57) and the Muster (55)** are the other two real decks: Rancor on a Baloth, and the Anthem.
- **The control decks did not work** in the AI's hands (UB 47, UR Pyroclasm 43): four Pyroclasms did not make the
  Rabble a good matchup (28). One sweeper that kills toughness two is not enough against decks whose best creatures
  are the Kavu, the Brute and the Chieftain's 3/3 goblins.
- **Naya Flash Snakes is a 48**: every card was cast (the Manaba 1.2 a game, the Forerunner 1.0), it is even with the
  aggro decks and loses badly to BR Removal (30) — its mana creatures are what the Rats and the Nekrataal are for.
- **Block and mill is last by a distance (26).** It does win by decking (about half its wins), but the Traumatizer
  needs creature damage to connect and the list has six evasive bodies; the Crab and the Altar alone are too slow. The
  Traumatizer is better in Skies (where it is cast once a game and flies with seven other fliers).
- **No card went uncast** in any list (the check that would have caught the Purge).

## What this suggests for the seeds (the implementer's read; untested)

1. Penny is a **creature-and-removal format with no combination deck and no control deck yet**. The triangle on this
   evidence: BR Removal > the aggro decks (Rabble, Stompy, Muster) > Skies > BR Removal. Whether that triangle holds
   after a sideboarded match table is the first thing to measure.
2. **BR Removal at 67 on a first draft is the Reaper Clio of this format** and may want the same watch (ADR-171's
   line): Flametongue Kavu and Nekrataal are the two cards every midrange list wants, and both are tier 2.
3. **Control needs a card**: a second sweeper at tier 2, or a blocker that survives a Kavu (Wall of Air is the only
   one and it is in the worst-performing list). Chris's "big enough butts to block" exists only as Wall of Air (1/5),
   Wall of Blossoms (0/4), Traumatizer (2/4), Snarespinner (1/4) and Youthful Valkyrie (1/3).
4. **The tools need the format switch first** (the handoff's Pauper note): `open:rr`, its sideboarding, the tables of
   record and the guides' shapes are the Open's. `format:rr` is a stopgap that plays game one of any field.

## The lists


- **Rabble (port)** (`rabble`, piloted as aggro): 20 Mountain, 4 Raging Goblin, 4 Dragon Fodder, 4 Hordeling Outburst, 4 Goblin Chieftain, 4 Goblin Grenade, 4 Lightning Bolt, 4 Char, 4 Flametongue Kavu, 4 Goblin Matron, 2 Boggart Brute, 2 Goblin Piker
- **Muster (port)** (`muster`, piloted as aggro): 4 Sacred Foundry, 11 Plains, 6 Mountain, 2 Secluded Steppe, 4 Savannah Lions, 4 Soul Warden, 4 Suntail Hawk, 4 Fencing Ace, 3 Restoration Angel, 4 Raise the Alarm, 4 Glorious Anthem, 4 Lightning Bolt, 2 Swords to Plowshares, 4 Flametongue Kavu
- **UW Skies** (`skies`, piloted as midrange): 4 Hallowed Fountain, 10 Plains, 10 Island, 4 Youthful Valkyrie, 4 Inspiring Overseer, 4 Plumecreed Escort, 3 Cloudkin Seer, 4 Restoration Angel, 4 Traumatizer, 2 Air Elemental, 4 Swords to Plowshares, 4 Counterspell, 3 Pacifism
- **BR Removal** (`brmid`, piloted as midrange): 4 Blood Crypt, 12 Swamp, 7 Mountain, 4 Typhoid Rats, 4 Blood Artist, 4 Child of Night, 4 Vampire Nighthawk, 4 Nekrataal, 4 Flametongue Kavu, 2 Reassembling Skeleton, 2 Gravedigger, 4 Doom Blade, 1 Terror, 4 Lightning Bolt
- **UG Block and Mill** (`mill`, piloted as midrange): 4 Breeding Pool, 4 Evolving Wilds, 9 Forest, 5 Island, 4 Hedron Crab, 4 Birds of Paradise, 4 Wall of Blossoms, 4 Deadly Recluse, 4 Traumatizer, 4 Gaean Wurm, 3 Rumbling Baloth, 3 Altar of Dementia, 3 Cloudkin Seer, 3 Counterspell, 2 Rampant Growth
- **Naya Flash Snakes** (`naya`, piloted as midrange): 4 Stomping Ground, 4 Temple Garden, 4 Sacred Foundry, 6 Forest, 1 Mountain, 1 Plains, 4 Manaba, 4 Birds of Paradise, 2 Llanowar Elves, 4 Rage Cobra, 4 Reaper's Forerunner, 3 Little Bear, 4 Restoration Angel, 4 Flametongue Kavu, 4 Wall of Blossoms, 4 Lightning Bolt, 3 Swords to Plowshares
- **UR Pyroclasm Control** (`urctl`, piloted as control): 4 Steam Vents, 11 Island, 9 Mountain, 4 Pyroclasm, 4 Lightning Bolt, 4 Counterspell, 2 Essence Scatter, 4 Flametongue Kavu, 4 Wall of Air, 4 Traumatizer, 3 Air Elemental, 4 Brainstorm, 3 Char
- **UB Control** (`ubctl`, piloted as control): 4 Watery Grave, 10 Island, 10 Swamp, 4 Counterspell, 2 Essence Scatter, 4 Doom Blade, 2 Terror, 3 Protocol, 4 Vampire Nighthawk, 4 Nekrataal, 4 Traumatizer, 3 Air Elemental, 4 Typhoid Rats, 2 Brainstorm
- **BW Aristocrats** (`bwlife`, piloted as midrange): 4 Godless Shrine, 9 Plains, 10 Swamp, 4 Soul Warden, 4 Blood Artist, 4 Child of Night, 4 Vampire Nighthawk, 4 Nekrataal, 4 Restoration Angel, 3 Vitalist, 2 Typhoid Rats, 4 Swords to Plowshares, 4 Doom Blade
- **RG Stompy** (`stompy`, piloted as aggro): 4 Stomping Ground, 13 Forest, 4 Mountain, 4 Llanowar Elves, 2 Birds of Paradise, 4 Grizzly Bears, 3 Mother Bear, 4 Centaur Courser, 4 Rumbling Baloth, 3 Gaean Wurm, 4 Rancor, 4 Flametongue Kavu, 4 Lightning Bolt, 3 Reaper's Forerunner
- **Warband (port)** (`warband`, piloted as aggro): 4 Sacred Foundry, 15 Mountain, 2 Plains, 4 Skirk Prospector, 4 Goblin Piker, 4 Goblin Chieftain, 4 Boggart Brute, 3 Goblin Matron, 4 Hordeling Outburst, 4 Goblin Grenade, 4 Lightning Bolt, 4 Flametongue Kavu, 2 Swords to Plowshares, 2 Raging Goblin
- **UW Skies, walls for counters** (`skies_wall`, piloted as midrange; round 3): 4 Hallowed Fountain, 10 Plains, 10 Island, 4 Youthful Valkyrie, 4 Inspiring Overseer, 4 Plumecreed Escort, 2 Cloudkin Seer, 4 Restoration Angel, 4 Traumatizer, 4 Wall of Air, 4 Swords to Plowshares, 4 Pacifism, 2 Soul Warden
- **UW Anthem Skies** (`skies_anthem`, piloted as aggro; round 3): 4 Hallowed Fountain, 13 Plains, 6 Island, 4 Suntail Hawk, 4 Youthful Valkyrie, 4 Inspiring Overseer, 4 Plumecreed Escort, 4 Restoration Angel, 4 Glorious Anthem, 4 Swords to Plowshares, 3 Pacifism, 3 Traumatizer, 3 Cloudkin Seer
- **BR Removal, Djinn and Char** (`br_djinn`, piloted as midrange; round 3): 4 Blood Crypt, 12 Swamp, 7 Mountain, 4 Typhoid Rats, 4 Blood Artist, 4 Child of Night, 4 Vampire Nighthawk, 4 Nekrataal, 4 Flametongue Kavu, 3 Gallows Djinn, 4 Doom Blade, 4 Lightning Bolt, 2 Char
- **Mono-Black Removal** (`mbc`, piloted as midrange; round 3): 23 Swamp, 4 Typhoid Rats, 4 Child of Night, 4 Vampire Nighthawk, 4 Nekrataal, 3 Gallows Djinn, 3 Gravedigger, 3 Blood Artist, 3 Phyrexian Rager, 4 Doom Blade, 3 Terror, 2 Tendrils of Corruption
- **GW Hexproof Auras** (`hexproof`, piloted as aggro; round 3): 4 Temple Garden, 12 Forest, 5 Plains, 4 Gladecover Scout, 4 Llanowar Elves, 4 Grizzly Bears, 4 Centaur Courser, 3 Rumbling Baloth, 4 Rancor, 4 Blanchwood Armor, 3 Spirit Link, 2 Giant Growth, 3 Swords to Plowshares, 4 Reaper's Forerunner
- **RW Tokens** (`tokens`, piloted as aggro; round 3): 4 Sacred Foundry, 9 Plains, 9 Mountain, 4 Soul Warden, 4 Young Pyromancer, 4 Raise the Alarm, 4 Dragon Fodder, 4 Hordeling Outburst, 4 Glorious Anthem, 2 Goblin Chieftain, 4 Lightning Bolt, 2 Goblin Grenade, 3 Flametongue Kavu, 3 Restoration Angel
