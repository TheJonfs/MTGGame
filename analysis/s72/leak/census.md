# The baseline leak — a census of the pool on a null board and a Bears board (263 variants of 69 cards)

A no-op variant is one whose predicted board, less the card's own move (and the source's tap), is the board it started from. **2 no-op variants score above passing** (leaks); 0 more within 0.25 under it (soft). 45 no-ops in all.

## Leaks (above passing)

| card | what | target | board | score − pass |
|---|---|---|---|---|
| Thought Replacement | spell | them | null | +0.20 |
| Thought Replacement | spell | them | bears | +0.20 |

## Soft leaks (within 0.25 under passing)

| card | what | target | board | score − pass |
|---|---|---|---|---|

## Every no-op, by score

| card | what | target | board | score − pass |
|---|---|---|---|---|
| Thought Replacement | spell | them | null | +0.20 |
| Thought Replacement | spell | them | bears | +0.20 |
| Arcanis the Omnipotent | ability 1 | — | null | -0.25 |
| Arcanis the Omnipotent | ability 1 | — | bears | -0.25 |
| Correspondence | spell | our land, our land | null | -2.40 |
| Correspondence | spell | our land, our land | null | -2.40 |
| Correspondence | spell | our land, our land | null | -2.40 |
| Correspondence | spell | our land, our land | null | -2.40 |
| Correspondence | spell | our land, our land | null | -2.40 |
| Correspondence | spell | our land, our land | null | -2.40 |
| Correspondence | spell | our land, our land | null | -2.40 |
| Correspondence | spell | our land, our land | null | -2.40 |
| Correspondence | spell | our land, our land | null | -2.40 |
| Correspondence | spell | our land, our land | null | -2.40 |
| Correspondence | spell | our land, our land | null | -2.40 |
| Correspondence | spell | our land, our land | null | -2.40 |
| Correspondence | spell | our land, our land | null | -2.40 |
| Correspondence | spell | our land, our land | null | -2.40 |
| Correspondence | spell | our land, our land | null | -2.40 |
| Correspondence | spell | our land, our land | null | -2.40 |
| Correspondence | spell | our land, our land | bears | -2.40 |
| Correspondence | spell | our land, our land | bears | -2.40 |
| Correspondence | spell | our land, our land | bears | -2.40 |
| Correspondence | spell | our land, our land | bears | -2.40 |
| Correspondence | spell | our land, our land | bears | -2.40 |
| Correspondence | spell | our land, our land | bears | -2.40 |
| Correspondence | spell | our land, our land | bears | -2.40 |
| Correspondence | spell | our land, our land | bears | -2.40 |
| Correspondence | spell | our land, our land | bears | -2.40 |
| Correspondence | spell | our land, our land | bears | -2.40 |
| Correspondence | spell | our land, our land | bears | -2.40 |
| Correspondence | spell | our land, our land | bears | -2.40 |
| Correspondence | spell | our land, our land | bears | -2.40 |
| Correspondence | spell | our land, our land | bears | -2.40 |
| Correspondence | spell | our land, our land | bears | -2.40 |
| Correspondence | spell | our land, our land | bears | -2.40 |
| Command of the Depths | spell, mode 2 | us | null | -100.40 |
| Hymn to Tourach | spell | us | null | -100.40 |
| Mind Rot | spell | us | null | -100.40 |
| Command of the Depths | spell, mode 2 | us | bears | -100.40 |
| Hymn to Tourach | spell | us | bears | -100.40 |
| Mind Rot | spell | us | bears | -100.40 |
| Lumen, the Hearth Fire | ability 0 | our Bears | bears | -100.85 |
| Sacred Helix | spell | us | null | -104.40 |
| Sacred Helix | spell | us | bears | -104.40 |

## Refused outright by a gate (−∞): 135 variants

Aetherbolt (spell, our land, them, null); Altar of Dementia (ability 0, us, null); Altar of Dementia (ability 0, them, null); Arcane Collector (ability 0, null); Brainstorm (spell, null); Buried Alive (spell, null); Burnfallow (ability 2, null); Char (spell, them, null); Clio, Lady of the Depths (ability 2, null); Dark Ritual (spell, null); Dawnwing Marshal (ability 0, null); Diabolic Edict (spell, us, null); Diabolic Edict (spell, them, null); Discontinuous Flash (spell, our land, null); Entomb (spell, null); Faerie Formation (ability 0, null); Furnace Whelp (ability 0, null); Glare of Subdual (ability 0, our land, null); Glory Hound (ability 0, null); Goblin Grenade (spell, them, null); Hearthspire (ability 2, us, null); Hearthspire (ability 2, them, null); Highland Ritual (spell, null); Isaura, the Levy (ability 1, null); Library of Alexandria (ability 1, null); Lightning Bolt (spell, them, null); Manaba (ability 0, null); Obsidian Observatory (ability 2, null); Pyroclasm (spell, null); Retribution of the Meek (spell, null); Sapwell Dryad (ability 0, our land, null); Savage Twister (spell, null); Scepter of Dominance (ability 0, our land, null); Shock (spell, them, null); Tallyflame Court (ability 2, null); Thawing Glaciers (ability 0, null); The Pearl Cleric (ability 0, null); The Reaper (ability 1, null); The Reeve (ability 0, us, null); The Reeve (ability 0, them, null); The Sower (ability 1, null); The Unwinder (ability 1, null); Tormod's Crypt (ability 0, us, null); Tormod's Crypt (ability 0, them, null); Volmaw (ability 2, us, null); Volmaw (ability 2, them, null); Wave of Reckoning (spell, null); Wrath of God (spell, null); Aetherbolt (spell, our land, them, bears); Altar of Dementia (ability 0, us, bears); Altar of Dementia (ability 0, them, bears); Arcane Collector (ability 0, bears); Brainstorm (spell, bears); Brute Force (spell, our Bears, bears); Brute Force (spell, their Bears, bears); Buried Alive (spell, bears); Burnfallow (ability 2, bears); Char (spell, them, bears); Clio, Lady of the Depths (ability 2, bears); Dark Ritual (spell, bears); Dawnwing Marshal (ability 0, bears); Diabolic Edict (spell, us, bears); Discontinuous Flash (spell, our land, bears); Entomb (spell, bears); Faerie Formation (ability 0, bears); Foxglove Dose (spell, our Bears, bears); Furnace Whelp (ability 0, bears); Giant Growth (spell, our Bears, bears); Giant Growth (spell, their Bears, bears); Glare of Subdual (ability 0, our land, bears); Glory Hound (ability 0, bears); Goblin Grenade (spell, them, bears); Hearthspire (ability 2, us, bears); Hearthspire (ability 2, them, bears); Highland Ritual (spell, bears); Isaura, the Levy (ability 0, our Bears, bears); Isaura, the Levy (ability 0, their Bears, bears); Isaura, the Levy (ability 1, bears); Library of Alexandria (ability 1, bears); Lightning Bolt (spell, them, bears); Lumen, the Hearth Fire (ability 0, their Bears, bears); Manaba (ability 0, bears); Nightbower (ability 2, our Bears, bears); Obsidian Observatory (ability 2, bears); Pyroclasm (spell, bears); Ranksmere (ability 2, our Bears, bears); Ranksmere (ability 2, their Bears, bears); Retribution of the Meek (spell, bears); Sapwell Dryad (ability 0, our land, bears); Savage Twister (spell, bears); Shock (spell, them, bears); Tallyflame Court (ability 2, bears); Thawing Glaciers (ability 0, bears); The Pearl Cleric (ability 0, bears); The Reaper (ability 1, bears); The Reeve (ability 0, us, bears); The Reeve (ability 0, them, bears); The Sower (ability 1, bears); The Unwinder (ability 1, bears); Tidal Shackle (ability 0, our Bears, bears); Tormod's Crypt (ability 0, us, bears); Tormod's Crypt (ability 0, them, bears); Volmaw (ability 2, us, bears); Volmaw (ability 2, them, bears); Wave of Reckoning (spell, bears); Wrackroot (ability 2, our Bears, bears); Wrackroot (ability 2, their Bears, bears); Wrath of God (spell, bears)

## Effects that changed the board yet scored above passing (not leaks; listed for the planner's eye)

| card | what | target | board | score − pass |
|---|---|---|---|---|
| Diabolic Edict | spell | them | bears | +4.50 |
| Command of the Depths | spell, mode 3 | their Bears | bears | +3.49 |
| Glimpse the Unthinkable | spell | them | null | +3.04 |
| Glimpse the Unthinkable | spell | them | bears | +3.04 |
| Shadow Summoning | spell | — | null | +2.48 |
| Shadow Summoning | spell | — | bears | +2.48 |
| Command of the Depths | spell, mode 0 | their Bears | bears | +2.45 |
| Command of the Depths | spell, mode 4 | them, their Bears | bears | +2.45 |
| Nightbower | ability 2 | their Bears | bears | +2.25 |
| Time Walk | spell | — | bears | +2.10 |
| Foxglove Dose | spell | their Bears | bears | +2.05 |
| Abrade | spell, mode 0 | their Bears | bears | +2.00 |
| Doom Blade | spell | their Bears | bears | +2.00 |
| Phyrexian Purge | spell | their Bears | bears | +2.00 |
| Prey Upon | spell | their Bears, their Bears | bears | +2.00 |
| Swords to Plowshares | spell | their Bears | bears | +2.00 |
| Tendrils of Corruption | spell | their Bears | bears | +2.00 |
| Terror | spell | their Bears | bears | +2.00 |
| Treetop Snarespinner | ability 0 | our Bears | bears | +1.96 |
| Sacred Helix | spell | them | null | +1.60 |
| Sacred Helix | spell | them | bears | +1.60 |
| Command of the Depths | spell, mode 1 | — | null | +1.44 |
| Command of the Depths | spell, mode 5 | them | null | +1.44 |
| Command of the Depths | spell, mode 1 | — | bears | +1.44 |
| Command of the Depths | spell, mode 5 | them | bears | +1.44 |
| Hordeling Outburst | spell | — | null | +1.40 |
| Hordeling Outburst | spell | — | bears | +1.40 |
| Seraphina, the Initiative | ability 0 | their Bears | bears | +1.25 |
| Tome Scour | spell | them | null | +1.21 |
| Tome Scour | spell | them | bears | +1.21 |
| Aether Mutation | spell | their Bears | bears | +1.20 |
| Time Walk | spell | — | null | +1.10 |
| Arcanis the Omnipotent | ability 0 | — | null | +1.05 |
| Waterfront Bouncer | ability 0 | their Bears | bears | +0.85 |
| Dragon Fodder | spell | — | null | +0.80 |
| Harmonize | spell | — | null | +0.80 |
| Raise the Alarm | spell | — | null | +0.80 |
| Wheel of Fortune | spell | — | null | +0.80 |
| Dragon Fodder | spell | — | bears | +0.80 |
| Harmonize | spell | — | bears | +0.80 |
