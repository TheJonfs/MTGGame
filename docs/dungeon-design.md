# Dungeon Design v2.1 — mini-worlds under the map (Chris + planner, post-S19; verdicts folded; §1/§3/§5 amended post-S20 playtest per `docs/planner-doc-amendments-s20b.md`)

*v2: all six v1 verdicts ratified (escrow, interior-life-discarded, steps-only empowerment, stationary minions, enabler tiering; Drakuseth = CMM #535). Adds: difficulty-parameterized empowerment, the lair-dungeon class, the five Mox dungeon laws, guardian decklists (draft, for verdict), prize structure (proposal). Feeds ADR-079 + the S20 brief.*

## 1. The shape (ratified)

A dungeon is a **mini-world**: a small fogged grid (~12×9, knob) reusing the world stack — WorldMapView, movement, fog/sight, fixed points, viewport. **The exterior clock freezes at the threshold**; an **interior step counter** powers §3. Topology: branching, interconnecting carved paths; treasures on branches; **stationary minions at chokepoints** (contact = fight, no parley inside; routing around is the topology's tradeoff). Entry screen telegraphs the stakes (§4) before the choice, parley-telegraph style.

**v2.1 amendment (planner-issued, supersedes the grid-size line above):**
> A dungeon is a mini-world: a fogged grid at **24×18 default** (`dungeonGridWidth`/`dungeonGridHeight` knobs; was ~12×9 — doubled after the round-1 measurement showed a full-loot tour averaging 22 steps against a 60-step empowerment tier, a provably decorative meter). Content scales off one grid-derived factor `s = sqrt(area/108)`: Mox dungeons 4–8 treasure caches / 3–5 minions; lair-dungeons 2–4 caches / 2–3 minions.

## 2. Life inside (ratified)

Life persists across interior battles, loss **and** gain — each duel starts at the running total (`MatchResult.finalLife` writes forward). The interior track seeds from world life at entry and is **discarded at exit**; §2a untouched (an interior *loss* still applies the normal world loss penalty on ejection).

## 3. The empowerment clock (ratified; difficulty-parameterized)

The guardian grows with interior steps. **Discrete tiers, always visible** (named stages + approaching threshold in the dungeon UI; §5's visible-schedules law). **Steps are the only input** — fights cost life and ante, never empowerment.

**Parameterization (Chris):** the tier table is a knob the **difficulty bundle overrides** (principle 5's precedence: world < difficulty < dungeon). Arguing baseline, `dungeonEmpowermentTiers`:

| Interior steps | Easy | Normal | Hard |
|---|---|---|---|
| 60 | — | +2 life | +4 life |
| 120 | +2 life | +2 life, +1 basic in play | +4 life, +1 basic in play |
| 180 | +2 life | +2 life, +1/1 token in play | +4 life, +1/1 token, +1 card |

All entries are modifier-package additions applied at guardian-duel MatchSpec build. Per-dungeon overrides sit above difficulty in precedence (a stronghold's schedule can be its own beast).

**v2.1 amendment (planner-issued, supersedes the tier table above):**
> Baseline thresholds **30/60/90 interior steps** (was 60/120/180). Difficulty bundles: easy 60/90 (two tiers); normal 30/60/90; hard 30/60/90 at double life values. Tier *contents* (the modifier packages) are unchanged from the ratified table — the amendment is arrival timing. Measured context at 24×18: speedrun ≈ 27 steps, optimal full-loot ≈ 71 (eats tiers 1–2; sloppy routes brush tier 3). **Chris's re-dive verdicts whether 30/60/90 over-rotated; the knob is the lever.**

## 4. Exit, reset, escrow (ratified)

Two exits: lose inside, or walk out — either **resets the dungeon** (minions repopulate, steps zero). **Escrow:** everything gained inside (treasures, boons, interior ante winnings) is held until the guardian falls — payout on victory; forfeit on walk-out; forfeit plus normal loss consequences on an interior defeat. The mountain keeps its gold. Softening lever if playtest says feel-bad: release interior ante through, keep boons/treasures escrowed.

## 5. Dungeon classes (ratified)

1. **The five Mox dungeons** — authored, unique, one per wild region, one-time (cleared = ground).
2. **Lair-dungeons** — the tier-3 signatures' lairs (Serra Angel, Faerie Formation, Hypnotic Specter, Siege-Gang, Pelakka Wurm) become **small procedural dungeons** (a couple of twists, 1–2 minions, resident as boss with the existing `lairResidentLifeBonus` on top of any empowerment), rewarding **a couple of R-tier cards**. Resolves the banked lesser/greater-lairs thread (greater lairs *are* dungeons) and S18 concern 7 (the interior resident is a different register from the roaming one). No dungeon law in the slice; small empowerment schedules via the same knob.

   **v2.1 amendment (planner-issued, supersedes the "couple of twists, 1–2 minions" sizing):**
   > Lair-dungeons at the doubled grid run **2–4 caches and 2–3 minions** (was "a couple of twists, 1–2 minions") — scaled commensurately per the round-1 ruling; the lair/Mox gap is preserved by the scaling factor.
3. **Strongholds** (S22) reuse everything at maximum scale with partisan laws.

## 6. The five laws (Chris-authored; register = symmetric-but-boss-favoring)

Strongholds get partisan laws later; Mox dungeons get balanced laws that still turn the guardian on. All five are existing modifiers — the data-model §5 enum at full employment:

| Dungeon | Law | Modifier | Why it favors the host |
|---|---|---|---|
| The Shattered Caldera | Both players begin with a Mountain in play | `permanentOnBattlefield` | ramps toward {4}{R}{R}{R} |
| The Reliquary Wastes | Both players begin with a Plains in play | `permanentOnBattlefield` | ramps toward {6}{W}{W}{W} |
| The Deepwood | Both players begin with a Llanowar Elves in play | `permanentOnBattlefield` (pool card — a first) | on-family green acceleration |
| The Drowned Reach | Both players draw a bonus card | `extraCards` | the wizard wins card-count wars |
| The Barrowlands | Both players begin with a 2/2 Zombie in play | `permanentOnBattlefield` (Waste Not's token def, in loader since S17) | accelerates interaction; Drana's dinner |

## 7. Guardians: identity ruling (proposal) + verified slate

***[AMENDED post-S24 (the great swap, Chris-ruled — see `five-powers-design.md` §6): the five real legends below move to guard the POWER-DUNGEONS, their decks and drop rules traveling with them; the Moxen pass to a new custom gem-titled court (the Pearl Cleric pattern), designs pending. The table below stands as the original record; existing saves grandfather.]***

**(P) Guardians are mono-color; the warp belongs to the stronghold lords.** The elder powers keep the old ways — orthodox single-flow magic at full strength; the five lords ride the warped currents on duals. Story-mechanical contrast, plus clean sequencing: duals ship S20 player-facing (solver fuzz-covered), first AI dual users arrive with the tri-color stronghold decks in S22.

| Mox | Guardian | Region | Printing | Engine bill |
|---|---|---|---|---|
| Pearl | Reya Dawnbringer ✔ | Reliquary Wastes | INV #33 | zero |
| Sapphire | Arcanis the Omnipotent ✔ | Drowned Reach | ONS #66 | zero |
| Jet | Drana, Kalastria Bloodchief (pool) | Barrowlands | as pooled | zero |
| Ruby | Drakuseth, Maw of Flames ✔ | Shattered Caldera | **CMM #535 (Chris-confirmed)** | A8 "up to" + inter-target distinctness |
| Emerald | Titania, Protector of Argoth ✔ | Deepwood | MH2 #416 ✔ | land predicate on `returnFromGraveyard`; `elemental_5_3_g` token |

Moxen ⚠ pending fetch ({0} artifact, "{T}: Add {X}" expected); `prizeOnly` all five.

## 8. Prize structure (proposal)

Beat a Mox guardian: **the Mox** (fixed) + **the guardian's own card** (the four new legendaries enter the pool as shopTier R; Drana's card already pooled — her copy rides the same rule) + **one color-prize roll** (R/T3 cards of the dungeon's color). "I run Reya because I beat Reya."

## 9. Guardian decklists (draft — 40 cards, signature ×3, full pool incl. R-drawer; implementer world-sims; Chris verdicts)

- **Reya (W):** 16 Plains, 3 Reya Dawnbringer, 2 Serra Angel, 2 Wrath of God, 3 Swords to Plowshares, 3 Pacifism, 2 Cunning Tactician, 2 Inspiring Overseer, 3 Youthful Valkyrie, 2 Master Decoy, 2 Raise the Alarm. *(Stall, sweep, then Reya raises the angels every upkeep — Wrath is her friend. Chris's swap: Restoration Angel out for Cunning Tactician — Resto's non-Angel blink restriction is nearly dead in an angel-heavy list, and the Tactician taps blockers to buy the nine-mana runway.)*
- **Arcanis (U):** 17 Island, 3 Arcanis, 2 Air Elemental, 2 Faerie Formation, 3 Man-o'-War, 2 Mist Raven, 2 Aether Channeler, 2 Wind Drake, 2 Cloudkin Seer, 2 Divination, 2 Essence Scatter, 1 Control Magic. *(Deliberately tempo-value, not counter-wall — the pilot lesson applied; Arcanis's draw-3 is the engine.)*
- **Drana (B):** 16 Swamp, 3 Drana, 2 Hypnotic Specter, 2 Nekrataal, 2 Doom Blade, 2 Terror, 2 Hymn to Tourach, 1 Demonic Tutor, 2 Phyrexian Rager, 2 Vampire Nighthawk, 2 Child of Night, 2 Gravedigger, 2 Zombify. *(Attrition; the Tutor finds her.)*
- **Drakuseth (R):** 17 Mountain, 3 Drakuseth, 2 Siege-Gang Commander, 3 Lightning Bolt, 2 Shock, 2 Pyroclasm, 2 Blaze, 2 Hill Giant, 2 Boggart Brute, 2 Goblin Chieftain, 2 Hordeling Outburst, 1 Gray Ogre. *(Burn the board, land the dragon; the Caldera's Mountain is a head start on seven mana.)*
- **Titania (G):** 12 Forest, 4 Evolving Wilds, 3 Tranquil Thicket, 3 Titania, 2 Pelakka Wurm, 2 Gaean Wurm, 3 Llanowar Elves, 2 Rampant Growth, 2 Rumbling Baloth, 2 Prey Upon, 2 Giant Growth, 2 Werebear, 1 Baru, Wurmspeaker. *(Wilds die into Elementals; Thickets cycle into her graveyard for the ETB; 19 land-slots feed the engine.)*

## 10. The land batch (rider recap)

Cycling-land cycle (Barren Moor ✔ ONS #312; cycle-mates ⚠: Secluded Steppe, Lonely Sandbar, Forgotten Cave, Tranquil Thicket) + Evolving Wilds ⚠ (BRC #184, old frame). shopTier 1, priceOverrides ~10g/12g. Zero new vocabulary. Pool at S20 close: 105 + 20 duals + 6 enabler lands + 4 new legendaries + 5 Moxen = **140**.

## 11. Remaining verdicts for Chris

1. Mono-color guardians / warp-reserved-for-lords (§7). 2. Prize structure incl. guardian-card drops and the four legendaries at R (§8). 3. The five decklists (§9). 4. Empowerment baseline numbers (§3 — knobs, tuned from play). 5. Lair-dungeons lawless in slice (§5).
