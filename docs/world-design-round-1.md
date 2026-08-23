# World Design Round 1 — v2 (Chris's answers folded; ADR-069..071)

Inputs: ADR-064 backlog, world-sim baselines (S14/S15), the lair pattern (ADR-067), overworld-manifest v0.3 §5. Outputs wanted: Chris's rulings on §5–§8, then session briefs per §1.

## 1. Proposed sequencing (one system per session, content rides along)

| S | Focus | Contents |
|---|---|---|
| S16 | **Worldgen round 2 + one-drops + starters** | Roaming visibility (ADR-071): visible enemies with positions, pursuit/flee movement, sight radius, scrolling larger map; home-region start; uniform towns; renown+fleeing (§5); mill amendment + Cathartic Adept + Llanowar Elves; five 30-card mono starters (§2, one-drops in); `world-save-v3` (positions + decks + provenance). world-sim re-baselined per starter. |
| S17 | **Bestiary + anchor cards** | ~7 beasts (§3 rebalanced toward U/B/W), anchor-card mini-batch designed around beasts, renders + chips. |
| S18 | **Quests MVP + manalinks** | Courier first (incl. the card-courier variant: deliver a predicate-matching card from your collection — it leaves), then bounty; quest state in `world-save-v4`; manalinks reward-class, one-per-colour cap (ADR-069). |
| S19 | **Clocks + sieges** | Boss escalation schedules, siege events with parties, town fall/suspension/liberation gauntlets (§7). |
| S20 | **Dungeons + color strongholds** | Lair pattern generalized to multi-room gauntlets with per-room modifiers and prize rooms; five color strongholds placed; color bosses (§8) with authored decks + buffs; prize tables (1–3 cards of the color). |
| S21 | **Wild dungeons + archetype bosses + endgame** | Remote dungeons, archetype bosses guarding Power-class trophies (Lotus becomes reachable), the five-boss → final-gauntlet victory condition. |

Interleaves anytime: card batches (pool toward 100), more beasts, AI workstream (ADR-062) if playtests demand.

## 2. Starter decks (draft — 30 cards, mono + shared artifacts, deliberately modest)

Principles: no bombs (Serra, Wrath, Siege-Gang, Drana, Control Magic, Demonic Tutor, Hymn, Rancor, Warhammer, Mystic Snake are **rewards, not starters**); 13 lands; a starter should win tier-1 fights on curve and hit the tier-2 wall *by design* — growth is the game. world-sim per starter is the acceptance test (target: tier-1 win ≥70% at journeyman pilot, tier-2 in the 40s).

- **White "Dawn Levy":** 13 Plains, 4 Suntail Hawk, 3 Fencing Ace, 2 Savannah Lions, 2 Cunning Tactician, 2 Raise the Alarm, 2 Pacifism, 1 Swords to Plowshares, 1 Glorious Anthem.
- **Blue "Tidal Grimoire":** 12 Island, 2 Cathartic Adept, 3 Wind Drake, 3 Man-o'-War, 2 Cloudkin Seer, 2 Counterspell, 2 Boomerang, 2 Divination, 2 Curiosity.
- **Black "Pallid Court":** 13 Swamp, 3 Typhoid Rats, 3 Child of Night, 2 Vampire Nighthawk, 2 Phyrexian Rager, 2 Duress, 2 Mind Rot, 1 Doom Blade, 1 Terror, 1 Gravedigger.
- **Red "Ember Warband":** 13 Mountain, 4 Raging Goblin, 3 Goblin Piker, 3 Gray Ogre, 2 Hill Giant, 2 Boggart Brute, 2 Shock, 1 Lightning Bolt.
- **Green "Verdant Trail":** 12 Forest, 2 Llanowar Elves, 2 Grizzly Bears, 3 Elvish Visionary, 3 Centaur Courser, 2 Timberland Guide, 2 Rampant Growth, 2 Giant Growth, 1 Rumbling Baloth, 1 Prey Upon.

Difficulty adjustment (manifest §2b): easy adds 1 removal + 1 three-drop of the colour; hard removes the rare-adjacent card (Swords/Bolt/Doom Blade/Counterspell/Prey Upon). Starter spares knob unchanged.

## 3. Bestiary roster (draft — signature-card rule throughout; one catalog row + subject + render + chip each)

| Beast | Colour | Tier | Deck concept | Notes |
|---|---|---|---|---|
| Grizzly (a bear) | G | 1 | bears + pump | buyable (it can be fed) |
| Deadly Recluse | G | 1 | spiders/deathtouch + reach | forest regions |
| Man-o'-War (a bloom of them) | U | 1 | bounce tempo | coastal civilized |
| Boggart Warband | R | 2 | Boggart Brute + goblins + Chieftain | **party seed:** warbands later become siege parties |
| Vampire Nighthawk | B | 2 | lifelink/deathtouch drain | approach regions |
| the Siege-Gang | R | 3 | full goblin tribal w/ Siege-Gang Commander | named goblin commander — beast or mage? (Q3) |
| *(withdrawn — legendaries reserved, ADR-069)* | B | 3 | slot refilled by an S17 anchor card | |
| the Pelakka Wurm | G | 3 | done (S14) | lair resident |

Serra Angel joins the bestiary (W, tier 3, angelic host deck — signature rule; generous membership per Chris). Roster rebalance toward U/B/W is S17's job, with an anchor-card mini-batch to fill B tier-3 and U tier-2/3.

## 4. Mono-starter consequences (worldgen round 2)

Home-region start: player spawns in the town of the region whose colour matches their starter. Region↔colour binding exists in the catalog; the generator guarantees each colour has at least one civilized-or-approach region (new invariant). Larger regions + uniform towns: generator constants become knobs (`regionScale`, `townSpacingMin`), invariant fuzz extended. Slice decks A–E remain as *enemy* decks and ladder infrastructure — they stop being starters.

## 5. Fleeing mobs — proposed mechanism (needs Chris's ruling)

Player **renown** = Σ over defeated opponents of their tier (a saved integer; duels lost subtract nothing). On an encounter roll where `enemy.tier × renownFleeFactor < renown`, the enemy appears **fleeing**: the reveal shows them scattering; the player may *pursue* (normal parley→fight, their choice) or *let them go* (no ante risk, no reward, walk continues; costs only the steps already taken). Knobs: `renownFleeFactor` per tier. Effect: late-game civilized regions become quiet unless you go hunting — grinding isn't forbidden, it's just no longer forced on you. Alternative rejected: suppressing spawns entirely (empty maps read as bugs; fleeing mobs read as a world responding to you).

## 6. Quests MVP (S17) — sketch

Town quest board (one seeded offer per town per manifest): **Bounty** ("Hunt <named roaming enemy/lair resident>" — completes on that instance's defeat; reward gold × tier or a card) and **Courier** ("Carry <token> to <town>" — completes on arrival; deadline in steps as the first real clock consumer; reward gold or a **manalink**). Manalink = permanent modifier: every duel starts with a "Manalink: <basic>" artifact on your battlefield ({T}: add colour), tied to the granting town — suspended while the town is fallen (S18). Quest state in `world-save-v3` alongside multiple decks + provenance (one migration, three parked wants).

## 7. Sieges (S18) — sketch

Siege events spawn on region clocks: a party (1–3 opponents, warband-flavoured) marches on a town (visible on the map, steps-based ETA). Unrelieved → town falls (shop/quests/manalinks suspended, map shows occupation). Liberation = a **gauntlet**: fight the party in sequence — each duel at your current world life, each loss costing ante + life as normal, retreat allowed between duels (the siege holds). Knobs: siege frequency per difficulty, party size by region tier.

## 8. Bosses (S19–S20) — the authorship Chris owns

Five **color bosses** in strongholds (dungeon capstones): hand-built decks from the full pool + buff packages (modifiers: starting life 20+, ante 2–3, possibly a battlefield start). Prize: choose 1–3 from the colour's prize list. Then **archetype bosses** in the wilds guarding Power-class trophies (Lotus's address). What I need from Chris (Q5): names/identities — or the invitation accepted to co-create them, portrait briefs and all. The final boss/gauntlet and its story framing ride with S20.

## Questions for Chris

**Q1.** ~~Answered:~~ starters approved with the one-drops added (ADR-070).
**Q2.** ~~Answered:~~ approved; and upgraded — visibility becomes roaming enemies with pursuit/flee movement on a larger scrolling map (ADR-071).
**Q3.** ~~Answered:~~ two kinds, generous membership; Serra Angel is a beast-roster monster; Drana withdrawn (legendaries reserved).
**Q4.** ~~Answered:~~ courier → bounty → retrieval; card-courier variant adopted; manalinks reward-only, capped one per colour.
**Q5.** ~~Answered:~~ built together, scheduled before S20.
**Q6.** ~~Answered:~~ split — S16 worldgen+starters+one-drops, S17 bestiary+anchors.

**Open thread (new):** what legendary creatures become — Chris is reserving them; candidate directions to discuss when ready (legendary opponents whose card is their boss identity; legend-locked quest rewards; something else).
