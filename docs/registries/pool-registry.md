# Pool Registry

Every card in the pool, its status, and the vocabulary it uses. Implementer updates status; planner curates membership.

Status: `planned` / `implemented` / `tested` / `cut`.

## Session 1 slice

| cardId | name | status | vocabulary | notes |
|---|---|---|---|---|
| mountain | Mountain | tested | addMana | |
| plains | Plains | tested | addMana | |
| island | Island | tested | addMana | |
| raging_goblin | Raging Goblin | tested | haste | exercised via fuzz (haste path unit-covered by eligibleAttackers) |
| goblin_piker | Goblin Piker | tested | — | vanilla 2/1; fixture 1 |
| hill_giant | Hill Giant | tested | — | vanilla 3/3; fixtures 13–14 |
| gray_ogre | Gray Ogre | tested | — | vanilla 2/2 for 2R; fixtures 2, 8, 9 |
| lightning_bolt | Lightning Bolt | tested | damage(anyTarget) | fixtures 1–3, 13 |
| shock | Shock | tested | damage(anyTarget) | same path as Bolt; fuzz-exercised |
| brute_force | Brute Force | tested | modifyPT(EOT) | fixtures 2, 14 |
| savannah_lions | Savannah Lions | tested | — | fixtures 4, 5 |
| suntail_hawk | Suntail Hawk | tested | flying | fuzz-exercised; flying path fixture 9 |
| wind_drake | Wind Drake | tested | flying | fixture 9 |
| serra_angel | Serra Angel | tested | flying, vigilance | fixture 7 |
| man_o_war | Man-o'-War | tested | triggered(ETB) bounce | fixture 6 (self-bounce edge, no carve-out needed) |
| cloudkin_seer | Cloudkin Seer | tested | flying, triggered(ETB) draw | fixture 12 |
| counterspell | Counterspell | tested | counter | fixture 3 |
| boomerang | Boomerang | tested | bounce(permanent) | fixture 4 |
| pacifism | Pacifism | tested | aura, restrict(both) | fixtures 4, 5; uses new `attached` scope |
| divination | Divination | tested | draw | unit-covered (sorcery timing) + fuzz |

## Session 2 additions

(Implementer-derived in S2; ratified by ADR-023, including the Rumbling Baloth substitution.)

| cardId | name | status | vocabulary | notes |
|---|---|---|---|---|
| forest | Forest | tested | addMana | |
| grizzly_bears | Grizzly Bears | tested | — | vanilla 2/2 |
| elvish_visionary | Elvish Visionary | tested | triggered(ETB) draw | S2 fixture 9 |
| timberland_guide | Timberland Guide | tested | triggered(ETB) addCounters | fixtures 8, 9; self-target edge like Man-o'-War |
| centaur_courser | Centaur Courser | tested | — | vanilla 3/3; anthem + block-order fixtures |
| rumbling_baloth | Rumbling Baloth | tested | — | vanilla 4/4; **substituted for the brief's Rhox Brute**, which is {2}{R}{G} (uncastable in mono-green); Chris-approved 2026-08-19 |
| pelakka_wurm | Pelakka Wurm | tested | trample, triggered(ETB) gainLife, triggered(DIES) draw | dies-trigger quadruple fixture |
| giant_growth | Giant Growth | tested | modifyPT(EOT) | |
| blaze | Blaze | tested | damage(anyTarget, X) | X enumeration (ADR-017) |
| raise_the_alarm | Raise the Alarm | tested | createToken | |
| glorious_anthem | Glorious Anthem | tested | static modifyPT(creaturesYouControl) | |
| soldier_1_1 | Soldier Token | tested | — | token def, `data/cards/tokens/` |

## Session 3 additions

| cardId | name | status | vocabulary | notes |
|---|---|---|---|---|
| siege_gang_commander | Siege-Gang Commander | tested | triggered(ETB) createToken ×3, activated(sac Goblin) damage | S3 fixtures 1, 1b, 2 |
| goblin_1_1 | Goblin Token | tested | — | token def, colors R (ADR-019) |
| boggart_brute | Boggart Brute | tested | menace | fixtures 9–9c; dead-end-free enumeration |
| bonesplitter | Bonesplitter | tested | equipment, static modifyPT(attached) | fixtures 4, 8 |
| loxodon_warhammer | Loxodon Warhammer | tested | equipment, static modifyPT + grantKeyword(trample, lifelink)(attached) | fixtures 5, 6b, 13 |
| mind_stone | Mind Stone | tested | addMana {C}, activated(sac self) draw | first non-land producer (R-033); fuzz-caught canPay fix |
| darksteel_myr | Darksteel Myr | tested | indestructible | fixture 12 |
| fencing_ace | Fencing Ace | tested | double strike | fixtures 8, 8b |
| prey_upon | Prey Upon | tested | fight | ADR-022; fixtures 7, 7b, 13 |
| deadly_recluse | Deadly Recluse | tested | reach, deathtouch | fixtures 6, 6b, 7 |
| gladecover_scout | Gladecover Scout | tested | hexproof | fixture 10 |
| blurred_mongoose | Blurred Mongoose | tested | shroud, can't be countered | fixture 11 (R-032) |

## Session 4 additions

| cardId | name | status | vocabulary | notes |
|---|---|---|---|---|
| swamp | Swamp | tested | addMana | |
| doom_blade | Doom Blade | tested | destroy(nonblack creature) | S4 fixture 1, 1b |
| terror | Terror | tested | destroy(nonartifact nonblack creature) | regeneration clause ignored; fixture 1 |
| swords_to_plowshares | Swords to Plowshares | tested | exile, gainLife(ref targetPower, controllerOfTarget) | ADR-028; fixtures 2, 2b |
| wrath_of_god | Wrath of God | tested | destroyAll | fixture 3 |
| pyroclasm | Pyroclasm | tested | damageAll(2) | fixture 4 |
| duress | Duress | tested | discard(casterChooses, filter noncreature nonland) | ADR-029; fixtures 5, 5b; targets opponentPlayer (new predicate) |
| mind_rot | Mind Rot | tested | discard(ownerChooses, 2) | fixtures 6, 6b |
| hymn_to_tourach | Hymn to Tourach | tested | discard(random, 2) | power level flagged for later curation; fixture 7 |
| phyrexian_rager | Phyrexian Rager | tested | triggered(ETB) draw + loseLife | fixture 8; first loseLife user |
| nekrataal | Nekrataal | tested | first strike, triggered(ETB) destroy(targeted) | fixture 9; 603.3d path |
| vampire_nighthawk | Vampire Nighthawk | tested | flying, deathtouch, lifelink | keyword composition; fixture 12 |
| child_of_night | Child of Night | tested | lifelink | fixture 2 |
| typhoid_rats | Typhoid Rats | tested | deathtouch | fixtures 4, 9 |
| goblin_chieftain | Goblin Chieftain | tested | haste, static modifyPT + grantKeyword scope{creaturesYouControl, Goblin, other} | ADR-020 first user; fixture 10 |
| curiosity | Curiosity | tested | aura, triggered(DEALS_DAMAGE_TO_PLAYER, source attached, player opponentOfController, optional) draw | ADR-021/027 first user; fixtures 11a-c |

## Session 5 additions

| cardId | name | status | vocabulary | notes |
|---|---|---|---|---|
| control_magic | Control Magic | tested | aura, static gainControl(attached) | ADR-033; R-020; S5 fixtures 1–4 |
| zombify | Zombify | tested | returnFromGraveyard(to battlefield) | fixtures 7–7c |
| gravedigger | Gravedigger | tested | triggered(ETB, optional) returnFromGraveyard(to hand) | fixtures 8–8c |
| rancor | Rancor | tested | aura, static modifyPT + grantKeyword(trample)(attached), triggered(DIES, self) return to owner's hand | scope `self` first user (R-041); fixtures 9–9c |
| drana_kalastria_bloodchief | Drana, Kalastria Bloodchief | tested | flying, legendary, activated(X) modifyPT ×2 | legend rule (R-025); "-X" P/T deltas; fixtures 5–6c |
| mystic_snake | Mystic Snake | tested | flash, triggered(ETB) counter(target spell) | fixtures 10–11 |

## Session 8 additions

| cardId | name | status | vocabulary | notes |
|---|---|---|---|---|
| cunning_tactician | Cunning Tactician | tested | vigilance, activated({W}+T) tapTarget | **first custom card** (ADR-053); `source: custom`, `text` field; s8 fixtures 1–3; first tapTarget user; art per ADR-052 (4 candidates → Chris picks) |

Deck B swap (S8): −1 Savannah Lions, −1 Fencing Ace, +2 Cunning Tactician.

## Session 15 additions (the tutor batch, ADR-068)

| cardId | name | status | vocabulary | prizeOnly | notes |
|---|---|---|---|---|---|
| rampant_growth | Rampant Growth | implemented | searchLibrary(basicLand → battlefield, entersTapped) | no | Amendment 1; enters-tapped special ETB rule (manifest §4 sanctioned); landfall fires; shuffle after (CR 701.19) |
| demonic_tutor | Demonic Tutor | implemented | searchLibrary(anyCard → hand) | no | Amendment 1; power-outlier drawer with Hymn (Shandalar-nasty by design) |
| black_lotus | Black Lotus | implemented | activated({T}, sac self) addMana(choice 3 of any one colour) | **yes** | Amendment 2: five colour actions at activation, no stack; never auto-paid; never shop stock — boss/lair treasure (M6b content) |

Deck swaps (S15, ADR-068): C −1 Forest −1 Centaur Courser +2 Rampant Growth; D −1 Zombify +1 Demonic Tutor; Lotus in no deck.

## Session 16 additions (the one-drops, ADR-070)

| cardId | name | status | vocabulary | prizeOnly | notes |
|---|---|---|---|---|---|
| llanowar_elves | Llanowar Elves | implemented | activated({T}) addMana({G}) on a creature | no | Scryfall re-verified ({G} Elf Druid 1/1, "{T}: Add {G}."); first creature mana producer — R-047 summoning-sickness gate; Green starter ×2 |
| cathartic_adept | Cathartic Adept | implemented | activated({T}, target player) mill(1, target) | no | Scryfall re-verified ({U} Human Wizard 1/1, "{T}: Target player mills a card."); Amendment 3 / R-046; Blue starter ×2; AI mill value 0.1 (nuisance) |

Starters (S16, ADR-069/070): the five authored 30-card mono starters live in `data/world/starters.json` (Green +2 Elves −1 Forest −1 Bears; Blue +2 Adept −1 Island −1 Seer, per ADR-070); slice decks A–E are enemy/ladder infrastructure only.

## Session 17 additions (Expansion 1 — the Bestiary's Arsenal, ADR-074/075/076)

All real cards Scryfall re-verified before encoding; ⚠-row outcomes are in the S17 handoff (nine rows differed from the planner's draft — Scryfall values encoded). prizeOnly: none.

| cardId | name | status | vocabulary | notes |
|---|---|---|---|---|
| werebear | Werebear | implemented | creature mana ability; conditional static (graveyardCount ≥ 7 → +3/+3) | A4 threshold |
| little_bear | Little Bear | implemented | flash; ETB untapTarget(other creatureYouControl) + addCounters `if` Bear | first untapTarget resolver |
| mother_bear | Mother Bear | implemented | graveyard-zone ability {3}{G}{G}, exileSelf, sorcery → two bear_2_2 | A5; cost {3}{G}{G} (planner draft said {1}{G}) |
| moss_viper | Moss Viper | implemented | deathtouch | |
| treetop_snarespinner | Treetop Snarespinner | implemented | reach, deathtouch; sorcery-speed {2}{G} counter on creatureYouControl | |
| airship_crash | Airship Crash | implemented | destroy anyOf(artifact, enchantment, creature withKeyword flying); cycling {2} | A5 cycling; or-predicate |
| baru_wurmspeaker | Baru, Wurmspeaker | implemented | static Wurms +2/+2 trample (subtype scope); {7}{G},{T} wurm_4_4 with reduceBy maxPower(Wurm) | A4 reduction; legendary (pool-legal, ADR-076) |
| gaean_wurm | Gaean Wurm (custom #2) | implemented | static modifyPT count(Forest you control) | A4; art candidates S18 |
| mist_raven | Mist Raven | implemented | flying; ETB bounce target creature | cost {2}{U}{U} (draft said {2}{U}) |
| waterfront_bouncer | Waterfront Bouncer | implemented | {U},{T}, discard 1: bounce creature | cost {1}{U} (draft {U}); discard cost |
| essence_scatter | Essence Scatter | implemented | counter target creatureSpell | spell-type predicate |
| gravitational_shift | Gravitational Shift | implemented | statics withKeyword/withoutKeyword flying ±2/+0 | keyword-filtered scopes |
| aether_channeler | Aether Channeler | implemented | ETB modal: bird token / bounce other nonlandPermanent / draw | A6 |
| aven_fisher | Aven Fisher | implemented | flying; DIES optional draw | cost {3}{U} |
| air_elemental | Air Elemental | implemented | 4/4 flying | ADR-074 |
| master_decoy | Master Decoy | implemented | {W},{T}: tapTarget creature | |
| scepter_of_dominance | Scepter of Dominance | implemented | {W},{T}: tapTarget permanent | cost {1}{W}{W} (draft {W}{W}) |
| disenchant | Disenchant | implemented | destroy anyOf(artifact, enchantment) | |
| youthful_valkyrie | Youthful Valkyrie | implemented | flying; observed ETB (other Angel you control) → counter on self | 1/3 (draft 1/1?) |
| restoration_angel | Restoration Angel | implemented | flash, flying; optional ETB exileThenReturn(other non-Angel creatureYouControl) | A8; "you may … target" — not "up to one" |
| inspiring_overseer | Inspiring Overseer | implemented | flying; ETB gain 1 + draw | |
| skirk_prospector | Skirk Prospector | implemented | sac Goblin: add {R} (deliberate, one action) | |
| hordeling_outburst | Hordeling Outburst | implemented | three goblin_1_1 | |
| goblin_grenade | Goblin Grenade | implemented | additionalCost sac Goblin; 5 damage anyTarget | A7 |
| goblin_matron | Goblin Matron | implemented | optional ETB searchLibrary subtype:Goblin → hand | subtype search |
| indulgent_aristocrat | Indulgent Aristocrat | implemented | lifelink; {2}, sac a creature: +1/+1 counter on each Vampire (scope) | "a creature" incl. itself; Vampire Noble |
| blood_artist | Blood Artist | implemented | observed DIES (source any, creature) → target player loses 1, you gain 1 | cost {1}{B} (draft {B}); look-back under Wrath |
| bitterblossom | Bitterblossom | implemented | UPKEEP (yours): lose 1, faerie_rogue_1_1_flying | Kindred Enchantment — Faerie encoded as Enchantment + subtype |
| dark_ritual | Dark Ritual | implemented | spell addMana {B}{B}{B} | book of shame 12 |
| waste_not | Waste Not | implemented | DISCARD (opponent) ×3: creature → zombie_2_2; land → {B}{B}; noncreature nonland → draw | triggered mana |
| tendrils_of_corruption | Tendrils of Corruption | implemented | damage count(Swamp you control) + gainLife same | A4 at resolution |
| hypnotic_specter | Hypnotic Specter | implemented | flying; DEALS_DAMAGE_TO_PLAYER (self, opponent) → discard 1 random | ADR-074 |

Tokens added: bear_2_2 (G), bird_1_1_flying (W), wurm_4_4 (G), zombie_2_2 (B), faerie_rogue_1_1_flying (B). Pool 72 → 104 cards (+5 tokens = 109 loader entries). Beast decklists (30 cards as listed; ADR-074 says 40 — planner reconciles in S18) live in `packages/sim/src/expansion-decks.ts` for fuzz/ladder until the S18 catalog adopts them.

## Ceiling anchors (not yet scheduled)
Ceiling complete as of S5 (see mechanics-manifest §3). Further additions are card batches using existing vocabulary.

## Slice decklists (S5 brief Part 3; 40 cards each)
- **A red:** 17 Mountain, 4 Raging Goblin, 2 Goblin Piker, 3 Lightning Bolt, 2 Shock, 2 Blaze, 3 Boggart Brute, 2 Siege-Gang Commander, 2 Bonesplitter, 2 Goblin Chieftain, 1 Pyroclasm.
- **B white-blue (S8 swap: −1 Savannah Lions, −1 Fencing Ace, +2 Cunning Tactician):** 8 Plains, 9 Island, 2 Serra Angel, 2 Man-o'-War, 2 Cloudkin Seer, 2 Counterspell, 1 Pacifism, 1 Raise the Alarm, 1 Glorious Anthem, 1 Fencing Ace, 2 Cunning Tactician, 1 Loxodon Warhammer, 1 Mind Stone, 2 Swords to Plowshares, 1 Wrath of God, 2 Curiosity, 2 Control Magic.
- **C green:** 17 Forest, 3 Elvish Visionary, 3 Timberland Guide, 2 Centaur Courser, 2 Rumbling Baloth, 2 Pelakka Wurm, 1 Giant Growth, 3 Prey Upon, 2 Deadly Recluse, 2 Gladecover Scout, 1 Blurred Mongoose, 2 Rancor.
- **D black:** 17 Swamp, 2 Typhoid Rats, 2 Child of Night, 3 Vampire Nighthawk, 2 Phyrexian Rager, 3 Nekrataal, 2 Doom Blade, 1 Terror, 1 Duress, 1 Hymn to Tourach, 2 Drana, 2 Gravedigger, 2 Zombify.
- **E Simic (new, S5):** 9 Forest, 8 Island, 3 Mystic Snake, 2 Counterspell, 2 Boomerang, 2 Wind Drake, 2 Man-o'-War, 2 Cloudkin Seer, 2 Curiosity, 3 Grizzly Bears, 3 Elvish Visionary, 2 Deadly Recluse.

(Rotated out of decks but still `tested` pool members: Gray Ogre, Boomerang, Hill Giant, Brute Force, Suntail Hawk, Wind Drake, Darksteel Myr, Savannah Lions.)

## Test-only cards (not pool members)
`test_fs_soldier` (first strike body), `test_pinger` ({1},T: 1 damage), `test_wrath` ({2} sorcery, destroy all creatures), `test_goblin_martyr` ({R} 1/1 Goblin, dies: draw), `test_pyroclasm` ({1}{R} sorcery, 2 to all creatures) — live in the engine test harness, never in `data/cards/`. Per ADR-018 they are permanent fixtures: engine tests never depend on pool membership.

## Scryfall printings (art:fetch)

Resolved per `docs/art/printings.md`; regenerate with `pnpm art:fetch`. Flagged rows appear in the session handoff, not here.

| cardId | set | collector | artist | scryfallId |
|---|---|---|---|---|
| aether_channeler | dmu | 42 | Caio Monteiro | 60afeb75-2c1e-4634-8c83-88b1dddb77c2 |
| air_elemental | lea | 46 | Richard Thomas | 69c3b2a3-0daa-4d42-832d-fcdfda6555ea |
| airship_crash | fin | 171 | Enora Mercier | ec91c4e4-711f-464d-bc83-e6813f4fdcdb |
| aven_fisher | ody | 63 | Christopher Moeller | 5b27130d-2296-4076-9829-15ab63081896 |
| baru_wurmspeaker | dmc | 26 | Andrew Mar | 2cae4149-d8ef-4772-9db4-cb576bef61b5 |
| bitterblossom | mor | 58 | Rebecca Guay | 8145fed6-6b51-420a-84cf-4ea5e0aa1883 |
| black_lotus | lea | 232 | Christopher Rush | b0faa7f2-b547-42c4-a810-839da50dadfe |
| blaze | por | 118 | Gerry Grace | f175c959-3b5d-46a3-9194-fad2359bbff9 |
| blood_artist | avr | 86 | Johannes Voss | 2e1fb442-68ff-4249-8e44-87edf6fae211 |
| blurred_mongoose | inv | 183 | Heather Hudson | 4b073e3f-6a6f-495a-ab16-39d906b660f1 |
| boggart_brute | ori | 133 | Igor Kieryluk | 9d735ebf-61a4-4507-9399-6d32c8903ded |
| bonesplitter | pal03 | 8 | Darrell Riche | ae31d513-7412-4467-b497-a7183ff29a42 |
| boomerang | leg | 48 | Brian Snõddy | b8286edd-644b-4135-8dca-af97f3920de3 |
| brute_force | plc | 116 | Wayne Reynolds | 82d43220-1e4e-4b61-9844-51c8bb5dde35 |
| cathartic_adept | ala | 34 | Carl Critchlow | 8e63626d-f55c-4155-9712-511f591c0614 |
| centaur_courser | m10 | 172 | Vance Kovacs | 03354b67-7df2-4b4b-a996-a37550e58561 |
| child_of_night | m10 | 88 | Ash Wood | e1f7a9a7-3679-4a18-a52a-e3a8ab16ad32 |
| cloudkin_seer | m20 | 54 | Anastasia Ovchinnikova | e2111753-a930-403f-9d94-a86dfcb069da |
| control_magic | lea | 52 | Dameon Willich | 7b52f459-c703-4a0b-9114-ff69eec61287 |
| counterspell | lea | 54 | Mark Poole | 0df55e3f-14de-46ef-b6b1-616618724d9e |
| curiosity | exo | 29 | Val Mayerik | fee17ef5-7e1a-42ae-b680-df81204df7dd |
| dark_ritual | lea | 98 | Sandra Everingham | ebb6664d-23ca-456e-9916-afcd6f26aa7f |
| darksteel_myr | som | 151 | Randis Albion | 0f5712cf-c6a9-4a2e-90db-8ca17c621724 |
| deadly_recluse | m10 | 175 | Warren Mahy | 6ab810f1-21d6-4a98-b77a-e455370aa6cc |
| demonic_tutor | lea | 104 | Douglas Shuler | 711d4d54-5520-4de8-9b93-79902ed8e562 |
| disenchant | lea | 18 | Amy Weber | 2722d7e2-61c6-4934-9c21-875ee78fd06c |
| divination | m10 | 49 | Howard Lyon | 3102cec9-1cdc-4946-a2dd-caf04eaa8b97 |
| doom_blade | m10 | 93 | Chippy | 6e19acff-f3dd-417a-a9ab-ea3e36c1ba61 |
| drana_kalastria_bloodchief | roe | 107 | Mike Bierek | aca8d295-e8e9-4213-bc9b-f1acf57fb520 |
| duress | usg | 132 | Lawrence Snelly | ca367f49-0f4a-4b7f-8104-851893fbcd8a |
| elvish_visionary | ala | 130 | D. Alexander Gregory | faccfa5f-4d89-4a86-92d7-36cb5a16c5c9 |
| essence_scatter | m10 | 51 | Jon Foster | c231101e-6620-46fc-a0ad-a53291d12dc2 |
| fencing_ace | rtr | 11 | David Rapoza | a42d3066-f4ec-4d28-83ab-e48141206c72 |
| forest | leb | 300 | Christopher Rush | b5a922eb-49c7-45f0-92bc-671d7a8758f4 |
| giant_growth | lea | 197 | Sandra Everingham | 367dbefe-3366-408e-9fcf-7dc00f8cc201 |
| gladecover_scout | m12 | 178 | Allen Williams | 26710d5c-01d1-498b-9f54-521dfd195843 |
| glorious_anthem | usg | 15 | Kev Walker | 61f867c5-0727-4408-b479-b81518daa0ec |
| goblin_chieftain | m10 | 139 | Sam Wood | f5c8a4a4-1611-4188-9c59-8aefb016b5ad |
| goblin_grenade | fem | 56a | Ron Spencer | 8837eaba-9602-4f63-9897-85583fcdcf51 |
| goblin_matron | p02 | 100 | Daniel Gelon | f99dc21c-8600-49bf-b0a3-c981f7ec7ac3 |
| goblin_piker | p02 | 102 | DiTerlizzi | 2786834d-dbda-40ce-82a4-e518cd554312 |
| gravedigger | por | 95 | Scott M. Fischer | b979d70e-d514-420f-886c-f60e2bb1861f |
| gravitational_shift | roe | 69 | Svetlin Velinov | bad32b9f-0aa4-4036-90e6-c087cffd52e7 |
| gray_ogre | lea | 156 | Dan Frazier | 73ae5276-b607-4f23-a9d2-e8cc7b8e3693 |
| grizzly_bears | lea | 199 | Jeff A. Menges | ce2d603a-3231-4a8c-bf39-1617586ea870 |
| hill_giant | lea | 157 | Dan Frazier | 0ddb98e8-13fe-4786-83f7-b72c56db135a |
| hordeling_outburst | ktk | 111 | Zoltan Boros | a5c1bf52-2737-423a-b340-07448afcaea6 |
| hymn_to_tourach | fem | 38b | Liz Danforth | 8601f082-7e43-44ef-97d0-dead272b7eb4 |
| hypnotic_specter | lea | 112 | Douglas Shuler | b43b900f-2d9b-442b-9699-058483604ec9 |
| indulgent_aristocrat | soi | 118 | Anna Steinbauer | f24200d4-cd98-424c-bc2f-69f8b361d8fc |
| inspiring_overseer | snc | 18 | Irina Nordsol | 35d9da1d-8678-4252-b0f8-9960795642f0 |
| island | leb | 291 | Mark Poole | bff33e91-8e52-43f2-b8ae-603b456b08fc |
| lightning_bolt | lea | 161 | Christopher Rush | d573ef03-4730-45aa-93dd-e45ac1dbaf4a |
| little_bear | hob | 128 | Tomas Duchek | 8a50858a-33b5-4c45-9c31-5956ae5a33a6 |
| llanowar_elves | lea | 210 | Anson Maddocks | d4f1cc9e-4f99-4c26-ac1b-8ef069fa8ceb |
| loxodon_warhammer | mrd | 201 | Jeremy Jarvis | a1a6e375-5c47-4447-9453-adf0038693e3 |
| man_o_war | vis | 37 | Jon J Muth | 4dbf9bf9-75cd-4b25-a3a1-43b7e029700b |
| master_decoy | tmp | 29 | Phil Foglio | f3e11097-1ace-4ae8-a9e8-d00b9f709e54 |
| mind_rot | 7ed | 147 | Adam Rex | 5681e85c-79d5-4300-bda6-4ae40bb7d5d4 |
| mind_stone | wth | 153 | Adam Rex | 162e81d3-6cd4-4cb8-8ed8-cfbd8d34ca71 |
| mist_raven | avr | 67 | John Avon | 0d98f0c4-021a-407a-8b0c-5500d804f959 |
| moss_viper | thb | 179 | Mike Bierek | a4d35ec4-0e0d-4611-8ad9-39d2c8a2ad6e |
| mother_bear | mh1 | 171 | Winona Nelson | efae4d84-8134-461a-a352-a5bdff7259a7 |
| mountain | leb | 297 | Douglas Shuler | 7af9c715-8d72-4eae-b412-fc89138ff588 |
| mystic_snake | apc | 112 | Daren Bader | f098a28c-5f9b-4a2c-b109-c342365eb948 |
| nekrataal | vis | 66 | Adrian Smith | dba3e342-88b7-4692-a3f7-a3f56c0cf6b5 |
| pacifism | mir | 32 | Robert Bliss | c891df1b-bae6-4d6d-85ee-42901c149f98 |
| pelakka_wurm | roe | 204 | Daniel Ljunggren | 8e732593-0bdc-4dd4-9b07-9aa1a780e6e8 |
| phyrexian_rager | apc | 49 | Mark Tedin | 3addf34c-ea54-42a3-bccd-b73453d964d2 |
| plains | leb | 288 | Jesper Myrfors | b7331b03-be66-419c-94bc-ed494c042ea3 |
| prey_upon | isd | 200 | Dave Kendall | b7b3eaf0-4207-4bac-923d-29f348c95a35 |
| pyroclasm | ice | 214 | Pat Lewis | 88040748-ad76-4b9a-bd4e-87e5980e9816 |
| raging_goblin | por | 145 | Pete Venters | fed57a17-7847-4e60-bc40-4452880f12a3 |
| raise_the_alarm | mrd | 16 | John Matson | 4be510c8-fc01-4374-ac04-7968d24480fe |
| rampant_growth | mir | 235 | Pat Lewis | a9dd8043-4099-42bb-9d54-4efc8b38fe18 |
| rancor | ulg | 110 | Kev Walker | 59e256c2-38df-4012-9308-ce17dd889e5f |
| restoration_angel | avr | 32 | Johannes Voss | c2ad8639-e586-47f4-baca-2a1af5aa281b |
| rumbling_baloth | m14 | 193 | Jesper Ejsing | d8610ff1-064b-4c75-a8df-d3b076370d1e |
| savannah_lions | lea | 38 | Daniel Gelon | d05b92bd-797e-413f-a8b0-32e0937a1ee0 |
| scepter_of_dominance | con | 17 | Howard Lyon | 888bc7ca-f9fa-4da4-b466-b9dc273d5319 |
| serra_angel | lea | 39 | Douglas Shuler | f8ac5006-91bd-4803-93da-f87cf196dd2f |
| shock | sth | 98 | Randy Gallegos | f9b2ff2a-6dfe-4635-8da2-22d525e82b94 |
| siege_gang_commander | scg | 103 | Christopher Moeller | 92e78cec-aaf9-4fe8-887b-b7e356d63315 |
| skirk_prospector | ons | 230 | Doug Chaffee | eb545dcd-3a7a-46a7-9c35-d28faebc6d17 |
| suntail_hawk | jud | 28 | Heather Hudson | 5fbdae0b-b4aa-40ff-9017-b4349bd6b627 |
| swamp | leb | 294 | Dan Frazier | d1309a80-a761-4b80-8cf1-1a8b83190511 |
| swords_to_plowshares | lea | 40 | Jeff A. Menges | 386ea9eb-abc1-4862-aa2d-8fb808d79490 |
| tendrils_of_corruption | tsp | 136 | Mike Dringenberg | 7f61db9e-ef88-4dc8-b90c-1f8b2d7e9bb9 |
| terror | lea | 130 | Ron Spencer | 21004958-2c7e-4a55-bc80-411c4d780106 |
| timberland_guide | avr | 197 | Zoltan Boros | ae80fefb-af78-4f98-8058-71b61e91842f |
| treetop_snarespinner | fdn | 114 | Steve Ellis | 88e68fa3-159d-49a6-8ac6-afc9bd6f1718 |
| typhoid_rats | isd | 120 | Kev Walker | 4490ce65-c73a-4809-abd1-ccc3175bd2a4 |
| vampire_nighthawk | zen | 116 | Jason Chan | 44f19fe3-7a17-4c45-adfa-590f73dfebfa |
| waste_not | m15 | 122 | Matt Stewart | 241d8f7d-3981-47c1-b7b8-748277fa452f |
| waterfront_bouncer | mmq | 114 | Paolo Parente | 8dbdce9e-94fa-4ed5-9b97-d2026cffe7cb |
| werebear | ody | 282 | Carl Critchlow | 964cf7e3-932d-432f-8ad4-9bd651aada96 |
| wind_drake | por | 77 | Zina Saunders | 5486d2dc-9a5d-4f58-a5ec-d94de54b852f |
| wrath_of_god | lea | 45 | Quinton Hoover | a2788d69-6a3a-42f0-8736-cc6b57755ecd |
| youthful_valkyrie | khm | 382 | Anna Steinbauer | ffe93b27-f8ae-4abf-8ade-90f503f132c2 |
| zombify | ody | 171 | Mark Romanoski | 513a2a6f-9ae6-42cb-b75f-6b45fc35f36e |


## Shop tiers (ADR-078, S19)

The `shopTier` column (`1 | 2 | 3 | R`) is repo-canonical **on the card defs themselves** (`data/cards/*.json`, validated by the loader: every non-token, non-basic, non-prizeOnly card must carry one) rather than duplicated per row above; `docs/card-tier-audit-v2.md` is the curation source (planner-maintained), and `pnpm card-manifest` regenerates the human-readable price sheet. Distribution at adoption: **T1 ×53 · T2 ×31 · T3 ×10 · R ×2** (Demonic Tutor, Mystic Snake) + Lotus `prizeOnly` + 5 basics; Faerie Formation joins at T3 this session (→ T3 ×11). Availability: a town stocks `shopTier ≤ ring` (civilized 1 / approach 2 / wild 3); price × `shopTierMultiplier` (1.0/1.5/2.5 knobs); **R never stocks** — ante/quest/treasure circulation only.
