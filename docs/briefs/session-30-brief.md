# Session 30 brief — the mages after the sweep

*Planner → Implementer. 2026-09-06. Follows the running handoff.md (after S29). Rides with mage-amendments-s30.md (the diagnosis per deck); the final lists are in this brief and are authoritative where the two differ.*

## Where we are

The S29 sweep did its job: the fifteen decks are distinct, and the table says which ones can't execute their plan at their tier's life. Chris ratified two framing calls and six cards. This session: encode the six, amend nine lists, re-run the sweep, and run two small new measurements (a starter round-robin; per-card cast counts). No AI families change; a few pins.

Process rules unchanged: decisions.md append-only (appends to `docs/decision-updates/s30.md`); fuzz before fixtures; every AI change carries a ladder delta or reverts; **re-verify every card text by curl before encoding** (all six carry ⚠ from the planner) and encode Oracle verbatim from the printing named.

---

## Part 0 — ADR appends (docs/decision-updates/s30.md)

**ADR-103 — The sweep is a diagnostic; the player is the target.** Mage-versus-mage results inside a tier are read for decks that cannot execute their plan, not balanced toward parity; a deck that dominates its tier stands unless it also walls the player. At tier 1 the "punish a starter" intent is calibrated to a real fight — the mage at 35–45% against the starter it targets under the sweep's asymmetry (8-life apprentice vs 10-life journeyman) — not to a win, because a human plays the starter better than journeyman and the tier-1 mage is a teacher, not a wall.

**ADR-104 — Six cards for the floor (pool 184 → 190).** Wall of Blossoms, Wood Elves, Wall of Air, Buried Alive, Reassembling Skeleton, Thought Scour. The pattern the sweep found is one shape in three colours — the weak decks need a cheap body that holds the ground while the plan runs — and the pool had none. The rest enable one deck each (Buried Alive: the reanimator; the Skeleton: recursion at 8 life; Thought Scour: mill that replaces itself). Ponder and Drudge Skeletons considered and passed.

**ADR-105 — Nine lists amended** (Part 2). Oriel, Vael, Brennor, Varro, Sorrel, Ysolde unchanged.

---

## Part 1 — The six adds (R-093 where words are needed)

| Card | Colour | Printing ⚠ | Text as the planner has it ⚠ | Tier / price | Words |
|---|---|---|---|---|---|
| Wall of Blossoms | G | Stronghold | {1}{G} 0/4 Plant Wall. Defender. When it enters, draw a card. | 1 / 12 | **defender** (a keyword: can't attack; the AI never attacks with it; the UI never offers it) |
| Wood Elves | G | Portal / Exodus — take the earliest printing Scryfall carries art for | {2}{G} 1/1 Elf Scout. When it enters, search your library for a Forest card, put it onto the battlefield, then shuffle. | 1 / 12 | none — Evolving Wilds' fetch-to-battlefield; note *untapped* and *Forest card* includes Breeding Pool / Temple Garden / Tropical Island / Savannah (subtype match, as the Lumberjack's sacrifice) |
| Wall of Air | U | Alpha | {1}{U}{U} 1/5 Wall. Defender, flying. | 1 / 12 | defender (same word) |
| Buried Alive | B | Weatherlight | {2}{B} Sorcery. Search your library for up to three creature cards, put them into your graveyard, then shuffle. | 2 / 16 | **search-to-graveyard** — Demonic Tutor's search with a graveyard destination and "up to three" (a small variant of the tutor word) |
| Reassembling Skeleton | B | M12 | {1}{B} 1/1 Skeleton Warrior. {1}{B}: Return it from your graveyard to the battlefield tapped. | 1 / 8 | **an activated ability usable from the graveyard** — one real word: a permanent card in the yard exposing an ability; enters tapped |
| Thought Scour | U | Innistrad | {U} Instant. Target player mills two cards. Draw a card. | 1 / 8 | none |

Pool-registry Session 30 section (+6). None prizeOnly. Art via `pnpm art:fetch`.

## Part 2 — The nine amended lists (final; 40 / 17 lands / 23 spells unless stated)

**Tessaly Reed (T1, U)** — 15 Island · 2 Evolving Wilds
```
4 Hedron Crab · 4 Cathartic Adept · 2 Traumatizer · 2 Thought Scour · 2 Brainstorm
2 Wall of Air · 2 Essence Scatter · 2 Counterspell · 1 Boomerang · 2 Altar of Dementia
```
(out: 2 Wind Drake, 1 Divination, 1 Boomerang, 1 Traumatizer; in: the Walls, the Scours, +1 Scatter, +1 Counterspell)

**Pale Edric (T1, B)** — 15 Swamp · 2 Barren Moor
```
3 Unearth · 1 Zombify · 2 Gravedigger · 2 Vampire Nighthawk · 2 Blood Artist · 2 Indulgent Aristocrat
2 Reassembling Skeleton · 2 Child of Night · 4 Typhoid Rats · 2 Terror · 1 Dark Ritual
```
(out: 2 Gallows Djinn, 2 Phyrexian Rager, 1 Zombify, 1 Gravedigger; in: Nighthawks, Skeletons, +2 Rats). Note the Skeleton + Aristocrat + Blood Artist line: each return costs {1}{B}, so it's a mana-bounded drain, not a loop; the AI's Altar gate ("a doomed creature, or lethal") is the right shape for the Aristocrat's sacrifice of a Skeleton — pin that it sacrifices the Skeleton freely (it comes back) but not into empty mana.

**Brann the Scorched (T1, R)** — unchanged lands
(out: 1 Bonesplitter; in: 1 Pyroclasm). Pin: the AI weighs its own Pyromancer and Elementals before casting Pyroclasm.

**Old Hask (T1, G)** — unchanged lands
(out: 2 Elvish Visionary; in: 2 Wall of Blossoms)

**Pell of the Shallows (T2, UG)** — 7 Island · 6 Forest · 2 Breeding Pool · 2 Evolving Wilds
```
4 Hedron Crab · 2 Traumatizer · 4 Rampant Growth · 2 Wood Elves · 2 Wall of Blossoms · 2 Birds of Paradise
2 Brainstorm · 2 Essence Scatter · 1 Counterspell · 2 Altar of Dementia
```
(out: 2 Blurred Mongoose, 2 Timberland Guide, 2 Cathartic Adept; in: Wood Elves, Walls, +1 Rampant Growth, +1 Altar). Every green card puts a land onto the battlefield.

**Kessa Emberhand (T2, UR)** — unchanged lands
```
3 Young Pyromancer · 3 Arc Mage · 2 Man-o'-War · 3 Lightning Bolt · 2 Shock · 1 Blaze · 1 Hordeling Outburst
3 Brainstorm · 2 Boomerang · 2 Essence Scatter · 1 Counterspell
```
(out: 1 Aether Channeler, 1 Air Elemental; in: +1 Arc Mage, +1 Brainstorm)

**Adept Maelin (T2, BR)** — unchanged lands
(out: 2 Raging Goblin; in: 2 Typhoid Rats)

**Lord Corvane (T3, WB)** — unchanged lands
```
2 Youthful Valkyrie · 1 Inspiring Overseer · 2 Indulgent Aristocrat · 2 Blood Artist · 1 Gravedigger
2 Unearth · 3 Zombify · 2 Buried Alive · 1 Restoration Angel · 3 Serra Angel · 2 Swords to Plowshares · 2 Dark Ritual
```
(out: 1 Terror, 1 Gravedigger, 1 Pacifism, 1 Inspiring Overseer; in: Buried Alive ×2, +1 Zombify, +1 Dark Ritual). AI: Buried Alive takes the three best reanimation targets (Serra, Serra, Resto) when a Zombify or Unearth is in hand or the deck still holds one; the S28 Unearth policy and the Zombify valuation should already price the yard.

**Magister Quill (T3, UG)** — unchanged lands
```
4 Hedron Crab · 3 Rampant Growth · 2 Llanowar Elves · 2 Wood Elves · 2 Wall of Blossoms
2 Gaean Wurm · 1 Pelakka Wurm · 1 Baru, Wurmspeaker · 2 Altar of Dementia · 2 Essence Scatter · 1 Counterspell · 1 Brainstorm
```
(out: 2 Cathartic Adept, 2 Traumatizer, 1 Man-o'-War; in: +1 Crab, Wood Elves, Walls). The mill is Crabs early and the Altar on a Wurm to close; nothing else.

Validate every id; report any substitution rather than making it silently. `pnpm reference` → cards.md (190), enemies.md.

## Part 3 — AI

No new families. Pins: defender never attacks (and the evaluator doesn't price a Wall's power as offence); Wood Elves fetches the dual when one is in the library and the colours want it, else a Forest; Thought Scour targets the opponent (the AI does not self-mill); the Skeleton's return only with mana to spare after the turn's casts, and as a blocker when behind; Pyroclasm vs own board (Brann); Buried Alive's picks (Corvane). Ladder gate + vs-random ladder as always.

## Part 4 — Fixtures

Wood Elves fetches a Breeding Pool untapped and triggers a Crab; Wall of Blossoms draws and cannot be declared as an attacker; Wall of Air blocks a flier; Buried Alive with fewer than three creatures in library; Reassembling Skeleton returns tapped, from the graveyard only, and is a legal Unearth target as well; Thought Scour targeting self and opponent; Pyroclasm killing the caster's own Elementals.

## Part 5 — Measurements

1. **Re-run the sweep in full** (`pnpm mage-sweep --games 100`, all three parts) with **`facts.spellsCast` per deck** added: cast count per card title across the deck's games, and the never-cast list. Report the same tables as S29 and a delta column against S29 for each pairing.
2. **Starter round-robin:** the five starters against each other, 100 games per pairing both seats, journeyman at 10. Ten pairings. Report win rates and mean turns. This is a read on the five roads, not on the mages; no changes follow from it this session.
3. The reads the planner wants: Tessaly and Edric against the starters they target (white and black for Edric; the field for Tessaly) now in the 35–45% band or not; Pell and Quill winning some games by *not* dying rather than by library; Corvane against the Serra Angel beast; anything over 80/20 within a tier that wasn't there in S29 (a new fold created by the amendments); and the starter table's spread.

## Part 6 — Smalls
- The Elemental token plate.
- The epithet stays off the duel rail (Chris's ruling stands as implemented).

## Director round (Chris)
- The Chronicle's phase-two tease: keep it after "A cutting from every colour." (as implemented) or drop it (one string). ⚠ unruled.

## Verification & handoff
Fuzz the nine amended decks at the full tier before fixtures; replays byte-exact. Test baselines (def count, shop-tier counts). Handoff in the running handoff.md with the three tables, the cast counts, deviations, concerns, the registry section (184 → 190).

## Out of scope (S31+)
Starter adjustments (pending the round-robin read). Phase two. The deckbuilder. Black's unconditional removal. The Lumberjack's home.
