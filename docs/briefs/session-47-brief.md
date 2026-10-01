# Session 47 brief — the Convocation, scoped

*Planner → Implementer. 2026-10-01. Follows the running handoff.md (after S46) and its first read. Reads `convocation-overview.md`, `convocation-formats-draft-2.md`, `convocation-open-lists-draft-2.md`. A scoping session: the deliverable is a plan and two small pieces of data, not an engine. Process rules unchanged.*

## Part 0 — Rulings and ADR appends
- **S46 Deviations 1–6 ratified.** The lists' source of truth in `sim/open-decks.ts` (gitignored `analysis/` cannot be pinned); the round-robin as its own CLI; Angelic Destiny's words; the Baloths' mandatory landfall; the Loop in Mardu.
- **ADR-144 — The Open's first metagame stands.** The Levy at 68% is the format's best deck, not a solved format: two lists hold it near even (the Wurmspeaker, the Coin), and its engine is the tier-3 round's printing. No restriction, no amendment. **The bottom rows are pilot floors** (the Undertow, the Larder, the Locks, the Tally): the heuristic prices mill, reanimation and counters crudely (ADR-118's family); their numbers are not a verdict on the lists. The Loop's 55% is an aristocrats deck's; a loop-aware Altar rule is AI work for after the mode exists.
- **ADR-145 — The Convocation's architecture (from the implementer's S46 read, ratified):** a **match series** is a wrapper chaining single-match controllers (the world's `start → finish` pattern one level up), sideboarding a screen between games; the **background field** runs on the Lab's worker pool; the **ladder** is `convocationEntrance[round]` read through the resolver; an **event in progress** lives under its own save key beside the campaign's; the **editor** serves Limited with a pool source and destination of its own; **pack recipes** are data over the tiers.

## Part 1 — The plan (the session's deliverable: `docs/convocation-plan.md`)
A build order with estimates for the seven pieces (the overview's list), in the staged order (Sealed single event → series and standings generalised → the drafter → Constructed by select-and-repair → the full ladder), each stage naming: what it touches (files), the new types, the screens, the save key's shape, the tests, and what the Lab can measure of it. Answer the overview's six questions in it. Mark the risks: the workers' lifetime inside the world's screens; the card rating; the draw rule.

## Part 2 — The card rating, v0 (data, not a builder)
Produce `data/convocation/card-rating.json`: a quality number per card, distinct from `shopPrice` (which is mana value × tier — rarity, not quality). First version, measured not guessed:
- From the Open's round-robin and the campaign sweeps already on disk (`analysis/runs/*`, `results/*`): for every card, its **presence-weighted win contribution** — across all games where a list containing it played, the list's win rate, averaged and centred — plus its cast rate when drawn.
- Blend with a prior by tier so a card that appears in no list has a number (tier 1 → 1.0, tier 2 → 1.5, tier 3 → 2.0, R → 2.5, scaled by the measured spread).
- Report the top and bottom twenty, and the five cards whose rating most disagrees with their tier — the planner reads those by hand. This is the builder's and the drafter's base rating; it will be wrong in places, and the Lab will correct it as the mode plays.

## Part 3 — The pack recipe and the set (data)
`data/convocation/sets.json`: the Plane (everything below prizeOnly), the First Bloom, the Flood, the five colour-pair sets (still pairs), a Pauper set — as id lists or filters; `data/convocation/recipes.json`: Classic, Flat, Rich, Pauper as `slots × weights`. A `pnpm pack --set plane --recipe classic --seed N` that prints a pack, and `pnpm sealed-pool` for six — so the Sealed build in S48 starts with pools that already exist. Validate: no basics in packs, no prizeOnly, no laws, a slot's weights sum to one, a set non-empty per tier it's drawn from.

## Part 4 — The series wrapper, sketched (code if cheap, else the design)
`MatchSeries` over `MatchController`: best-of-N, the loser of the last game chooses play/draw, a hook between games for a sideboard screen, a series seed deriving each game's, a **draw rule** (a game with no winner — both libraries empty, or a turn cap — is a draw; a series is won at the majority, a drawn series is a draw; standings score a draw as one point of three). If a day's work reaches a headless series test (two heuristic agents, best-of-three, the play/draw rule observed, a forced draw scored), build it; otherwise design it in the plan.

## Part 5 — The event's save key (design)
`convocation-event-v1`: the format and stage list, the seed, the field (seats: name, face, list or pool, record), the player's pool and deck(s) and sideboard, the round and pairings, the standings, the results per match (game seeds and outcomes), the prize state. Resumable; never touching the campaign's key. Which pieces of the world's UI the standings and the match screens can reuse.

## Handoff
The plan; the rating file and its disagreements; the sets and recipes with a sample pack and pool; the series (built or designed); the save key; the implementer's estimate for S48 — **Sealed, a single event**: six Classic packs from the Plane, the AI builder from the rating, seven AI seats, three Swiss rounds at a flat entrance, a prize screen.
