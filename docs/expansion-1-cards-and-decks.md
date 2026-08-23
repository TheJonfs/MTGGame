# Expansion 1 — "The Bestiary's Arsenal": card batch + beast decklists

Planner-maintained. Oracle text below: rows marked ✔ were planner-search-verified this round; rows marked ⚠ are planner-recalled and **must be treated as unconfirmed until the implementer's Scryfall re-verification** (principle 9 — a mismatch is a blocker to flag, never silently fix).

## Pool additions (with Air Elemental ✔ and Hypnotic Specter ✔ from ADR-074: 32 cards, pool 74→106... [count: 30 below + 2 prior])

| Card | Cost | Type | P/T | Text (abbrev.) | V | Vocabulary |
|---|---|---|---|---|---|---|
| Werebear | {1}{G} | Creature — Human Bear Druid | 1/1 | {T}: Add {G}. Threshold — 7+ cards in your graveyard: +3/+3 | ⚠ | mana dork; A4 graveyardCount conditional static |
| Little Bear | {2}{G} | Creature — Bear | 3/2 | Flash. ETB: untap another target creature you control; if it's a Bear, +1/+1 counter | ✔ | flash, untapTarget, conditional clause |
| Mother Bear | {1}{G} | Creature — Bear | 2/2 | {1}{G}, Exile from your graveyard: two 2/2 Bear tokens. Sorcery only | ⚠ | A5 graveyard ability, exile-self cost |
| Moss Viper | {G} | Creature — Snake | 1/1 | Deathtouch | ⚠ | — |
| Treetop Snarespinner | {3}{G} | Creature — Spider | 1/4 | Reach, deathtouch. {2}{G}: +1/+1 counter on target creature you control. Sorcery only | ✔ | — |
| Airship Crash | {2}{G} | Instant | — | Destroy target artifact, enchantment, or creature with flying. Cycling {2} | ✔ | or/keyword predicates; A5 cycling |
| Baru, Wurmspeaker | {2}{G}{G} | Legendary Creature — Human Druid | 3/3 | Wurms +2/+2 & trample. {7}{G},{T}: 4/4 Wurm token; costs {X} less, X = greatest Wurm power | ✔ | subtype scope; A4 count; cost reduction |
| **Gaean Wurm** (custom) | {2}{G}{G} | Creature — Wurm | 1/1 | Trample. +1/+1 for each Forest you control | — | A4 count static |
| Mist Raven | {2}{U} | Creature — Bird | 2/2 | Flying. ETB: return target creature to owner's hand | ⚠ | — |
| Waterfront Bouncer | {U} | Creature — Merfolk Spellshaper | 1/1 | {U},{T}, Discard a card: bounce target creature | ⚠ | discard cost |
| Essence Scatter | {1}{U} | Instant | — | Counter target creature spell | ⚠ | spell-type predicate |
| Gravitational Shift | {3}{U}{U} | Enchantment | — | Flying +2/+0; nonflying −2/−0 | ✔ | keyword scopes |
| Aether Channeler | {2}{U} | Creature — Human Wizard | 2/1 | ETB choose one: Bird token / bounce other nonland / draw | ✔ | A6 modal |
| Aven Fisher | {2}{U}? | Creature — Bird Soldier | 2/2 | Flying. Dies: you may draw | ⚠ cost esp. | optional dies trigger |
| Master Decoy | {1}{W} | Creature — Human Soldier | 1/2 | {W},{T}: Tap target creature | ⚠ | — |
| Scepter of Dominance | {W}{W} | Artifact | — | {W},{T}: Tap target permanent | ⚠ | — |
| Disenchant | {1}{W} | Instant | — | Destroy target artifact or enchantment | ⚠ | or-predicate |
| Youthful Valkyrie | {1}{W} | Creature — Angel | 1/1? | Flying. Another Angel ETBs under your control: +1/+1 counter on this | ⚠ P/T | ADR-021 other+subtype |
| Restoration Angel | {3}{W} | Creature — Angel | 3/4 | Flash, flying. ETB: exile up to one other target non-Angel creature you control, return it | ⚠ | A8 blink + up-to |
| Inspiring Overseer | {2}{W} | Creature — Angel Cleric | 2/1 | Flying. ETB: gain 1, draw 1 | ⚠ | — |
| Skirk Prospector | {R} | Creature — Goblin | 1/1 | Sacrifice a Goblin: Add {R} | ⚠ | sac mana ability |
| Hordeling Outburst | {1}{R}{R} | Sorcery | — | Three 1/1 red Goblin tokens | ⚠ | — |
| Goblin Grenade | {R} | Sorcery | — | Additional cost: sac a Goblin. 5 damage any target | ⚠ | A7 |
| Goblin Matron | {2}{R} | Creature — Goblin | 1/1 | ETB: may search library for a Goblin card, reveal, to hand, shuffle | ⚠ | subtype search |
| Indulgent Aristocrat | {B} | Creature — Vampire | 1/1 | Lifelink. {2}, Sac another creature: +1/+1 counter on each Vampire you control | ⚠ | sac cost, subtype mass counters |
| Blood Artist | {B} | Creature — Vampire | 0/1 | This or another creature dies: target player loses 1, you gain 1 | ⚠ | DIES source:any |
| Bitterblossom | {1}{B} | Enchantment | — | Your upkeep: lose 1, create 1/1 black Faerie Rogue flying token | ⚠ | upkeep trigger |
| Dark Ritual | {B} | Instant | — | Add {B}{B}{B} | ⚠ | spell mana |
| Waste Not | {1}{B} | Enchantment | — | Opp discards creature→Zombie; land→{B}{B}; other→draw | ✔ | discard payload, triggered mana |
| Tendrils of Corruption | {3}{B} | Instant | — | X damage to target creature, X = your Swamps; gain X | ⚠ | A4 count |

`prizeOnly` candidates from this batch: none (Bitterblossom and Baru are reward-tier but shop-legal; boss prize tables come later).

## Beast decklists (30 cards; signature 3–4×; implementer world-sims per deck and reports; planner adjusts)

- **A Grizzly Bear (G,1):** 13 Forest, 4 Grizzly Bears, 3 Little Bear, 2 Mother Bear, 2 Werebear, 2 Rumbling Baloth, 2 Centaur Courser, 2 Giant Growth.
- **The Deadly Recluse (G,1):** 13 Forest, 4 Deadly Recluse, 3 Moss Viper, 3 Treetop Snarespinner, 3 Giant Growth, 2 Prey Upon, 2 Elvish Visionary.
- **A Bloom of Man-o'-War (U,1):** 12 Island, 4 Man-o'-War, 3 Mist Raven, 2 Waterfront Bouncer, 3 Boomerang, 2 Essence Scatter, 2 Wind Drake, 2 Cloudkin Seer.
- **The Cunning Tactician (W,1–2):** 12 Plains, 4 Cunning Tactician, 3 Master Decoy, 2 Scepter of Dominance, 3 Fencing Ace, 2 Savannah Lions, 2 Raise the Alarm, 2 Pacifism.
- **The Boggart Warband (R,2):** 12 Mountain, 4 Boggart Brute, 3 Raging Goblin, 3 Goblin Piker, 2 Skirk Prospector, 2 Hordeling Outburst, 2 Goblin Chieftain, 2 Goblin Grenade.
- **A Vampire Nighthawk (B,2):** 12 Swamp, 4 Vampire Nighthawk, 3 Child of Night, 2 Indulgent Aristocrat, 2 Blood Artist, 2 Typhoid Rats, 2 Doom Blade, 2 Mind Rot, 1 Tendrils of Corruption.
- **The Living Gale (U,2):** 12 Island, 3 Air Elemental, 3 Wind Drake, 2 Cloudkin Seer, 2 Aven Fisher, 2 Gravitational Shift, 2 Aether Channeler, 2 Counterspell, 2 Boomerang.
- **The Siege-Gang (R,3):** 12 Mountain, 3 Siege-Gang Commander, 3 Goblin Matron, 3 Goblin Chieftain, 2 Skirk Prospector, 2 Hordeling Outburst, 2 Boggart Brute, 2 Goblin Grenade, 1 Lightning Bolt.
- **The Hypnotic Specter (B,3):** 12 Swamp, 4 Hypnotic Specter, 2 Dark Ritual, 2 Hymn to Tourach, 2 Duress, 2 Waste Not, 2 Doom Blade, 2 Phyrexian Rager, 1 Mind Rot, 1 Tendrils of Corruption.
- **The Serra Angel (W,3):** 12 Plains, 3 Serra Angel, 3 Youthful Valkyrie, 2 Inspiring Overseer, 2 Restoration Angel, 2 Glorious Anthem, 2 Swords to Plowshares, 2 Pacifism, 1 Wrath of God, 1 Raise the Alarm.
- **The Pelakka Wurm (G,3):** 12 Forest, 3 Pelakka Wurm, 3 Gaean Wurm, 2 Baru Wurmspeaker, 3 Llanowar Elves, 3 Rampant Growth, 2 Rumbling Baloth, 2 Prey Upon.
