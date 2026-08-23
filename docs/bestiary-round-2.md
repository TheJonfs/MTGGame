# Bestiary Round 2 — filling the roster grid (planner draft v2, for Chris's verdict)

*Planner-authored. v2: **Faerie Formation replaces Mahamoti Djinn** as the U tier-3 signature (Chris's suggestion, planner concurs — see the pilotability note). Fills the five roster gaps (S18 concern 2 + Chris's W addition). One new pool card (search-verified this round, ✔); all other deck contents are existing pool cards already Scryfall-verified in-repo. Implementer re-verification of Formation remains blocker-level per principle 9 — and note the activation-cost flag below.*

## The five (names are suggestions; Chris verdicts)

| Entry | Spoke | Tier | Kind | Signature | Buyable (suggested) | Voice sketch |
|---|---|---|---|---|---|---|
| **A Plague of Rats** | B | 1 | beast | Typhoid Rats ×4 | yes (rations) | chittering hunger; "it can be fed, for now" |
| **A Gray Ogre** | R | 1 | beast | Gray Ogre ×4 | yes (greedy, dim) | slow menace; counts your coin on thick fingers |
| **A Savannah Lion** | W | 1 | beast | Savannah Lions ×4 | yes (fresh meat) | regal indifference; you are prey or you are boring |
| **A Rumbling Baloth** | G | 2 | beast | Rumbling Baloth ×4 | yes (rations, big appetite) | territorial; the ground shakes before you see it |
| **The Faerie Formation** | U | 3 | beast | Faerie Formation ×3 | **yes — but they take *trinkets*, not coin** | a glittering throng; the buy-off is them relieving you of something shiny (their printed flavor: castle-to-castle mischief, damaging rumors, missing heirlooms) |

The buyable trio at tiers 2–3 now covers three distinct fictions for why payment works or doesn't: the Serra tithe (devotion), the Gale's refusal (nothing it wants), and the Formation's larceny-as-transaction (they were going to take something anyway; you chose what).

**Grid coverage after this round** (signature per spoke × tier):

| | T1 | T2 | T3 |
|---|---|---|---|
| W | Savannah Lion · Tactician(mage) | Tactician(mage) | Serra Angel |
| U | Man-o'-War bloom | Living Gale | **Faerie Formation** |
| B | **Plague of Rats** | Vampire Nighthawk | Hypnotic Specter |
| R | **Gray Ogre** | Boggart Warband | Siege-Gang |
| G | Grizzly Bear · Deadly Recluse | **Rumbling Baloth** | Pelakka Wurm |

Complete — every spoke has a signature at every tier. **Consequence for OQ-4:** `beastTierFallback` no longer fires for signature rolls at all; it survives only as dead-code insurance for future catalog states. The `mage` default recommended at the S18 close stays correct and now costs nothing (realized beast share matches the knob everywhere). The Tactician also stops double-shifting at W1 once the Lion lands — recommend the W1 Tactician catalog entry be retired or kept as a *second* W1 face (variety), Chris's call.

## Why Formation over the Djinn (recorded so the reasoning survives)

The Djinn draft carried a flagged risk: tier-3 blue built as counter-wall-plus-finisher is the archetype the AI has always played worst (ADR-010's original caveat), so it was the deck most likely to world-sim under tier for pilot reasons rather than list reasons. Formation dissolves the risk instead of managing it: a proactive engine ("spare {3}{U} → 1/1 flyer + draw a card") that the existing evaluator already prices (tokens, draws) and the master profile's mana-sink behavior already exploits — Drana's proven shape, in blue. It also gives the deck a real win-condition identity distinct from the Gale: token swarm + Gravitational Shift is go-wide in the air, where the Gale is tempo-aggressive. Zero new vocabulary; one new token def.

## Decklists (30 cards; signature 3–4×; tier-appropriate power; implementer world-sims and reports)

- **A Plague of Rats (B,1):** 13 Swamp, 4 Typhoid Rats, 3 Child of Night, 2 Terror, 2 Duress, 2 Mind Rot, 2 Phyrexian Rager, 2 Gravedigger.
- **A Gray Ogre (R,1):** 12 Mountain, 4 Gray Ogre, 3 Raging Goblin, 3 Goblin Piker, 3 Shock, 2 Brute Force, 2 Hill Giant, 1 Blaze.
- **A Savannah Lion (W,1):** 12 Plains, 4 Savannah Lions, 4 Suntail Hawk, 3 Fencing Ace, 2 Master Decoy, 2 Raise the Alarm, 2 Pacifism, 1 Swords to Plowshares.
- **A Rumbling Baloth (G,2):** 12 Forest, 4 Rumbling Baloth, 3 Centaur Courser, 3 Llanowar Elves, 2 Grizzly Bears, 2 Elvish Visionary, 2 Giant Growth, 2 Prey Upon.
- **The Faerie Formation (U,3):** 13 Island, 3 Faerie Formation, 2 Air Elemental, 2 Gravitational Shift, 2 Mist Raven, 2 Wind Drake, 2 Man-o'-War, 2 Essence Scatter, 1 Counterspell, 1 Control Magic.

Design notes: the tier-1 lists sit at near-starter strength per ADR-074's scale (the Rats list is the nastiest of the three by a hair — deathtouch walls plus discard — which suits black's civilized ring being the least civilized). The Formation list is deliberately mana-hungry (13 lands) so the engine turns on: the intended late game is Formation online, tokens accumulating, Shift flipping the board's math. Counterspell/Scatter are a light shield, not the plan. Overlap with the Gale (Air Elemental, Wind Drake, Shift, the counters) is real but the play patterns diverge: the Gale spends its mana on threats up the curve; the Formation banks mana for the engine. Lair math: Formation becomes U's top-tier signature — **lair-host reassignment from the Gale to the Formation** (W Serra, U **Formation**, B Specter, R Siege-Gang, G Wurm), per the spoke's-top-signature rule.

## New card entry (pool 104 → 105)

**Faerie Formation** — {4}{U} Creature — Faerie 5/4, Flying. "{3}{U}: Create a 1/1 blue Faerie creature token with flying. Draw a card." ✔ *search-verified this round (Scryfall ELD #316; Gatherer corroborates the card).* **⚠ Activation-cost flag for the blocker re-verification:** some Gatherer renderings show the cost as bare "{3}"; Scryfall shows {3}{U}. Almost certainly a scrape artifact on Gatherer's side, but the implementer's Scryfall check settles it — if it comes back {3}, flag, don't fix.

- Vocabulary: activated ability (mana cost, no timing restriction → instant speed), `createToken` + `draw 1`. Zero new words; no manifest amendment.
- **New token def:** `faerie_1_1_u` — 1/1 blue Faerie, flying, `colors: ["U"]` (required per ADR-019). Distinct from Bitterblossom's black Faerie Rogue.
- `shopTier: 3` (tier-3 signature floor), price 4 × 6 × 2.5 = **60 gold**. MV 5.
- Printing: default-printing rule resolves it (ELD original, J22, WOC exist); Ryan Yee's original suits the bestiary register — flag per the Rager/Restoration Angel precedent if the default lands elsewhere unintended.
- Deck membership: the Formation beast deck only (no slice or starter changes; ladder unaffected).
- Token art: the house-style token treatment (S7/S17 pattern) — one more subject file alongside the five plates.

## Tier-table updates (folds Chris's verdict round into the audit)

| Card | Was | Now | Price | Why |
|---|---|---|---|---|
| Mother Bear | 1 | **2** | 18 | Chris's verdict |
| Little Bear | 1 | **2** | 24 | Chris's verdict |
| Restoration Angel | 3 | **2** | 30 | Chris's verdict |
| Mystic Snake | 3 | **R** | — | gold-cards-are-R rule (Chris); R-acquisition mechanism to come |
| Faerie Formation | — | **3** | 60 | new; tier-3 signature |

**Floor-consistency flag (Chris's call):** the signature floor ("a tier-N beast's card sits at shopTier ≥ N") has two violations once the Baloth is a tier-2 signature — **Boggart Brute** (tier-2 Warband signature, currently T1/16g) and **Rumbling Baloth** (currently T1/20g). Recommend promoting both to T2 (24g / 30g) for the rule's sake; the alternative is accepting vanilla-weak signatures as exceptions. My lean is promote — the rule is about the fiction (the beast's card is never cheaper in the next town over), not the card's power, and the price deltas are small.

Resulting distribution: T1 ×52 · T2 ×31 · T3 ×11 · R ×2 (+Lotus, +basics) with both promotions, before any future R additions.

## What rides to the implementer (S19 brief material)

1. Catalog entries ×5 (spoke, tier, `kind: beast`, parley voice, buyable per verdict, deck refs) + decklists into `expansion-decks.ts`; lair-host reassignment (U → Formation); W1 Tactician retirement or retention per verdict.
2. Faerie Formation card def + token def + re-verification (blocker; activation cost specifically), `art:fetch`, pool/printings registry rows.
3. Five bestiary plates + chip crops (ADR-066 full-body discipline — the rat plague is a *mass*, not a rat; the Formation is a *throng*, not one faerie) + the Faerie token art.
4. Tier-table implementation per the audit (registry column, stock filter, multiplier knob) with the updates above folded in.
5. World-sim on the 16-signature roster — **after the concern-0 gate re-run** — reporting per-opponent tables against tier expectations; the five new decks' tier-appropriateness is measured there, and the Nighthawk/Warband adjustments happen against the same post-fix tables. Watch item: the Formation AI's activation discipline (it should bank toward the engine when the board is stable — if it never activates because casting always wins the greedy comparison, that's a pin candidate, not an evaluator project).
