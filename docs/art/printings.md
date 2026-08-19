# Printing selection for Scryfall art

Principle 9 applies: nothing here is a `scryfallId`. The fetch step resolves each card by exact name (+ set override if given) through Scryfall's search, records the resolved id and artist in the pool registry, and **flags** any row where the override set doesn't contain the card rather than guessing. Chris can then ratify or override per card.

## Default rule

For each pool card, pull the **oldest English printing that has a high-resolution scan** (Scryfall `image_status = highres_scan`), images `art_crop` (for our frame) and `normal` (for the inspector's "printed card" view). Oldest-with-highres is where the classic art lives (Shuler's Serra Angel, Spencer's Terror, Rush's Bolt, Hoover's Wrath) and it's deterministic.

## Overrides (set code; artist noted where the planner is confident — verify)

Only where the default would pick something we don't want, or where a card has multiple original arts.

| card | override set | reason / artist to confirm |
|---|---|---|
| Hymn to Tourach | fem, collector 38b | Fallen Empires has four arts; 38b is the Liz Danforth — planner's pick; ratify |
| Basic lands (Mountain, Plains, Island, Swamp, Forest) | 3ed, first collector number of each type | one consistent classic cycle; Revised has three arts per basic — take the lowest number; ratify or pick others |
| Mind Rot | 7ed | Adam Rex art over Portal's; taste |
| Pyroclasm | default (ice) | planner has not seen the Ice Age art recently — implementer: flag if it reads poorly at art_crop |
| Raging Goblin, Goblin Piker, Wind Drake, Suntail Hawk, Brute Force, Timberland Guide, Rumbling Baloth, Centaur Courser, Cloudkin Seer | default | originals are modern-era commons; no strong preference |
| Everything else | default | |

## Rendering note

Because every card renders in our own frame (art-direction §0), the *frame* of the chosen printing is irrelevant; only the art matters. `normal` is fetched only for the inspector toggle.

## Scryfall API etiquette (implementer: verify against current Scryfall documentation at fetch time)

Identify the client with a `User-Agent` and `Accept` header, space requests (Scryfall documents a minimum delay between requests — honor it), cache everything locally, never fetch at runtime. Images are under Scryfall's image terms; use is personal/non-commercial here; do not commit them (`data/art/real/` is gitignored, ADR-008).
