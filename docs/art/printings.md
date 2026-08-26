# Printing selection for Scryfall art

Principle 9 applies: nothing here is a `scryfallId`. The fetch step resolves each card by exact name (+ set override if given) through Scryfall's search, records the resolved id and artist in the pool registry, and **flags** any row where the override set doesn't contain the card rather than guessing. Chris can then ratify or override per card.

## Default rule

For each pool card, pull the **oldest English printing that has a high-resolution scan** (Scryfall `image_status = highres_scan`), images `art_crop` (for our frame) and `normal` (for the inspector's "printed card" view). Oldest-with-highres is where the classic art lives (Shuler's Serra Angel, Spencer's Terror, Rush's Bolt, Hoover's Wrath) and it's deterministic.

## Overrides (set code; artist noted where the planner is confident — verify)

Only where the default would pick something we don't want, or where a card has multiple original arts.

| card | override set | reason / artist to confirm |
|---|---|---|
| Hymn to Tourach | fem, collector 38b | Fallen Empires has four arts; 38b is the Liz Danforth — planner's pick; ratify |
| Basic lands (Mountain, Plains, Island, Swamp, Forest) | leb, first collector number of each type | one consistent classic cycle, black-bordered (S8 feedback round: Chris moved these from Revised to Beta to match the frame's black border) |
| Mind Rot | por, collector 101 | S22 playtest r2 (Chris): the 7ED scan is WHITE-bordered — Portal is Steve Luke's black-bordered original (the 7ED★ foil keeps the Rex art black-bordered if taste prefers it; flag) |
| Pyroclasm | default (ice) | planner has not seen the Ice Age art recently — implementer: flag if it reads poorly at art_crop |
| Raging Goblin, Goblin Piker, Wind Drake, Suntail Hawk, Brute Force, Timberland Guide, Rumbling Baloth, Centaur Courser, Cloudkin Seer | default | originals are modern-era commons; no strong preference |
| Phyrexian Rager | apc | oldest-highres resolves to PMEI (magazine promo); Apocalypse is the real original (ADR-044) |
| Cathartic Adept | ala | S16: Shards of Alara, Carl Critchlow (brief); Llanowar Elves takes the default rule (expected early Anson Maddocks — verify at fetch) |
| Restoration Angel | avr | S17: default resolved to the PAVR prerelease promo (Wesley Burt alternate art); Avacyn Restored #32, Johannes Voss, is the original (Phyrexian Rager precedent) |
| Expansion 1 (S17), everything else | default | Air Elemental LEA Thomas, Hypnotic Specter LEA Shuler, Dark Ritual LEA Everingham, Disenchant LEA Weber, Goblin Grenade FEM 56a Spencer, Goblin Matron P02 Gelon, Youthful Valkyrie KHM #382 (Theme Booster original), Little Bear HOB (2026 set — its original); UB printings fine per ADR-076 (Airship Crash FIN) |
| Abrade | brc, collector 111 | S22 brief: the Brothers War Commander printing per Chris (Evolving Wilds BRC precedent) |
| Everything else | default | |

## Rendering note

Because every card renders in our own frame (art-direction §0), the *frame* of the chosen printing is irrelevant; only the art matters. `normal` is fetched only for the inspector toggle.

## Scryfall API etiquette (implementer: verify against current Scryfall documentation at fetch time)

Identify the client with a `User-Agent` and `Accept` header, space requests (Scryfall documents a minimum delay between requests — honor it), cache everything locally, never fetch at runtime. Images are under Scryfall's image terms; use is personal/non-commercial here; do not commit them (`data/art/real/` is gitignored, ADR-008).
