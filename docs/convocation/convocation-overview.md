# The Convocation — an overview (for the implementer's introduction)

*Planner + Chris, 2026-10-01. Read this first; then `convocation-formats-draft-2.md` (the formats as data) and `convocation-open-lists-draft-2.md` (the Open's seed decks); the S46 brief is the pool round that gives the first format a measured metagame. Nothing here is a build order — S47 is the scoping session, and its job is to turn this into one.*

## The idea
A second game mode beside the campaign: **a tournament**. The player enters an event with a field of AI competitors, builds a deck under the event's rules, and plays a Swiss ladder — rounds of best-of-three matches — toward a final table of eight. The shape is the Pro Tour's by default: a draft and three Limited rounds, five Constructed rounds, a second draft and three more Limited, five more Constructed (sixteen rounds), then a Top 8 in one of the formats. Stages are modular: the mix of Limited and Constructed, and which Constructed format, can vary per event, so two Convocations are two different games.

Why: the campaign's phase two proved that **deckbuilding constraints are gameplay** — the strongholds' colour gates and the courts' shape gates were the fun. A tournament is that idea as a mode: every event is a new constraint, every round a new opponent, and the ladder's difficulty is the campaign's own vocabulary (life, basics in play, a signature in hand) rising with the round. Shandalar had a primitive Limited engine; this is the version the campaign's machinery makes possible.

## What it stands on (already built)
- **The door-rule engine** (S37/S40): `checkDeck` with colour, count, fraction, ban and stat rules — a Constructed format is a rule set plus a pool filter. The editor validates live; the parley/telegraph refuses. Formats need three more fields (copy caps with restricted/banned lists, tier bounds, a pool filter).
- **The resolver** (S34/S38): `resolveMatchup` turns a seat into life, profile, entrance and ante from tables — the ladder's difficulty is a table indexed by round.
- **The Lab** (S33+): any deck against any deck at any entrance, N games, in a worker pool, saved runs — the background tournament's engine and the format's test bench.
- **The deck editor** with several saved decks per save and a legality panel; the salvage assembler (a builder from a fixed pool with a curve) — the AI builder's ancestor.
- **The pool's tiers** (1 / 2 / 3 / R) — rarity for boosters and for tier formats (Pauper, Peasant).
- **The gallery's unlock rule** — the shape of "the player's pickable pool is a subset of the AI's legal pool," left as a hook for a later campaign linkage.
- **Forty-odd authored lists** (the mages, the beasts, the seats, the yardsticks, the Open's twelve) — the Constructed AI's library.

## What has to be built (the three AI pieces and the bookkeeping)
1. **Match play** — best-of-three, play/draw by the previous game's loser, sideboarding between games (the AI's sideboard is its unused playables; its sideboarding is a few shape-keyed rules); a match seed; a **draw rule** (a mill mirror that empties both libraries is a result).
2. **A standings engine** — Swiss pairings by record, tiebreaks, a Top 8 bracket. The background field's matches are real (one best-of-three each at the tournament's seed; a knob for more games and a biased coin).
3. **A builder from a fixed pool** (Limited) — two colours by rated playables (tier and price as the base rating), a curve fill, seventeen lands by pips, the Lab's stats as the check. The floor of the AI's deck is what the ladder's entrances compensate for.
4. **A drafter** — the same rating plus a colour-commitment bonus and a curve term; packs from a **recipe** (slots × tier weights) drawn from a **set** (a pool subset). Sealed needs no drafter and ships first.
5. **A Constructed builder by select-and-repair** — choose the authored list that best fits the format, cut what the rule forbids, fill from the pool by rating and colour; add noise (same-role swaps, a land ±1) so five seats on one archetype are five variations.
6. **The ladder** — `convocationEntrance[round]`: Day 1 flat, Day 2 a linear ramp, the Top 8 its own three steps; the human seat never gets an entrance.
7. **Prizes and the event's frame** — entry, the field's names and faces, the standings screen, the prize structure by finish (1–8). The event is **the Convocation**; the final table's name is open (the Umbel is the planner's lean).

## The staged plan (each stage shippable and measurable)
1. **S46** — the Open as a real `Format`; five cards; the twelve lists in the Lab; the first round-robin. *A measured format before any engine.*
2. **S47 — scoping** (this introduction's purpose): survey what the editor, the Lab's worker pool, the resolver, the match controller and the save expose; estimate the seven pieces; propose the order.
3. **Sealed, single event** — six packs, the AI builder, three Swiss rounds against seven AI seats at rising entrances, a prize. No drafter, no Constructed.
4. **Match play and the standings engine** generalised; a sixteen-seat field.
5. **The drafter.**
6. **Constructed by select-and-repair** against the Open's library; then the tier and gate formats (their rules exist).
7. **The full ladder** — mixed stages, the Top 8, prizes, a hundred-seat field.

## Deferred on purpose
- The campaign ↔ Convocation linkage (the player's pool as the cards they've met; the Convocation as a world event at a town; prizes into the campaign). The hook stays; the value waits until the mode exists.
- Formats that need a word or a card the pool lacks (§1.8 of the formats doc).

## Questions the scoping should answer
- Where does a **match series** live — a controller beside the world's and the single match's, or a wrapper over the single match?
- Can the Lab's worker pool run the **background field** while the human plays, and at what seat count per round?
- What does the **AI builder** need beyond the salvage assembler and the tier/price rating — a curve target per format? a synergy table?
- What does a **Format** object carry so the editor, the Lab, the builder and the ladder read one source?
- What does the **save** hold for an event in progress (the pool, the deck, the standings, the seed), and can an event be resumed?
- What is the **draw rule** and how does the standings engine score it?
