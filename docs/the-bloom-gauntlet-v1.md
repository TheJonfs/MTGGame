# The Bloom — final gauntlet design v1.1 (Chris + planner; the last system)

*v1.1: the Corolla's still-pair bijection (Chris-ruled), the two-node Heart, the Mirror fight for the Vault (Chris-conceived; planner additions flagged), the work ledger. Story ratified in v1: the plane is the flower and the flower is blooming; the lords rode what they fed; the warped mana stays nameless; stakes per pass are postponement/harvest — the meta seam; the finale's deck is five-colour.*

## 1. The geometry, cashed

- **The center of the map** hosts **two nodes** (worldgen reserves the space — the radial generator keeps the convergence clear; escalate if spoke-carving fights it): **the Vault** and **the Corolla**.
- **The ten duals complete**: the five flowing pairs (WB BR RU UG GW — the lords' warped adjacencies) and the five **still pairs** (WU UB BG RG WR), unmoving all game, awakened only at the center. The Bloom's five-colour deck runs all ten; the Corolla decks run the still five, one each.
- **Mana identity as the power ladder**: guardians mono → lords tri → **the Bloom pentachromatic**.

## 2. The laws were the flower's (pending Chris's explicit yes)

Per-battle law re-injection becomes lore: laws regrow because they were **grown** — five petals of the Bloom's own law, worn by sovereigns who mistook blossoms for crowns. No shipped mechanic changes; only meaning.

## 3. The Corolla — the still-pair bijection (Chris-ruled)

Each petal-chamber returns one lord's law, fought by a deck in **the one pairing that lord could never touch** — his triple's complement, which is exactly a still pair (the bijection is perfect: five lords, five complements, five still pairs, no gaps):

| Chamber | Law returns | Lord (his pairs) | The still-pair deck | Signature |
|---|---|---|---|---|
| 1 | the Risen Tide | the Unwinder (UR, UG) | **RG** | new gold custom — the game's only RG card |
| 2 | the Tithe | the Usher (BW, BR) | **WR** | " only WR " |
| 3 | the Intake | the Warden (WG, WB) | **GB** | " only GB " |
| 4 | the Toll | the Stoker (RB, RU) | **UB** | " only UB " |
| 5 | the Season | the Sower (GU, GW) | **WU** | " only WU " |

The petals were always bigger than the sovereigns who wore them. Player law-tech (Disenchant, Abrade, the unwrite) scales to the end. *Open: chamber order (fixed ring walked in sequence vs player-chosen), whether still-pair signatures drop (the only path to collection completion running through the Corolla — planner leans yes, sole-mechanism style), interior grammar knobs (escrow, life persistence, an empowerment clock if wanted).*

### The still-pair signatures (Chris-designed; planner-audited; two of five)

**Lumen, the Hearth Fire** — {2}{R}{W} Legendary Creature — Human Advisor, 3/4 *(WR; the Tithe chamber)*
- Haste, lifelink
- {T}: Gain control of target creature until end of turn. Untap it. It gains haste and lifelink until end of turn.

*Endorsed as written. **Bill: one rider** — temporary (until-EOT) control change, riding Control Magic's shipped layer + the S25 grantKeyword-until-EOT + S17's untap; the threaten class unlocked for future red. Fixtures: returns tapped at cleanup; revert survives Lumen leaving mid-turn. Her keywords echo her gift (she has what she lends). Chamber teeth: under the Tithe, the creature she steals from you and spends drains you for its own death. AI: steal-then-swing rides the attack search; sequencing watch (main-one activation).*

**Clio, Lady of the Depths** — {1}{U}{B} Legendary Creature — Human Advisor *(Chris-ruled; the Advisor pair with Lumen — the courtiers of the Corolla)*, 2/4 *(UB; the Toll chamber)*
- At the beginning of your end step, put a depth counter on Clio.
- Creatures your opponents control get -1/-0 for each depth counter on Clio.
- {U}{B}, Remove three depth counters from Clio: Draw two cards, then each opponent discards a card.

*Endorsed; the batch's heavier bill at ~2.5 riders: **named counter kinds** (the accumulator class opens permanently), **counters-on-self value ref** (family member eight), **remove-counters-as-cost**. The clockwork: accumulate (the tide's tax grows) or spend (the burst) — never both. Chamber teeth: the Toll taxes casts while Clio taxes attacks. AI: hold-vs-spend pin sketch (spend at 3+ when the hand runs low; hold when the board threatens); guardian-sim grades. "Each opponent discards" compiles to the Mind Rot chooser. Clio-of-the-muses clears the naming rule (the Gaean precedent — real myth is open commons).*

**[Name pending], the WU signature** — {2}{W}{U} Legendary Creature — Human Soldier *(Chris-ruled)*, 2/2 *(WU; the Season chamber)* — **name and art pending**
- Whenever you draw a card, create a 1/1 white Soldier creature token.

*Endorsed. **Bill: skeleton, likely zero** — the DRAW trigger collector (DISCARD's sibling; the SFX channel has listened to draws since S24; first collectors count as skeleton per the R-061/S23 precedent); the token is Raise the Alarm's `soldier_1_1`. The draw step is a draw — a guaranteed soldier every turn, Bitterblossom's cadence without the life cost; under the Season the army ages upward as it widens. Divination = two soldiers; opening-hand draws don't fire; **cycling is a draw** — a player holding her and the Stoker's card turns every cycle into a soldier (lord-plus-petal collection synergy). Third variation on the Corolla's per-turn form.*

**[Name pending], the RG signature** — {2}{R}{G} Legendary Creature — Human Druid *(Chris-ruled)*, 3/3 *(RG; the Risen Tide chamber)* — **Chris-final; name and art pending**
- Trample, haste
- Whenever a land enters under your control, ~ gets +2/+0 until end of turn.
- Whenever ~ attacks, you may return target land card from your graveyard to your hand.

*Bill: zero — LAND_ENTERS (a trigger event since the data model's first draft), pump-until-EOT, Titania's land predicate meeting Gravedigger's to-hand destination. **The loop**: cycle a flooded land (a draw, and it hits the graveyard) → attack, recover it → play it with the law's extra drop → landfall. The signature manufactures the drops the law consumes. Chris's tweaks: haste as a property (honest any turn); the return **targeted** (answerable when graveyard hate arrives). The turn-two line under the law: land-land-Elves; land, cast on four, second drop, a 5/3 trample haste on turn two. Deck skeleton (Chris): 4 Forgotten Cave, 4 Tranquil Thicket, 4 Evolving Wilds (two landfalls each) in a land-rich 40; planner drafts around it. Fourth variation on the Corolla's per-turn form. (The Jund-modal sketch is shelved with love for a future Jund card.)*

**Seraphina, the Initiative** — {2}{B}{G} Legendary Creature — Human Assassin, 2/3 *(BG; the Intake chamber)* — **Chris-final; art in hand (external provenance)**
- {T}: Destroy target tapped creature.
- Whenever a creature an opponent controls dies, put a +1/+1 counter on Seraphina.

*Chris's trim: opponents' deaths only — she is the Intake's headsman, not also an aristocrats payoff. "The Initiative": she moves first, which is what killing things before they untap means.*

*The Intake's headsman: what arrives shackled dies before it wakes; she grows on every death. Royal Assassin's 1994 design meeting the law built for it. **Bill: ~half a rider** — the `tapped` target predicate (the status-predicate door from the Warden's round, opened at last); counters + observed DIES are Blood Artist's machinery. **The chamber that makes law-removal mandatory**: with the Intake up, creature strategies lose; Disenchant the law and she collapses to Royal Assassin — the petal that teaches the doctrine by force before the Heart. Instant-speed by default (mid-combat kills on attackers). Alternative B (automatic, crueler, less interactive): "tapped creatures your opponents control get −2/−2" — a Wrath-on-entry under the law; planner leans A.*

*Art provenance (for the brief): Lumen, Clio, and Seraphina carry Chris's own renders (the Drana precedent); the RG and WU signatures and the Bloom go through the art skill.*

*The court is human entire — Advisor, Advisor, Soldier, Druid, Assassin. The lords were a merfolk, a vampire, a treefolk, an efreet, a dryad; the flower's ministers are people. Filed for the disposition.*

*All five chambers have Chris-final signatures; two names pending (WU, RG). Next planner deliverable: the five Corolla decklists around Chris's skeletons.*

## 4. The Vault — the Mirror (Chris-conceived)

Locked until all five Moxen are held. Inside: **your own deck, played against you** — the AI is handed a copy and tries to play it better. The gate methodology (self-play mirrors, the ladder's instrument since ADR-010) surfaced as content; `enemyDeck = copy(playerDeck)` is the whole spine — the cheapest boss in the project.

**Planner additions (Chris's yes/no):**
1. **The mirror fights with the prize** — the copy is your deck **plus the Black Lotus**: your strategy improved by the thing you came to take; a live demonstration of the prize's worth; a list-append.
2. **Ante off, both ways** — mirror-ante mints duplicates of your own cards (an economy break); *a reflection has nothing to lose.*
3. **No guardian card** — the encounter's identity is the reflection; the Vault doesn't test your strength, it shows you what you brought. New-card count drops to six.

Prize: **Black Lotus** (`prizeOnly`, at last with an address) — the bud's first gift, carried into the Heart if the pilgrimage precedes it. Sole-mechanism law applies in spirit: there is exactly one, and now it is yours.

## 5. The Heart (design space; Chris mechanical-first when ready)

Fixed points: **five-colour deck, all ten duals**; the entrance rule in spirit ("the flower is always already here"); cost-grammar terminus open ({N}{W}{U}{B}{R}{G}-shaped, the lords' pattern completed); the sixth-law question (what law is *underneath* the five) rides with the card; the name appears nowhere until the card, then once.

## 6. Stakes and the chronicle (v1-agnostic scaffold, ratified)

V1 ends on the standing register — *"the petals close. For now."* The ultimate truth is the meta layer's payload: the reserved `chronicle` accumulates it across completed runs; the v1 victory text is written to survive any eventual disposition (indifferent / hungry / tragic — Chris noodles at leisure).

## 7. The work ledger

**Decks: six** — five Corolla still-pair decks (Chris noodling anchors; each ~30–40 with duals of its pair; planner drafts on his sketches) + the Bloom's five-colour 40. **New cards: six** — five still-pair gold signatures + the Bloom itself; minimal-surface mandate holds (aim zero-to-one riders each; the Mirror needs none). **Engine**: mirror-copy MatchSpec (+Lotus append, ante-off — near-zero); center-reservation worldgen; Corolla/Vault site machinery on the dungeon system; the Heart's fight on the boss grammars. **Text**: entry telegraphs, the victory text, chronicle lines (planner, post-§2-yes). **Art**: two site plates (the Vault, the Corolla), the Bloom's card ceremony, five still-pair card ceremonies.

## 8. Open ledger

1. Chris's yes on §2 (the laws were the flower's).  2. The Mirror additions (§4).  3. Corolla chamber order + signature-drop rule + interior knobs (§3).  4. The five still-pair anchors (Chris noodling) → planner deck drafts.  5. The Bloom's card (Chris mechanical-first).  6. Disposition (deferred by design).  7. Site names (working labels stand).  8. The victory text (planner, gated on 1 and 5).

---

# v1.2 — The Corolla as a world (Chris-conceived), and the five decks

## The petal-world (ratified in shape; details for the S26 round)

**The Corolla is a small radial world map** — five petals around a center, **the logo rendered as geography** — entered from the outer map's center node once five seals are held. The dungeon system's founding insight taken to its endpoint: the final dungeon is literally a world, with a **town at its heart**. At each petal's tip, **a fixed-point boss fight** (the lair pattern: certain, stationary, no buildup) — the still-pair signature's deck under its chamber's returned law (the dungeon-law hook on a fixed point). Signatures drop as the lords' cards did (sole-mechanism; Chris-ruled by implication). **The Heart battle takes place at the town** once all five petals fall — its door stands locked, its state readable, its fight out of scope until the Bloom's card exists.

**Rulings for the round (planner proposals):** the petal-world is world-kind, not dungeon-kind — rewards pay as they go (a town is not a mountain; no escrow), cleared petals persist, and the player may walk back out to the outer world and return (the flower keeps its wounds). No roamers by default (the petals are the only fights; knob if wanted). An empowerment clock on Corolla steps is a knob shipped **off** — time stops in the flower unless play wants tension there. **The town's offerings** are Chris's to fill; baseline shell: the inn, a shop (the flower's shelf — planner proposes the R drawer, the only place it's ever stocked), the tavern (the chronicle's future voice), and the Heart's door. **The Vault's placement**: outside at the outer center (ratified two-lock timing; the Lotus winnable pre-seals) unless Chris moves it inside as a town door.

## The five Corolla decks (v1; 40 cards; signature ×3; the still pair's ABU dual + shock; petal-sim tunes)

- **The Tithe petal — Lumen (WR):** 16 lands — 6 Plains, 6 Mountain, 2 Plateau, 2 Sacred Foundry. 24 spells — 3 Lumen, 3 Lightning Bolt, 2 Shock, 2 Savannah Lions, 2 Fencing Ace, 2 Master Decoy, 2 Boggart Brute, 2 Hordeling Outburst, 2 Glorious Anthem, 2 Swords to Plowshares, 2 Pacifism. *(Aggro with a courtesan's theft; every creature she borrows and spends drains you by the law.)*
- **The Toll petal — Clio (UB):** 16 lands — 6 Island, 6 Swamp, 2 Underground Sea, 2 Watery Grave. 24 spells — 3 Clio, 2 Counterspell, 2 Essence Scatter, 2 Doom Blade, 2 Terror, 2 Mind Rot, 2 Hymn to Tourach, 2 Man-o'-War, 2 Phyrexian Rager, 2 Divination, 2 Air Elemental, 1 Hypnotic Specter. *(Attrition; the tide taxes attacks while the law taxes casts.)*
- **The Intake petal — Seraphina (BG):** 16 lands — 6 Swamp, 6 Forest, 2 Bayou, 2 Overgrown Tomb. 24 spells — 3 Seraphina, 2 Doom Blade, 2 Duress, 2 Prey Upon, 2 Deadly Recluse, 2 Moss Viper, 2 Llanowar Elves, 2 Vampire Nighthawk, 2 Gravedigger, 2 Werebear, 2 Rumbling Baloth, 1 Pelakka Wurm. *(Deathtouch walls and the headsman; the petal that makes law-removal mandatory.)*
- **The Risen Tide petal — the Druid (RG):** 22 lands — 4 Forgotten Cave, 4 Tranquil Thicket, 4 Evolving Wilds, 3 Mountain, 3 Forest, 2 Taiga, 2 Stomping Ground. 18 spells — 3 the Druid, 3 Llanowar Elves, 2 Rampant Growth, 2 Lightning Bolt, 2 Gaean Wurm, 2 Rumbling Baloth, 2 Giant Growth, 2 Thundersnake. *(Chris's skeleton, land-rich; the cycle-recover-drop-landfall engine; Wilds is two landfalls.)*
- **The Season petal — the Soldier (WU):** 16 lands — 6 Plains, 6 Island, 2 Tundra, 2 Hallowed Fountain. 24 spells — 3 the Soldier, 2 Divination, 2 Cloudkin Seer, 2 Inspiring Overseer, 2 Aether Channeler, 2 Restoration Angel, 2 Raise the Alarm, 2 Glorious Anthem, 2 Counterspell, 2 Swords to Plowshares, 2 Pacifism, 1 Serra Angel. *(Every draw musters; every upkeep the Season ages the muster upward.)*
