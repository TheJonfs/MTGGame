# Phase Two — The Flood (design, draft 1, table filled 2026-09-15)

*Planner, 2026-09-15. For Chris's holistic read before anything goes to the implementer. Everything here is either fixed by Chris in conversation (marked **fixed**), the planner's recommendation (**proposed**), or open (**open**). Companion to `five-powers-design.md`, `the-bloom-gauntlet-v1.md`, `stronghold-bosses.md`, `mox-court.md`, and `planner-notes-tuning-arc-shipped.md`.*

---

## 1. Premise

**The flower was a dam.** (fixed, Chris: "I like the flood.")

The Manafleur stilled the plane's mana. Its five roots held the five *still* pairs — the courts of phase one — and its laws are how mana is stilled on this plane. The player has now cut all five roots. What the flower held back is loose: mana flows in the enemy-colour currents, and the *flowing* pairs dominate a plane that has been inundated. The five new lords are those who rose in the flood and learned to wield the laws as dams of their own. The phase-two Heart is what grows from the flood — a flower that no longer stills but **accumulates** (§7).

**The three-act spine** (proposed): phase one, you cut the dam. Phase two, you survive the flood. Phase three (the horizon, not designed here), you plant the flower anew — the act in which the player earns a copy of the Manafleur and, with it, the laws, when the challenge has risen to meet it. The laws stay the world's alone through phase two (fixed, Chris).

**What the player has done to the plane:** the antagonist of five runs turns out to have been holding back something more dangerous than itself. The Chronicle's tease after the fifth cutting is paid off here.

## 2. Structure

- **One journey, not five resets** (fixed, Chris, with the diversification condition below). Five resets from an identical legacy would converge every run on the same deck; one long run lets the legacy be the foundation of a deck that grows across ten bosses.
- **Diversification is enforced by the world, not the reset** (fixed): the strongholds impose deckbuilding rules that force the player to revector from within the collection (§5). The deckbuilding *puzzle* is the phase's gameplay identity.
- **Open progression, not serial** (proposed): five territories, three rings, quests between towns, roaming enemies as danger and income — the phase-one loop recycled (fixed, Chris: recycle the good machinery, make the experience distinct). The triad gates give structure without a rail; a player routes by what their collection can dress for.
- **A new map, no door on the old** (proposed, from Chris's lean): the flood is the door. Phase two starts on its own map; the phase-one world is reached only by starting a new road.
- **The phase-one legends do not appear** (fixed, Chris) except the ten the player carries. The other face of the plane, only; the unification of the twenty is phase three's.

## 3. The map — the flooded plane

- Generated from a phase-two seed by the existing generator (fixed: the world already draws terrain and locations from a seed and a name list). Same five coloured territories, same three rings, so the motifs hold; a new town-name list for the flood; palette to water and dusk (proposed).
- Terrain reads: roads become fords and ferries; low towns drowned and renamed; the wilds are marsh (proposed; content).
- **The Calyx** (proposed name): the flooded plane's counterpart to the Corolla — the sepals beneath the petals, the underside shown by the water. Where the phase-two Heart is met (§7). Structure open.
- Lairs, sieges, quest boards, shops as phase one, with phase-two stock (§9).

## 4. The ten legends — five lord/court pairs under five laws

Every colour has two triads; phase one used one per colour. **Phase two's five lords are the other five triads** (fixed), each wielding **the same law** its phase-one counterpart did (fixed: the white law is still the Intake). Each lord's court is its pair — so **the phase-two petal courts are the five flowing pairs** (fixed: "a UR boss that plays off the Intake the way Seraphina did for the Warden"). Authored **in pairs** (fixed): one law, one lord, one minister.

| law (colour) | phase-one lord (triad) | phase-two lord (triad) | phase-two court (pair) |
|---|---|---|---|
| the Intake (W) | the Warden (W·bg) | W·ur — Jeskai | UR |
| the Tithe (B) | the Usher (B·rw) | B·ug — Sultai | UG |
| the Toll (R) | the Stoker (R·ub) | R·wg — Naya | WG |
| the Risen Tide (U) | the Unwinder (U·rg) | U·bw — Esper | BW |
| the Season (G) | the Sower (G·wu) | G·br — Jund | BR |

(Fixed, Chris, 2026-09-15. Each colour's phase-one triad is a shard or a wedge and its phase-two triad is the other; the five phase-two courts are exactly the five flowing pairs. Lumen, RW, plays at the Jeskai and Naya doors; a Sultai minister at one.)

**Lords** (proposed): a different spin on the law than the phase-one lord — the WUR lord leverages tapped creatures differently from the Warden (Chris's example). Stronghold fights with the lord's law in play and the signature to hand (the phase-one shape), at phase-two life.

**Courts** (fixed, Chris, "might"; planner treats as the working assumption): the five new petal bosses serve the *Mox court's* purpose rather than a gauntlet before the Heart — they guard new cards or powers, so they stay relevant across the whole journey. They have their law available (fixed). They impose a **shape** rule at the door (§5), not a colour rule.

**Signatures**: ten new custom legends (five lords, five ministers), the phase-one authoring rules (no WotC proper nouns; the ink-and-wash pipeline; portraits; parley lines in the archaic register). Content round, not this doc.

## 5. The deckbuilding puzzles

**Strongholds — the colour gate** (fixed, Chris: "a good filter"): the deck brought to a phase-two stronghold must be within the lord's triad — cards whose colours are a subset of the three, plus colourless. Five strongholds, five triads, five forced revectors from one growing collection. The carried legends each fit some doors and not others: a two-colour minister fits two triads (Lumen, RW, plays at both the Jeskai and Naya doors — Chris's example); a three-colour one fits one.

**Courts — the shape gate** (proposed, from Chris's lean "yes, but not colour"): a deckbuilding rule about the deck's *shape* rather than its colours, one per court, ideally law-flavoured. Candidates (open, content): a minimum creature count (the Intake's court, UR — "you must bring bodies to be tapped"); a maximum land count (the Tithe's, UG — "you pay from what you hold"); a mana-value ceiling (the Toll's, WG); a maximum hand-of-copies or a singleton rule (the Risen Tide's, BW); a deck-size floor or a minimum land count (the Season's, BR). All open; law-flavoured is the aim, not a requirement. The strongholds ask *what colours*; the courts ask *what shape*.

**The Heart — no gate** (proposed): the journey ends with whatever the player has become.

**Engineering**: a `deckRule` on the opponent template (`colorsWithin: [W,U,R]`, `minCreatures: 15`, `maxLands: 12`, …), validated by the deck editor and at the door (the parley refuses a deck that fails, naming the rule). See §10.

## 6. The start — the salvage

**Prescribed, not a shopping trip** (fixed, Chris's lean; the flood forecloses the interval). What the player carried out of the water:

- **Fixed:** the ten legends (the five carried ministers, the five power guardians) and a purse (knob).
- **The deck — three shapes, Chris to pick** (open):
  1. *A flowing-pair starter* — five new thirty-card starters keyed to the wedge pairs; the pair is the first commitment and pulls toward two of the five strongholds.
  2. *A sealed salvage* — a defined per-pair pool (e.g. forty cards from the shop tiers, seeded per run) the player builds from; the pool is the tuning knob; the deckbuilder's first real use is before the first duel.
  3. *A starter plus picks* — a flowing-pair starter and N picks from the salvage pool. **Planner's recommendation.** A floor for the player who wants to move, a choice for the one who wants to build.
- **A thread of continuity** (proposed): at the flood, the phase-one save's last deck is shown as what was lost, and one or two cards from it are salvaged as the player's choice. Continuity as a moment, not a mode; tunable at zero cost.
- **Manalinks**: the player starts with none beyond the legacy's fixed terms (open: whether the flood grants a phase-two manalink kind — a card to hand at duel start, a token in play — is content; the vocabulary exists).

## 7. The Heart of the flood

**Same flower, dark reflection** (fixed in spirit, Chris: "some extension of the Manafleur … five and twisted mana and the laws"). Proposed rule: **the ring stops forgetting** — the phase-two Manafleur's law sequence *accumulates* (the previous law is not exiled when the next is created), so by the third law the player fights under three at once. One knob (`heartLawsPersist`), no new vocabulary, and the mechanical reading of "what the flower was holding back."

Open: its name and aspect (a second bloom, a drowned flower, a flower of the Calyx); whether it carries a phase-two-only sixth petal; its life and roots (the resolver's phase-two bundle, §8); whether it mirrors the player's manalinks.

## 8. Difficulty — the resolver's fourth column

Phase two is a mode in the matchup resolver (fixed by ADR-115's design; proposed values): a `phaseTwo` bundle on `mageTierLife` / `mageTierEntrance` / `beastTierLifeDelta` (e.g. T1 12/1, T2 16/2, T3 20/3; beasts +4/+8/+12), Easy/Standard/Hard applied on top as today. `legacyTerm()` remains the hook for an adaptive term reading the deck at duel time (colours, legends present) rather than the route — every phase-two player carries the same ten legends, so route-reading is moot. Measured in the Lab before ratification, as the tuning arc did.

## 9. The roster of the flood

- **Mages — inverted** (proposed): the phase-two tier-2/3 mages take the five *still* pairs (the pairs phase one's courts held), so "the only multicolour opponents were bosses and random mages" is true again, mirrored. Fifteen new lists over the existing archetype lines; names and portraits for the flood (content). Tier 1 stays mono.
- **Beasts** (open): the same bestiary at phase-two deltas, or a partly new one (marsh and water beasts). The cheap version first.
- **Shop stock** (open): the phase-two shop tiers and R table; new cards for the flood are a content decision — the pool is 198 and the phase-one shops already carry it; phase two may want a few flood-flavoured additions and the *rest of the ten pairs'* duals as tier-2 stock.
- **Quests, lairs, sieges**: the phase-one machinery with phase-two text (content).

## 10. Engineering sequence (proposed)

1. **The deckbuilder** — several saved decks per save, a legality check against a `deckRule`, and the collection screen it already has. Needed by the strongholds (§5), by the salvage (§6), and by single-game mode regardless. **First brief.**
2. **The resolver's phase-two bundle and `deckRule` on templates** — data, validation, the parley's refusal line.
3. **`heartLawsPersist`** and a Heart-sim read of the accumulating ring against `chris-road-B`.
4. **The map**: the generator with a phase-two seed, territory palette, and the flood name list; the Calyx's structure.
5. **The salvage** start (whichever shape is picked) and the flood scene (the phase-one deck shown as lost; the picks).
6. **Content rounds** (planner + Chris, then implementer): the five lord/court pairs (§4), the mage inversion (§9), the courts' shape rules (§5), the Heart's aspect (§7), shop stock, town names, quest text.
7. **Sweeps and the Lab** at the phase-two bundle; a clean playthrough by Chris.

## 11. Open questions (honest list)

1. The salvage's shape (§6, three options).
2. The courts' shape rules, one per court (§5).
3. The Heart's name, aspect, life, roots; a sixth petal or not (§7).
4. The Calyx's structure — a ring of five courts around the Heart as the Corolla was, or the courts scattered as the Mox court is (§3).
5. Beasts: same bestiary or partly new (§9).
6. A phase-two manalink kind at the start (§6).
7. The map's entry scene and the flood's first town.
8. Whether phase two's completion writes a second row to the legacy (a "second cutting" flag) and what, if anything, carries to a phase-three or to new phase-one roads.

## 12. What this doc does not decide
Card texts, names, portraits, town names, quest text, the exact tables — every content item goes through the pairs-and-rounds process the Bloom Gauntlet used, after the structure above is ratified.
