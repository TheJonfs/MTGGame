# Session 46 brief — the Open's pool round

*Planner → Implementer. 2026-10-01. Follows the running handoff.md (after S45). Rides with `convocation-formats-draft-2.md` (§1.1 the Open) and `convocation-open-lists-draft-2.md` (the eleven lists, amended below). The Convocation's scoping is S47; this session gives it a measured format to scope against. Process rules unchanged: appends to `docs/decision-updates/s46.md`; re-verify every ⚠ real card by curl; the custom from its text; fuzz before fixtures; every AI change carries a ladder delta or reverts.*

## Part 0 — ADR appends
- **ADR-142 — The Open format** (formats doc §1.1 as ratified by Chris): 60 minimum, 4-of, basics uncapped; restricted at one — Black Lotus, the five Moxen, Time Walk, the five High Grounds, Demonic Tutor, Library of Alexandria; the laws banned; the legends at four; prizeOnly legal for the player; the Manafleur and the Cinquefont legal and watched. Encoded as a `Format` (a `deckRule` set + a pool filter + the lists), the first of the Convocation's formats; the editor's door picker lists it as a format to check against.
- **ADR-143 — Five cards for the Open (pool 233 → 238)**: Entomb, Rampaging Baloths, Ponder, Angelic Destiny (real, ⚠ curl) and **Vitalist** (custom). Held on purpose (Chris): Lightning Helix, Mana Leak, a one-mana sacrifice outlet.
- **S45 smalls**: re-run the lord/court sims whose lists carry Gravedigger or the Usher (the scored return targets) as the new baseline; the Dragon Mage's line restated — *spend before the wheel*; push.

## Part 1 — The cards
| card | printing ⚠ | text as the planner has it ⚠ | words |
|---|---|---|---|
| Entomb | Odyssey | {B} Instant. Search your library for a card, put that card into your graveyard, then shuffle. | zero (Buried Alive's search-to-graveyard at one, any card) — tier 2 |
| Rampaging Baloths | Zendikar | {4}{G}{G} 6/6 Beast. Trample. Landfall — you may create a 4/4 green Beast creature token. | zero + a Beast token def — tier 3 |
| Ponder | Lorwyn | {U} Sorcery. Look at the top three cards of your library, then put them back in any order. You may shuffle. Draw a card. | the putOnTop word from the library's top (half: look-at-N + reorder; the shuffle is a choice) — tier 1 |
| Angelic Destiny | M12 | {2}{W}{W} Aura. Enchant creature. Enchanted creature gets +4/+4, has flying and first strike, and is an Angel. When enchanted creature dies, return Angelic Destiny to its owner's hand. | zero (Rancor's return; the type grant is cosmetic unless the engine keys Angels — Youthful Valkyrie does: honour it) — tier 3 |
| **Vitalist** (custom) | — | {2}{W} Creature — Human Cleric, 1/1. Whenever you gain life, put that many +1/+1 counters on target creature. | **a GAINS_LIFE collector carrying the amount** (half a word; the first trigger on lifegain) — tier 2 |

Art: the four real cards through `art:fetch`; Vitalist through the image skill (a cleric whose vigour passes to whatever she touches; the flood register is not required — the Convocation is the plane's), four candidates to Chris.

## Part 2 — The eleven lists into the Lab (as custom decks, `analysis/decks/open-*.json`, generated from the document by `pnpm open:gen`, pinned by a sync test), with the adds placed:
- **The Larder** (4c reanimator): −3 Thought Scour −1 Duress → +4 Entomb.
- **The Wurmspeaker** (mono-G): −1 Pelakka Wurm −1 Gaean Wurm → +2 Rampaging Baloths.
- **The Tally** (Sparks): −3 Thought Scour → +3 Ponder. **The Locks** (Esper): −2 Brainstorm → +2 Ponder. **The Undertow** (mill): −2 Brainstorm → +2 Ponder.
- **The Enchantress** (auras): −3 Giant Growth → +3 Angelic Destiny.
- **The Ford** (Naya): −2 Wood Elves −2 Char → +4 Vitalist. **The Muster** (Boros): −2 Sacred Helix → +2 Vitalist.
- Every other list as draft 2. `checkDeck` against the Open's rule set for all eleven (the restricted list, the copy cap, the ban).

## Part 3 — AI
- Entomb: the reanimator's target by `reanimationWorth` (the Buried Alive chooser); never without a reanimator in hand or on the board's next turn.
- Ponder: at sorcery speed on our turn (a cantrip, not a window card); the reorder by the hand's needs (lands if short, the top spell if not); shuffle when all three are poor.
- Angelic Destiny: on the hexproof host first (S30's rule); the return is automatic.
- Vitalist: the counters on the best evasive creature we control, else itself; the AI values lifegain cards higher while she is out (a term, not a rule).
- Rampaging Baloths: the token is free — always; lands after him.
Pinned; ladder gates.

## Part 4 — Measure: the Open's first round-robin
The eleven lists, 100 games per pairing, both seats, master both, no entrances; the Lab's saved run `analysis/runs/open_rr_1.json`. Report: the win-rate table, each list's row mean, wins by library for the Undertow, the restricted cards' cast rate per list (a list that never casts its High Ground drops it), and — the read the planner wants — whether any list is over 65% against the field ("solvable"), with the Muster–Warband pairing and the Sparks and Mardu rows called out. No list changes; the planner amends.

Also: the Altar loop's Open list is not in the eleven — build **"the Loop"** as a twelfth from the Usher's Coin (−4 Vampire Nighthawk −3 Meliyan −1 Sacred Helix → +4 Restoration Angel +2 Altar of Dementia +2 Counterspell; a Tundra for a Plains, a Hallowed Fountain for a Plains) and report how often the loop assembles by turn ten in the heuristic's hands (it will rarely find the response-window line — say what it does instead).

## Handoff
The five cards, the format encoded, the twelve Lab decks, the round-robin table and reads, the re-baselined lord/court sims, deviations, concerns — and the implementer's first read for S47's scoping: what a match-series controller, a pool builder and a pack recipe would touch (the editor, the Lab's worker pool, the resolver, the save).
