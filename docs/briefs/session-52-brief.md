# Session 52 brief — Constructed

*Planner → Implementer. 2026-10-05. Follows the running handoff.md (after S51) and `docs/convocation-plan.md` stage 4. One session, with the drafter's cut-reading term alongside. Process rules unchanged: appends to `docs/decision-updates/s52.md`; every AI change carries a ladder delta or reverts.*

## Part 0 — Rulings and ADR appends
- **S51 Deviations 1–7 ratified.** v1.1 is the live rating; the S49 "v2 movers" are struck from the ledger as an artefact of the pooling bug (the forced-pair result stands); the draft of eight seats all in the Umbel; the slope at 0.07 with the cut at pick 8 (23%).
- **ADR-151 — The rating pipeline is tested.** A fixture with two runs whose decks share names asserts their records stay apart; the build's output on the fixture is pinned. The bug cost two sessions silently; the check that found it (the same statistic a second way) becomes the test.
- **ADR-152 — The Constructed player's pool is the format's whole legal pool.** With the campaign linkage deferred, the player builds in the editor over every card the format allows (prizeOnly included — the S47 ruling), or registers a saved deck that passes the format's rule. The campaign's collection as the pool is the linkage and waits.
- **The drafter reads what is passed** (S51 Concern 1, lever (a)) — Part 3.
- Kessa's row stands (+9 against the starters is a better teacher); ADR-150's archived evidence on Entomb and the Adept is watched in the next noise run; the lord, guardian and petal sims re-run once as baselines.

## Part 1 — Constructed by select-and-repair
`buildConstructedDeck(format, rating, seed, library) → Decklist`:
- **Select**: from `authoredLists()` (112) the lists that are *closest* to legal in the format — score = cards legal ÷ cards, ties by the list's measured strength (the Open's round-robin means where known, else the rating's mean); the top five candidates; a seeded pick weighted by score so a field varies.
- **Repair**: cut what the rule forbids (the ban, the restricted list's extras, the colour gate, the type ban, the curve ceiling, the stat floor); fill to the minimum by rating within the list's colours and roles (a creature for a creature, a spell for a spell, a land for a land); meet the floors (creatures, land fraction) by the same fill.
- **Noise**: two or three same-role swaps by rating within ±0.5, a land count ±1 — so five seats on one archetype are five variations.
- **Check**: `checkDeck` against the format; the Lab's stats; a seeded build is deterministic.
- Tests: the Open (every seed yields a legal sixty from the twelve seeds and the campaign's forties); the five gate formats and Pauper from the formats doc (each yields a legal deck; the report says which authored list each started from); a 30-card campaign list repaired to sixty.

## Part 2 — A Constructed event
`newConstructedEvent({ seed, format, seats, rounds, top8 })`: the field's decks by Part 1; the player's by ADR-152 — the editor over the format's legal pool, "Suggest a deck" (Part 1 for the human's seat), or a saved deck checked at registration. The entrance table as the Sealed's (life only — ⚠ Constructed may want its own rows; the Open's turn one is Vintage's); the rounds, the Umbel, the ledger as built. The door offers **the Open** this session (the other formats are data once the builder passes their tests — list them when they do).
Walked in the browser: an Open event with a saved deck and with a suggested one; a reload mid-round.

## Part 3 — The drafter reads what is passed
**Chris's ruling: the AI has perfect memory of every pack it sees** — the whole pack each time, not a colour count; the other three places it is weaker (the picks as a rating, the build on forty-five, the pilot) keep it honest against a human. A seat keeps the packs it has seen; when a pack returns (pick 9+ in a pack of fifteen, every pick in a wheel), the colours of the cards *missing* since it was last seen are the colours being taken upstream; the colours still present are flowing. A term in the pick rule: a bonus to colours flowing toward the seat, a penalty to colours being cut, scaled by how many picks have passed; and a card-level read where the pack supports it (a rated card gone early says more about its colour than a common gone late). Measure with `pnpm draft-sim --vs-sealed`: drafted vs Sealed (was 46%), the share of pods with four or more seats on black (was 29 of 50), the pod's spread (48). The read: drafted decks at or above 50% against Sealed, and black's crowding down. If the term alone doesn't reach 50%, report the builder-on-45 read (the curve mends' cost) as the next lever; no entrance change this session.

## Part 4 — Measure
- The Open's field of fifteen select-and-repair decks (one human seat empty) in a round-robin: how the archetypes spread, the variation within one archetype (the swaps), any list the repair breaks (a deck the rating fills badly).
- The campaign's lord, guardian and petal sims once, as baselines on pilot 92.

## Handoff
The builder's per-format report; the Open event walked; the draft term's three numbers; the rating test; deviations, concerns; the estimate for S53 — **the full ladder** (mixed stages in one event: draft → Limited rounds → Constructed rounds → a second draft → the Umbel in a chosen format; the per-round entrance across stages; the prize structure by finish).
