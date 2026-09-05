# Session 29 brief — the mage cleansheet

*Planner → Implementer. 2026-09-05. Follows the running handoff.md (after S28). Rides with three decklist documents: mage-cleansheet-tier1.md, -tier2.md, -tier3.md. Reference files in force: cards.md (178), enemies.md.*

## Where we are

S28 landed: the Heart has roots, the legacy is five flags, the five one-drops are in. `heartLife` was recommended at 40 and Chris's own reads agree — **set it** (Part 0). The mages were the oldest content in the game: fifteen names on five decks built from a 100-card pool. This session rebuilds all fifteen from scratch (portraits and names retained), adds six cards to make the archetypes honest, reclassifies the Tactician, and then runs a sweep so the implementer can tell us what the fifteen actually do to each other and to the starters.

Process rules unchanged: decisions.md append-only (appends to `docs/decision-updates/s29.md`); fuzz before fixtures; every AI change carries a ladder delta or reverts; no card facts from memory — the six adds carry ⚠ where the planner has not Scryfall-verified; **re-verify every text by curl before encoding**, as in S28, and encode Oracle verbatim from the first printing named.

---

## Part 0 — Rulings and ADR appends (docs/decision-updates/s29.md)

- **Knob:** `heartLife` 35 → **40** (easy 35 / hard 45). `pnpm knobs:doc`, `pnpm reference`.
- **Chronicle string:** the fifth-cutting line becomes *"A cutting from every colour."* (it counted cuttings; under ADR-095 it must count colours).

**ADR-099 — The mage cleansheet.** Fifteen mage decklists rebuilt; portraits and names retained; mages stay at 40 cards. Tier 1: five mono-colour archetypes distinct from every beast of that colour (lifegain, mill, recursion, spells-make-bodies, hexproof auras), apprentice, 8 life, no tier-3 cards. Tier 2: the five flowing pairs (WB UR BR WG UG), journeyman, 10 life, each a cross of two parent lines (three mage-mage, two mage-beast), basics plus two of the pair's Ravnica dual, at most one tier-3 title. Tier 3: the same pairs with the *other* parent lines (one mage-mage, four mage-beast), master, 12 life, anteCount 2, plus one of the pair's ABU dual, one or two tier-3 titles. No gold cards and no prizeOnly cards in any mage deck. Rationale: mages roam; their decks are the card pools the player can win from them; they should each be a different opponent and a different prize, and the flowing pairs are the world's first quiet hint of phase two.

**ADR-100 — The Cunning Tactician is a beast.** kind=mage → kind=beast, spoke W, tiers 1–2 unchanged. White now has beasts at every tier. The five named mages per tier are the mages.

**ADR-101 — Six cards for the archetypes (pool 178 → 184).** Soul Warden, Hedron Crab, Young Pyromancer, Arc Mage, Altar of Dementia, Blanchwood Armor. Each exists to make one tier-1 deck honest; none is breadth. The Lumberjack has no mage home in phase one (no flowing pair holds Forest and Mountain) and is shop-only until phase two — ratified.

**ADR-102 — The Altar loop is a designed line.** The Usher + Restoration Angel + Altar of Dementia is an infinite mill-and-drain that requires the response window (sacrifice Resto with its blink trigger on the stack). It is intended: a stack-timing combo whose pieces are spread across a tier-1 white ante, a tier-1 blue ante, and a petal prize. The engine must support it; the AI need not find it.

---

## Part 1 — Engine words (R-092)

| Word | For | Shape |
|---|---|---|
| Cast trigger (own spells, filtered by type) | Young Pyromancer | a SPELL_CAST collector on the caster's side with a type filter (instant/sorcery); resolves before the spell (CR 603.2 — the trigger goes on the stack above it) |
| Divided damage, 1–2 targets | Arc Mage | ride the existing modality: modes {2→A}, {1→A, 1→B}; the AI's split rule is in Part 4. CR 601.2d: divide as you cast/activate, at least 1 per target |
| X = the sacrificed creature's power | Altar of Dementia | read from the cost's object (last-known information, CR 608.2h) |
| Landfall | Hedron Crab | **none** — Yuloke's land-enters trigger (Chris) |
| "Another creature enters" lifegain | Soul Warden | none — the Valkyrie's trigger with a wider filter |
| Per-Forest count | Blanchwood Armor | none — Gaean Wurm's count |
| Elemental token | Young Pyromancer | a new token def (1/1 red Elemental); tokens.md regenerates |

If divided damage does not fit the modality path cleanly, say so and encode "2 damage divided" as the two modes above rather than a general divider; the general word can wait for a card that needs three targets.

## Part 2 — The six adds

| Card | Colour | First printing | Tier / price | Verified |
|---|---|---|---|---|
| Soul Warden | W | Exodus | 1 / 8 | ⚠ |
| Hedron Crab | U | Zendikar | 1 / 8 | ⚠ |
| Young Pyromancer | R | M14 | 2 / 12 | planner-verified |
| Arc Mage | R | Nemesis | 2 / 16 | planner-verified |
| Altar of Dementia | — | Tempest | 2 / 16 | ⚠ |
| Blanchwood Armor | G | Urza's Saga | 1 / 12 | ⚠ |

The texts as the planner has them are in mage-cleansheet-tier1.md. Art and oracle via `pnpm art:fetch` from the printings named. Pool-registry Session 29 section (+6). None prizeOnly. All are kindling and stakes.

## Part 3 — The fifteen decks + the Tactician

Encode the fifteen lists from the three documents exactly (every id validated against the pool; if a list fails validation, substitute the nearest pool card and report it — do not silently change a count). Deck ids: retire A–E; one deck per mage, named for the mage. Tier/life/profile/anteCount as the documents state; roaming rules unchanged (mages roam anywhere; tier 1 civilized rings, 2 the approach, 3 the wilds). The dungeon templates that borrowed mage decks (enemies.md line 21) take the new deck of the same mage.

The Tactician: kind=beast, spoke W. Anything keyed on kind=mage for the Tactician (spawn tables, the encounter line, the ante rule) follows the beast path now; report any string that reads wrong afterwards.

Data checks the planner wants: Reya Dawnbringer's row reads tier 1 / 40 in cards.md — confirm whether that's the def or a reference bug; a nine-drop reanimator should be tier 3. Siege-Gang Commander is tier 3 (confirmed from cards.md); Serra Angel tier 3.

`pnpm reference` → cards.md (184), enemies.md (fifteen new lists, the Tactician moved), tokens.md.

## Part 4 — AI (each change pinned; ladder delta or revert)

- **Mill as a win path:** when the opponent's library is within reach of the deck's mill (Crabs × lands in hand, Adepts, Traumatizer, Altar × board power), value mill actions as damage against the library and prefer them over attacks that don't close. Verify the Traumatizer's existing valuation generalises; if it was card-specific, make it a library-clock heuristic.
- **Altar:** sacrifice for mill when the library is in reach of the board's total power; otherwise sacrifice a creature that is about to die (in combat, or to a removal spell on the stack). Never sacrifice the last blocker while behind on board.
- **Arc Mage split:** if 2 kills a creature, kill it; if two 1-toughness creatures, split; else face. Discard lands first while the hand still casts; then Brute Force; never the Pyromancer.
- **Young Pyromancer:** with the Pyromancer in hand and a quiet board, cast it before the cheap spells; with it on the table, cast cheap spells at the end of the opponent's turn when they do nothing else.
- **Wrath with a Blood Artist out (Vael):** the drain is counted in the Wrath's value.
- **Ysolde's two plans:** Anthem when ≥ 3 creatures are out; Armor when a hexproof body is out; Raise the Alarm at instant speed.
- **Reya:** the upkeep return targets the best creature in the yard; the AI casts Reya when it has nine mana and a yard, not as a 4/6 flier.
- **Quill's Altar-on-a-Wurm:** the mill-clock heuristic above should make this automatic; pin it (a Gaean Wurm sacrificed for lethal mill).
- **Spirit Link** and **Unearth** policies from S28 apply unchanged.

## Part 5 — The sweep

After fuzz and fixtures, run three round-robins with the ladder harness (100 games per pairing, both seats, the tier's profile, the tier's life for both sides unless noted):

1. **Tier by tier:** the five mages of each tier against each other (10 pairings × 3 tiers).
2. **Teachers vs starters:** each tier-1 mage against each of the five starters at the starters' life. The documents say which starter each is meant to punish — report whether the table agrees.
3. **Children vs parents:** each tier-2 and tier-3 mage against its two parent lines (the parent mage at tier 1 settings; the parent beast at its own).

Report per pairing: win rate, mean turns, and for the mill decks the share of wins by library. Then the read the planner wants: any pairing over 80/20 or under 20/80 within a tier (a deck that dominates or folds), any tier-1 mage that does *not* beat the starter it was built to punish, and anything surprising — a cross that plays like neither parent, a card that never gets cast, a deck whose plan the AI can't execute (the mill decks and Ysolde are the ones to watch). No decklist changes on your own; report and the planner amends.

## Part 6 — Fixtures

- The Altar loop: Usher + Resto + Altar, four iterations by script, opponent's library and life both tracked; the Usher's delayed end-step sacrifice on the returned Resto must not interfere; the "may" stops it.
- Pyromancer: a trigger per instant/sorcery, none for creatures, resolves before the spell; a countered spell still makes the token.
- Arc Mage: both modes; cannot choose zero targets; discard as cost.
- Altar: X = power at the time of sacrifice (a Giant Growth in response counts).
- Hedron Crab: Evolving Wilds triggers twice (the Wilds, then the fetched basic); Rampant Growth triggers.
- Soul Warden: triggers on the opponent's creatures too, and on tokens.
- Blanchwood Armor: Temple Garden counts.
- Legacy: the Chronicle string.

## Verification & handoff

- Fuzz the fifteen decks (every tier, both seats, the three law modes where the dungeon templates apply) before fixtures; replays byte-exact.
- FUZZ_FULL ladder gate and the vs-random ladder for every AI change.
- Test baselines: def count, shop-tier counts, the enemies table.
- Handoff in the running handoff.md: the sweep tables in full, deviations, concerns, the registry section (178 → 184), any strings that need the planner's pen.

## Out of scope (S30+)
Phase two design. The deckbuilder. Black's unconditional removal (still with Chris). The Manafleur-aware master. The Lumberjack's home.
