# Session 48 brief — Sealed, a single event

*Planner → Implementer. 2026-10-02. Follows the running handoff.md (after S47) and `docs/convocation-plan.md` stage 1. One session, tight; one and a half honest (the plan's estimate). The order below is the implementer's — the risky piece first. If something must be shed, shed the prize screen's content, never the save. Process rules unchanged: appends to `docs/decision-updates/s48.md`; every AI change carries a ladder delta or reverts.*

## Part 0 — Rulings and ADR appends
- **S47 Deviations 1–9 ratified** with the rulings: Rich's rare slot = 2 × {3: 0.6, R: 0.4}, 4 × {2: 0.8, 3: 0.2}, 9 commons; the series ends at two wins, a drawn game plays on to the third, no majority after three is a draw, game one's coin winner **chooses** (the AI chooses play); Flat rolls down a tier when a set is short; the Flood stays the Plane under Rich for now; the prize prior at R.
- **ADR-146 — The power list gains the Manafleur and the Cinquefont**: the two law-makers never draft (five-colour capstones are the campaign's). The other thirty legends stay at the rare slot's share.
- **ADR-144 amended**: the Undertow at 38% with Clio is competitive; the Larder is the remaining pilot floor.
- **ADR-147 — A Sealed event's prize is the ledger** (the campaign linkage deferred): the profile's `convocation` record holds every event played — the format, the seed, the field, the finish, the deck — and that record is the hook a later linkage reads. Real prizes arrive with the ladder.
- **The rating v0 is the builder's prior**; the Sealed sim is its first update (Concern 2).

## Part 1 — The editor's pool source (first — the overrun risk)
The deck editor takes a **source object** in place of `world.player.collection` / `world.decks`: `{ collection, decks, activeDeckName, save(decks) }` — the world provides its own today, an event provides its pool and its one deck. The legality panel takes the event's `Format` (`kind: "limited"`: 40 minimum, the pool as the collection, basics unlimited). The spares grid, the counts, the stats and the door picker unchanged. Pinned: the world's editor behaves exactly as before (the S37/S38 controller tests); an event editor over a sealed pool saves to the event, never the world.

## Part 2 — The Limited builder and the Sealed sim
- `buildLimitedDeck(pool, rating, format) → Decklist`: colour pair by the sum of rated playables (a third colour only as a splash with two fixing sources — Wilds, duals in the pool); a curve target (two-drops ≥ 5, three-drops ≥ 4, a cap on six-plus); creature count ≥ 13; seventeen lands split by pips (16 at a low curve); the Lab's stats as the check. Deterministic for a seed.
- **`pnpm sealed-sim --pools 200 --games 10`**: pools from the Plane / Classic → decks by the builder → a round-robin sample (each deck against twenty others) → the deck win rates, the pair chosen per pool, the curve histogram, and **the rating's update**: a card's lift in built decks (no author to confound it), blended into v1 at the brief's weights. Report the twenty cards that moved most between v0 and v1 — the planner reads them. The builder's own check: no deck under 40, no deck with fewer than 15 lands, no three-colour deck without fixing.
- AI: the seats' decks play with the master; no new books expected.

## Part 3 — The event engine, headless end to end
`packages/world/src/event.ts`: `newSealedEvent({ seed, set, recipe, seats: 8, rounds: 3, difficulty })` — the field (seven AI seats: a name from a Convocation name list ⚠ placeholder, a face from the mage/beast portraits by colour pair, a pool, a built deck), the player's pool; `pairRound` (Swiss by record; round one random by seed; no rematches), `playRound` (the player's series through `MatchSeries` over `MatchController`; the field's six series headless on the Lab's workers if the browser rate allows — **time the worker first** (S47 Concern 4) — else on the main thread between the player's games), `standings` (points 3/1/0, the tiebreak by opponents' match-win %), `finishEvent` (the final standings, the ledger entry). The entrance: flat (the plan's stage 1); the resolver's `convocationEntrance[round]` wired but all zeros. The save key `convocation-event-v1` as designed, resumable at any point between matches; a world save untouched. Tests: a full event headless with heuristic agents in every seat (three rounds, standings, the ledger), saved and resumed mid-round, the player's seat replaced by a heuristic.

## Part 4 — Four screens (in this order; the prize's content last)
1. **The pool and the build** — the event editor (Part 1) over the sealed pool, the format's legality, "Register the deck."
2. **Pairings and standings** — the round, the player's opponent (name, face, record), the table; "Play the match."
3. **The series over the match** — `PlayMatch` under a series banner (game N of 3, the record, play/draw); the sideboard screen between games is the event editor again with the deck's spares as the sideboard (the AI's sideboarding: the S47 plan's shape-keyed rules, or none this session — say which).
4. **The prize** — the final standings, the finish, the ledger line; a card from the pool to keep if the ledger is all the session reaches (a placeholder for the linkage).
The entry point: a "Convocation" door on the start screen beside the campaign and the single match; "a Sealed Convocation of eight" is the one event this session.

## Part 5 — Text (planner; Chris's pen)
- The event's name on the door: *"A Convocation — Sealed, eight seats, three rounds."*
- Round announcements: *"Round {n}. You are paired with {name}."*; the standings' header: *"The table after round {n}."*
- The finish: *"You finish {place} of eight."* — and for the top: *"The Umbel is yours."* (⚠ the final table's name; placeholder for a single event where the Umbel is the whole field).

## Handoff
The editor's source object and its pins; the builder and the Sealed sim's report (the pair choices, the curve, the twenty movers); the event headless test; the four screens walked in the browser (a full three-round event played as the human with the dev concession); the worker's measured rate; the save key round-trip; deviations, concerns; the estimate for S49 (the series and standings at sixteen seats, the drafter's data).
