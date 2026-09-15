# Session 39 brief — the salvage

*Planner → Implementer. 2026-09-16. Follows the running handoff.md (after S38) and its S39 estimate. Reads `phase-two-design-draft-1.md` §6 and ADR-126. Process rules unchanged: appends to `docs/decision-updates/s39.md`; validate every id below against the pool and report a substitution rather than making one silently; fuzz before fixtures where duels are touched.*

## Part 0 — Rulings and ADR appends
- **S38 Deviations 1–5 ratified.** One phase-indexed knob (`phaseTierTables`) with phase 3 scarred; the stronghold gate refuses the whole descent (the host of battles is the challenge); the telegraph's notice and `EditorBack`; the Continue summary; `heartLawsPersist` true for any phase-two world regardless of the knob — the flood's Heart accumulates by design, and the knob is for phase-one experiments.
- **ADR-127 — The accumulating ring is texture, not the difficulty lever.** heart-sim: +2 to +5 against `chris-road-B`, games shorter by a turn, death under two to three laws instead of one; not passive. The phase-two Heart's difficulty comes from its life row (and any sixth petal, §7), authored with its content. **Planner's proposal, ⚠ unratified and unmeasured**: phase-two `heartLife` 50 (easy 45 / hard 55) — the ring's step plus a step for the ten legends the phase-two player carries. Measured against an end-of-journey reference once one exists; nothing moves now.
- **The refusal lines**: a `door.byRule` map in `quests.json` keyed by the rule field (`colorsWithin`, `minCreatures`, `maxLands`, `maxManaValue`, `singleton`, `minCards`) with the colour line as the fallback; the planner writes the five shape lines with the courts' content. Not this session.
- **The dev "set phase" toggle** may ship now behind `?dev=1` — the salvage start is the shipped path to phase 2, so a dev shortcut no longer creates one.

## Part 1 — `newWorld({ salvage })`
Per the S38 estimate: the `salvage` branch on `NewWorldOptions`; the collection = the ten legends (from `legacyCarry`) + the five picks + the pack (Part 3) + basics; `phase: 2`; `salvagePurse` (knob, proposed 100 gold — ⚠); no manalinks (the legacy's manalink terms skipped, the legacy's *gold* term skipped too — the purse replaces it); the phase-two seed; the town-name list (Part 5). Eligibility: the legacy's fifth flag set. The start screen offers "the Flood" beside "a new road" when eligible. Tests: the collection's composition (10 + 5 + 55 + basics), no manalinks, phase 2, the ineligible case.

## Part 2 — The pick screen and the first deck
- **The flood scene** (a screen before the picks): the text in Part 6, the phase-one deck shown as what was lost (a reading — nothing salvages from it), Continue.
- **The picks** (`WorldScreen: "salvage"`): five colour tabs over the pool filtered `shopTier ≤ 3 && !prizeOnly` (R included; every dual, every Tutor) through the stronghold prize picker's colour rule (a card counts for any colour it carries; gold included); one pick per tab; a pick can't be undone once the tab is left (say so on the screen). The picks are logged to the Chronicle ("Salvaged: …").
- **Choose two colours** (ten pairs, the pair's name from the still/flowing vocabulary if we have one, else the colours) → the editor opens on the assembled default deck: the two colours' pack halves (twenty) + any pick in those colours + basics to thirty, split by pip count; legal by construction; `mustLeaveLegal` on. The player may rebuild freely.
- Tests in the S10 pattern: the five picks bank; a gold card counts for either tab; the pair; the assembled deck is legal; Cancel refused until legal; the Chronicle line.

## Part 3 — The pack (`data/world/salvage-pack.json`, fifty-five ids; the planner's list)
Ten per colour at tier ≤ 2 (no R, no prizeOnly), five colourless. Built so any pair's twenty make an honest thirty with basics: each colour carries six or seven creatures on a one-to-four curve, two or three spells, one enabler.

**White:** Savannah Lions · Suntail Hawk · Soul Warden · Fencing Ace · Youthful Valkyrie · Master Decoy · Inspiring Overseer · Pacifism · Swords to Plowshares · Raise the Alarm
**Blue:** Plumecreed Escort · Man-o'-War · Cloudkin Seer · Wind Drake · Aether Channeler · Air Elemental · Brainstorm · Counterspell · Essence Scatter · Boomerang
**Black:** Typhoid Rats · Child of Night · Vampire Nighthawk · Phyrexian Rager · Gravedigger · Nekrataal · Terror · Doom Blade · Duress · Unearth
**Red:** Young Pyromancer · Goblin Piker · Boggart Brute · Goblin Chieftain · Thundersnake · Lightning Bolt · Shock · Abrade · Hordeling Outburst · Blaze
**Green:** Llanowar Elves · Birds of Paradise · Grizzly Bears · Deadly Recluse · Wall of Blossoms · Centaur Courser · Rumbling Baloth · Rancor · Giant Growth · Rampant Growth
**Colourless:** Mind Stone · Bonesplitter · Loxodon Warhammer · Darksteel Myr · Evolving Wilds

Deliberately absent: the archetype anchors (Traumatizer, Hedron Crab, Cathartic Adept, Altar, Blanchwood Armor, Buried Alive, Arc Mage, the Skeleton, Thought Scour) — those are shop finds that let a player *choose* a plan in the flood rather than be handed one. One copy of each. Validated against the pool and the tier rule; rendered as `salvage.md` beside `starters.md`.

## Part 4 — The salvage yardstick (`sim/road-decks`)
Two decks from the pack plus one pick set each, 12 life, journeyman, no basics in play, no legends (the legends' texts vary per player's build; the yardstick measures the floor). Thirty cards, twelve lands.

**`salvage-WR`** (picks: Plateau as the white pick, Sacred Foundry as the red pick — ⚠ verify Sacred Foundry's tier is ≤ 3; else Badlands as the red pick and a Mountain in its place):
```
1 Plateau · 1 Sacred Foundry · 5 Plains · 5 Mountain
Savannah Lions · Suntail Hawk · Soul Warden · Fencing Ace · Youthful Valkyrie · Inspiring Overseer · Pacifism · Swords to Plowshares
Young Pyromancer · Goblin Piker · Boggart Brute · Goblin Chieftain · Thundersnake · Lightning Bolt · Shock · Abrade · Hordeling Outburst
Bonesplitter
```
(30: 12 lands, 18 spells; out of the pack halves: Master Decoy, Raise the Alarm, Blaze.)

**`salvage-UB`** (picks: Underground Sea as the blue pick, Watery Grave as the black pick):
```
1 Underground Sea · 1 Watery Grave · 5 Island · 5 Swamp
Plumecreed Escort · Man-o'-War · Cloudkin Seer · Wind Drake · Aether Channeler · Air Elemental · Brainstorm · Counterspell · Essence Scatter
Typhoid Rats · Child of Night · Vampire Nighthawk · Phyrexian Rager · Gravedigger · Nekrataal · Terror · Doom Blade
Mind Stone
```
(30: 12 lands, 18 spells; out: Boomerang, Duress, Unearth.)

Sweep **part 10**: every tier-2/3 mage at the phase-two column (`--phase 2`) against both yardsticks, 100 games both seats; and the same at phase 1 for comparison. Report as part 7 did. This is the first read of the phase-two column (S38 Concern 1); the read the planner wants is where the yardsticks' win rate sits per tier — tier 2 near even, tier 3 unfavourable — knowing the yardstick is the *floor* (no legends, journeyman). No knob moves.

## Part 5 — The map's phase-two seed and names
`generateWorld` with `phase: 2` takes `townNamesPhaseTwo` from the towns file (⚠ the list is Chris's/the planner's — a placeholder list of twenty flood names ships this session so the path works; the real list arrives with the content rounds). Territory palette: the phase-two terrain tokens (water, marsh, dusk) may reuse the phase-one tiles with a recoloured palette this session — the real tiles are art-round work. The Corolla's phase-two form (the Calyx) is not built; a phase-two world has no Corolla until the Heart's content lands (the map generator leaves the centre as a placeholder site with a "the water is deep here" line).

## Part 6 — The flood scene (planner's text, for Chris's pen)
> The fifth root parts.
> For a breath the plane is still — stiller than it has ever been.
> Then the stillness breaks. What the flower held, it holds no longer: the mana it stilled runs, and the low country goes under.
> You keep your feet, and what you carried, and little else.
> Ten faces you know. The rest is water.

The picks: *"From the wrack, five things — one of each colour — before the current takes them."*
The pair: *"Two colours you will carry first. The rest can wait for dry ground."*
The Chronicle's line at the flood: *"The plane turns over."* (the existing tease, now paid).

## Verification & handoff
Fuzz a phase-two world's first ten encounters with the two yardsticks as pilots (replays byte-exact); the pick screen and the editor's forced legality through the controller; the pack's validation; `salvage.md`; part 10's tables. Handoff: the start-to-first-duel path as built, the pack as rendered, the part-10 read, deviations, concerns.

## Out of scope
The ten legends, the mage inversion, the courts' shape rules and their lines, the Heart's phase-two row, the real town names and tiles, the Calyx.
